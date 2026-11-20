import { useEffect, useState, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  GitBranch,
  Search,
  Settings,
  Sun,
  Moon,
  StickyNote,
  Plus,
} from 'lucide-react';
import type {
  ActiveView,
  AppSettings,
  BackupEntry,
  Category,
  Followup,
  Task,
  TaskPayload,
} from './types.ts';
import { DEFAULT_SETTINGS_CLIENT } from './utils/defaults.ts';
import { api, subscribeDataChanges } from './api/client.ts';
import { QuickCaptureBar } from './components/QuickCaptureBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { FollowupsView } from './components/FollowupsView.tsx';
import { SearchArchiveView } from './components/SearchArchiveView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { TaskDrawer } from './components/TaskDrawer.tsx';
import { FloatingWidget } from './components/FloatingWidget.tsx';
import { ReminderAlertManager } from './components/ReminderAlertManager.tsx';
import { getTodayIso, toPersianDigits } from './utils/jalali.ts';
import { isTaskActive } from './utils/taskFilters.ts';

function matchesShortcut(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((p) => p.trim());
  const needCtrl = parts.includes('ctrl') || parts.includes('commandorcontrol');
  const needShift = parts.includes('shift');
  const needAlt = parts.includes('alt');
  const mainKey = parts.find((p) => !['ctrl', 'commandorcontrol', 'shift', 'alt'].includes(p));

  if (Boolean(e.ctrlKey || e.metaKey) !== needCtrl) return false;
  if (Boolean(e.shiftKey) !== needShift) return false;
  if (Boolean(e.altKey) !== needAlt) return false;
  if (!mainKey) return false;

  if (mainKey === 'space') return e.code === 'Space' || e.key === ' ';
  return e.key.toLowerCase() === mainKey || e.code.toLowerCase() === `key${mainKey}`;
}

