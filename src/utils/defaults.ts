import type { AppSettings } from '../types.ts';

export const DEFAULT_SETTINGS_CLIENT: AppSettings = {
  theme: 'light',
  calendarType: 'jalali',
  autoLaunch: true,
  showWidgetOnStart: true,
  widgetAlwaysOnTop: true,
  widgetVisible: true,
  widgetCompact: false,
  widgetOpacity: 0.96,
  widgetPositionPreset: 'bottom-left',
  widgetBounds: { x: 28, y: 120, width: 350, height: 470 },
  notificationSound: 'chime',
  notificationDisplay: 'banner_and_native',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:30',
  autoBackupEnabled: true,
  autoBackupIntervalHours: 24,
  lastAutoBackupAt: null,
  shortcuts: {
    toggleWidget: 'Ctrl+Shift+Space',
    quickNote: 'Ctrl+N',
    search: 'Ctrl+F',
    urgentTask: 'Ctrl+Shift+N',
  },
};
