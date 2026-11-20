import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Bell,
  Pin,
  Archive,
  FolderOpen,
} from 'lucide-react';
import type { AppSettings, Category, SmartGroup, Task } from '../types.ts';
import { formatDisplayDate, toPersianDigits } from '../utils/jalali.ts';
import {
  PRIORITY_META,
  SMART_GROUPS,
  STATUS_META,
  isTaskOverdue,
  matchesSmartGroup,
  sortTasksByPriorityAndTime,
} from '../utils/taskFilters.ts';

interface TasksViewProps {
  tasks: Task[];
  categories: Category[];
  settings: AppSettings;
  onToggleComplete: (task: Task) => Promise<void>;
  onTogglePinToday: (task: Task) => Promise<void>;
  onArchiveTask: (task: Task) => Promise<void>;
  onSelectTask: (task: Task) => void;
  onCreateNewTask: () => void;
}

export function TasksView({
  tasks,
  categories,
  settings,
  onToggleComplete,
  onTogglePinToday,
  onArchiveTask,
  onSelectTask,
  onCreateNewTask,
}: TasksViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<SmartGroup>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const activeNonArchived = tasks.filter((t) => !t.is_archived);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const filtered = activeNonArchived
    .filter((t) => matchesSmartGroup(t, selectedGroup))
    .filter((t) => (selectedCategoryId === 'all' ? true : t.category_id === selectedCategoryId))
    .sort(sortTasksByPriorityAndTime);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left/Right RTL Sidebar for the 10 Temporal/Priority Groups + Custom Categories */}
      <aside className="lg:col-span-3 space-y-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="px-2 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            دسته‌بندی زمانی و اولویت
          </div>
          <nav className="mt-1 space-y-0.5">
            {SMART_GROUPS.map((g) => {
              const count = activeNonArchived.filter((t) => matchesSmartGroup(t, g.id)).length;
              const active = selectedGroup === g.id && selectedCategoryId === 'all';
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(g.id);
                    setSelectedCategoryId('all');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{g.label}</span>
                  <span
                    className={`tabular-nums ${
                      active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {toPersianDigits(count)}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Custom Categories */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="px-2 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>دسته‌بندی‌های اختصاصی</span>
          </div>
          <nav className="mt-1 space-y-0.5">
            {categories.map((cat) => {
              const count = activeNonArchived.filter((t) => t.category_id === cat.id).length;
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setSelectedGroup('all');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span className="tabular-nums opacity-70">{toPersianDigits(count)}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Task List */}
      <section className="lg:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {selectedCategoryId !== 'all'
                ? catMap.get(selectedCategoryId)?.name || 'دسته‌بندی'
                : SMART_GROUPS.find((g) => g.id === selectedGroup)?.label}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {toPersianDigits(filtered.length)} مورد یافت شد
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateNewTask}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>کار با جزئیات کامل</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                در این دسته‌بندی کاری ثبت نشده است.
              </p>
              <button
                type="button"
                onClick={onCreateNewTask}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                ثبت اولین کار در این بخش
              </button>
            </div>
          ) : (
            filtered.map((task) => {
              const pMeta = PRIORITY_META[task.priority];
              const sMeta = STATUS_META[task.status];
              const overdue = isTaskOverdue(task);
              const cat = task.category_id ? catMap.get(task.category_id) : null;
              const isDone = task.status === 'completed';
              const activeRemindersCount = (task.reminders || []).filter((r) => !r.is_dismissed).length;

              return (
                <div
                  key={task.id}
                  className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onToggleComplete(task)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 shrink-0"
                      title={isDone ? 'بازگردانی به حالت فعال' : 'علامت‌گذاری انجام‌شده'}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className={`text-sm font-semibold text-right block truncate max-w-full hover:text-blue-600 dark:hover:text-blue-400 ${
                          isDone
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.title}
                      </button>

                      {task.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {task.description}
                        </p>
                      )}

                      {/* Unboxed Metadata Line with clean separators */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        <span className={`font-medium ${pMeta.textClass}`}>اولویت {pMeta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className={sMeta.textClass}>{sMeta.label}</span>
                        {task.due_date && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                              {formatDisplayDate(task.due_date, settings.calendarType)}
                              {overdue ? ' (عقب‌افتاده)' : ''}
                            </span>
                          </>
                        )}
                        {task.due_time && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">ساعت {toPersianDigits(task.due_time)}</span>
                          </>
                        )}
                        {task.is_all_day ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>تمام‌روزه</span>
                          </>
                        ) : null}
                        {cat && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{cat.name}</span>
                          </>
                        )}
                        {task.related_person && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{task.related_person}</span>
                          </>
                        )}
                        {activeRemindersCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 tabular-nums">
                              <Bell className="w-3 h-3" />
                              {toPersianDigits(activeRemindersCount)} یادآور
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onTogglePinToday(task)}
                      title="پین در اولویت امروز"
                      className={`p-1.5 rounded-lg transition-colors ${
                        task.is_pinned_today
                          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onArchiveTask(task)}
                      title="انتقال به آرشیو"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
