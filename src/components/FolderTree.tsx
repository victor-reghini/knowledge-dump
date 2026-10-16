import React, { useState } from 'react';
import { Folder, FolderTreeNode, Note, ReferenceFile } from '../types';
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';

interface FolderTreeProps {
  folders: Folder[];
  notes: Note[];
  references?: ReferenceFile[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onUpdateFolder?: (id: string, data: { name?: string; parent_id?: string | null }) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
}

export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const safeFolders = Array.isArray(folders) ? folders : [];
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // Initialize nodes
  safeFolders.forEach((f) => {
    map.set(f.id, { ...f, children: [], level: 0 });
  });

  // Assign children
  safeFolders.forEach((f) => {
    const node = map.get(f.id);
    if (!node) return;
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

// Count notes and references in folder and all descendants
export function countFolderNotes(
  folderId: string,
  folders: Folder[],
  notes: Note[],
  references?: ReferenceFile[]
): number {
  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeNotes = Array.isArray(notes) ? notes : [];
  const safeRefs = Array.isArray(references) ? references : [];
  const subFolderIds = new Set<string>([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of safeFolders) {
      if (f.parent_id && subFolderIds.has(f.parent_id) && !subFolderIds.has(f.id)) {
        subFolderIds.add(f.id);
        added = true;
      }
    }
  }
  const notesCount = safeNotes.filter((n) => n.folder_id && subFolderIds.has(n.folder_id)).length;
  const refsCount = safeRefs.filter((r) => r.folder_id && subFolderIds.has(r.folder_id)).length;
  return notesCount + refsCount;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  notes,
  references,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder
}) => {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set(folders.map((f) => f.id)));
  const [creatingForParentId, setCreatingForParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');

  // Editing state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState<string | null>(null);

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
    setEditingFolderId(null);
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

  const handleStartEdit = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditName(folder.name);
    setEditParentId(folder.parent_id || null);
    setCreatingForParentId(undefined);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolderId || !editName.trim() || !onUpdateFolder) return;
    await onUpdateFolder(editingFolderId, {
      name: editName.trim(),
      parent_id: editParentId
    });
    setEditingFolderId(null);
  };

  const renderNode = (node: FolderTreeNode) => {
    const isExpanded = expandedFolderIds.has(node.id);
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children.length > 0;
    const noteCount = countFolderNotes(node.id, folders, notes, references);
    const isEditing = editingFolderId === node.id;

    if (isEditing) {
      return (
        <form
          key={node.id}
          onSubmit={handleConfirmEdit}
          className="tree-edit-form"
          style={{ paddingLeft: `${8 + node.level * 14}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tree-edit-row">
            <input
              type="text"
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="folder-inline-input"
              placeholder="Nome da pasta..."
            />
            <select
              value={editParentId || ''}
              onChange={(e) => setEditParentId(e.target.value ? e.target.value : null)}
              className="tree-parent-select"
            >
              <option value="">Raiz (sem pai)</option>
              {folders
                .filter((f) => f.id !== node.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <div className="tree-edit-buttons">
              <button type="submit" className="tree-btn-confirm" title="Salvar">
                <Check size={13} />
              </button>
              <button
                type="button"
                className="tree-btn-cancel"
                onClick={() => setEditingFolderId(null)}
                title="Cancelar"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </form>
      );
    }

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
            {onUpdateFolder && (
              <button
                type="button"
                className="folder-action-btn"
                title="Editar / Mover pasta"
                onClick={(e) => handleStartEdit(node, e)}
              >
                <Edit2 size={12} />
              </button>
            )}
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
            className="tree-create-form"
            style={{ paddingLeft: `${24 + (node.level + 1) * 14}px` }}
          >
            <div className="tree-create-row">
              <input
                type="text"
                autoFocus
                placeholder="Nome da subpasta..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="folder-inline-input"
              />
              <button type="submit" className="tree-btn-confirm" title="Criar">
                <Check size={13} />
              </button>
              <button
                type="button"
                className="tree-btn-cancel"
                onClick={() => setCreatingForParentId(undefined)}
                title="Cancelar"
              >
                <X size={13} />
              </button>
            </div>
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
        <form onSubmit={handleConfirmCreate} className="tree-create-form" style={{ paddingLeft: '8px' }}>
          <div className="tree-create-row">
            <input
              type="text"
              autoFocus
              placeholder="Nome da nova pasta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="folder-inline-input"
            />
            <button type="submit" className="tree-btn-confirm" title="Criar">
              <Check size={13} />
            </button>
            <button
              type="button"
              className="tree-btn-cancel"
              onClick={() => setCreatingForParentId(undefined)}
              title="Cancelar"
            >
              <X size={13} />
            </button>
          </div>
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
