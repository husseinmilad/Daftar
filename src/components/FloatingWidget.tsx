import { useState, useRef, useEffect } from 'react';
import {
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  X,
  Plus,
  CheckCircle2,
  Circle,
  ExternalLink,
  Move,
  Eye,
  AppWindow,
} from 'lucide-react';
import type { AppSettings, Task, WidgetPositionPreset } from '../types.ts';
import {
  formatDisplayDate,
  getTodayIso,
  toPersianDigits,
  pad2,
} from '../utils/jalali.ts';
import {
  PRIORITY_META,
  isTaskActive,
  isTaskOverdue,
  sortTasksByPriorityAndTime,
} from '../utils/taskFilters.ts';

interface FloatingWidgetProps {
  tasks: Task[];
  settings: AppSettings;
  standaloneMode?: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onQuickCreate: (title: string) => Promise<void>;
  onToggleComplete: (task: Task) => Promise<void>;
  onOpenMainWindow: () => void;
  onOpenStandaloneWindow?: () => void;
  onSelectTask?: (task: Task) => void;
}

export function FloatingWidget({
  tasks,
  settings,
  standaloneMode = false,
  onUpdateSettings,
  onQuickCreate,
  onToggleComplete,
  onOpenMainWindow,
  onOpenStandaloneWindow,
  onSelectTask,
}: FloatingWidgetProps) {
  const [now, setNow] = useState(new Date());
  const [quickText, setQuickText] = useState('');
  const [showQuickControls, setShowQuickControls] = useState(false);

  // Drag & resize state for in-app floating desktop widget simulation
  const [bounds, setBounds] = useState(settings.widgetBounds);
  const draggingRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizingRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  useEffect(() => {
    setBounds(settings.widgetBounds);
  }, [settings.widgetBounds]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!standaloneMode && !settings.widgetVisible) {
    return null;
  }

  const todayIso = getTodayIso();
  const activeTasks = tasks.filter(isTaskActive).sort(sortTasksByPriorityAndTime);
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, now));
  const urgentTasks = activeTasks.filter((t) => t.priority === 'critical' || t.priority === 'high');
  const todayImportant = activeTasks
    .filter((t) => t.due_date === todayIso || t.is_pinned_today || isTaskOverdue(t, now) || t.priority === 'critical')
    .slice(0, settings.widgetCompact ? 4 : 7);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    await onQuickCreate(quickText.trim());
    setQuickText('');
  };

  const applyPositionPreset = (preset: WidgetPositionPreset) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = bounds.width || 350;
    const h = settings.widgetCompact ? 290 : bounds.height || 470;
    let x = 24;
    let y = 80;
    if (preset === 'top-left') {
      x = 24;
      y = 76;
    } else if (preset === 'top-right') {
      x = Math.max(24, vw - w - 24);
      y = 76;
    } else if (preset === 'bottom-left') {
      x = 24;
      y = Math.max(24, vh - h - 24);
    } else if (preset === 'bottom-right') {
      x = Math.max(24, vw - w - 24);
      y = Math.max(24, vh - h - 24);
    }
    const nextBounds = { x, y, width: w, height: h };
    setBounds(nextBounds);
    onUpdateSettings({ widgetPositionPreset: preset, widgetBounds: nextBounds });
  };

  // Dragging handlers (for non-standalone floating overlay)
  const handlePointerDownDrag = (e: React.PointerEvent) => {
    if (standaloneMode) return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: bounds.x,
      origY: bounds.y,
    };
  };

  const handlePointerMoveDrag = (e: React.PointerEvent) => {
    if (draggingRef.current) {
      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;
      const nextX = Math.max(8, Math.min(window.innerWidth - 260, draggingRef.current.origX + dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 140, draggingRef.current.origY + dy));
      setBounds((prev) => ({ ...prev, x: nextX, y: nextY }));
    } else if (resizingRef.current) {
      const dx = resizingRef.current.startX - e.clientX; // RTL left edge resize increases width
      const dy = e.clientY - resizingRef.current.startY;
      const nextW = Math.max(280, Math.min(540, resizingRef.current.origW + dx));
      const nextH = Math.max(240, Math.min(680, resizingRef.current.origH + dy));
      setBounds((prev) => ({ ...prev, width: nextW, height: nextH }));
    }
  };

  const handlePointerUpDrag = () => {
    if (draggingRef.current || resizingRef.current) {
      draggingRef.current = null;
      resizingRef.current = null;
      onUpdateSettings({ widgetBounds: bounds, widgetPositionPreset: 'custom' });
    }
  };

  const handlePointerDownResize = (e: React.PointerEvent) => {
    if (standaloneMode) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: bounds.width,
      origH: bounds.height,
    };
  };

  const clockStr = toPersianDigits(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
  const dateStr = formatDisplayDate(todayIso, settings.calendarType, true);

  const containerStyle: React.CSSProperties = standaloneMode
    ? { opacity: settings.widgetOpacity }
    : {
        position: 'fixed',
        left: `${Math.min(bounds.x, Math.max(12, window.innerWidth - bounds.width - 12))}px`,
        top: `${Math.min(bounds.y, Math.max(12, window.innerHeight - 240))}px`,
        width: `${bounds.width}px`,
        height: settings.widgetCompact ? 'auto' : `${bounds.height}px`,
        opacity: settings.widgetOpacity,
        zIndex: settings.widgetAlwaysOnTop ? 60 : 30,
      };

  return (
    <aside
      style={containerStyle}
      className={`${
        standaloneMode ? 'w-full h-screen' : 'shadow-2xl'
      } rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col overflow-hidden transition-shadow select-none`}
      aria-label="ویجت شناور دستیار دفتر"
    >
      {/* Draggable Title Bar */}
      <div
        onPointerDown={handlePointerDownDrag}
        onPointerMove={handlePointerMoveDrag}
        onPointerUp={handlePointerUpDrag}
        className={`px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 flex items-center justify-between gap-2 ${
          standaloneMode ? 'app-drag' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Move className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                دستیار دفتر
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                {clockStr}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {dateStr}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 app-no-drag">
          <button
            type="button"
            onClick={() => setShowQuickControls((v) => !v)}
            title="تنظیمات شفافیت و موقعیت ویجت"
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ widgetAlwaysOnTop: !settings.widgetAlwaysOnTop })}
            title={settings.widgetAlwaysOnTop ? 'حالت همیشه روی پنجره‌ها فعال است' : 'فعال‌سازی همیشه روی پنجره‌ها'}
            className={`p-1.5 rounded-md transition-colors ${
              settings.widgetAlwaysOnTop
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60'
                : 'text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            {settings.widgetAlwaysOnTop ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ widgetCompact: !settings.widgetCompact })}
            title={settings.widgetCompact ? 'حالت گسترده' : 'حالت فشرده'}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          >
            {settings.widgetCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          {!standaloneMode && onOpenStandaloneWindow && (
            <button
              type="button"
              onClick={onOpenStandaloneWindow}
              title="باز کردن در پنجره مستقل دسکتاپ"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700"
            >
              <AppWindow className="w-3.5 h-3.5" />
            </button>
          )}

          {standaloneMode ? (
            <button
              type="button"
              onClick={onOpenMainWindow}
              title="باز کردن پنجره اصلی"
              className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdateSettings({ widgetVisible: false })}
              title="مخفی کردن ویجت (Ctrl+Shift+Space)"
              className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Opacity & Position Pop-down */}
      {showQuickControls && (
        <div className="px-3.5 py-2.5 bg-slate-100/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 space-y-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-600 dark:text-slate-300">شفافیت ویجت:</span>
            <input
              type="range"
              min={0.45}
              max={1}
              step={0.05}
              value={settings.widgetOpacity}
              onChange={(e) => onUpdateSettings({ widgetOpacity: Number(e.target.value) })}
              className="w-28 accent-blue-600"
            />
            <span className="tabular-nums text-slate-700 dark:text-slate-200 w-9 text-left">
              {toPersianDigits(Math.round(settings.widgetOpacity * 100))}٪
            </span>
          </div>
          {!standaloneMode && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-600 dark:text-slate-300">موقعیت:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'top-right', label: 'بالا راست' },
                    { id: 'top-left', label: 'بالا چپ' },
                    { id: 'bottom-right', label: 'پایین راست' },
                    { id: 'bottom-left', label: 'پایین چپ' },
                  ] as const
                ).map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => applyPositionPreset(pos.id)}
                    className={`px-1.5 py-0.5 rounded border text-[10px] ${
                      settings.widgetPositionPreset === pos.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remaining & Urgent Summary Strip */}
      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
        <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
          {toPersianDigits(activeTasks.length)} کار باقی‌مانده
        </span>
        <div className="flex items-center gap-2 tabular-nums">
          {urgentTasks.length > 0 && (
            <span className="text-orange-700 dark:text-orange-400 font-medium">
              {toPersianDigits(urgentTasks.length)} فوری
            </span>
          )}
          {overdueTasks.length > 0 && (
            <>
              <span>·</span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                {toPersianDigits(overdueTasks.length)} عقب‌افتاده
              </span>
            </>
          )}
        </div>
      </div>

      {/* Quick 1-Click Note Input */}
      <form onSubmit={handleQuickAdd} className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
        <input
          type="text"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="ثبت سریع یادداشت در ویجت..."
          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
        />
        <button
          type="submit"
          disabled={!quickText.trim()}
          title="افزودن"
          className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Today's Important & Overdue Tasks */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {todayImportant.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            تمام کارهای فوری و امروز انجام شده‌اند.
          </div>
        ) : (
          todayImportant.map((t) => {
            const overdue = isTaskOverdue(t, now);
            const pMeta = PRIORITY_META[t.priority];
            return (
              <div
                key={t.id}
                className="group flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onToggleComplete(t)}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 shrink-0"
                  title="علامت‌گذاری به عنوان انجام‌شده"
                >
                  {t.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => (onSelectTask ? onSelectTask(t) : onOpenMainWindow())}
                  className="flex-1 text-right min-w-0"
                >
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                    {t.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] mt-0.5 text-slate-500 dark:text-slate-400">
                    <span className={pMeta.textClass}>{pMeta.label}</span>
                    {t.due_time && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">{toPersianDigits(t.due_time)}</span>
                      </>
                    )}
                    {overdue && (
                      <>
                        <span>·</span>
                        <span className="text-red-600 dark:text-red-400 font-medium">عقب‌افتاده</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Action */}
      <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={onOpenMainWindow}
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          <span>باز کردن پنجره اصلی</span>
        </button>

        {!standaloneMode && !settings.widgetCompact && (
          <div
            onPointerDown={handlePointerDownResize}
            onPointerMove={handlePointerMoveDrag}
            onPointerUp={handlePointerUpDrag}
            title="تغییر اندازه ویجت"
            className="w-4 h-4 cursor-nwse-resize text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
          >
            <svg viewBox="0 0 12 12" className="w-3 h-3">
              <path d="M2 10L10 2M6 10L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    </aside>
  );
}
