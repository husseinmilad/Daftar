import { useState, useRef, useEffect } from 'react';
import { Plus, Clock, AlertTriangle, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import type { Category, Priority, Task } from '../types.ts';
import { addDaysIso, getTodayIso, parseQuickNoteHints, toPersianDigits } from '../utils/jalali.ts';

interface QuickCaptureBarProps {
  categories: Category[];
  onCreateTask: (payload: Partial<Task>) => Promise<void>;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  forceUrgentDefault?: boolean;
  onEscape?: () => void;
}

export function QuickCaptureBar({
  categories,
  onCreateTask,
  inputRef: externalRef,
  forceUrgentDefault = false,
  onEscape,
}: QuickCaptureBarProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputEl = externalRef || internalRef;

  const [text, setText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [datePreset, setDatePreset] = useState<'none' | 'today' | 'tomorrow' | 'next_week'>('today');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<Priority>(forceUrgentDefault ? 'critical' : 'medium');
  const [categoryId, setCategoryId] = useState<string>('');
  const [relatedPerson, setRelatedPerson] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (forceUrgentDefault) {
      setPriority('critical');
    }
  }, [forceUrgentDefault]);

  const parsedHints = text.trim() ? parseQuickNoteHints(text) : null;

  const resolveDate = (): string | null => {
    if (parsedHints?.suggestedDueDate && datePreset === 'today') {
      return parsedHints.suggestedDueDate;
    }
    const today = getTodayIso();
    if (datePreset === 'today') return today;
    if (datePreset === 'tomorrow') return addDaysIso(today, 1);
    if (datePreset === 'next_week') return addDaysIso(today, 7);
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const effectivePriority =
        priority === 'medium' && parsedHints?.suggestedPriority
          ? parsedHints.suggestedPriority
          : priority;
      const effectiveTime = dueTime || parsedHints?.suggestedDueTime || null;
      const effectiveDate =
        datePreset === 'none'
          ? null
          : parsedHints?.suggestedDueDate && !showOptions
          ? parsedHints.suggestedDueDate
          : resolveDate();

      await onCreateTask({
        title: trimmed,
        due_date: effectiveDate,
        due_time: effectiveTime,
        priority: effectivePriority,
        category_id: categoryId || null,
        related_person: relatedPerson.trim(),
        is_quick_note: 1,
        status: 'not_started',
      });
      setText('');
      setDueTime('');
      setRelatedPerson('');
      setPriority(forceUrgentDefault ? 'critical' : 'medium');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputEl}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowOptions(false);
                inputEl.current?.blur();
                onEscape?.();
              }
            }}
            placeholder="ثبت سریع یادداشت یا کار... (مثلاً: تماس با آقای رضایی، پیگیری نامه ۱۲۳، ارسال گزارش تا ساعت ۱۴)"
            className="w-full pr-3 pl-3 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowOptions((s) => !s)}
          className="px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="تعیین مشخصات اختیاری"
        >
          <span>جزئیات</span>
          {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت سریع</span>
        </button>
      </div>

      {/* Subtle inline smart detection hint + fast 1-click chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPriority((p) => (p === 'critical' ? 'medium' : 'critical'))}
            className={`px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1 whitespace-nowrap ${
              priority === 'critical'
                ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-medium'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>فوری</span>
          </button>

          {(
            [
              { id: 'today', label: 'امروز' },
              { id: 'tomorrow', label: 'فردا' },
              { id: 'next_week', label: 'هفته آینده' },
              { id: 'none', label: 'بدون تاریخ' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDatePreset(opt.id)}
              className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap ${
                datePreset === opt.id
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-medium'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {parsedHints && (parsedHints.suggestedDueTime || parsedHints.suggestedPriority || parsedHints.suggestedDueDate) && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>تشخیص خودکار:</span>
            {parsedHints.suggestedPriority === 'critical' && (
              <span className="text-red-600 dark:text-red-400 font-medium">اولویت بحرانی</span>
            )}
            {parsedHints.suggestedDueTime && (
              <span className="tabular-nums">ساعت {toPersianDigits(parsedHints.suggestedDueTime)}</span>
            )}
            {parsedHints.suggestedDueDate && <span>تاریخ ثبت‌شده از متن</span>}
          </div>
        )}
      </div>

      {showOptions && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> ساعت انجام
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> اولویت
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="critical">بحرانی</option>
              <option value="high">زیاد</option>
              <option value="medium">متوسط</option>
              <option value="low">کم</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> دسته‌بندی
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">بدون دسته‌بندی</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> شخص یا واحد مرتبط
            </label>
            <input
              type="text"
              value={relatedPerson}
              onChange={(e) => setRelatedPerson(e.target.value)}
              placeholder="مثلاً: واحد مالی"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      )}
    </form>
  );
}
