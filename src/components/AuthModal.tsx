import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import { X, User as UserIcon, Lock, LogIn, UserPlus } from 'lucide-react';

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
