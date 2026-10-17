import { api } from '../api';
import { SyncPushPayload, SyncResponse, SyncStatus, Note, Folder, Category, Bookmark } from '../types';

const STORAGE_LAST_SYNC = 'kd_last_synced_at';
const STORAGE_PENDING_CHANGES = 'kd_pending_changes';
const STORAGE_CLIENT_ID = 'kd_client_id';

export interface PendingChanges {
  notes?: Note[];
  folders?: Folder[];
  categories?: Category[];
  bookmarks?: Bookmark[];
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
}

class SyncManager {
  private clientId: string;
  private isSyncing = false;
  private listeners: Array<(state: SyncState) => void> = [];
  private lastError: string | null = null;

  constructor() {
    let id = localStorage.getItem(STORAGE_CLIENT_ID);
    if (!id) {
      id = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem(STORAGE_CLIENT_ID, id);
    }
    this.clientId = id;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notify();
        this.sync().catch(() => {});
      });
      window.addEventListener('offline', () => {
        this.notify();
      });
    }
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getState(): SyncState {
    const pending = this.getPendingChanges();
    const count =
      (pending.notes?.length || 0) +
      (pending.folders?.length || 0) +
      (pending.categories?.length || 0) +
      (pending.bookmarks?.length || 0);

    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      lastSyncedAt: localStorage.getItem(STORAGE_LAST_SYNC),
      pendingCount: count,
      lastError: this.lastError
    };
  }

  public subscribe(cb: (state: SyncState) => void): () => void {
    this.listeners.push(cb);
    cb(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  public getPendingChanges(): PendingChanges {
    try {
      const raw = localStorage.getItem(STORAGE_PENDING_CHANGES);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public queueChange<K extends keyof PendingChanges>(type: K, item: any): void {
    const current = this.getPendingChanges();
    const list = (current[type] || []) as any[];
    const idx = list.findIndex((i: any) => i.id === item.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push(item);
    }
    current[type] = list as any;
    localStorage.setItem(STORAGE_PENDING_CHANGES, JSON.stringify(current));
    this.notify();
  }

  public clearPendingChanges(): void {
    localStorage.removeItem(STORAGE_PENDING_CHANGES);
    this.notify();
  }

  public async checkStatus(): Promise<SyncStatus | null> {
    try {
      const status = await api.getSyncStatus();
      this.lastError = null;
      this.notify();
      return status;
    } catch (err: any) {
      this.lastError = err.message || 'Erro ao conectar';
      this.notify();
      return null;
    }
  }

  public async sync(): Promise<SyncResponse | null> {
    if (this.isSyncing) return null;
    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      const pending = this.getPendingChanges();
      const lastSyncedAt = localStorage.getItem(STORAGE_LAST_SYNC);

      const payload: SyncPushPayload = {
        client_id: this.clientId,
        last_synced_at: lastSyncedAt,
        changes: pending
      };

      const response = await api.sync(payload);

      // Successfully synced: update lastSyncedAt and clear pending changes
      localStorage.setItem(STORAGE_LAST_SYNC, response.server_time);
      this.clearPendingChanges();

      this.isSyncing = false;
      this.lastError = null;
      this.notify();
      return response;
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err.message || 'Erro de sincronização';
      this.notify();
      throw err;
    }
  }
}

export const syncManager = new SyncManager();
