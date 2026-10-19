import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api';
import { googleDriveSync } from '../utils/googleDriveSync';
import {
  X,
  User as UserIcon,
  LogIn,
  UserPlus,
  Cloud,
  UserCheck,
  LogOut,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: User) => void;
  currentUser: User | null;
}

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onUserChanged,
  currentUser
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [driveState, setDriveState] = useState(() => googleDriveSync.getState());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const isUserLoggedIn = Boolean(
    currentUser && (currentUser.username !== 'admin' || localStorage.getItem('kd_user'))
  );

  useEffect(() => {
    return googleDriveSync.subscribe((state) => {
      setDriveState(state);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsSwitchingAccount(false);
      setError('');
      setSyncFeedback(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(username, password);
        localStorage.setItem('kd_user', JSON.stringify(res.user));
        onUserChanged(res.user);
        setIsSwitchingAccount(false);
        onClose();
      } else {
        const res = await api.register(username, password, name);
        localStorage.setItem('kd_user', JSON.stringify(res.user));
        onUserChanged(res.user);
        setIsSwitchingAccount(false);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro na autenticação');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const clientId = googleDriveSync.getClientId();
      if (!clientId) {
        const inputId = prompt(
          'Informe seu Google OAuth Client ID (ou clique em OK sem preencher para conectar com sandbox/demonstração):',
          ''
        );
        if (inputId === null) {
          setLoading(false);
          return;
        }
        if (inputId.trim()) {
          googleDriveSync.setClientId(inputId.trim());
        } else {
          const simulatedEmail = `pesquisador_${Date.now().toString().slice(-4)}@gmail.com`;
          const res = await api.loginWithGoogle({
            email: simulatedEmail,
            name: 'Pesquisador Google Drive',
            google_id: `google-${Date.now()}`,
            access_token: 'mock-token'
          });
          googleDriveSync.setAccessToken('mock-token', simulatedEmail, res.user.name);
          localStorage.setItem('kd_user', JSON.stringify(res.user));
          onUserChanged(res.user);
          setIsSwitchingAccount(false);
          onClose();
          googleDriveSync.performStartupSync().catch(() => {});
          return;
        }
      }

      const googleData = await googleDriveSync.requestGoogleLogin();
      const res = await api.loginWithGoogle({
        email: googleData.email,
        name: googleData.name,
        access_token: googleData.token
      });
      localStorage.setItem('kd_user', JSON.stringify(res.user));
      onUserChanged(res.user);
      setIsSwitchingAccount(false);
      onClose();
      googleDriveSync.performStartupSync().catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com a conta Google');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kd_user');
    googleDriveSync.disconnect();
    const guestUser: User = { id: 'user-admin', username: 'admin', name: 'Pesquisador' };
    onUserChanged(guestUser);
    setIsSwitchingAccount(false);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Autenticação de Usuário"
    >
      <div className="modal-content" style={{ maxWidth: 440 }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isUserLoggedIn && !isSwitchingAccount ? (
              <>
                <UserCheck size={18} style={{ color: 'var(--accent-green)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Minha Conta</h3>
              </>
            ) : isSwitchingAccount ? (
              <>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setIsSwitchingAccount(false)}
                  title="Voltar para Minha Conta"
                  style={{ padding: 4 }}
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Trocar de Conta</h3>
              </>
            ) : (
              <>
                <UserIcon size={18} style={{ color: 'var(--primary-yellow-border)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {mode === 'login' ? 'Entrar no Repositório' : 'Criar Nova Conta'}
                </h3>
              </>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* CASE 1: User is CONNECTED and NOT switching accounts -> SHOW PROFILE ONLY, NO LOGIN FORMS */}
          {isUserLoggedIn && !isSwitchingAccount && currentUser ? (
            <div>
              {/* Profile Card */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    border: '2px solid var(--primary-yellow-border)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.15rem',
                    flexShrink: 0
                  }}
                >
                  {getInitials(currentUser.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                      {currentUser.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 7px',
                        borderRadius: 10,
                        backgroundColor: 'rgba(22, 163, 74, 0.15)',
                        color: 'var(--accent-green)',
                        fontWeight: 600
                      }}
                    >
                      ● Conectado
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    @{currentUser.username}
                  </div>
                </div>
              </div>

              {/* Google Drive Sync Status Card */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  marginBottom: 20
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                    <Cloud size={16} style={{ color: driveState.isConnected ? '#4285F4' : 'var(--text-muted)' }} />
                    <span>Google Drive</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                      backgroundColor: driveState.isConnected ? 'rgba(66, 133, 244, 0.12)' : 'var(--bg-tertiary)',
                      color: driveState.isConnected ? '#2563eb' : 'var(--text-muted)'
                    }}
                  >
                    {driveState.isConnected ? 'Sincronizado' : 'Não vinculado'}
                  </span>
                </div>

                {driveState.isConnected ? (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                      Conta: <strong>{driveState.accountEmail || 'Conectada'}</strong>
                      {driveState.lastBackupAt && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 3 }}>
                          Último backup: {new Date(driveState.lastBackupAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="toolbar-btn"
                      style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '0.82rem' }}
                      onClick={async () => {
                        setIsSyncingDrive(true);
                        setSyncFeedback(null);
                        try {
                          const res = await googleDriveSync.triggerBackup();
                          if (res?.reason) {
                            setSyncFeedback(`Sincronizado: ${res.reason}`);
                          } else {
                            setSyncFeedback('Dados sincronizados com o Drive com sucesso!');
                          }
                        } catch (err: any) {
                          setSyncFeedback(err.message || 'Erro na sincronização');
                        } finally {
                          setIsSyncingDrive(false);
                        }
                      }}
                      disabled={isSyncingDrive}
                    >
                      <RefreshCw size={13} className={isSyncingDrive ? 'spinning' : ''} />
                      <span>{isSyncingDrive ? 'Sincronizando...' : 'Sincronizar com o Drive Agora'}</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                      Vincule sua conta Google para salvar e atualizar suas notas e referências no Google Drive.
                    </p>
                    <button
                      type="button"
                      className="user-badge-btn"
                      style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '0.82rem' }}
                      onClick={handleGoogleAuth}
                      disabled={loading}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Vincular ao Google Drive</span>
                    </button>
                  </div>
                )}

                {syncFeedback && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: syncFeedback.includes('Erro') ? 'var(--accent-red)' : 'var(--accent-green)'
                    }}
                  >
                    {syncFeedback}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="toolbar-btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: '0.85rem' }}
                  onClick={() => setIsSwitchingAccount(true)}
                >
                  <LogIn size={14} />
                  <span>Trocar de Conta</span>
                </button>

                <button
                  type="button"
                  className="btn-red"
                  style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: '0.85rem' }}
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          ) : (
            /* CASE 2: User NOT connected OR switching account -> SHOW LOGIN / REGISTER FORM */
            <div>
              {error && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-red-bg)',
                    color: 'var(--accent-red-text)',
                    fontSize: '0.85rem',
                    marginBottom: 14,
                    fontWeight: 500
                  }}
                >
                  {error}
                </div>
              )}

              {/* Google Login & Auto-Sync Button */}
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className="user-badge-btn"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  title="Entrar com a conta Google e ativar sincronização automática com o Google Drive"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span style={{ fontWeight: 600 }}>Entrar com Google & Sincronizar Drive</span>
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                    marginBottom: 8,
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
                  <span>ou acesse localmente</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
                </div>
              </div>

              {/* Mode Tabs: Login vs Register */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 16,
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: 8
                }}
              >
                <button
                  type="button"
                  className={`view-toggle-btn ${mode === 'login' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setMode('login')}
                >
                  <LogIn size={15} />
                  <span>Login</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${mode === 'register' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setMode('register')}
                >
                  <UserPlus size={15} />
                  <span>Cadastrar</span>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <div className="form-group">
                    <label className="form-label">Nome Completo:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: Dra. Maria Santos"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Usuário:</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Seu nome de usuário..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Senha:</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Sua senha..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                    type="submit"
                    className="sidebar-action-btn"
                    style={{ width: '100%', margin: 0, padding: '10px' }}
                    disabled={loading}
                  >
                    {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

