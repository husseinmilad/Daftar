import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Pin,
  Clock,
  AlertCircle,
  FileText,
  ArrowUpLeft,
  Bell,
} from 'lucide-react';
import type { ActiveView, AppSettings, Category, Followup, Task } from '../types.ts';
import {
  formatDisplayDate,
  formatLiveClockPersian,
  getGreetingPersian,
  getTodayIso,
  toPersianDigits,
} from '../utils/jalali.ts';
import {
  PRIORITY_META,
  STATUS_META,
  isTaskActive,
  isTaskOverdue,
  sortTasksByPriorityAndTime,
} from '../utils/taskFilters.ts';

interface DashboardViewProps {
  tasks: Task[];
  followups: Followup[];
  categories: Category[];
  settings: AppSettings;
  onToggleComplete: (task: Task) => Promise<void>;
  onTogglePinToday: (task: Task) => Promise<void>;
  onSelectTask: (task: Task) => void;
  onNavigate: (view: ActiveView) => void;
}

export function DashboardView({
  tasks,
  followups,
  categories,
  settings,
  onToggleComplete,
  onTogglePinToday,
  onSelectTask,
  onNavigate,
}: DashboardViewProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayIso = getTodayIso();
  const activeTasks = tasks.filter(isTaskActive).sort(sortTasksByPriorityAndTime);
  const todayTasks = activeTasks.filter((t) => t.due_date === todayIso);
  const urgentTasks = activeTasks.filter((t) => t.priority === 'critical' || t.priority === 'high');
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, now));
  const completedTasks = tasks.filter((t) => !t.is_archived && t.status === 'completed');

  const activeFollowups = followups.filter(
    (f) => !f.is_archived && f.status !== 'completed' && f.status !== 'cancelled'
  );
  const needsFollowup = activeFollowups.filter(
    (f) => f.next_followup_date <= todayIso || f.status === 'needs_followup' || f.status === 'waiting'
  );

  // "اولویت امروز" — Top 3 pinned or highest-priority today/overdue tasks
  const pinnedToday = activeTasks.filter((t) => t.is_pinned_today);
  const topThreePriorities = [
    ...pinnedToday,
    ...activeTasks.filter((t) => !t.is_pinned_today && (t.due_date === todayIso || t.priority === 'critical' || isTaskOverdue(t, now))),
  ].slice(0, 3);

  const upcomingDeadlines = activeTasks
    .filter((t) => t.deadline || t.due_date)
    .sort((a, b) => (a.deadline || a.due_date || '').localeCompare(b.deadline || b.due_date || ''))
    .slice(0, 5);

  const recentQuickNotes = activeTasks.filter((t) => t.is_quick_note).slice(0, 5);

  // Missed / overdue active reminders
  const missedReminders = activeTasks.flatMap((t) =>
    (t.reminders || [])
      .filter((r) => {
        if (r.is_dismissed) return false;
        const target = new Date(r.snoozed_until || r.remind_at);
        return !Number.isNaN(target.getTime()) && target.getTime() <= now.getTime();
      })
      .map((r) => ({ task: t, reminder: r }))
  );

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Greeting & Daily Status Header */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {formatDisplayDate(todayIso, settings.calendarType, true)}
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {getGreetingPersian(now.getHours())} — خلاصه وضعیت میز کار شما
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {todayTasks.length > 0 || overdueTasks.length > 0
              ? `امروز ${toPersianDigits(todayTasks.length)} کار برنامه‌ریزی‌شده و ${toPersianDigits(
                  overdueTasks.length
                )} مورد عقب‌افتاده در انتظار رسیدگی است.`
              : 'همه کارهای زمان‌بندی‌شده امروز رسیدگی شده‌اند.'}
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-left">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">
              {formatLiveClockPersian(now)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ساعت رسمی سیستم</div>
          </div>
        </div>
      </section>

      {/* Missed Reminders Strip (only if any) */}
      {missedReminders.length > 0 && (
        <section className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-red-800 dark:text-red-300 font-medium">
            <Bell className="w-4 h-4 shrink-0" />
            <span>
              {toPersianDigits(missedReminders.length)} یادآوری ازدست‌رفته یا در موعد سررسید دارید:
            </span>
            <span className="font-normal text-red-700 dark:text-red-400">
              {missedReminders.map((m) => m.task.title).slice(0, 2).join(' · ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectTask(missedReminders[0].task)}
            className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline whitespace-nowrap"
          >
            بررسی اولین مورد
          </button>
        </section>
      )}

      {/* 5-Column Clean KPI Summary Row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'کارهای امروز', value: todayTasks.length, accent: 'text-blue-600 dark:text-blue-400', view: 'tasks' as ActiveView },
          { label: 'کارهای فوری', value: urgentTasks.length, accent: 'text-orange-600 dark:text-orange-400', view: 'tasks' as ActiveView },
          { label: 'عقب‌افتاده', value: overdueTasks.length, accent: 'text-red-600 dark:text-red-400', view: 'tasks' as ActiveView },
          { label: 'نیازمند پیگیری', value: needsFollowup.length, accent: 'text-amber-600 dark:text-amber-400', view: 'followups' as ActiveView },
          { label: 'انجام‌شده', value: completedTasks.length, accent: 'text-emerald-600 dark:text-emerald-400', view: 'tasks' as ActiveView },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => onNavigate(stat.view)}
            className="text-right rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</div>
            <div className={`text-2xl font-bold mt-1.5 tabular-nums ${stat.accent}`}>
              {toPersianDigits(stat.value)}
            </div>
          </button>
        ))}
      </section>

      {/* Main 2-Column Executive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Column (7 cols): اولویت امروز + نزدیکترین موعدها */}
        <div className="lg:col-span-7 space-y-6">
          {/* «اولویت امروز» — Top 3 */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  اولویت امروز (سه کار کلیدی روز)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  مهم‌ترین کارهای پین‌شده یا بحرانی برای تمرکز اصلی امروز
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>همه کارها</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topThreePriorities.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  در حال حاضر کاری در اولویت امروز قرار ندارد. می‌توانید از نوار بالا یادداشت ثبت کنید.
                </div>
              ) : (
                topThreePriorities.map((task, idx) => {
                  const pMeta = PRIORITY_META[task.priority];
                  const overdue = isTaskOverdue(task, now);
                  return (
                    <div
                      key={task.id}
                      className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleComplete(task)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 shrink-0"
                          title="علامت‌گذاری انجام‌شده"
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectTask(task)}
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-right block truncate max-w-full"
                          >
                            {toPersianDigits(idx + 1)}. {task.title}
                          </button>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className={`font-medium ${pMeta.textClass}`}>اولویت {pMeta.label}</span>
                            {task.due_date && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{formatDisplayDate(task.due_date, settings.calendarType)}</span>
                              </>
                            )}
                            {task.due_time && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">ساعت {toPersianDigits(task.due_time)}</span>
                              </>
                            )}
                            {task.related_person && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{task.related_person}</span>
                              </>
                            )}
                            {overdue && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-red-600 dark:text-red-400 font-semibold">عقب‌افتاده</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onTogglePinToday(task)}
                        title={task.is_pinned_today ? 'برداشتن از اولویت امروز' : 'پین در اولویت امروز'}
                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                          task.is_pinned_today
                            ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Closest Upcoming Deadlines */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>نزدیکترین موعدها و زمان‌بندی‌ها</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                مشاهده تقویم
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingDeadlines.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  کار زمان‌بندی‌شده‌ای ثبت نشده است.
                </div>
              ) : (
                upcomingDeadlines.map((t) => {
                  const overdue = isTaskOverdue(t, now);
                  const catName = t.category_id ? catMap.get(t.category_id) : null;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTask(t)}
                      className="w-full px-5 py-3 flex items-center justify-between gap-4 text-right hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {t.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{STATUS_META[t.status].label}</span>
                          {catName && (
                            <>
                              <span>·</span>
                              <span>{catName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-left shrink-0 text-xs tabular-nums">
                        <div className={overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}>
                          {formatDisplayDate((t.deadline || t.due_date)?.slice(0, 10), settings.calendarType)}
                        </div>
                        {t.due_time && (
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            ساعت {toPersianDigits(t.due_time)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Secondary Column (5 cols): پیگیری‌ها + یادداشت‌های اخیر + انجام‌شده */}
        <div className="lg:col-span-5 space-y-6">
          {/* Followups needing action */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>موضوعات نیازمند پیگیری</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('followups')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                بخش پیگیری‌ها
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {needsFollowup.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  موضوع پیگیری باز در موعد امروز وجود ندارد.
                </div>
              ) : (
                needsFollowup.slice(0, 4).map((f) => {
                  const isLate = f.next_followup_date < todayIso;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onNavigate('followups')}
                      className="w-full px-5 py-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {f.title}
                        </span>
                        <span
                          className={`text-xs shrink-0 tabular-nums ${
                            isLate ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {formatDisplayDate(f.next_followup_date, settings.calendarType)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span>{f.counterparty || 'بدون واحد ثبت‌شده'}</span>
                        {f.logs && f.logs[0] && (
                          <>
                            <span>·</span>
                            <span>مرحله: {f.logs[0].stage_label}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Recent Quick Notes */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>یادداشت‌های سریع اخیر</span>
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">
                {toPersianDigits(recentQuickNotes.length)} مورد
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentQuickNotes.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  هنوز یادداشت سریعی ثبت نشده است.
                </div>
              ) : (
                recentQuickNotes.map((note) => (
                  <div
                    key={note.id}
                    className="px-5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(note)}
                      className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate text-right flex-1"
                    >
                      {note.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleComplete(note)}
                      className="text-slate-400 hover:text-emerald-600 shrink-0"
                      title="انجام شد"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recently Completed */}
          {completedTasks.length > 0 && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  انجام‌شده‌های اخیر
                </span>
                <span className="tabular-nums">{toPersianDigits(completedTasks.length)} کار</span>
              </div>
              <div className="space-y-1.5">
                {completedTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-slate-500 line-through">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
