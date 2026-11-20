import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AppSettings,
  BackupEntry,
  Category,
  Followup,
  FollowupLog,
  Reminder,
  Task,
} from '../types.ts';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const DEFAULT_SETTINGS: AppSettings = {
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

export class OfficeDatabase {
  public db: Database.Database;
  public dbPath: string;
  public backupDir: string;

  constructor(customPath?: string) {
    this.dbPath =
      customPath ||
      process.env.OFFICE_DESK_DB_PATH ||
      path.join(process.cwd(), 'data', 'office-desk.db');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.backupDir = path.join(dir, 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
    this.seedInitialIfEmpty();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#2563EB',
        is_system INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        due_date TEXT,
        due_time TEXT,
        deadline TEXT,
        is_all_day INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        category_id TEXT,
        status TEXT NOT NULL DEFAULT 'not_started',
        related_person TEXT NOT NULL DEFAULT '',
        related_link TEXT NOT NULL DEFAULT '',
        extra_notes TEXT NOT NULL DEFAULT '',
        is_quick_note INTEGER NOT NULL DEFAULT 0,
        is_pinned_today INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        rule_type TEXT NOT NULL DEFAULT 'exact_time',
        offset_value INTEGER NOT NULL DEFAULT 0,
        recurrence TEXT NOT NULL DEFAULT 'none',
        recurrence_interval_days INTEGER NOT NULL DEFAULT 1,
        repeat_until_resolved INTEGER NOT NULL DEFAULT 0,
        snoozed_until TEXT,
        is_dismissed INTEGER NOT NULL DEFAULT 0,
        last_triggered_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS followups (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        reference_code TEXT NOT NULL DEFAULT '',
        counterparty TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'in_progress',
        priority TEXT NOT NULL DEFAULT 'medium',
        next_followup_date TEXT NOT NULL,
        next_followup_time TEXT,
        linked_task_id TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS followup_logs (
        id TEXT PRIMARY KEY,
        followup_id TEXT NOT NULL,
        stage_label TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        logged_at TEXT NOT NULL,
        FOREIGN KEY (followup_id) REFERENCES followups(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
      CREATE INDEX IF NOT EXISTS idx_followups_next_date ON followups(next_followup_date);
    `);
  }

  private seedInitialIfEmpty() {
    const initialized = this.db
      .prepare(`SELECT value FROM settings WHERE key = 'db_initialized'`)
      .get() as { value: string } | undefined;

    if (initialized) return;

    const now = new Date().toISOString();
    const today = isoDateOffset(0);
    const tomorrow = isoDateOffset(1);
    const yesterday = isoDateOffset(-1);
    const inThreeDays = isoDateOffset(3);

    const seedCategories = [
      { id: 'cat-admin', name: 'امور اداری و مکاتبات', color: '#2563EB', sort_order: 1 },
      { id: 'cat-finance', name: 'مالی و قراردادها', color: '#D97706', sort_order: 2 },
      { id: 'cat-meetings', name: 'جلسات و هماهنگی', color: '#0F766E', sort_order: 3 },
      { id: 'cat-procurement', name: 'خرید و تدارکات', color: '#475569', sort_order: 4 },
      { id: 'cat-personal', name: 'امور شخصی و دفتر', color: '#64748B', sort_order: 5 },
    ];

    const insertCat = this.db.prepare(
      `INSERT OR IGNORE INTO categories (id, name, color, is_system, sort_order, created_at) VALUES (?, ?, ?, 0, ?, ?)`
    );

    const insertTask = this.db.prepare(`
      INSERT INTO tasks (
        id, title, description, due_date, due_time, deadline, is_all_day,
        priority, category_id, status, related_person, related_link, extra_notes,
        is_quick_note, is_pinned_today, is_archived, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
    `);

    const insertReminder = this.db.prepare(`
      INSERT INTO reminders (
        id, task_id, remind_at, rule_type, offset_value, recurrence,
        recurrence_interval_days, repeat_until_resolved, snoozed_until, is_dismissed, last_triggered_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?)
    `);

    const insertFollowup = this.db.prepare(`
      INSERT INTO followups (
        id, title, reference_code, counterparty, status, priority,
        next_followup_date, next_followup_time, linked_task_id, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)
    `);

    const insertLog = this.db.prepare(`
      INSERT INTO followup_logs (id, followup_id, stage_label, note, logged_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const c of seedCategories) {
        insertCat.run(c.id, c.name, c.color, c.sort_order, now);
      }

      const t1 = crypto.randomUUID();
      insertTask.run(
        t1,
        'ارسال گزارش عملکرد ماهانه به مدیریت',
        'جمع‌بندی آمار واحدهای عملیاتی و ارسال فایل نهایی PDF',
        today,
        '14:00',
        `${today}T16:00`,
        0,
        'critical',
        'cat-admin',
        'in_progress',
        'دفتر مدیریت',
        '',
        'فایل اکسل ضمیمه بررسی شود.',
        0,
        1,
        now,
        now
      );
      insertReminder.run(
        crypto.randomUUID(),
        t1,
        `${today}T13:30`,
        'hours_before',
        1,
        'none',
        1,
        1,
        now
      );

      const t2 = crypto.randomUUID();
      insertTask.run(
        t2,
        'تماس با آقای رضایی جهت تأیید پیش‌فاکتور تجهیزات',
        'پیگیری قیمت نهایی پرینتر لیزری و کاغذ A4',
        today,
        '11:45',
        null,
        0,
        'high',
        'cat-procurement',
        'not_started',
        'آقای رضایی (تأمین)',
        '',
        '',
        0,
        1,
        now,
        now
      );

      const t3 = crypto.randomUUID();
      insertTask.run(
        t3,
        'مراجعه به واحد مالی برای امضای چک تنخواه',
        'ارائه مدارک هزینه‌های هفته گذشته',
        yesterday,
        '10:00',
        yesterday,
        0,
        'critical',
        'cat-finance',
        'needs_followup',
        'خانم محمدی (مالی)',
        '',
        'رسیدها در پوشه آبی قرار دارند.',
        0,
        1,
        now,
        now
      );

      const t4 = crypto.randomUUID();
      insertTask.run(
        t4,
        'آماده‌سازی صورتجلسه نشست هماهنگی',
        'تدوین مصوبات و ارسال برای اعضای جلسه',
        tomorrow,
        '09:30',
        null,
        0,
        'medium',
        'cat-meetings',
        'not_started',
        'تیم فنی و اداری',
        '',
        '',
        0,
        0,
        now,
        now
      );

      const t5 = crypto.randomUUID();
      insertTask.run(
        t5,
        'هماهنگی تمدید قرارداد پشتیبانی شبکه',
        'در انتظار ارسال نسخه اصلاح‌شده قرارداد از طرف پیمانکار',
        inThreeDays,
        null,
        null,
        1,
        'medium',
        'cat-finance',
        'waiting',
        'شرکت پارس شبکه',
        '',
        'مفاد بند ۴ بررسی شود.',
        0,
        0,
        now,
        now
      );

      const t6 = crypto.randomUUID();
      insertTask.run(
        t6,
        'پیگیری خرید ملزومات بایگانی (زونکن و پوشه)',
        'نیاز به استعلام قیمت جدید',
        null,
        null,
        null,
        0,
        'low',
        'cat-procurement',
        'not_started',
        'انبار مرکزی',
        '',
        '',
        1,
        0,
        now,
        now
      );

      const f1 = crypto.randomUUID();
      insertFollowup.run(
        f1,
        'پیگیری نامه اداری درخواست مجوز تجهیز اتاق جلسات',
        'نامه شماره ۱۴۰۵/۸۴۲',
        'معاونت پشتیبانی و اداری',
        'waiting',
        'high',
        today,
        '12:30',
        now,
        now
      );
      insertLog.run(crypto.randomUUID(), f1, 'ثبت اولیه', 'ثبت در دبیرخانه و دریافت شماره پیگیری', yesterday);
      insertLog.run(crypto.randomUUID(), f1, 'ارسال به واحد مربوطه', 'ارجاع به کارشناس فنی معاونت پشتیبانی', today);

      const f2 = crypto.randomUUID();
      insertFollowup.run(
        f2,
        'پیگیری مفاصاحساب قرارداد خدمات عمومی',
        'پرونده م-۴۱۲',
        'واحد امور قراردادها و مالی',
        'needs_followup',
        'critical',
        yesterday,
        '11:00',
        now,
        now
      );
      insertLog.run(crypto.randomUUID(), f2, 'ثبت اولیه', 'تحویل مدارک اولیه به امور قراردادها', yesterday);
      insertLog.run(crypto.randomUUID(), f2, 'انتظار برای پاسخ', 'در انتظار تاییدیه نهایی مدیر مالی', yesterday);

      this.db
        .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)`)
        .run(JSON.stringify(DEFAULT_SETTINGS));
      this.db
        .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('db_initialized', '1')`)
        .run();
    });

    tx();
  }

  public getSettings(): AppSettings {
    const row = this.db
      .prepare(`SELECT value FROM settings WHERE key = 'app_settings'`)
      .get() as { value: string } | undefined;
    if (!row) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(row.value) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        widgetBounds: { ...DEFAULT_SETTINGS.widgetBounds, ...(parsed.widgetBounds || {}) },
        shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(parsed.shortcuts || {}) },
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public updateSettings(patch: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const next: AppSettings = {
      ...current,
      ...patch,
      widgetBounds: { ...current.widgetBounds, ...(patch.widgetBounds || {}) },
      shortcuts: { ...current.shortcuts, ...(patch.shortcuts || {}) },
    };
    this.db
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)`)
      .run(JSON.stringify(next));
    return next;
  }

  public listCategories(): Category[] {
    return this.db
      .prepare(`SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC`)
      .all() as Category[];
  }

  public createCategory(name: string, color = '#2563EB'): Category {
    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const maxRow = this.db.prepare(`SELECT MAX(sort_order) as m FROM categories`).get() as { m: number | null };
    const sortOrder = (maxRow?.m ?? 0) + 1;
    this.db
      .prepare(
        `INSERT INTO categories (id, name, color, is_system, sort_order, created_at) VALUES (?, ?, ?, 0, ?, ?)`
      )
      .run(id, name.trim(), color, sortOrder, now);
    return this.db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as Category;
  }

  public updateCategory(id: string, name: string, color: string): Category | null {
    this.db.prepare(`UPDATE categories SET name = ?, color = ? WHERE id = ?`).run(name.trim(), color, id);
    return (this.db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as Category) || null;
  }

  public deleteCategory(id: string) {
    this.db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  }

  public listTasks(includeArchived = false): Task[] {
    const tasks = this.db
      .prepare(
        includeArchived
          ? `SELECT * FROM tasks ORDER BY created_at DESC`
          : `SELECT * FROM tasks WHERE is_archived = 0 ORDER BY created_at DESC`
      )
      .all() as Task[];
    const reminders = this.db
      .prepare(`SELECT * FROM reminders ORDER BY remind_at ASC`)
      .all() as Reminder[];

    const byTask = new Map<string, Reminder[]>();
    for (const r of reminders) {
      const arr = byTask.get(r.task_id) || [];
      arr.push(r);
      byTask.set(r.task_id, arr);
    }

    return tasks.map((t) => ({
      ...t,
      reminders: byTask.get(t.id) || [],
    }));
  }

  public getTask(id: string): Task | null {
    const task = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as Task | undefined;
    if (!task) return null;
    const reminders = this.db
      .prepare(`SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at ASC`)
      .all(id) as Reminder[];
    return { ...task, reminders };
  }

  public createTask(input: Partial<Task> & { reminders?: Partial<Reminder>[] }): Task {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const status = input.status || 'not_started';
    const completedAt = status === 'completed' ? now : null;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO tasks (
            id, title, description, due_date, due_time, deadline, is_all_day,
            priority, category_id, status, related_person, related_link, extra_notes,
            is_quick_note, is_pinned_today, is_archived, completed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          (input.title || 'کار بدون عنوان').trim(),
          input.description || '',
          input.due_date || null,
          input.due_time || null,
          input.deadline || null,
          input.is_all_day ? 1 : 0,
          input.priority || 'medium',
          input.category_id || null,
          status,
          input.related_person || '',
          input.related_link || '',
          input.extra_notes || '',
          input.is_quick_note ? 1 : 0,
          input.is_pinned_today ? 1 : 0,
          input.is_archived ? 1 : 0,
          completedAt,
          now,
          now
        );

      if (Array.isArray(input.reminders)) {
        for (const rem of input.reminders) {
          if (!rem.remind_at) continue;
          this.db
            .prepare(`
              INSERT INTO reminders (
                id, task_id, remind_at, rule_type, offset_value, recurrence,
                recurrence_interval_days, repeat_until_resolved, snoozed_until, is_dismissed, last_triggered_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?)
            `)
            .run(
              crypto.randomUUID(),
              id,
              rem.remind_at,
              rem.rule_type || 'exact_time',
              rem.offset_value ?? 0,
              rem.recurrence || 'none',
              rem.recurrence_interval_days ?? 1,
              rem.repeat_until_resolved ? 1 : 0,
              now
            );
        }
      }
    });

    tx();
    return this.getTask(id)!;
  }

  public updateTask(id: string, patch: Partial<Task> & { reminders?: Partial<Reminder>[] }): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;
    const now = new Date().toISOString();

    const nextStatus = patch.status ?? existing.status;
    let completedAt = existing.completed_at;
    if (patch.status === 'completed' && existing.status !== 'completed') {
      completedAt = now;
    } else if (patch.status && patch.status !== 'completed') {
      completedAt = null;
    }

    const tx = this.db.transaction(() => {
      this.db
        .prepare(`
          UPDATE tasks SET
            title = ?,
            description = ?,
            due_date = ?,
            due_time = ?,
            deadline = ?,
            is_all_day = ?,
            priority = ?,
            category_id = ?,
            status = ?,
            related_person = ?,
            related_link = ?,
            extra_notes = ?,
            is_quick_note = ?,
            is_pinned_today = ?,
            is_archived = ?,
            completed_at = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          (patch.title !== undefined ? patch.title : existing.title).trim(),
          patch.description !== undefined ? patch.description : existing.description,
          patch.due_date !== undefined ? patch.due_date : existing.due_date,
          patch.due_time !== undefined ? patch.due_time : existing.due_time,
          patch.deadline !== undefined ? patch.deadline : existing.deadline,
          patch.is_all_day !== undefined ? (patch.is_all_day ? 1 : 0) : existing.is_all_day,
          patch.priority !== undefined ? patch.priority : existing.priority,
          patch.category_id !== undefined ? patch.category_id : existing.category_id,
          nextStatus,
          patch.related_person !== undefined ? patch.related_person : existing.related_person,
          patch.related_link !== undefined ? patch.related_link : existing.related_link,
          patch.extra_notes !== undefined ? patch.extra_notes : existing.extra_notes,
          patch.is_quick_note !== undefined ? (patch.is_quick_note ? 1 : 0) : existing.is_quick_note,
          patch.is_pinned_today !== undefined ? (patch.is_pinned_today ? 1 : 0) : existing.is_pinned_today,
          patch.is_archived !== undefined ? (patch.is_archived ? 1 : 0) : existing.is_archived,
          completedAt,
          now,
          id
        );

      if (patch.reminders !== undefined) {
        this.db.prepare(`DELETE FROM reminders WHERE task_id = ?`).run(id);
        for (const rem of patch.reminders) {
          if (!rem.remind_at) continue;
          this.db
            .prepare(`
              INSERT INTO reminders (
                id, task_id, remind_at, rule_type, offset_value, recurrence,
                recurrence_interval_days, repeat_until_resolved, snoozed_until, is_dismissed, last_triggered_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              rem.id || crypto.randomUUID(),
              id,
              rem.remind_at,
              rem.rule_type || 'exact_time',
              rem.offset_value ?? 0,
              rem.recurrence || 'none',
              rem.recurrence_interval_days ?? 1,
              rem.repeat_until_resolved ? 1 : 0,
              rem.snoozed_until || null,
              rem.is_dismissed ? 1 : 0,
              rem.last_triggered_at || null,
              rem.created_at || now
            );
        }
      }
    });

    tx();
    return this.getTask(id);
  }

  public deleteTask(id: string) {
    this.db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
  }

  public addReminder(taskId: string, rem: Partial<Reminder>): Reminder {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO reminders (
          id, task_id, remind_at, rule_type, offset_value, recurrence,
          recurrence_interval_days, repeat_until_resolved, snoozed_until, is_dismissed, last_triggered_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?)
      `)
      .run(
        id,
        taskId,
        rem.remind_at!,
        rem.rule_type || 'exact_time',
        rem.offset_value ?? 0,
        rem.recurrence || 'none',
        rem.recurrence_interval_days ?? 1,
        rem.repeat_until_resolved ? 1 : 0,
        now
      );
    return this.db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(id) as Reminder;
  }

  public snoozeReminder(reminderId: string, snoozedUntilIso: string): Reminder | null {
    this.db
      .prepare(`UPDATE reminders SET snoozed_until = ?, is_dismissed = 0 WHERE id = ?`)
      .run(snoozedUntilIso, reminderId);
    return (this.db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(reminderId) as Reminder) || null;
  }

  public dismissReminder(reminderId: string): Reminder | null {
    const rem = this.db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(reminderId) as Reminder | undefined;
    if (!rem) return null;
    const now = new Date().toISOString();

    if (rem.recurrence !== 'none') {
      // Advance next remind_at according to recurrence rule
      const base = new Date(rem.remind_at);
      if (!Number.isNaN(base.getTime())) {
        if (rem.recurrence === 'daily') base.setDate(base.getDate() + 1);
        else if (rem.recurrence === 'weekly') base.setDate(base.getDate() + 7);
        else if (rem.recurrence === 'monthly') base.setMonth(base.getMonth() + 1);
        else if (rem.recurrence === 'custom') base.setDate(base.getDate() + Math.max(1, rem.recurrence_interval_days || 1));

        const nextRemindAt = `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}T${pad2(base.getHours())}:${pad2(base.getMinutes())}`;
        this.db
          .prepare(`UPDATE reminders SET remind_at = ?, snoozed_until = NULL, is_dismissed = 0, last_triggered_at = ? WHERE id = ?`)
          .run(nextRemindAt, now, reminderId);
        return this.db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(reminderId) as Reminder;
      }
    }

    this.db
      .prepare(`UPDATE reminders SET is_dismissed = 1, snoozed_until = NULL, last_triggered_at = ? WHERE id = ?`)
      .run(now, reminderId);
    return (this.db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(reminderId) as Reminder) || null;
  }

  public listFollowups(includeArchived = false): Followup[] {
    const items = this.db
      .prepare(
        includeArchived
          ? `SELECT * FROM followups ORDER BY next_followup_date ASC`
          : `SELECT * FROM followups WHERE is_archived = 0 ORDER BY next_followup_date ASC`
      )
      .all() as Followup[];
    const logs = this.db
      .prepare(`SELECT * FROM followup_logs ORDER BY logged_at DESC`)
      .all() as FollowupLog[];

    const byFollowup = new Map<string, FollowupLog[]>();
    for (const l of logs) {
      const arr = byFollowup.get(l.followup_id) || [];
      arr.push(l);
      byFollowup.set(l.followup_id, arr);
    }

    return items.map((f) => ({
      ...f,
      logs: byFollowup.get(f.id) || [],
    }));
  }

  public createFollowup(
    input: Partial<Followup> & { initial_stage?: string; initial_note?: string }
  ): Followup {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const nextDate = input.next_followup_date || isoDateOffset(1);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO followups (
            id, title, reference_code, counterparty, status, priority,
            next_followup_date, next_followup_time, linked_task_id, is_archived, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `)
        .run(
          id,
          (input.title || 'موضوع پیگیری جدید').trim(),
          input.reference_code || '',
          input.counterparty || '',
          input.status || 'not_started',
          input.priority || 'medium',
          nextDate,
          input.next_followup_time || null,
          input.linked_task_id || null,
          now,
          now
        );

      this.db
        .prepare(`INSERT INTO followup_logs (id, followup_id, stage_label, note, logged_at) VALUES (?, ?, ?, ?, ?)`)
        .run(
          crypto.randomUUID(),
          id,
          input.initial_stage || 'ثبت اولیه',
          input.initial_note || 'موضوع برای پیگیری ثبت شد.',
          now
        );
    });

    tx();
    return this.listFollowups(true).find((f) => f.id === id)!;
  }

  public updateFollowup(id: string, patch: Partial<Followup>): Followup | null {
    const existing = this.db.prepare(`SELECT * FROM followups WHERE id = ?`).get(id) as Followup | undefined;
    if (!existing) return null;
    const now = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE followups SET
          title = ?,
          reference_code = ?,
          counterparty = ?,
          status = ?,
          priority = ?,
          next_followup_date = ?,
          next_followup_time = ?,
          is_archived = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        (patch.title !== undefined ? patch.title : existing.title).trim(),
        patch.reference_code !== undefined ? patch.reference_code : existing.reference_code,
        patch.counterparty !== undefined ? patch.counterparty : existing.counterparty,
        patch.status !== undefined ? patch.status : existing.status,
        patch.priority !== undefined ? patch.priority : existing.priority,
        patch.next_followup_date !== undefined ? patch.next_followup_date : existing.next_followup_date,
        patch.next_followup_time !== undefined ? patch.next_followup_time : existing.next_followup_time,
        patch.is_archived !== undefined ? (patch.is_archived ? 1 : 0) : existing.is_archived,
        now,
        id
      );

    return this.listFollowups(true).find((f) => f.id === id) || null;
  }

  public addFollowupLog(
    followupId: string,
    stageLabel: string,
    note: string,
    nextFollowupDate?: string,
    nextStatus?: string
  ): Followup | null {
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`INSERT INTO followup_logs (id, followup_id, stage_label, note, logged_at) VALUES (?, ?, ?, ?, ?)`)
        .run(crypto.randomUUID(), followupId, stageLabel.trim(), note.trim(), now);

      if (nextFollowupDate || nextStatus) {
        const existing = this.db.prepare(`SELECT * FROM followups WHERE id = ?`).get(followupId) as Followup | undefined;
        if (existing) {
          this.db
            .prepare(`UPDATE followups SET next_followup_date = ?, status = ?, updated_at = ? WHERE id = ?`)
            .run(
              nextFollowupDate || existing.next_followup_date,
              nextStatus || existing.status,
              now,
              followupId
            );
        }
      } else {
        this.db.prepare(`UPDATE followups SET updated_at = ? WHERE id = ?`).run(now, followupId);
      }
    });

    tx();
    return this.listFollowups(true).find((f) => f.id === followupId) || null;
  }

  public deleteFollowup(id: string) {
    this.db.prepare(`DELETE FROM followups WHERE id = ?`).run(id);
  }

  public exportAllJson() {
    return {
      exportedAt: new Date().toISOString(),
      app: 'Office Desk Assistant',
      version: 1,
      categories: this.listCategories(),
      tasks: this.listTasks(true),
      followups: this.listFollowups(true),
      settings: this.getSettings(),
    };
  }

  public exportTasksCsv(): string {
    const tasks = this.listTasks(true);
    const categories = new Map(this.listCategories().map((c) => [c.id, c.name]));
    const headers = [
      'شناسه',
      'عنوان',
      'توضیحات',
      'تاریخ انجام',
      'ساعت انجام',
      'مهلت نهایی',
      'اولویت',
      'دسته‌بندی',
      'وضعیت',
      'شخص/واحد مرتبط',
      'لینک/فایل',
      'یادداشت تکمیلی',
      'آرشیو',
      'تاریخ ثبت',
    ];
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = tasks.map((t) => [
      t.id,
      t.title,
      t.description,
      t.due_date || '',
      t.due_time || '',
      t.deadline || '',
      t.priority,
      (t.category_id && categories.get(t.category_id)) || '',
      t.status,
      t.related_person,
      t.related_link,
      t.extra_notes,
      t.is_archived ? 'بله' : 'خیر',
      t.created_at,
    ]);
    // UTF-8 BOM for clean Persian rendering in Windows Microsoft Excel
    return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
  }

  public restoreFromJson(payload: {
    categories?: Category[];
    tasks?: Task[];
    followups?: Followup[];
    settings?: Partial<AppSettings>;
  }) {
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM followup_logs`).run();
      this.db.prepare(`DELETE FROM followups`).run();
      this.db.prepare(`DELETE FROM reminders`).run();
      this.db.prepare(`DELETE FROM tasks`).run();
      this.db.prepare(`DELETE FROM categories`).run();

      if (Array.isArray(payload.categories)) {
        const stmt = this.db.prepare(
          `INSERT INTO categories (id, name, color, is_system, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`
        );
        for (const c of payload.categories) {
          stmt.run(c.id, c.name, c.color || '#2563EB', c.is_system ? 1 : 0, c.sort_order || 0, c.created_at || now);
        }
      }

      if (Array.isArray(payload.tasks)) {
        const stmtTask = this.db.prepare(`
          INSERT INTO tasks (
            id, title, description, due_date, due_time, deadline, is_all_day,
            priority, category_id, status, related_person, related_link, extra_notes,
            is_quick_note, is_pinned_today, is_archived, completed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const stmtRem = this.db.prepare(`
          INSERT INTO reminders (
            id, task_id, remind_at, rule_type, offset_value, recurrence,
            recurrence_interval_days, repeat_until_resolved, snoozed_until, is_dismissed, last_triggered_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const t of payload.tasks) {
          stmtTask.run(
            t.id,
            t.title,
            t.description || '',
            t.due_date || null,
            t.due_time || null,
            t.deadline || null,
            t.is_all_day ? 1 : 0,
            t.priority || 'medium',
            t.category_id || null,
            t.status || 'not_started',
            t.related_person || '',
            t.related_link || '',
            t.extra_notes || '',
            t.is_quick_note ? 1 : 0,
            t.is_pinned_today ? 1 : 0,
            t.is_archived ? 1 : 0,
            t.completed_at || null,
            t.created_at || now,
            t.updated_at || now
          );
          if (Array.isArray(t.reminders)) {
            for (const r of t.reminders) {
              stmtRem.run(
                r.id || crypto.randomUUID(),
                t.id,
                r.remind_at,
                r.rule_type || 'exact_time',
                r.offset_value ?? 0,
                r.recurrence || 'none',
                r.recurrence_interval_days ?? 1,
                r.repeat_until_resolved ? 1 : 0,
                r.snoozed_until || null,
                r.is_dismissed ? 1 : 0,
                r.last_triggered_at || null,
                r.created_at || now
              );
            }
          }
        }
      }

      if (Array.isArray(payload.followups)) {
        const stmtF = this.db.prepare(`
          INSERT INTO followups (
            id, title, reference_code, counterparty, status, priority,
            next_followup_date, next_followup_time, linked_task_id, is_archived, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const stmtLog = this.db.prepare(`
          INSERT INTO followup_logs (id, followup_id, stage_label, note, logged_at) VALUES (?, ?, ?, ?, ?)
        `);
        for (const f of payload.followups) {
          stmtF.run(
            f.id,
            f.title,
            f.reference_code || '',
            f.counterparty || '',
            f.status || 'in_progress',
            f.priority || 'medium',
            f.next_followup_date || isoDateOffset(1),
            f.next_followup_time || null,
            f.linked_task_id || null,
            f.is_archived ? 1 : 0,
            f.created_at || now,
            f.updated_at || now
          );
          if (Array.isArray(f.logs)) {
            for (const l of f.logs) {
              stmtLog.run(l.id || crypto.randomUUID(), f.id, l.stage_label, l.note || '', l.logged_at || now);
            }
          }
        }
      }

      if (payload.settings) {
        this.updateSettings(payload.settings);
      }
    });

    tx();
  }

  public saveLocalBackupSnapshot(): BackupEntry {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `office-desk-backup-${stamp}.json`;
    const filePath = path.join(this.backupDir, filename);
    const data = JSON.stringify(this.exportAllJson(), null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    this.updateSettings({ lastAutoBackupAt: new Date().toISOString() });
    const stat = fs.statSync(filePath);
    return {
      filename,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
    };
  }

  public listLocalBackups(): BackupEntry[] {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.json'))
      .map((filename) => {
        const stat = fs.statSync(path.join(this.backupDir, filename));
        return {
          filename,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public readLocalBackup(filename: string): string | null {
    const safeName = path.basename(filename);
    const full = path.join(this.backupDir, safeName);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf-8');
  }

  public maybeRunScheduledBackup() {
    const settings = this.getSettings();
    if (!settings.autoBackupEnabled) return;
    const intervalMs = Math.max(1, settings.autoBackupIntervalHours || 24) * 3600 * 1000;
    const last = settings.lastAutoBackupAt ? new Date(settings.lastAutoBackupAt).getTime() : 0;
    if (Date.now() - last >= intervalMs) {
      this.saveLocalBackupSnapshot();
    }
  }
}
