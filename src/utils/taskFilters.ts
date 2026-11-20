import type { Priority, SmartGroup, Task, TaskStatus } from '../types.ts';
import {
  addDaysIso,
  getEndOfPersianWeekIso,
  getStartOfPersianWeekIso,
  getTodayIso,
  pad2,
} from './jalali.ts';

export const PRIORITY_META: Record<
  Priority,
  { label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  critical: {
    label: 'بحرانی',
    textClass: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/40',
    borderClass: 'border-red-200 dark:border-red-900/60',
  },
  high: {
    label: 'زیاد',
    textClass: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/40',
    borderClass: 'border-orange-200 dark:border-orange-900/60',
  },
  medium: {
    label: 'متوسط',
    textClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/40',
    borderClass: 'border-blue-200 dark:border-blue-900/60',
  },
  low: {
    label: 'کم',
    textClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-100 dark:bg-slate-800/60',
    borderClass: 'border-slate-200 dark:border-slate-700',
  },
};

export const STATUS_META: Record<
  TaskStatus,
  { label: string; textClass: string }
> = {
  not_started: { label: 'شروع نشده', textClass: 'text-slate-600 dark:text-slate-400' },
  in_progress: { label: 'در حال انجام', textClass: 'text-blue-700 dark:text-blue-400' },
  waiting: { label: 'منتظر اقدام دیگران', textClass: 'text-amber-700 dark:text-amber-400' },
  needs_followup: { label: 'نیازمند پیگیری', textClass: 'text-orange-700 dark:text-orange-400' },
  paused: { label: 'متوقف‌شده', textClass: 'text-slate-500 dark:text-slate-400' },
  completed: { label: 'انجام‌شده', textClass: 'text-emerald-700 dark:text-emerald-400' },
  cancelled: { label: 'لغوشده', textClass: 'text-rose-700 dark:text-rose-400' },
};

export const FOLLOWUP_STAGES = [
  'ثبت اولیه',
  'ارسال به واحد مربوطه',
  'انتظار برای پاسخ',
  'دریافت پاسخ',
  'بررسی نتیجه',
  'خاتمه موضوع',
];

export const SMART_GROUPS: { id: SmartGroup; label: string }[] = [
  { id: 'all', label: 'همه کارها' },
  { id: 'urgent', label: 'فوری و ضروری' },
  { id: 'today', label: 'کارهای امروز' },
  { id: 'scheduled', label: 'زمان‌بندی‌شده ساعتی' },
  { id: 'tomorrow', label: 'کارهای فردا' },
  { id: 'this_week', label: 'کارهای این هفته' },
  { id: 'upcoming', label: 'کارهای آینده' },
  { id: 'unscheduled', label: 'بدون زمان مشخص' },
  { id: 'waiting', label: 'در انتظار پاسخ یا اقدام دیگران' },
  { id: 'completed', label: 'کارهای انجام‌شده' },
  { id: 'overdue', label: 'کارهای عقب‌افتاده' },
];

export function isTaskActive(task: Task): boolean {
  return !task.is_archived && task.status !== 'completed' && task.status !== 'cancelled';
}

export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (!isTaskActive(task) || !task.due_date) return false;
  const today = getTodayIso();
  if (task.due_date < today) return true;
  if (task.due_date === today && task.due_time) {
    const currentHhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    return task.due_time < currentHhmm;
  }
  return false;
}

export function matchesSmartGroup(task: Task, group: SmartGroup): boolean {
  if (task.is_archived) return false;
  const today = getTodayIso();
  const tomorrow = addDaysIso(today, 1);
  const weekStart = getStartOfPersianWeekIso(today);
  const weekEnd = getEndOfPersianWeekIso(today);

  switch (group) {
    case 'all':
      return true;
    case 'urgent':
      return isTaskActive(task) && (task.priority === 'critical' || task.priority === 'high');
    case 'today':
      return task.due_date === today;
    case 'scheduled':
      return isTaskActive(task) && Boolean(task.due_time);
    case 'tomorrow':
      return task.due_date === tomorrow;
    case 'this_week':
      return Boolean(task.due_date && task.due_date >= weekStart && task.due_date <= weekEnd);
    case 'upcoming':
      return isTaskActive(task) && Boolean(task.due_date && task.due_date > weekEnd);
    case 'unscheduled':
      return isTaskActive(task) && !task.due_date;
    case 'waiting':
      return task.status === 'waiting' || task.status === 'needs_followup';
    case 'completed':
      return task.status === 'completed';
    case 'overdue':
      return isTaskOverdue(task);
    default:
      return true;
  }
}

export function sortTasksByPriorityAndTime(a: Task, b: Task): number {
  const rank: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const aDone = a.status === 'completed' || a.status === 'cancelled' ? 1 : 0;
  const bDone = b.status === 'completed' || b.status === 'cancelled' ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date.localeCompare(b.due_date);
  }
  if (a.due_time && b.due_time && a.due_time !== b.due_time) {
    return a.due_time.localeCompare(b.due_time);
  }
  return b.created_at.localeCompare(a.created_at);
}
