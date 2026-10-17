import React, { useState, useEffect } from 'react';
import { X, Download, CloudUpload, HardDrive, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Settings, LogOut, Check } from 'lucide-react';
import { api } from '../api';
import { BackupStatus, BackupDriveUploadResult } from '../types';
import { googleDriveSync, GoogleDriveSyncState } from '../utils/googleDriveSync';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncState, setSyncState] = useState<GoogleDriveSyncState>(() => googleDriveSync.getState());
  const [clientIdInput, setClientIdInput] = useState(() => googleDriveSync.getClientId());
  const [accessTokenInput, setAccessTokenInput] = useState(() => googleDriveSync.getAccessToken() || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadResult, setUploadResult] = useState<BackupDriveUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = googleDriveSync.subscribe((state) => {
      setSyncState(state);
      if (state.lastError) {
        setError(state.lastError);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoadingStatus(true);
      setError(null);
      setUploadResult(null);
      api.getBackupStatus()
        .then(setStatus)
        .catch(err => setError(err.message || 'Erro ao carregar estatísticas do acervo'))
        .finally(() => setLoadingStatus(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadLocal = () => {
    const url = api.getBackupDownloadUrl();
    window.location.href = url;
  };

  const handleConnectGoogle = async () => {
    setError(null);
    try {
      let targetClientId = clientIdInput.trim() || googleDriveSync.getClientId();
      if (!targetClientId) {
        const input = prompt(
          'Informe seu Google OAuth Client ID (ou clique em OK sem preencher para conectar com sandbox/demonstração):',
          ''
        );
        if (input === null) return;
        if (input.trim()) {
          targetClientId = input.trim();
          setClientIdInput(targetClientId);
          googleDriveSync.setClientId(targetClientId);
        } else {
          // Sandbox mock token
          const simulatedEmail = `pesquisador_${Date.now().toString().slice(-4)}@gmail.com`;
          googleDriveSync.setAccessToken('mock-token', simulatedEmail, 'Pesquisador Google Drive');
          const res = await googleDriveSync.triggerBackup('mock-token');
          if (res) setUploadResult(res);
          return;
        }
      }

      const res = await googleDriveSync.requestGoogleLogin(targetClientId);
      await api.loginWithGoogle({
        email: res.email,
        name: res.name,
        access_token: res.token
      }).catch(() => {});
      const uploadRes = await googleDriveSync.triggerBackup(res.token);
      if (uploadRes) setUploadResult(uploadRes);
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação com o Google');
    }
  };

  const handleManualSyncNow = async () => {
    setError(null);
    setUploadResult(null);
    try {
      const res = await googleDriveSync.triggerBackup(accessTokenInput.trim() || undefined);
      if (res) setUploadResult(res);
    } catch (err: any) {
      setError(err.message || 'Falha ao sincronizar com Google Drive');
    }
  };

  const handleSaveManualToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessTokenInput.trim()) {
      setError('Informe um token válido');
      return;
    }
    googleDriveSync.setAccessToken(accessTokenInput.trim(), 'manual-token@gdrive', 'Token Manual');
    handleManualSyncNow();
  };

  const handleSaveClientId = () => {
    googleDriveSync.setClientId(clientIdInput.trim());
    setError(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="backup-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HardDrive size={20} style={{ color: 'var(--primary-yellow-border)' }} />
            <h2 id="backup-title" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              Backup Geral & Google Drive
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--accent-red)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-red)',
              fontSize: '0.85rem'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Acervo Summary Card */}
          <div style={{
            padding: 14,
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Conteúdo do Pacote de Backup:</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Formato Universal .ZIP (RNF-08)</span>
            </div>
            {loadingStatus ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Contabilizando acervo...</p>
            ) : status ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div><strong>{status.counts.notes}</strong> notas (.md/YAML)</div>
                <div><strong>{status.counts.references}</strong> referências anexas</div>
                <div><strong>{status.counts.categories}</strong> categorias</div>
                <div><strong>{status.counts.folders}</strong> pastas estruturais</div>
                <div><strong>{status.counts.bookmarks}</strong> marcadores</div>
                <div><strong>Manifesto</strong> JSON de restauração</div>
              </div>
            ) : null}
          </div>

          {/* Download Local Option */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>Download Local (.ZIP)</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Empacota todo o acervo sem travas proprietárias (no vendor lock-in).
              </div>
            </div>
            <button
              className="btn-blue"
              onClick={handleDownloadLocal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <Download size={15} />
              <span>Baixar ZIP</span>
            </button>
          </div>

          {/* Google Drive Upload & Auto-Sync Section (RF-35) */}
          <div style={{
            padding: 14,
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudUpload size={18} style={{ color: 'var(--accent-blue)' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Sincronização com Google Drive</div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowAdvanced(!showAdvanced)}
                title="Configurações avançadas de OAuth2"
                style={{ padding: 4 }}
              >
                <Settings size={15} style={{ color: showAdvanced ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Account Status Card */}
            {syncState.isConnected ? (
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-green)'
                    }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {syncState.accountEmail || syncState.accountName || 'Conta Google Conectada'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => googleDriveSync.disconnect()}
                    title="Desconectar conta Google"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <LogOut size={13} />
                    <span>Desconectar</span>
                  </button>
                </div>

                {/* Auto-Sync Toggle */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}>
                  <input
                    type="checkbox"
                    checked={syncState.isAutoSyncEnabled}
                    onChange={(e) => googleDriveSync.setAutoSyncEnabled(e.target.checked)}
                  />
                  <span>Sincronização automática contínua (após edições e a cada 30min)</span>
                </label>

                {syncState.lastBackupAt && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Último backup: {new Date(syncState.lastBackupAt).toLocaleString('pt-BR')}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                  <button
                    type="button"
                    className="sidebar-action-btn"
                    onClick={handleManualSyncNow}
                    disabled={syncState.isSyncing}
                    style={{
                      margin: 0,
                      padding: '7px 14px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: syncState.isSyncing ? 'wait' : 'pointer'
                    }}
                  >
                    {syncState.isSyncing ? (
                      <>
                        <RefreshCw size={15} className="spin" />
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload size={15} />
                        <span>Sincronizar Agora com o Drive</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Conecte sua conta Google para enviar backups de notas e anexos diretamente ao seu Google Drive com 1 clique e manter sincronização contínua.
                </div>
                <button
                  type="button"
                  className="user-badge-btn"
                  onClick={handleConnectGoogle}
                  disabled={syncState.isSyncing}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '9px 14px',
                    fontSize: '0.86rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer'
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span style={{ fontWeight: 600 }}>Conectar e Sincronizar pelo Google Drive</span>
                </button>
              </div>
            )}

            {/* Upload Result Feedback */}
            {uploadResult && (
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid var(--accent-green)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>Backup enviado com sucesso ao Google Drive!</span>
                </div>
                <div><strong>Arquivo:</strong> {uploadResult.file.name}</div>
                <div><strong>ID no Drive:</strong> <code>{uploadResult.file.fileId}</code></div>
                {uploadResult.file.webViewLink && (
                  <a
                    href={uploadResult.file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--accent-blue)',
                      marginTop: 4,
                      textDecoration: 'none',
                      fontWeight: 500
                    }}
                  >
                    <span>Abrir arquivo no Google Drive</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}

            {/* Advanced OAuth / Token Drawer */}
            {showAdvanced && (
              <div style={{
                padding: 12,
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: '0.82rem'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Configurações Avançadas</div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Google OAuth Client ID:
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="seu-client-id.apps.googleusercontent.com"
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem'
                      }}
                    />
                    <button
                      type="button"
                      className="sidebar-action-btn"
                      onClick={handleSaveClientId}
                      style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem' }}
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveManualToken} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <label style={{ color: 'var(--text-secondary)' }}>
                    Ou insira um OAuth Access Token manual:
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="password"
                      value={accessTokenInput}
                      onChange={(e) => setAccessTokenInput(e.target.value)}
                      placeholder="ya29.a0AfH6SM..."
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    <button
                      type="submit"
                      className="sidebar-action-btn"
                      disabled={syncState.isSyncing}
                      style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem' }}
                    >
                      {syncState.isSyncing ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
