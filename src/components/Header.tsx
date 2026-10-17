import React, { useEffect, useState } from 'react';
import {
  Search,
  Moon,
  Sun,
  ShieldCheck,
  User as UserIcon,
  Columns2,
  Network,
  GraduationCap,
  PenTool,
  RefreshCw,
  Cloud,
  CloudOff,
  PanelLeft,
  PanelLeftClose,
  HardDrive
} from 'lucide-react';
import { User } from '../types';
import { syncManager, SyncState } from '../utils/syncManager';

interface HeaderProps {
  onOpenSearch: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  notesCount: number;
  currentUser: User | null;
  onOpenAuth: () => void;
  isSplitViewOpen?: boolean;
  onToggleSplitView?: () => void;
  isGraphOpen?: boolean;
  onToggleGraph?: () => void;
  isStudiesOpen?: boolean;
  onToggleStudies?: () => void;
  isCompositionOpen?: boolean;
  onToggleComposition?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  theme,
  onToggleTheme,
  notesCount,
  currentUser,
  onOpenAuth,
  isSplitViewOpen,
  onToggleSplitView,
  isGraphOpen,
  onToggleGraph,
  isStudiesOpen,
  onToggleStudies,
  isCompositionOpen,
  onToggleComposition,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenBackup
}) => {
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe(setSyncState);
  }, []);

  const handleManualSync = async () => {
    try {
      await syncManager.sync();
    } catch {
      // Handled in syncManager
    }
  };

  return (
    <header className="top-header" role="banner">
      <div className="header-left">
        {onToggleSidebar && (
          <button
            className={`icon-btn ${isSidebarCollapsed ? 'active' : ''}`}
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}

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
        {onToggleComposition && (
          <button
            className={`icon-btn ${isCompositionOpen ? 'active' : ''}`}
            onClick={onToggleComposition}
            title={isCompositionOpen ? 'Sair do Modo de Redação' : 'Modo de Redação Científica (RF-30)'}
            aria-label="Modo de Redação Científica"
          >
            <PenTool size={18} />
          </button>
        )}

        {onToggleStudies && (
          <button
            className={`icon-btn ${isStudiesOpen ? 'active' : ''}`}
            onClick={onToggleStudies}
            title={isStudiesOpen ? 'Sair do Módulo de Estudos' : 'Planos de Estudo e Exercícios (RF-22)'}
            aria-label="Módulo de Estudos e Exercícios"
          >
            <GraduationCap size={18} />
          </button>
        )}

        {onToggleGraph && (
          <button
            className={`icon-btn ${isGraphOpen ? 'active' : ''}`}
            onClick={onToggleGraph}
            title={isGraphOpen ? 'Sair do Grafo de Conhecimento' : 'Mapa Interativo em Grafo (RF-32)'}
            aria-label="Grafo de Conhecimento"
          >
            <Network size={18} />
          </button>
        )}

        {onToggleSplitView && (
          <button
            className={`icon-btn ${isSplitViewOpen ? 'active' : ''}`}
            onClick={onToggleSplitView}
            title={isSplitViewOpen ? 'Fechar Split-View' : 'Dividir Tela (Visualizador de PDF)'}
            aria-label="Dividir Tela"
          >
            <Columns2 size={18} />
          </button>
        )}

        <div className="header-divider" />

        {/* Local-First indicator icon */}
        <div
          className="icon-btn-static"
          title={`Armazenamento Local Soberano (${notesCount} notas salvas no SQLite)`}
          aria-label="Local-First"
        >
          <ShieldCheck size={18} style={{ color: 'var(--accent-green)' }} />
        </div>

        {/* Sync Status Icon Button */}
        <button
          className="icon-btn"
          onClick={handleManualSync}
          disabled={syncState.isSyncing}
          title={
            syncState.isSyncing
              ? 'Sincronizando com a nuvem...'
              : !syncState.isOnline
              ? 'Modo Offline: alterações serão sincronizadas ao reconectar'
              : syncState.pendingCount > 0
              ? `${syncState.pendingCount} alteração(ões) pendente(s) - clique para sincronizar`
              : syncState.lastSyncedAt
              ? `Sincronizado às ${new Date(syncState.lastSyncedAt).toLocaleTimeString()} - clique para sincronizar`
              : 'Sincronizar acervo com a nuvem'
          }
          aria-label="Sincronização"
        >
          {syncState.isSyncing ? (
            <RefreshCw size={18} className="spin" />
          ) : !syncState.isOnline ? (
            <CloudOff size={18} style={{ color: 'var(--accent-red)' }} />
          ) : (
            <Cloud size={18} style={{ color: 'var(--accent-blue)' }} />
          )}
        </button>

        {/* Backup & Google Drive Icon Button (RF-35, RNF-08) */}
        {onOpenBackup && (
          <button
            className="icon-btn"
            onClick={onOpenBackup}
            title="Backup Geral & Google Drive (RF-35, RNF-08)"
            aria-label="Backup Geral & Google Drive"
          >
            <HardDrive size={18} />
          </button>
        )}

        <div className="header-divider" />

        {/* User Badge Icon Button (RF-36) */}
        <button
          className="icon-btn"
          onClick={onOpenAuth}
          title={currentUser ? `Usuário autenticado: ${currentUser.name}` : 'Entrar na Conta (RF-36)'}
          aria-label="Conta do Usuário"
        >
          <UserIcon size={18} style={{ color: currentUser ? 'var(--primary-yellow-border)' : undefined }} />
        </button>

        {/* Theme Toggle Icon Button */}
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

