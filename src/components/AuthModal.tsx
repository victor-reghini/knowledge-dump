import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import { googleDriveSync } from '../utils/googleDriveSync';
import { X, User as UserIcon, Lock, LogIn, UserPlus, Cloud } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: User) => void;
  currentUser: User | null;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(username, password);
        localStorage.setItem('kd_user', JSON.stringify(res.user));
        onUserChanged(res.user);
        onClose();
      } else {
        const res = await api.register(username, password, name);
        localStorage.setItem('kd_user', JSON.stringify(res.user));
        onUserChanged(res.user);
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
          onClose();
          googleDriveSync.triggerBackup().catch(() => {});
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
      onClose();
      googleDriveSync.triggerBackup().catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com a conta Google');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kd_user');
    const guestUser: User = { id: 'user-admin', username: 'admin', name: 'Pesquisador' };
    onUserChanged(guestUser);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Autenticação de Usuário"
    >
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserIcon size={18} style={{ color: 'var(--primary-yellow-border)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              {mode === 'login' ? 'Entrar no Repositório' : 'Criar Nova Conta'}
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {currentUser && currentUser.username !== 'admin' && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Conectado como:</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser.name} (@{currentUser.username})</div>
              </div>
              <button className="btn-red" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={handleLogout}>
                Sair
              </button>
            </div>
          )}

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

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              marginBottom: 8,
              color: 'var(--text-muted)',
              fontSize: '0.78rem'
            }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
              <span>ou acesse localmente</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
            </div>
          </div>

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
      </div>
    </div>
  );
};
