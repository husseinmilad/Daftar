export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting'
  | 'needs_followup'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type SmartGroup =
  | 'all'
  | 'urgent'
  | 'today'
  | 'scheduled'
  | 'tomorrow'
  | 'this_week'
  | 'upcoming'
  | 'unscheduled'
  | 'waiting'
  | 'completed'
  | 'overdue';

export type ReminderRuleType =
  | 'exact_time'
  | 'exact_date'
  | 'hours_before'
  | 'days_before'
  | 'recurring';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Category {
  id: string;
  name: string;
  color: string;
  is_system: number;
  sort_order: number;
  created_at: string;
}

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string; // ISO local datetime string YYYY-MM-DDTHH:mm
  rule_type: ReminderRuleType;
  offset_value: number;
  recurrence: RecurrenceType;
  recurrence_interval_days: number;
  repeat_until_resolved: number;
  snoozed_until: string | null;
  is_dismissed: number;
  last_triggered_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string | null; // YYYY-MM-DD
  due_time: string | null; // HH:mm
  deadline: string | null; // YYYY-MM-DDTHH:mm or YYYY-MM-DD
  is_all_day: number;
  priority: Priority;
  category_id: string | null;
  status: TaskStatus;
  related_person: string;
  related_link: string;
  extra_notes: string;
  is_quick_note: number;
  is_pinned_today: number;
  is_archived: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  reminders?: Reminder[];
}

export type TaskPayload = Omit<Partial<Task>, 'reminders'> & {
  reminders?: Partial<Reminder>[];
};

export interface FollowupLog {
  id: string;
  followup_id: string;
  stage_label: string;
  note: string;
  logged_at: string;
}

export interface Followup {
  id: string;
  title: string;
  reference_code: string;
  counterparty: string;
  status: TaskStatus;
  priority: Priority;
  next_followup_date: string; // YYYY-MM-DD (required)
  next_followup_time: string | null; // HH:mm
  linked_task_id: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
  logs?: FollowupLog[];
}

export interface ShortcutConfig {
  toggleWidget: string;
  quickNote: string;
  search: string;
  urgentTask: string;
}

export type WidgetPositionPreset =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'custom';

export interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  calendarType: 'jalali' | 'gregorian';
  autoLaunch: boolean;
  showWidgetOnStart: boolean;
  widgetAlwaysOnTop: boolean;
  widgetVisible: boolean;
  widgetCompact: boolean;
  widgetOpacity: number;
  widgetPositionPreset: WidgetPositionPreset;
  widgetBounds: WidgetBounds;
  notificationSound: 'chime' | 'bell' | 'soft' | 'mute';
  notificationDisplay: 'banner_and_native' | 'native_only' | 'in_app_only';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  lastAutoBackupAt: string | null;
  shortcuts: ShortcutConfig;
}

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export type ActiveView =
  | 'dashboard'
  | 'tasks'
  | 'calendar'
  | 'followups'
  | 'search_archive'
  | 'settings';

declare global {
  interface Window {
    electronDesk?: {
      isElectron: boolean;
      toggleWidget: () => Promise<boolean>;
      openMainWindow: () => Promise<boolean>;
      applyDesktopSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      onDesktopAction: (cb: (payload: { type: string }) => void) => () => void;
    };
  }
}
