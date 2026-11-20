import { useState } from 'react';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Volume2,
  Monitor,
  Keyboard,
  HardDrive,
  AppWindow,
} from 'lucide-react';
import type { AppSettings, BackupEntry, Category, WidgetPositionPreset } from '../types.ts';
import { formatDisplayDate, toPersianDigits } from '../utils/jalali.ts';
import { playNotificationSound } from '../utils/sound.ts';

interface SettingsViewProps {
  settings: AppSettings;
  categories: Category[];
  backups: BackupEntry[];
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onCreateCategory: (name: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onCreateSnapshot: () => Promise<void>;
  onRestoreBackupFile: (filename: string) => Promise<void>;
  onRestoreJsonUpload: (data: unknown) => Promise<void>;
  onOpenStandaloneWidget: () => void;
}

export function SettingsView({
  settings,
  categories,
  backups,
  onUpdateSettings,
  onCreateCategory,
  onDeleteCategory,
  onCreateSnapshot,
  onRestoreBackupFile,
  onRestoreJsonUpload,
  onOpenStandaloneWidget,
}: SettingsViewProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#2563EB');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleJsonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onRestoreJsonUpload(parsed);
      showNotice('نسخه پشتیبان با موفقیت بازیابی و جایگزین شد.');
    } catch {
      showNotice('فایل پشتیبان معتبر نیست.');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            تنظیمات، ویجت دسکتاپ و پشتیبان‌گیری
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            پیکربندی محیط کار، رفتار ویجت روی ویندوز، یادآورها، میانبرها و امنیت داده‌ها
          </p>
        </div>

        {statusMessage && (
          <div className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Appearance & Calendar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          ظاهر برنامه و نوع تقویم
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              تم ظاهری (روشن / تاریک)
            </label>
            <div className="flex items-center gap-2">
              {(
                [
                  { id: 'light', label: 'حالت روشن' },
                  { id: 'dark', label: 'حالت تاریک' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    settings.theme === t.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              نوع تقویم پیش‌فرض
            </label>
            <div className="flex items-center gap-2">
              {(
                [
                  { id: 'jalali', label: 'تقویم شمسی (جلالی)' },
                  { id: 'gregorian', label: 'تقویم میلادی' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onUpdateSettings({ calendarType: c.id })}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    settings.calendarType === c.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop System & Floating Widget */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>ویجت شناور و اجرای دسکتاپ ویندوز</span>
          </h2>
          <button
            type="button"
            onClick={onOpenStandaloneWidget}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <AppWindow className="w-3.5 h-3.5 text-blue-600" />
            <span>باز کردن پنجره مستقل ویجت</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            {
              key: 'autoLaunch' as const,
              label: 'اجرای خودکار هنگام روشن شدن ویندوز',
              val: settings.autoLaunch,
            },
            {
              key: 'showWidgetOnStart' as const,
              label: 'نمایش ویجت شناور هنگام شروع سیستم',
              val: settings.showWidgetOnStart,
            },
            {
              key: 'widgetVisible' as const,
              label: 'نمایش ویجت شناور روی میز کار',
              val: settings.widgetVisible,
            },
            {
              key: 'widgetAlwaysOnTop' as const,
              label: 'همیشه در بالاترین لایه بودن ویجت (Always on Top)',
              val: settings.widgetAlwaysOnTop,
            },
            {
              key: 'widgetCompact' as const,
              label: 'نمایش ویجت در حالت فشرده',
              val: settings.widgetCompact,
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
              <input
                type="checkbox"
                checked={item.val}
                onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              شفافیت ویجت ({toPersianDigits(Math.round(settings.widgetOpacity * 100))}٪)
            </label>
            <input
              type="range"
              min={0.45}
              max={1}
              step={0.05}
              value={settings.widgetOpacity}
              onChange={(e) => onUpdateSettings({ widgetOpacity: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">موقعیت پیش‌فرض ویجت</label>
            <select
              value={settings.widgetPositionPreset}
              onChange={(e) =>
                onUpdateSettings({ widgetPositionPreset: e.target.value as WidgetPositionPreset })
              }
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="bottom-left">پایین چپ</option>
              <option value="bottom-right">پایین راست</option>
              <option value="top-left">بالا چپ</option>
              <option value="top-right">بالا راست</option>
              <option value="custom">موقعیت دلخواه ذخیره‌شده</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">عرض ویجت (پیکسل)</label>
            <input
              type="number"
              min={280}
              max={540}
              value={settings.widgetBounds.width}
              onChange={(e) =>
                onUpdateSettings({
                  widgetBounds: { ...settings.widgetBounds, width: Number(e.target.value) || 350 },
                })
              }
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">ارتفاع ویجت (پیکسل)</label>
            <input
              type="number"
              min={240}
              max={680}
              value={settings.widgetBounds.height}
              onChange={(e) =>
                onUpdateSettings({
                  widgetBounds: { ...settings.widgetBounds, height: Number(e.target.value) || 470 },
                })
              }
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      </section>

      {/* Notifications & Quiet Hours */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-blue-600" />
          <span>تنظیمات اعلان‌ها و ساعات سکوت</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">صدای اعلان یادآور</label>
            <div className="flex items-center gap-2">
              <select
                value={settings.notificationSound}
                onChange={(e) =>
                  onUpdateSettings({
                    notificationSound: e.target.value as AppSettings['notificationSound'],
                  })
                }
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="chime">زنگ اداری ملایم (Chime)</option>
                <option value="bell">زنگ شفاف (Bell)</option>
                <option value="soft">هشدار کوتاه (Soft)</option>
                <option value="mute">بی‌صدا</option>
              </select>
              <button
                type="button"
                onClick={() => playNotificationSound(settings.notificationSound)}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                تست صدا
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">نحوه نمایش اعلان‌ها</label>
            <select
              value={settings.notificationDisplay}
              onChange={(e) =>
                onUpdateSettings({
                  notificationDisplay: e.target.value as AppSettings['notificationDisplay'],
                })
              }
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="banner_and_native">اعلان داخل برنامه + اعلان ویندوز/مرورگر</option>
              <option value="in_app_only">فقط پنجره یادآور داخل برنامه</option>
              <option value="native_only">فقط اعلان سیستمی ویندوز</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled}
              onChange={(e) => onUpdateSettings({ quietHoursEnabled: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span className="font-medium">فعال‌سازی ساعات سکوت (عدم پخش صدا و مزاحمت)</span>
          </label>

          <div className="flex items-center gap-2">
            <span>از ساعت:</span>
            <input
              type="time"
              disabled={!settings.quietHoursEnabled}
              value={settings.quietHoursStart}
              onChange={(e) => onUpdateSettings({ quietHoursStart: e.target.value })}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
            />
            <span>تا ساعت:</span>
            <input
              type="time"
              disabled={!settings.quietHoursEnabled}
              value={settings.quietHoursEnd}
              onChange={(e) => onUpdateSettings({ quietHoursEnd: e.target.value })}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
            />
          </div>
        </div>
      </section>

      {/* Custom Categories Manager */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          مدیریت دسته‌بندی‌های اختصاصی
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="نام دسته‌بندی جدید..."
            className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-9 h-9 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
          />
          <button
            type="button"
            disabled={!newCatName.trim()}
            onClick={async () => {
              await onCreateCategory(newCatName.trim(), newCatColor);
              setNewCatName('');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {categories.map((cat) => (
            <div key={cat.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="font-medium text-slate-800 dark:text-slate-100">{cat.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteCategory(cat.id)}
                className="text-slate-400 hover:text-red-600 p-1"
                title="حذف دسته‌بندی"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-blue-600" />
          <span>شخصی‌سازی میانبرهای صفحه‌کلید</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {(
            [
              { key: 'toggleWidget', label: 'نمایش سریع ویجت' },
              { key: 'quickNote', label: 'ثبت یادداشت جدید' },
              { key: 'search', label: 'جست‌وجوی سریع' },
              { key: 'urgentTask', label: 'ثبت کار فوری' },
            ] as const
          ).map((sc) => (
            <div key={sc.key}>
              <label className="block text-slate-500 mb-1">{sc.label}</label>
              <input
                type="text"
                dir="ltr"
                value={settings.shortcuts[sc.key]}
                onChange={(e) =>
                  onUpdateSettings({
                    shortcuts: { ...settings.shortcuts, [sc.key]: e.target.value },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-nums text-left"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Backup, Export, Restore & Windows Installer Info */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600" />
          <span>پشتیبان‌گیری خودکار، بازیابی و خروجی اطلاعات</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={async () => {
              await onCreateSnapshot();
              showNotice('نسخه پشتیبان محلی جدید در پوشه امن پایگاه داده ذخیره شد.');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            تهیه نسخه پشتیبان فوری روی دیسک
          </button>

          <a
            href="/api/export/json"
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی کامل JSON</span>
          </a>

          <a
            href="/api/export/csv"
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی CSV اکسل</span>
          </a>

          <label className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>بازیابی از فایل JSON</span>
            <input type="file" accept=".json" onChange={handleJsonFileUpload} className="hidden" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoBackupEnabled}
              onChange={(e) => onUpdateSettings({ autoBackupEnabled: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span>پشتیبان‌گیری خودکار زمان‌بندی‌شده</span>
          </label>
          <div className="flex items-center gap-2">
            <span>هر</span>
            <input
              type="number"
              min={1}
              max={168}
              value={settings.autoBackupIntervalHours}
              onChange={(e) =>
                onUpdateSettings({ autoBackupIntervalHours: Math.max(1, Number(e.target.value) || 24) })
              }
              className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-center"
            />
            <span>ساعت</span>
          </div>
        </div>

        {backups.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              نسخه‌های پشتیبان ذخیره‌شده روی رایانه:
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {backups.slice(0, 6).map((b) => (
                <div key={b.filename} className="px-3.5 py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono-nums text-slate-700 dark:text-slate-300" dir="ltr">
                      {b.filename}
                    </span>
                    <span className="text-slate-400 mr-3">
                      {formatDisplayDate(b.createdAt.slice(0, 10), settings.calendarType)} ·{' '}
                      {toPersianDigits(Math.max(1, Math.round(b.sizeBytes / 1024)))} کیلوبایت
                    </span>
                  </div>
                  {confirmRestoreFile === b.filename ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await onRestoreBackupFile(b.filename);
                          setConfirmRestoreFile(null);
                          showNotice('اطلاعات از نسخه پشتیبان انتخابی بازیابی شد.');
                        }}
                        className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold"
                      >
                        تأیید بازیابی
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestoreFile(null)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700"
                      >
                        لغو
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreFile(b.filename)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      بازیابی این نسخه
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Windows Packaging Guide */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          <div className="font-bold text-slate-900 dark:text-slate-100">
            ساخت فایل نصبی و اجرایی مستقل ویندوز ۱۰ و ۱۱ (EXE / MSI)
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            ساختار دسکتاپ این نرم‌افزار در پوشه <code dir="ltr">electron/</code> و فایل پیکربندی{' '}
            <code dir="ltr">electron-builder.yml</code> آماده شده است و از System Tray، ویجت شناور مستقل ویندوز (Always on Top)، اجرای خودکار ویندوز و پایگاه داده محلی SQLite پشتیبانی می‌کند. برای ساخت فایل نصبی در ویندوز دستورات زیر را اجرا کنید:
          </p>
          <pre
            dir="ltr"
            className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono-nums text-[11px] overflow-x-auto text-left"
          >
{`npm install -D electron electron-builder
npm run electron:build`}
          </pre>
        </div>
      </section>
    </div>
  );
}