export default function App() {
  const isStandaloneWidget =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'widget';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS_CLIENT);
  const [backups, setBackups] = useState<BackupEntry[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [forceUrgentQuick, setForceUrgentQuick] = useState(false);

  const quickInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setTasks(data.tasks);
      setCategories(data.categories);
      setFollowups(data.followups);
      setSettings(data.settings);
      setBackups(data.backups);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'خطا در برقراری ارتباط با پایگاه داده محلی');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const unsubSync = subscribeDataChanges(() => {
      loadAll();
    });
    return () => unsubSync();
  }, [loadAll]);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  // Listen to Electron tray/global shortcut events when running in Windows Desktop
  useEffect(() => {
    if (!window.electronDesk?.onDesktopAction) return;
    return window.electronDesk.onDesktopAction((payload) => {
      if (payload.type === 'focus-quick-note') {
        setForceUrgentQuick(false);
        setTimeout(() => quickInputRef.current?.focus(), 50);
      } else if (payload.type === 'new-urgent-task') {
        setForceUrgentQuick(true);
        setTimeout(() => quickInputRef.current?.focus(), 50);
      }
    });
  }, []);

  const handleUpdateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await api.updateSettings(patch);
    setSettings(updated);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+Shift+Space, Ctrl+N, Ctrl+F, Ctrl+Shift+N, Esc)
  useEffect(() => {
    if (isStandaloneWidget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setForceUrgentQuick(false);
        return;
      }

      if (matchesShortcut(e, settings.shortcuts.toggleWidget)) {
        e.preventDefault();
        if (window.electronDesk?.toggleWidget) {
          window.electronDesk.toggleWidget();
        } else {
          handleUpdateSettings({ widgetVisible: !settings.widgetVisible });
        }
        return;
      }

      if (matchesShortcut(e, settings.shortcuts.urgentTask)) {
        e.preventDefault();
        setForceUrgentQuick(true);
        setTimeout(() => quickInputRef.current?.focus(), 20);
        return;
      }

      if (matchesShortcut(e, settings.shortcuts.quickNote)) {
        e.preventDefault();
        setForceUrgentQuick(false);
        setTimeout(() => quickInputRef.current?.focus(), 20);
        return;
      }

      if (matchesShortcut(e, settings.shortcuts.search)) {
        e.preventDefault();
        setActiveView('search_archive');
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isStandaloneWidget, settings.shortcuts, settings.widgetVisible, handleUpdateSettings]);

  const handleCreateTask = async (payload: TaskPayload) => {
    const created = await api.createTask(payload);
    setTasks((prev) => [created, ...prev]);
    setForceUrgentQuick(false);
  };

  const handleSaveTask = async (id: string | null, payload: TaskPayload) => {
    if (id) {
      const updated = await api.updateTask(id, payload);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } else {
      await handleCreateTask(payload);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'not_started' : 'completed';
    const updated = await api.updateTask(task.id, { status: nextStatus });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  };

  const handleTogglePinToday = async (task: Task) => {
    const updated = await api.updateTask(task.id, { is_pinned_today: task.is_pinned_today ? 0 : 1 });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  };

  const handleDeleteTask = async (id: string) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const openTaskForEdit = (task: Task) => {
    setEditingTask(task);
    setDrawerOpen(true);
  };

  const openNewTaskDrawer = (prefill?: Partial<Task>) => {
    setEditingTask(
      prefill
        ? ({
            id: '',
            title: '',
            description: '',
            due_date: prefill.due_date ?? getTodayIso(),
            due_time: prefill.due_time ?? null,
            deadline: null,
            is_all_day: prefill.is_all_day ?? 0,
            priority: 'medium',
            category_id: null,
            status: 'not_started',
            related_person: '',
            related_link: '',
            extra_notes: '',
            is_quick_note: 0,
            is_pinned_today: 0,
            is_archived: 0,
            completed_at: null,
            created_at: '',
            updated_at: '',
            reminders: [],
          } as Task)
        : null
    );
    setDrawerOpen(true);
  };

  // Standalone Floating Desktop Widget Mode (?mode=widget)
  if (isStandaloneWidget) {
    return (
      <div className="min-h-screen bg-transparent">
        <FloatingWidget
          tasks={tasks}
          settings={settings}
          standaloneMode={true}
          onUpdateSettings={handleUpdateSettings}
          onQuickCreate={async (title) => {
            await handleCreateTask({
              title,
              due_date: getTodayIso(),
              priority: 'medium',
              is_quick_note: 1,
            });
          }}
          onToggleComplete={handleToggleComplete}
          onOpenMainWindow={() => {
            if (window.electronDesk?.openMainWindow) {
              window.electronDesk.openMainWindow();
            } else {
              window.location.href = '/';
            }
          }}
        />
      </div>
    );
  }

  const activeCount = tasks.filter(isTaskActive).length;
  const openFollowupsCount = followups.filter(
    (f) => !f.is_archived && f.status !== 'completed' && f.status !== 'cancelled'
  ).length;

  const navItems: { id: ActiveView; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'tasks', label: 'کارها و دسته‌بندی', icon: CheckSquare, count: activeCount },
    { id: 'calendar', label: 'تقویم شمسی', icon: CalendarDays },
    { id: 'followups', label: 'پیگیری امور', icon: GitBranch, count: openFollowupsCount },
    { id: 'search_archive', label: 'جست‌وجو و آرشیو', icon: Search },
    { id: 'settings', label: 'تنظیمات', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Persistent Desktop Sidebar */}
      <aside className="w-60 shrink-0 hidden md:flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            دستیار دفتر
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مدیریت امور روزانه و پیگیری
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`tabular-nums ${
                      isActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {toPersianDigits(item.count)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Controls */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => handleUpdateSettings({ widgetVisible: !settings.widgetVisible })}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
              settings.widgetVisible
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <StickyNote className="w-3.5 h-3.5" />
              <span>ویجت شناور</span>
            </span>
            <span>{settings.widgetVisible ? 'نمایش' : 'مخفی'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            className="w-full px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              {settings.theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>حالت نمایش</span>
            </span>
            <span>{settings.theme === 'dark' ? 'تاریک' : 'روشن'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Top Bar */}
        <header className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="md:hidden text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              دستیار دفتر
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {navItems.find((n) => n.id === activeView)?.label}
            </span>
          </div>

          {/* Mobile Nav */}
          <nav className="flex md:hidden items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap ${
                  activeView === item.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openNewTaskDrawer()}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت کار جدید</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Workspace */}
        <main className="flex-1 p-5 md:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Always-Ready Quick Capture Bar */}
          <QuickCaptureBar
            categories={categories}
            onCreateTask={handleCreateTask}
            inputRef={quickInputRef}
            forceUrgentDefault={forceUrgentQuick}
            onEscape={() => setForceUrgentQuick(false)}
          />

          {error && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-24 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
              <div className="h-64 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : (
            <>
              {activeView === 'dashboard' && (
                <DashboardView
                  tasks={tasks}
                  followups={followups}
                  categories={categories}
                  settings={settings}
                  onToggleComplete={handleToggleComplete}
                  onTogglePinToday={handleTogglePinToday}
                  onSelectTask={openTaskForEdit}
                  onNavigate={setActiveView}
                />
              )}

              {activeView === 'tasks' && (
                <TasksView
                  tasks={tasks}
                  categories={categories}
                  settings={settings}
                  onToggleComplete={handleToggleComplete}
                  onTogglePinToday={handleTogglePinToday}
                  onArchiveTask={async (t) => {
                    const updated = await api.updateTask(t.id, { is_archived: 1 });
                    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
                  }}
                  onSelectTask={openTaskForEdit}
                  onCreateNewTask={() => openNewTaskDrawer()}
                />
              )}

              {activeView === 'calendar' && (
                <CalendarView
                  tasks={tasks}
                  settings={settings}
                  onRescheduleTask={async (taskId, dueDate, dueTime, isAllDay) => {
                    const patch: Partial<Task> = { due_date: dueDate };
                    if (dueTime !== undefined) patch.due_time = dueTime;
                    if (isAllDay !== undefined) patch.is_all_day = isAllDay;
                    const updated = await api.updateTask(taskId, patch);
                    setTasks((prev) => prev.map((x) => (x.id === taskId ? updated : x)));
                  }}
                  onSelectTask={openTaskForEdit}
                  onCreateTaskOnDate={(dueDate, dueTime, isAllDay) =>
                    openNewTaskDrawer({
                      due_date: dueDate,
                      due_time: dueTime ?? null,
                      is_all_day: isAllDay ? 1 : 0,
                    })
                  }
                />
              )}

              {activeView === 'followups' && (
                <FollowupsView
                  followups={followups}
                  settings={settings}
                  onCreateFollowup={async (payload) => {
                    const created = await api.createFollowup(payload);
                    setFollowups((prev) => [...prev, created]);
                    return created;
                  }}
                  onUpdateFollowup={async (id, patch) => {
                    const updated = await api.updateFollowup(id, patch);
                    if (updated) setFollowups((prev) => prev.map((f) => (f.id === id ? updated : f)));
                    return updated;
                  }}
                  onAddLog={async (id, payload) => {
                    const updated = await api.addFollowupLog(id, payload);
                    if (updated) setFollowups((prev) => prev.map((f) => (f.id === id ? updated : f)));
                    return updated;
                  }}
                  onDeleteFollowup={async (id) => {
                    await api.deleteFollowup(id);
                    setFollowups((prev) => prev.filter((f) => f.id !== id));
                  }}
                />
              )}

              {activeView === 'search_archive' && (
                <SearchArchiveView
                  tasks={tasks}
                  followups={followups}
                  categories={categories}
                  settings={settings}
                  searchInputRef={searchInputRef}
                  onSelectTask={openTaskForEdit}
                  onRestoreTask={async (id) => {
                    const updated = await api.updateTask(id, {
                      is_archived: 0,
                      status: 'not_started',
                    });
                    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
                  }}
                  onDeleteTask={handleDeleteTask}
                  onRestoreFollowup={async (id) => {
                    const updated = await api.updateFollowup(id, { is_archived: 0 });
                    if (updated) setFollowups((prev) => prev.map((f) => (f.id === id ? updated : f)));
                  }}
                  onDeleteFollowup={async (id) => {
                    await api.deleteFollowup(id);
                    setFollowups((prev) => prev.filter((f) => f.id !== id));
                  }}
                />
              )}

              {activeView === 'settings' && (
                <SettingsView
                  settings={settings}
                  categories={categories}
                  backups={backups}
                  onUpdateSettings={handleUpdateSettings}
                  onCreateCategory={async (name, color) => {
                    const cat = await api.createCategory(name, color);
                    setCategories((prev) => [...prev, cat]);
                  }}
                  onDeleteCategory={async (id) => {
                    await api.deleteCategory(id);
                    setCategories((prev) => prev.filter((c) => c.id !== id));
                  }}
                  onCreateSnapshot={async () => {
                    const res = await api.createSnapshot();
                    setBackups(res.backups);
                  }}
                  onRestoreBackupFile={async (filename) => {
                    const res = await api.restoreBackupFile(filename);
                    setTasks(res.tasks);
                    setCategories(res.categories);
                    setFollowups(res.followups);
                    setSettings(res.settings);
                  }}
                  onRestoreJsonUpload={async (data) => {
                    const res = await api.restoreFromJson(data);
                    setTasks(res.tasks);
                    setCategories(res.categories);
                    setFollowups(res.followups);
                    setSettings(res.settings);
                  }}
                  onOpenStandaloneWidget={() => {
                    if (window.electronDesk?.toggleWidget) {
                      window.electronDesk.toggleWidget();
                    } else {
                      handleUpdateSettings({ widgetVisible: true });
                    }
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Interactive Floating Desktop Widget Overlay */}
      <FloatingWidget
        tasks={tasks}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onQuickCreate={async (title) => {
          await handleCreateTask({
            title,
            due_date: getTodayIso(),
            priority: 'medium',
            is_quick_note: 1,
          });
        }}
        onToggleComplete={handleToggleComplete}
        onOpenMainWindow={() => {
          setActiveView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenStandaloneWindow={() => {
          const a = document.createElement('a');
          a.href = '/?mode=widget';
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.click();
        }}
        onSelectTask={openTaskForEdit}
      />

      {/* Full Task Editor Drawer */}
      <TaskDrawer
        task={editingTask && editingTask.id ? editingTask : editingTask}
        isOpen={drawerOpen}
        categories={categories}
        calendarType={settings.calendarType}
        onClose={() => {
          setDrawerOpen(false);
          setEditingTask(null);
        }}
        onSave={async (id, payload) => {
          const actualId = editingTask && editingTask.id ? editingTask.id : null;
          await handleSaveTask(actualId, payload);
        }}
        onDelete={handleDeleteTask}
      />

      {/* Background Reminder Alert & Snooze Manager */}
      <ReminderAlertManager
        tasks={tasks}
        settings={settings}
        onCompleteTask={async (taskId) => {
          const updated = await api.updateTask(taskId, { status: 'completed' });
          setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        }}
        onSnoozeReminder={async (remId, snoozedUntilIso) => {
          await api.snoozeReminder(remId, snoozedUntilIso);
          await loadAll();
        }}
        onDismissReminder={async (remId) => {
          await api.dismissReminder(remId);
          await loadAll();
        }}
        onOpenTask={openTaskForEdit}
      />
    </div>
  );
}
