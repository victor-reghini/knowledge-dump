import React, { useState } from 'react';
import { Folder, FolderTreeNode, Note } from '../types';
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';

interface FolderTreeProps {
  folders: Folder[];
  notes: Note[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
}

export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // Initialize nodes
  folders.forEach((f) => {
    map.set(f.id, { ...f, children: [], level: 0 });
  });

  // Assign children
  folders.forEach((f) => {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      const parent = map.get(f.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// Count notes in folder and all descendants
export function countFolderNotes(folderId: string, folders: Folder[], notes: Note[]): number {
  const subFolderIds = new Set<string>([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (f.parent_id && subFolderIds.has(f.parent_id) && !subFolderIds.has(f.id)) {
        subFolderIds.add(f.id);
        added = true;
      }
    }
  }
  return notes.filter((n) => n.folder_id && subFolderIds.has(n.folder_id)).length;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  notes,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder
}) => {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set(folders.map((f) => f.id)));
  const [creatingForParentId, setCreatingForParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');

  const tree = buildFolderTree(folders);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartCreate = (parentId: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCreatingForParentId(parentId);
    setNewFolderName('');
    if (parentId) {
      setExpandedFolderIds((prev) => new Set([...prev, parentId]));
    }
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setCreatingForParentId(undefined);
      return;
    }
    await onCreateFolder(newFolderName.trim(), creatingForParentId);
    setNewFolderName('');
    setCreatingForParentId(undefined);
  };

  const renderNode = (node: FolderTreeNode) => {
    const isExpanded = expandedFolderIds.has(node.id);
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children.length > 0;
    const noteCount = countFolderNotes(node.id, folders, notes);

    return (
      <div key={node.id} className="folder-tree-node-wrapper">
        <div
          className={`folder-tree-item ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${8 + node.level * 14}px` }}
          onClick={() => onSelectFolder(isSelected ? null : node.id)}
          title={node.name}
        >
          <button
            type="button"
            className="folder-tree-expand-btn"
            onClick={(e) => toggleExpand(node.id, e)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            aria-label={isExpanded ? 'Recolher subpastas' : 'Expandir subpastas'}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <span className="folder-tree-icon">
            {isExpanded || isSelected ? (
              <FolderOpen size={16} className="text-accent" />
            ) : (
              <FolderIcon size={16} />
            )}
          </span>

          <span className="folder-tree-name">{node.name}</span>

          <span className="nav-badge">{noteCount}</span>

          <div className="folder-tree-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="folder-action-btn"
              title="Nova subpasta"
              onClick={(e) => handleStartCreate(node.id, e)}
            >
              <Plus size={13} />
            </button>
            {onDeleteFolder && (
              <button
                type="button"
                className="folder-action-btn delete"
                title="Excluir pasta"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Deseja excluir a pasta "${node.name}"? As notas serão mantidas.`)) {
                    onDeleteFolder(node.id);
                  }
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Inline Subfolder creation */}
        {creatingForParentId === node.id && (
          <form
            onSubmit={handleConfirmCreate}
            className="folder-inline-create"
            style={{ paddingLeft: `${24 + (node.level + 1) * 14}px` }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Nome da subpasta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => !newFolderName.trim() && setCreatingForParentId(undefined)}
              className="folder-inline-input"
            />
          </form>
        )}

        {/* Children nodes */}
        {hasChildren && isExpanded && (
          <div className="folder-tree-children">
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="folder-tree-container">
      <div className="folder-tree-header">
        <span className="nav-section-title">Pastas</span>
        <button
          type="button"
          className="folder-add-root-btn"
          title="Criar nova pasta raiz"
          onClick={() => handleStartCreate(null)}
        >
          <Plus size={14} />
          <span>Nova</span>
        </button>
      </div>

      {/* Inline Root Folder Creation */}
      {creatingForParentId === null && (
        <form onSubmit={handleConfirmCreate} className="folder-inline-create" style={{ paddingLeft: '12px' }}>
          <input
            type="text"
            autoFocus
            placeholder="Nome da nova pasta..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => !newFolderName.trim() && setCreatingForParentId(undefined)}
            className="folder-inline-input"
          />
        </form>
      )}

      {tree.length === 0 ? (
        <div className="folder-tree-empty">
          <small>Nenhuma pasta criada</small>
        </div>
      ) : (
        <div className="folder-tree-list">
          {tree.map((rootNode) => renderNode(rootNode))}
        </div>
      )}
    </div>
  );
};
