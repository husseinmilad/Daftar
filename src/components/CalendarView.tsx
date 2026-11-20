import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, GripVertical } from 'lucide-react';
import type { AppSettings, Task } from '../types.ts';
import {
  GREGORIAN_MONTHS_FA,
  JALALI_MONTHS,
  PERSIAN_WEEKDAYS,
  addDaysIso,
  formatDisplayDate,
  getPersianWeekdayIndex,
  getStartOfPersianWeekIso,
  getTodayIso,
  isoToJalaliParts,
  jalaliMonthLength,
  jalaliStringToIso,
  pad2,
  parseIsoDate,
  toPersianDigits,
} from '../utils/jalali.ts';
import { PRIORITY_META, isTaskActive } from '../utils/taskFilters.ts';

type CalendarMode = 'month' | 'week' | 'day' | 'agenda';

interface CalendarViewProps {
  tasks: Task[];
  settings: AppSettings;
  onRescheduleTask: (taskId: string, dueDate: string | null, dueTime?: string | null, isAllDay?: number) => Promise<void>;
  onSelectTask: (task: Task) => void;
  onCreateTaskOnDate: (dueDate: string, dueTime?: string | null, isAllDay?: boolean) => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 .. 22:00

export function CalendarView({
  tasks,
  settings,
  onRescheduleTask,
  onSelectTask,
  onCreateTaskOnDate,
}: CalendarViewProps) {
  const todayIso = getTodayIso();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [anchorIso, setAnchorIso] = useState<string>(todayIso);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const calendarType = settings.calendarType;
  const activeTasks = tasks.filter((t) => !t.is_archived);
  const unscheduledTasks = activeTasks.filter((t) => isTaskActive(t) && !t.due_date);

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDropOnDate = async (targetIso: string, targetTime?: string | null, makeAllDay = false) => {
    if (!draggedTaskId) return;
    await onRescheduleTask(
      draggedTaskId,
      targetIso,
      targetTime !== undefined ? targetTime : undefined,
      makeAllDay ? 1 : undefined
    );
    setDraggedTaskId(null);
  };

  const shiftPeriod = (dir: -1 | 1) => {
    if (mode === 'day') {
      setAnchorIso((d) => addDaysIso(d, dir));
    } else if (mode === 'week') {
      setAnchorIso((d) => addDaysIso(d, dir * 7));
    } else {
      if (calendarType === 'gregorian') {
        const { gy, gm } = parseIsoDate(anchorIso);
        const dt = new Date(gy, gm - 1 + dir, 1);
        setAnchorIso(`${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-01`);
      } else {
        const { jy, jm } = isoToJalaliParts(anchorIso);
        let nextM = jm + dir;
        let nextY = jy;
        if (nextM < 1) {
          nextM = 12;
          nextY -= 1;
        } else if (nextM > 12) {
          nextM = 1;
          nextY += 1;
        }
        setAnchorIso(jalaliStringToIso(nextY, nextM, 1));
      }
    }
  };

  const renderHeaderTitle = () => {
    if (mode === 'day') {
      return formatDisplayDate(anchorIso, calendarType, true);
    }
    if (mode === 'week') {
      const start = getStartOfPersianWeekIso(anchorIso);
      const end = addDaysIso(start, 6);
      return `${formatDisplayDate(start, calendarType)} تا ${formatDisplayDate(end, calendarType)}`;
    }
    if (calendarType === 'gregorian') {
      const { gy, gm } = parseIsoDate(anchorIso);
      return `${GREGORIAN_MONTHS_FA[gm - 1]} ${toPersianDigits(gy)}`;
    }
    const { jy, jm } = isoToJalaliParts(anchorIso);
    return `${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  };

  // Month grid preparation
  const renderMonthView = () => {
    let daysCount = 30;
    let firstIso = anchorIso;
    if (calendarType === 'gregorian') {
      const { gy, gm } = parseIsoDate(anchorIso);
      daysCount = new Date(gy, gm, 0).getDate();
      firstIso = `${gy}-${pad2(gm)}-01`;
    } else {
      const { jy, jm } = isoToJalaliParts(anchorIso);
      daysCount = jalaliMonthLength(jy, jm);
      firstIso = jalaliStringToIso(jy, jm, 1);
    }

    const offset = getPersianWeekdayIndex(firstIso);
    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysCount; d++) {
      const iso = addDaysIso(firstIso, d - 1);
      cells.push({ day: d, iso });
    }

    return (
      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          {PERSIAN_WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[112px] border-b border-l border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30"
                />
              );
            }
            const dayTasks = activeTasks.filter((t) => t.due_date === cell.iso);
            const isToday = cell.iso === todayIso;
            return (
              <div
                key={cell.iso}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnDate(cell.iso)}
                className={`min-h-[112px] p-2 border-b border-l border-slate-100 dark:border-slate-800/80 flex flex-col gap-1 transition-colors ${
                  isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    {toPersianDigits(cell.day)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCreateTaskOnDate(cell.iso)}
                    title="ثبت رویداد یا کار در این روز"
                    className="opacity-0 hover:opacity-100 focus:opacity-100 p-0.5 rounded text-slate-400 hover:text-blue-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 overflow-y-auto max-h-20">
                  {dayTasks.map((t) => {
                    const pMeta = PRIORITY_META[t.priority];
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => handleDragStart(t.id)}
                        onClick={() => onSelectTask(t)}
                        className={`cursor-pointer px-1.5 py-1 rounded text-[11px] truncate border ${pMeta.bgClass} ${pMeta.borderClass} ${
                          t.status === 'completed' ? 'opacity-50 line-through' : ''
                        }`}
                      >
                        {t.due_time ? `${toPersianDigits(t.due_time)} ` : ''}
                        {t.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Weekly 7-Column View
  const renderWeekView = () => {
    const start = getStartOfPersianWeekIso(anchorIso);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));

    return (
      <div className="grid grid-cols-1 md:grid-cols-7 border-t border-slate-200 dark:border-slate-800">
        {weekDays.map((iso, i) => {
          const dayTasks = activeTasks.filter((t) => t.due_date === iso);
          const isToday = iso === todayIso;
          return (
            <div
              key={iso}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnDate(iso)}
              className={`min-h-[360px] border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-800 p-2.5 flex flex-col gap-2 ${
                isToday ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {PERSIAN_WEEKDAYS[i]}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDisplayDate(iso, calendarType)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCreateTaskOnDate(iso)}
                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="افزودن به این روز"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 flex-1">
                {dayTasks.map((t) => {
                  const pMeta = PRIORITY_META[t.priority];
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => handleDragStart(t.id)}
                      onClick={() => onSelectTask(t)}
                      className={`cursor-pointer p-2 rounded-lg border text-xs ${pMeta.bgClass} ${pMeta.borderClass} ${
                        t.status === 'completed' ? 'opacity-50 line-through' : ''
                      }`}
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        {t.is_all_day ? (
                          <span>تمام‌روزه</span>
                        ) : t.due_time ? (
                          <span className="tabular-nums">ساعت {toPersianDigits(t.due_time)}</span>
                        ) : (
                          <span>بدون ساعت</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Daily Hourly + All-Day View
  const renderDayView = () => {
    const dayTasks = activeTasks.filter((t) => t.due_date === anchorIso);
    const allDayOrUntimed = dayTasks.filter((t) => t.is_all_day || !t.due_time);

    return (
      <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {/* All-day / untimed dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnDate(anchorIso, null, true)}
          className="p-4 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              رویدادهای تمام‌روزه و کارهای بدون ساعت مشخص
            </span>
            <button
              type="button"
              onClick={() => onCreateTaskOnDate(anchorIso, null, true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت رویداد تمام‌روزه</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allDayOrUntimed.length === 0 ? (
              <span className="text-xs text-slate-400">موردی برای بخش تمام‌روزه وجود ندارد.</span>
            ) : (
              allDayOrUntimed.map((t) => {
                const pMeta = PRIORITY_META[t.priority];
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => handleDragStart(t.id)}
                    onClick={() => onSelectTask(t)}
                    className={`cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-medium ${pMeta.bgClass} ${pMeta.borderClass}`}
                  >
                    {t.title}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hourly Slots */}
        {HOURS.map((hr) => {
          const hhPrefix = pad2(hr);
          const slotTasks = dayTasks.filter((t) => !t.is_all_day && t.due_time?.startsWith(hhPrefix));
          return (
            <div
              key={hr}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnDate(anchorIso, `${hhPrefix}:00`, false)}
              className="flex items-stretch min-h-[54px] hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
            >
              <div className="w-20 px-3 py-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums border-l border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-center">
                {toPersianDigits(`${hhPrefix}:00`)}
              </div>
              <div className="flex-1 p-2 flex flex-wrap items-center gap-2">
                {slotTasks.map((t) => {
                  const pMeta = PRIORITY_META[t.priority];
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => handleDragStart(t.id)}
                      onClick={() => onSelectTask(t)}
                      className={`cursor-pointer px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${pMeta.bgClass} ${pMeta.borderClass}`}
                    >
                      <span className="tabular-nums font-semibold">{toPersianDigits(t.due_time)}</span>
                      <span className="font-medium">{t.title}</span>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => onCreateTaskOnDate(anchorIso, `${hhPrefix}:00`, false)}
                  className="mr-auto text-[11px] text-slate-400 hover:text-blue-600 px-2 py-1"
                >
                  + ثبت در این ساعت
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Upcoming Agenda View
  const renderAgendaView = () => {
    const dated = activeTasks
      .filter((t) => isTaskActive(t) && t.due_date && t.due_date >= todayIso)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

    const grouped = new Map<string, Task[]>();
    for (const t of dated) {
      const key = t.due_date!;
      const arr = grouped.get(key) || [];
      arr.push(t);
      grouped.set(key, arr);
    }

    return (
      <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {grouped.size === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            برنامه آتی زمان‌بندی‌شده‌ای وجود ندارد.
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateIso, list]) => (
            <div key={dateIso} className="p-4 space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {formatDisplayDate(dateIso, calendarType, true)}
                {dateIso === todayIso ? ' (امروز)' : ''}
              </div>
              <div className="space-y-1.5">
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="w-full text-right px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">{t.title}</span>
                    <span className="text-slate-500 tabular-nums">
                      {t.is_all_day ? 'تمام‌روزه' : t.due_time ? toPersianDigits(t.due_time) : 'بدون ساعت'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Calendar Toolbar */}
        <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="دوره قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorIso(todayIso)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="دوره بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mr-2">
              {renderHeaderTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'day', label: 'روزانه' },
                { id: 'week', label: 'هفتگی' },
                { id: 'month', label: 'ماهانه' },
                { id: 'agenda', label: 'کارهای آتی' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'month' && renderMonthView()}
        {mode === 'week' && renderWeekView()}
        {mode === 'day' && renderDayView()}
        {mode === 'agenda' && renderAgendaView()}
      </div>

      {/* Drag-and-Drop Unscheduled Tasks Sidebar */}
      <aside className="xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <CalendarIcon className="w-4 h-4 text-blue-600" />
          <span>کارهای بدون زمان (بکشید و رها کنید)</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          برای زمان‌بندی، هر کار را با ماوس بکشید و روی روز یا ساعت دلخواه در تقویم رها کنید.
        </p>

        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {unscheduledTasks.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              کار بدون تاریخی وجود ندارد.
            </div>
          ) : (
            unscheduledTasks.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => handleDragStart(t.id)}
                onClick={() => onSelectTask(t)}
                className="cursor-grab active:cursor-grabbing p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-400 flex items-center gap-2 text-xs"
              >
                <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                  {t.title}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
