import { useState } from 'react';
import { Search, RotateCcw, Trash2, Download, Archive } from 'lucide-react';
import type { AppSettings, Category, Followup, Priority, Task, TaskStatus } from '../types.ts';
import { JalaliDatePicker } from './JalaliDatePicker.tsx';
import { formatDisplayDate, toPersianDigits } from '../utils/jalali.ts';
import { PRIORITY_META, STATUS_META } from '../utils/taskFilters.ts';

interface SearchArchiveViewProps {
  tasks: Task[];
  followups: Followup[];
  categories: Category[];
  settings: AppSettings;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectTask: (task: Task) => void;
  onRestoreTask: (taskId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onRestoreFollowup: (followupId: string) => Promise<void>;
  onDeleteFollowup: (followupId: string) => Promise<void>;
}

export function SearchArchiveView({
  tasks,
  followups,
  categories,
  settings,
  searchInputRef,
  onSelectTask,
  onRestoreTask,
  onDeleteTask,
  onRestoreFollowup,
  onDeleteFollowup,
}: SearchArchiveViewProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'active' | 'archived'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const q = query.trim().toLowerCase();

  const matchedTasks = tasks.filter((t) => {
    if (scope === 'active' && t.is_archived) return false;
    if (scope === 'archived' && !t.is_archived && t.status !== 'completed') return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false;
    if (dateFrom && (!t.due_date || t.due_date < dateFrom)) return false;
    if (dateTo && (!t.due_date || t.due_date > dateTo)) return false;
    if (q) {
      const haystack = `${t.title} ${t.description} ${t.extra_notes} ${t.related_person} ${t.related_link}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const matchedFollowups = followups.filter((f) => {
    if (scope === 'active' && f.is_archived) return false;
    if (scope === 'archived' && !f.is_archived && f.status !== 'completed') return false;
    if (priorityFilter !== 'all' && f.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (q) {
      const logsText = (f.logs || []).map((l) => `${l.stage_label} ${l.note}`).join(' ');
      const haystack = `${f.title} ${f.reference_code} ${f.counterparty} ${logsText}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Search & Export Header */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              جست‌وجو، سوابق و آرشیو
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              جست‌وجوی آنی در عنوان، یادداشت‌ها، افراد مرتبط و سوابق پیگیری (میان‌بر Ctrl+F)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/export/csv"
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی CSV (اکسل)</span>
            </a>
            <a
              href="/api/export/json"
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی JSON</span>
            </a>
          </div>
        </div>

        {/* Search Input + Scope Switch */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="عبارت مورد نظر، نام شخص، شماره نامه یا متن یادداشت را بنویسید..."
              className="w-full pr-9 pl-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            {(
              [
                { id: 'all', label: 'همه سوابق' },
                { id: 'active', label: 'موارد فعال' },
                { id: 'archived', label: 'آرشیو و انجام‌شده' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScope(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scope === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Facet Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">همه اولویت‌ها</option>
            <option value="critical">بحرانی</option>
            <option value="high">زیاد</option>
            <option value="medium">متوسط</option>
            <option value="low">کم</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">همه وضعیت‌ها</option>
            {Object.entries(STATUS_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <JalaliDatePicker
            value={dateFrom}
            onChange={setDateFrom}
            calendarType={settings.calendarType}
            placeholder="از تاریخ..."
          />

          <JalaliDatePicker
            value={dateTo}
            onChange={setDateTo}
            calendarType={settings.calendarType}
            placeholder="تا تاریخ..."
          />
        </div>
      </section>

      {/* Matched Tasks */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-500" />
            <span>کارها و یادداشت‌ها ({toPersianDigits(matchedTasks.length)})</span>
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {matchedTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              موردی مطابق فیلترهای انتخاب‌شده پیدا نشد.
            </div>
          ) : (
            matchedTasks.map((t) => {
              const pMeta = PRIORITY_META[t.priority];
              const sMeta = STATUS_META[t.status];
              return (
                <div
                  key={t.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="text-right min-w-0 flex-1"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {t.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className={pMeta.textClass}>{pMeta.label}</span>
                      <span>·</span>
                      <span className={sMeta.textClass}>{sMeta.label}</span>
                      {t.category_id && catMap.get(t.category_id) && (
                        <>
                          <span>·</span>
                          <span>{catMap.get(t.category_id)}</span>
                        </>
                      )}
                      {t.due_date && (
                        <>
                          <span>·</span>
                          <span>{formatDisplayDate(t.due_date, settings.calendarType)}</span>
                        </>
                      )}
                      {t.is_archived ? (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400">آرشیوشده</span>
                        </>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(t.is_archived || t.status === 'completed') && (
                      <button
                        type="button"
                        onClick={() => onRestoreTask(t.id)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>بازیابی</span>
                      </button>
                    )}

                    {confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteTask(t.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white"
                        >
                          تأیید حذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          لغو
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(t.id)}
                        title="حذف دائمی"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Matched Followups */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            موضوعات و سوابق پیگیری ({toPersianDigits(matchedFollowups.length)})
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {matchedFollowups.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              مورد پیگیری یافت نشد.
            </div>
          ) : (
            matchedFollowups.map((f) => (
              <div
                key={f.id}
                className="px-5 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {f.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{STATUS_META[f.status].label}</span>
                    {f.counterparty && (
                      <>
                        <span>·</span>
                        <span>{f.counterparty}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{toPersianDigits(f.logs?.length || 0)} سابقه ثبت‌شده</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {f.is_archived ? (
                    <button
                      type="button"
                      onClick={() => onRestoreFollowup(f.id)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-blue-600 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازیابی</span>
                    </button>
                  ) : null}
                  {confirmDeleteId === `f-${f.id}` ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteFollowup(f.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white"
                    >
                      تأیید حذف
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(`f-${f.id}`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
