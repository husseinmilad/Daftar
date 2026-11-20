import type {
  AppSettings,
  BackupEntry,
  Category,
  Followup,
  Reminder,
  Task,
  TaskPayload,
} from '../types.ts';

export interface BootstrapPayload {
  tasks: Task[];
  categories: Category[];
  followups: Followup[];
  settings: AppSettings;
  backups: BackupEntry[];
}

const syncChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('office-desk-sync') : null;

export function notifyDataChanged() {
  try {
    syncChannel?.postMessage({ type: 'sync', ts: Date.now() });
  } catch {
    // Ignore channel errors
  }
}

export function subscribeDataChanges(onSync: () => void): () => void {
  if (!syncChannel) return () => {};
  const handler = (ev: MessageEvent) => {
    if (ev.data?.type === 'sync') onSync();
  };
  syncChannel.addEventListener('message', handler);
  return () => syncChannel.removeEventListener('message', handler);
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => req<BootstrapPayload>('/api/bootstrap'),

  createTask: async (data: TaskPayload) => {
    const t = await req<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
    notifyDataChanged();
    return t;
  },

  updateTask: async (id: string, patch: TaskPayload) => {
    const t = await req<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    notifyDataChanged();
    return t;
  },

  deleteTask: async (id: string) => {
    await req<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' });
    notifyDataChanged();
  },

  snoozeReminder: async (id: string, snoozedUntil: string) => {
    const r = await req<Reminder>(`/api/reminders/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ snoozedUntil }),
    });
    notifyDataChanged();
    return r;
  },

  dismissReminder: async (id: string) => {
    const r = await req<Reminder>(`/api/reminders/${id}/dismiss`, { method: 'POST' });
    notifyDataChanged();
    return r;
  },

  createCategory: async (name: string, color: string) => {
    const c = await req<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    notifyDataChanged();
    return c;
  },

  updateCategory: async (id: string, name: string, color: string) => {
    const c = await req<Category>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, color }),
    });
    notifyDataChanged();
    return c;
  },

  deleteCategory: async (id: string) => {
    await req<{ ok: boolean }>(`/api/categories/${id}`, { method: 'DELETE' });
    notifyDataChanged();
  },

  createFollowup: async (
    data: Partial<Followup> & { initial_stage?: string; initial_note?: string }
  ) => {
    const f = await req<Followup>('/api/followups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    notifyDataChanged();
    return f;
  },

  updateFollowup: async (id: string, patch: Partial<Followup>) => {
    const f = await req<Followup>(`/api/followups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    notifyDataChanged();
    return f;
  },

  addFollowupLog: async (
    id: string,
    payload: { stage_label: string; note: string; next_followup_date?: string; status?: string }
  ) => {
    const f = await req<Followup>(`/api/followups/${id}/logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyDataChanged();
    return f;
  },

  deleteFollowup: async (id: string) => {
    await req<{ ok: boolean }>(`/api/followups/${id}`, { method: 'DELETE' });
    notifyDataChanged();
  },

  updateSettings: async (patch: Partial<AppSettings>) => {
    const s = await req<AppSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (window.electronDesk?.applyDesktopSettings) {
      window.electronDesk.applyDesktopSettings(patch).catch(() => {});
    }
    notifyDataChanged();
    return s;
  },

  createSnapshot: () =>
    req<{ entry: BackupEntry; backups: BackupEntry[] }>('/api/backups/snapshot', {
      method: 'POST',
    }),

  restoreBackupFile: async (filename: string) => {
    const res = await req<BootstrapPayload & { ok: boolean }>(
      `/api/backups/restore-file/${encodeURIComponent(filename)}`,
      { method: 'POST' }
    );
    notifyDataChanged();
    return res;
  },

  restoreFromJson: async (data: unknown) => {
    const res = await req<BootstrapPayload & { ok: boolean }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    notifyDataChanged();
    return res;
  },
};
