import React from 'react';
import { Search, Moon, Sun, ShieldCheck, User as UserIcon, Columns2 } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  onOpenSearch: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  notesCount: number;
  currentUser: User | null;
  onOpenAuth: () => void;
  isSplitViewOpen?: boolean;
  onToggleSplitView?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  theme,
  onToggleTheme,
  notesCount,
  currentUser,
  onOpenAuth,
  isSplitViewOpen,
  onToggleSplitView
}) => {
  return (
    <header className="top-header" role="banner">
      <div className="header-left">
        <button
          className="search-trigger"
          onClick={onOpenSearch}
          aria-label="Buscar notas e referências"
        >
          <Search size={16} />
          <span>Buscar no Knowledge Dump...</span>
          <span className="search-kbd">⌘K</span>
        </button>
      </div>

      <div className="header-right">
        {onToggleSplitView && (
          <button
            className={`user-badge-btn ${isSplitViewOpen ? 'active' : ''}`}
            onClick={onToggleSplitView}
            title={isSplitViewOpen ? 'Fechar Split-View' : 'Dividir Tela com Visualizador de PDF'}
            style={{
              backgroundColor: isSplitViewOpen ? 'var(--primary-yellow-light)' : undefined,
              borderColor: isSplitViewOpen ? 'var(--primary-yellow-border)' : undefined,
              color: isSplitViewOpen ? 'var(--primary-yellow-text)' : undefined
            }}
          >
            <Columns2 size={15} />
            <span>{isSplitViewOpen ? 'Split-View Ativo' : 'Visualizador PDF'}</span>
          </button>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginRight: '6px'
          }}
          title="Armazenamento Local Soberano no Host macOS"
        >
          <ShieldCheck size={16} style={{ color: 'var(--accent-green)' }} />
          <span>Local-First ({notesCount} notas)</span>
        </div>

        {/* User Badge / Login button (RF-36) */}
        <button className="user-badge-btn" onClick={onOpenAuth} title="Conta do Usuário">
          <UserIcon size={15} style={{ color: 'var(--primary-yellow-border)' }} />
          <span>{currentUser ? currentUser.name : 'Entrar'}</span>
        </button>

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
};
