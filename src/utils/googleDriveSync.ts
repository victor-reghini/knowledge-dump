import { api } from '../api';
import { BackupDriveUploadResult } from '../types';

const STORAGE_GDRIVE_TOKEN = 'kd_gdrive_token';
const STORAGE_GDRIVE_EMAIL = 'kd_gdrive_email';
const STORAGE_GDRIVE_NAME = 'kd_gdrive_name';
const STORAGE_GDRIVE_CLIENT_ID = 'kd_gdrive_client_id';
const STORAGE_GDRIVE_AUTO_SYNC = 'kd_gdrive_auto_sync';
const STORAGE_GDRIVE_LAST_BACKUP = 'kd_gdrive_last_backup';

export interface GoogleDriveSyncState {
  isConnected: boolean;
  accountEmail: string | null;
  accountName: string | null;
  clientId: string;
  isAutoSyncEnabled: boolean;
  isSyncing: boolean;
  lastBackupAt: string | null;
  lastError: string | null;
}

type SyncListener = (state: GoogleDriveSyncState) => void;

class GoogleDriveSyncManager {
  private isSyncing = false;
  private lastError: string | null = null;
  private listeners: SyncListener[] = [];
  private debounceTimer: any = null;
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Periódico: verifica a cada 30 minutos se a aba estiver aberta e auto-sync ativo
      this.autoSyncInterval = setInterval(() => {
        if (this.isAutoSyncEnabled() && this.isConnected()) {
          this.triggerBackup().catch(() => {});
        }
      }, 30 * 60 * 1000);
    }
  }

  public getState(): GoogleDriveSyncState {
    const token = this.getAccessToken();
    return {
      isConnected: Boolean(token),
      accountEmail: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_GDRIVE_EMAIL) : null,
      accountName: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_GDRIVE_NAME) : null,
      clientId: this.getClientId(),
      isAutoSyncEnabled: this.isAutoSyncEnabled(),
      isSyncing: this.isSyncing,
      lastBackupAt: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_GDRIVE_LAST_BACKUP) : null,
      lastError: this.lastError
    };
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  public getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_GDRIVE_TOKEN);
  }

  public setAccessToken(token: string, email?: string, name?: string): void {
    localStorage.setItem(STORAGE_GDRIVE_TOKEN, token);
    if (email) localStorage.setItem(STORAGE_GDRIVE_EMAIL, email);
    if (name) localStorage.setItem(STORAGE_GDRIVE_NAME, name);
    this.lastError = null;
    this.notify();
  }

  public getClientId(): string {
    if (typeof localStorage === 'undefined') return '';
    const stored = localStorage.getItem(STORAGE_GDRIVE_CLIENT_ID);
    if (stored) return stored;
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  }

  public setClientId(clientId: string): void {
    localStorage.setItem(STORAGE_GDRIVE_CLIENT_ID, clientId.trim());
    this.notify();
  }

  public isConnected(): boolean {
    return Boolean(this.getAccessToken());
  }

  public isAutoSyncEnabled(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(STORAGE_GDRIVE_AUTO_SYNC) !== 'false';
  }

  public setAutoSyncEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_GDRIVE_AUTO_SYNC, enabled ? 'true' : 'false');
    this.notify();
  }

  public disconnect(): void {
    localStorage.removeItem(STORAGE_GDRIVE_TOKEN);
    localStorage.removeItem(STORAGE_GDRIVE_EMAIL);
    localStorage.removeItem(STORAGE_GDRIVE_NAME);
    this.lastError = null;
    this.notify();
  }

  /**
   * Dispara backup automático no Google Drive com debounce de 10s após salvar alterações
   */
  public notifyContentChanged(): void {
    if (!this.isConnected() || !this.isAutoSyncEnabled()) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.triggerBackup().catch(() => {});
    }, 10000); // 10 segundos após última edição
  }

  /**
   * Executa upload de backup para o Google Drive
   */
  public async triggerBackup(explicitToken?: string): Promise<BackupDriveUploadResult | null> {
    const token = explicitToken || this.getAccessToken();
    if (!token) {
      throw new Error('Nenhuma conta Google conectada');
    }

    if (this.isSyncing) return null;
    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      const res = await api.uploadBackupToGoogleDrive(token);
      localStorage.setItem(STORAGE_GDRIVE_LAST_BACKUP, new Date().toISOString());
      this.isSyncing = false;
      this.lastError = null;
      this.notify();
      return res;
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err.message || 'Erro ao sincronizar com Google Drive';
      this.notify();
      throw err;
    }
  }

  /**
   * Inicia o fluxo de autorização nativo do Google (Google Identity Services)
   */
  public async requestGoogleLogin(customClientId?: string): Promise<{ token: string; email: string; name: string }> {
    const clientId = (customClientId || this.getClientId()).trim();
    if (!clientId) {
      throw new Error('Google Client ID não configurado');
    }

    await this.ensureGoogleScriptLoaded();

    return new Promise((resolve, reject) => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile https://www.googleapis.com/auth/drive.file',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              return reject(new Error(tokenResponse.error_description || tokenResponse.error));
            }
            if (!tokenResponse.access_token) {
              return reject(new Error('Nenhum access token recebido do Google'));
            }

            try {
              // Busca perfil básico do usuário
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const userInfo = await userInfoRes.json();
              const email = userInfo.email || '';
              const name = userInfo.name || email.split('@')[0];

              // Armazena credenciais
              this.setAccessToken(tokenResponse.access_token, email, name);

              resolve({
                token: tokenResponse.access_token,
                email,
                name
              });
            } catch (err) {
              this.setAccessToken(tokenResponse.access_token);
              resolve({
                token: tokenResponse.access_token,
                email: '',
                name: 'Usuário Google'
              });
            }
          }
        });

        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  private ensureGoogleScriptLoaded(): Promise<void> {
    if ((window as any).google?.accounts?.oauth2) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.getElementById('google-gsi-client');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar script do Google')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'));
      document.head.appendChild(script);
    });
  }
}

export const googleDriveSync = new GoogleDriveSyncManager();
