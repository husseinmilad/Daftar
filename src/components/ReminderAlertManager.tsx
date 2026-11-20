import { useEffect, useState, useRef } from 'react';
import { BellRing, Clock, Check, X, ExternalLink } from 'lucide-react';
import type { AppSettings, Reminder, Task } from '../types.ts';
import { formatDisplayDate, pad2, toPersianDigits } from '../utils/jalali.ts';
import { playNotificationSound } from '../utils/sound.ts';
import { PRIORITY_META } from '../utils/taskFilters.ts';

interface ActiveAlert {
  task: Task;
  reminder: Reminder;
}

interface ReminderAlertManagerProps {
  tasks: Task[];
  settings: AppSettings;
  onCompleteTask: (taskId: string) => Promise<void>;
  onSnoozeReminder: (reminderId: string, snoozedUntilIso: string) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onOpenTask: (task: Task) => void;
}

function isInQuietHours(settings: AppSettings, now: Date): boolean {
  if (!settings.quietHoursEnabled) return false;
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const start = settings.quietHoursStart;
  const end = settings.quietHoursEnd;
  return start <= end ? hhmm >= start && hhmm <= end : hhmm >= start || hhmm <= end;
}

function computeSnoozeIso(minutes: number, customIso?: string): string {
  if (customIso) return customIso;
  const dt = new Date(Date.now() + minutes * 60 * 1000);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

function computeTomorrowMorningIso(): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T09:00`;
}

export function ReminderAlertManager({
  tasks,
  settings,
  onCompleteTask,
  onSnoozeReminder,
  onDismissReminder,
  onOpenTask,
}: ReminderAlertManagerProps) {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [customSnoozeValue, setCustomSnoozeValue] = useState('');
  const triggeredKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const quiet = isInQuietHours(settings, now);
      const dueNow: ActiveAlert[] = [];

      for (const task of tasks) {
        if (task.is_archived || task.status === 'completed' || task.status === 'cancelled') continue;
        for (const rem of task.reminders || []) {
          if (rem.is_dismissed) continue;
          const targetStr = rem.snoozed_until || rem.remind_at;
          if (!targetStr) continue;
          const target = new Date(targetStr);
          if (Number.isNaN(target.getTime())) continue;

          if (now.getTime() >= target.getTime()) {
            const key = `${rem.id}:${targetStr}`;
            if (!triggeredKeysRef.current.has(key)) {
              triggeredKeysRef.current.add(key);
              dueNow.push({ task, reminder: rem });

              if (!quiet && settings.notificationDisplay !== 'in_app_only' && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                  new Notification(
                    task.priority === 'critical' ? 'یادآوری فوری — دستیار دفتر' : 'یادآوری کار — دستیار دفتر',
                    { body: task.title }
                  );
                }
              }
            }
          }
        }
      }

      if (dueNow.length > 0) {
        if (!quiet) {
          playNotificationSound(settings.notificationSound);
        }
        if (settings.notificationDisplay !== 'native_only') {
          setActiveAlerts((prev) => {
            const existingIds = new Set(prev.map((p) => p.reminder.id));
            return [...prev, ...dueNow.filter((d) => !existingIds.has(d.reminder.id))];
          });
        }
      }
    };

    checkReminders();
    const timer = setInterval(checkReminders, 10000);
    return () => clearInterval(timer);
  }, [tasks, settings]);

  if (activeAlerts.length === 0) return null;

  const current = activeAlerts[0];
  const pMeta = PRIORITY_META[current.task.priority];

  const closeCurrent = () => {
    setActiveAlerts((prev) => prev.slice(1));
    setCustomSnoozeValue('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 ${
            current.task.priority === 'critical'
              ? 'bg-red-50 dark:bg-red-950/50'
              : 'bg-blue-50 dark:bg-blue-950/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <BellRing
              className={`w-5 h-5 ${
                current.task.priority === 'critical' ? 'text-red-600' : 'text-blue-600'
              }`}
            />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {current.task.priority === 'critical' ? 'یادآوری فوری و مهم' : 'یادآوری زمان‌بندی‌شده'}
            </span>
          </div>
          {activeAlerts.length > 1 && (
            <span className="text-xs text-slate-500 tabular-nums">
              {toPersianDigits(activeAlerts.length)} اعلان فعال
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs mb-1.5">
              <span className={`font-semibold ${pMeta.textClass}`}>اولویت {pMeta.label}</span>
              {current.task.due_date && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatDisplayDate(current.task.due_date, settings.calendarType)}
                  </span>
                </>
              )}
              {current.task.due_time && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    ساعت {toPersianDigits(current.task.due_time)}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {current.task.title}
            </h3>
            {current.task.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {current.task.description}
              </p>
            )}
          </div>

          {/* Snooze Presets */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>به تعویق انداختن (Snooze):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '۵ دقیقه', mins: 5 },
                { label: '۱۵ دقیقه', mins: 15 },
                { label: '۳۰ دقیقه', mins: 30 },
                { label: '۱ ساعت', mins: 60 },
              ].map((opt) => (
                <button
                  key={opt.mins}
                  type="button"
                  onClick={async () => {
                    await onSnoozeReminder(current.reminder.id, computeSnoozeIso(opt.mins));
                    closeCurrent();
                  }}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={async () => {
                  await onSnoozeReminder(current.reminder.id, computeTomorrowMorningIso());
                  closeCurrent();
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                فردا صبح (۰۹:۰۰)
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="datetime-local"
                value={customSnoozeValue}
                onChange={(e) => setCustomSnoozeValue(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={!customSnoozeValue}
                onClick={async () => {
                  await onSnoozeReminder(current.reminder.id, customSnoozeValue);
                  closeCurrent();
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-40"
              >
                زمان دلخواه
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await onCompleteTask(current.task.id);
                await onDismissReminder(current.reminder.id);
                closeCurrent();
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>انجام شد</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenTask(current.task);
                closeCurrent();
              }}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>مشاهده کار</span>
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              await onDismissReminder(current.reminder.id);
              closeCurrent();
            }}
            className="px-3 py-2 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>بستن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
