import { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Plus,
  Trash2,
  Pin,
  Archive,
  Link2,
  User,
  Clock,
  CheckCircle2,
  Repeat,
} from 'lucide-react';
import type {
  Category,
  Priority,
  RecurrenceType,
  Reminder,
  ReminderRuleType,
  Task,
  TaskPayload,
  TaskStatus,
} from '../types.ts';
import { JalaliDatePicker } from './JalaliDatePicker.tsx';
import {
  addDaysIso,
  formatDisplayDate,
  getTodayIso,
  pad2,
  toPersianDigits,
} from '../utils/jalali.ts';
import { STATUS_META } from '../utils/taskFilters.ts';

interface TaskDrawerProps {
  task: Task | null;
  isOpen: boolean;
  categories: Category[];
  calendarType: 'jalali' | 'gregorian';
  onClose: () => void;
  onSave: (id: string | null, payload: TaskPayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskDrawer({
  task,
  isOpen,
  categories,
  calendarType,
  onClose,
  onSave,
  onDelete,
}: TaskDrawerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState<string | null>(null);
  const [deadlineTime, setDeadlineTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [priority, setPriority] = useState<Priority>('medium');
  const [categoryId, setCategoryId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [relatedPerson, setRelatedPerson] = useState('');
  const [relatedLink, setRelatedLink] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [isPinnedToday, setIsPinnedToday] = useState(false);
  const [reminders, setReminders] = useState<Partial<Reminder>[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // New reminder builder state
  const [newRuleType, setNewRuleType] = useState<ReminderRuleType>('exact_time');
  const [newRemDate, setNewRemDate] = useState<string>(getTodayIso());
  const [newRemTime, setNewRemTime] = useState<string>('09:00');
  const [newOffsetVal, setNewOffsetVal] = useState<number>(1);
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>('none');
  const [newIntervalDays, setNewIntervalDays] = useState<number>(2);
  const [newRepeatUntilResolved, setNewRepeatUntilResolved] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(task.due_date || null);
      setDueTime(task.due_time || '');
      if (task.deadline) {
        setDeadlineDate(task.deadline.slice(0, 10));
        setDeadlineTime(task.deadline.length > 10 ? task.deadline.slice(11, 16) : '');
      } else {
        setDeadlineDate(null);
        setDeadlineTime('');
      }
      setIsAllDay(Boolean(task.is_all_day));
      setPriority(task.priority);
      setCategoryId(task.category_id || '');
      setStatus(task.status);
      setRelatedPerson(task.related_person || '');
      setRelatedLink(task.related_link || '');
      setExtraNotes(task.extra_notes || '');
      setIsPinnedToday(Boolean(task.is_pinned_today));
      setReminders(task.reminders || []);
      setNewRemDate(task.due_date || getTodayIso());
      setNewRemTime(task.due_time || '09:00');
    } else {
      setTitle('');
      setDescription('');
      setDueDate(getTodayIso());
      setDueTime('');
      setDeadlineDate(null);
      setDeadlineTime('');
      setIsAllDay(false);
      setPriority('medium');
      setCategoryId('');
      setStatus('not_started');
      setRelatedPerson('');
      setRelatedLink('');
      setExtraNotes('');
      setIsPinnedToday(false);
      setReminders([]);
      setNewRemDate(getTodayIso());
      setNewRemTime('09:00');
    }
  }, [task, isOpen]);

  if (!isOpen) return null;
  const isExisting = Boolean(task && task.id);

  const computeReminderIso = (): string => {
    const baseDate = dueDate || getTodayIso();
    const baseTime = dueTime || '09:00';
    if (newRuleType === 'exact_time' || newRuleType === 'recurring') {
      return `${newRemDate || baseDate}T${newRemTime || '09:00'}`;
    }
    if (newRuleType === 'exact_date') {
      return `${newRemDate || baseDate}T09:00`;
    }
    if (newRuleType === 'hours_before') {
      const dt = new Date(`${baseDate}T${baseTime}:00`);
      dt.setHours(dt.getHours() - Math.max(1, newOffsetVal));
      return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    }
    // days_before
    const targetDate = addDaysIso(baseDate, -Math.max(1, newOffsetVal));
    return `${targetDate}T${baseTime}`;
  };

  const handleAddReminder = () => {
    const remindAt = computeReminderIso();
    setReminders((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        remind_at: remindAt,
        rule_type: newRuleType,
        offset_value: newOffsetVal,
        recurrence: newRuleType === 'recurring' && newRecurrence === 'none' ? 'daily' : newRecurrence,
        recurrence_interval_days: newIntervalDays,
        repeat_until_resolved: newRepeatUntilResolved ? 1 : 0,
        is_dismissed: 0,
      },
    ]);
  };

  const handleRemoveReminder = (idx: number) => {
    setReminders((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const deadline = deadlineDate
        ? deadlineTime
          ? `${deadlineDate}T${deadlineTime}`
          : deadlineDate
        : null;
      await onSave(task ? task.id : null, {
        title: title.trim(),
        description,
        due_date: dueDate,
        due_time: isAllDay ? null : dueTime || null,
        deadline,
        is_all_day: isAllDay ? 1 : 0,
        priority,
        category_id: categoryId || null,
        status,
        related_person: relatedPerson,
        related_link: relatedLink,
        extra_notes: extraNotes,
        is_pinned_today: isPinnedToday ? 1 : 0,
        reminders,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const recurrenceLabel: Record<RecurrenceType, string> = {
    none: 'یک‌بار',
    daily: 'روزانه',
    weekly: 'هفتگی',
    monthly: 'ماهانه',
    custom: 'سفارشی',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isExisting ? 'جزئیات و ویرایش کار' : 'ثبت کار جدید'}
            </h2>
            {isExisting && (
              <button
                type="button"
                onClick={() => setIsPinnedToday((p) => !p)}
                className={`px-2.5 py-1 text-xs rounded-md border flex items-center gap-1 transition-colors ${
                  isPinnedToday
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-medium'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span>اولویت امروز</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              عنوان کار <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان واضح و کوتاه برای کار..."
              className="w-full px-3.5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              توضیحات
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="جزئیات اجرا، نکات کلیدی یا مراحل مورد نیاز..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>

          {/* Scheduling Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                تاریخ انجام
              </label>
              <JalaliDatePicker
                value={dueDate}
                onChange={setDueDate}
                calendarType={calendarType}
                placeholder="بدون تاریخ مشخص"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> ساعت انجام
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>تمام‌روزه</span>
                </label>
              </div>
              <input
                type="time"
                disabled={isAllDay}
                value={isAllDay ? '' : dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                تاریخ مهلت نهایی (Deadline)
              </label>
              <JalaliDatePicker
                value={deadlineDate}
                onChange={setDeadlineDate}
                calendarType={calendarType}
                placeholder="تعیین نشده"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                ساعت مهلت نهایی
              </label>
              <input
                type="time"
                disabled={!deadlineDate}
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-40"
              />
            </div>
          </div>

          {/* Priority, Category, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                اولویت
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="critical">بحرانی</option>
                <option value="high">زیاد</option>
                <option value="medium">متوسط</option>
                <option value="low">کم</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                وضعیت انجام
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                دسته‌بندی
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="">بدون دسته‌بندی</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Person, Link, Extra Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> شخص یا واحد مرتبط
              </label>
              <input
                type="text"
                value={relatedPerson}
                onChange={(e) => setRelatedPerson(e.target.value)}
                placeholder="مثلاً: واحد مالی، آقای حسینی..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> مسیر فایل یا لینک مرتبط
              </label>
              <input
                type="text"
                value={relatedLink}
                onChange={(e) => setRelatedLink(e.target.value)}
                placeholder="C:\Docs\letter.pdf یا https://..."
                dir="ltr"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-left"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              یادداشت‌های تکمیلی
            </label>
            <textarea
              rows={2}
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="سوابق مکالمه، شماره داخلی، نکات تکمیلی..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Multi-Reminder Manager */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <span>یادآورهای کار ({toPersianDigits(reminders.length)})</span>
              </h3>
            </div>

            {reminders.length > 0 && (
              <div className="space-y-2">
                {reminders.map((rem, idx) => {
                  const datePart = rem.remind_at?.slice(0, 10) || '';
                  const timePart = rem.remind_at?.slice(11, 16) || '';
                  return (
                    <div
                      key={rem.id || idx}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
                        <span className="font-medium tabular-nums">
                          {formatDisplayDate(datePart, calendarType)} · ساعت {toPersianDigits(timePart)}
                        </span>
                        {rem.recurrence && rem.recurrence !== 'none' && (
                          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            {recurrenceLabel[rem.recurrence]}
                          </span>
                        )}
                        {rem.repeat_until_resolved ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            · یادآوری مجدد تا تعیین تکلیف
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReminder(idx)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="حذف یادآور"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Reminder Builder */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    نوع یادآوری
                  </label>
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value as ReminderRuleType)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="exact_time">در تاریخ و ساعت مشخص</option>
                    <option value="exact_date">در تاریخ مشخص (ساعت ۰۹:۰۰)</option>
                    <option value="hours_before">چند ساعت قبل از موعد</option>
                    <option value="days_before">چند روز قبل از موعد</option>
                    <option value="recurring">یادآوری تکرارشونده</option>
                  </select>
                </div>

                {(newRuleType === 'exact_time' || newRuleType === 'exact_date' || newRuleType === 'recurring') && (
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      تاریخ یادآور
                    </label>
                    <JalaliDatePicker
                      value={newRemDate}
                      onChange={(d) => setNewRemDate(d || getTodayIso())}
                      calendarType={calendarType}
                      allowClear={false}
                    />
                  </div>
                )}

                {(newRuleType === 'exact_time' || newRuleType === 'recurring') && (
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      ساعت یادآور
                    </label>
                    <input
                      type="time"
                      value={newRemTime}
                      onChange={(e) => setNewRemTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                {(newRuleType === 'hours_before' || newRuleType === 'days_before') && (
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      {newRuleType === 'hours_before' ? 'تعداد ساعت قبل' : 'تعداد روز قبل'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={newOffsetVal}
                      onChange={(e) => setNewOffsetVal(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as RecurrenceType)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="none">بدون تکرار</option>
                    <option value="daily">تکرار روزانه</option>
                    <option value="weekly">تکرار هفتگی</option>
                    <option value="monthly">تکرار ماهانه</option>
                    <option value="custom">تکرار سفارشی (هر N روز)</option>
                  </select>

                  {newRecurrence === 'custom' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span>هر</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={newIntervalDays}
                        onChange={(e) => setNewIntervalDays(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
                      />
                      <span>روز</span>
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRepeatUntilResolved}
                      onChange={(e) => setNewRepeatUntilResolved(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>یادآوری مجدد تا تعیین تکلیف</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleAddReminder}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن یادآور</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          {isExisting && task ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  حذف دائمی انجام شود؟
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await onDelete(task.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  تأیید حذف
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف دائمی</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onSave(task.id, { is_archived: task.is_archived ? 0 : 1 });
                    onClose();
                  }}
                  className="px-3 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{task.is_archived ? 'خروج از آرشیو' : 'انتقال به آرشیو'}</span>
                </button>
              </div>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim() || saving}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
