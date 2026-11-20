import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { OfficeDatabase } from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startServer() {
  const app = express();
  const db = new OfficeDatabase();

  app.use(express.json({ limit: '10mb' }));

  // Trigger scheduled local backup check on startup & every 30 minutes
  db.maybeRunScheduledBackup();
  const backupInterval = setInterval(() => {
    try {
      db.maybeRunScheduledBackup();
    } catch {
      // Ignore background backup errors
    }
  }, 30 * 60 * 1000);
  backupInterval.unref();

  // Bootstrap endpoint: fetch initial state in one call
  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      tasks: db.listTasks(true),
      categories: db.listCategories(),
      followups: db.listFollowups(true),
      settings: db.getSettings(),
      backups: db.listLocalBackups(),
    });
  });

  // Tasks API
  app.get('/api/tasks', (req, res) => {
    const includeArchived = req.query.archived !== 'false';
    res.json(db.listTasks(includeArchived));
  });

  app.post('/api/tasks', (req, res) => {
    try {
      const task = db.createTask(req.body || {});
      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/tasks/:id', (req, res) => {
    try {
      const updated = db.updateTask(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/tasks/:id', (req, res) => {
    db.deleteTask(req.params.id);
    res.json({ ok: true });
  });

  // Reminders API
  app.post('/api/tasks/:id/reminders', (req, res) => {
    try {
      const rem = db.addReminder(req.params.id, req.body || {});
      res.status(201).json(rem);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/reminders/:id/snooze', (req, res) => {
    const { snoozedUntil } = req.body || {};
    if (!snoozedUntil) return res.status(400).json({ error: 'snoozedUntil is required' });
    const rem = db.snoozeReminder(req.params.id, snoozedUntil);
    if (!rem) return res.status(404).json({ error: 'Reminder not found' });
    res.json(rem);
  });

  app.post('/api/reminders/:id/dismiss', (req, res) => {
    const rem = db.dismissReminder(req.params.id);
    if (!rem) return res.status(404).json({ error: 'Reminder not found' });
    res.json(rem);
  });

  // Categories API
  app.get('/api/categories', (_req, res) => {
    res.json(db.listCategories());
  });

  app.post('/api/categories', (req, res) => {
    const { name, color } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Category name required' });
    res.status(201).json(db.createCategory(String(name), color || '#2563EB'));
  });

  app.patch('/api/categories/:id', (req, res) => {
    const { name, color } = req.body || {};
    const cat = db.updateCategory(req.params.id, String(name || ''), String(color || '#2563EB'));
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  });

  app.delete('/api/categories/:id', (req, res) => {
    db.deleteCategory(req.params.id);
    res.json({ ok: true });
  });

  // Followups API
  app.get('/api/followups', (req, res) => {
    const includeArchived = req.query.archived !== 'false';
    res.json(db.listFollowups(includeArchived));
  });

  app.post('/api/followups', (req, res) => {
    try {
      const created = db.createFollowup(req.body || {});
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/followups/:id', (req, res) => {
    const updated = db.updateFollowup(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Followup not found' });
    res.json(updated);
  });

  app.post('/api/followups/:id/logs', (req, res) => {
    const { stage_label, note, next_followup_date, status } = req.body || {};
    if (!stage_label) return res.status(400).json({ error: 'stage_label is required' });
    const updated = db.addFollowupLog(
      req.params.id,
      String(stage_label),
      String(note || ''),
      next_followup_date,
      status
    );
    if (!updated) return res.status(404).json({ error: 'Followup not found' });
    res.json(updated);
  });

  app.delete('/api/followups/:id', (req, res) => {
    db.deleteFollowup(req.params.id);
    res.json({ ok: true });
  });

  // Settings API
  app.get('/api/settings', (_req, res) => {
    res.json(db.getSettings());
  });

  app.patch('/api/settings', (req, res) => {
    res.json(db.updateSettings(req.body || {}));
  });

  // Backups & Export/Restore API
  app.get('/api/export/json', (_req, res) => {
    const data = db.exportAllJson();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="office-desk-backup.json"');
    res.send(JSON.stringify(data, null, 2));
  });

  app.get('/api/export/csv', (_req, res) => {
    const csv = db.exportTasksCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="office-desk-tasks.csv"');
    res.send(csv);
  });

  app.get('/api/backups', (_req, res) => {
    res.json(db.listLocalBackups());
  });

  app.post('/api/backups/snapshot', (_req, res) => {
    const entry = db.saveLocalBackupSnapshot();
    res.status(201).json({ entry, backups: db.listLocalBackups() });
  });

  app.post('/api/backups/restore-file/:filename', (req, res) => {
    const raw = db.readLocalBackup(req.params.filename);
    if (!raw) return res.status(404).json({ error: 'Backup file not found' });
    try {
      const parsed = JSON.parse(raw);
      db.restoreFromJson(parsed);
      res.json({
        ok: true,
        tasks: db.listTasks(true),
        categories: db.listCategories(),
        followups: db.listFollowups(true),
        settings: db.getSettings(),
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/restore', (req, res) => {
    try {
      db.restoreFromJson(req.body || {});
      res.json({
        ok: true,
        tasks: db.listTasks(true),
        categories: db.listCategories(),
        followups: db.listFollowups(true),
        settings: db.getSettings(),
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Mount Vite middleware in development or serve built static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.OFFICE_DESK_DIST_PATH || path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Office Desk Assistant running on http://127.0.0.1:${PORT}`);
  });

  // Do not let Electron create a hidden window until the HTTP server is listening.
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });

  return { app, server, db };
}

// Start directly when executed as main entry point
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  startServer();
}
