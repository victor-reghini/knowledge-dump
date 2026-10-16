import React, { useState } from 'react';
import { Category, CategoryTreeNode, Note } from '../types';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';

interface CategoryTreeProps {
  categories: Category[];
  notes: Note[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onCreateCategory: (data: { name: string; color?: string; parent_id?: string | null }) => Promise<void>;
  onUpdateCategory?: (id: string, data: { name?: string; color?: string; parent_id?: string | null }) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const safeCats = Array.isArray(categories) ? categories : [];
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  safeCats.forEach((c) => {
    map.set(c.id, { ...c, children: [], level: 0 });
  });

  safeCats.forEach((c) => {
    const node = map.get(c.id);
    if (!node) return;
    if (c.parent_id && map.has(c.parent_id)) {
      const parent = map.get(c.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function countCategoryNotes(categoryId: string, categories: Category[], notes: Note[]): number {
  const safeCats = Array.isArray(categories) ? categories : [];
  const safeNotes = Array.isArray(notes) ? notes : [];
  const subCategoryIds = new Set<string>([categoryId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of safeCats) {
      if (c.parent_id && subCategoryIds.has(c.parent_id) && !subCategoryIds.has(c.id)) {
        subCategoryIds.add(c.id);
        added = true;
      }
    }
  }
  return safeNotes.filter((n) => n.category_id && subCategoryIds.has(n.category_id)).length;
}

const PALETTE = [
  '#eab308', // Ambar
  '#3b82f6', // Azul
  '#22c55e', // Verde
  '#ef4444', // Vermelho
  '#a855f7', // Roxo
  '#06b6d4', // Ciano
  '#f97316', // Laranja
  '#ec4899'  // Rosa
];

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  categories,
  notes,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(categories.map((c) => c.id)));
  const [creatingForParentId, setCreatingForParentId] = useState<string | null | undefined>(undefined);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#eab308');

  // Editing state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#eab308');
  const [editParentId, setEditParentId] = useState<string | null>(null);

  const tree = buildCategoryTree(categories);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartCreate = (parentId: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCreatingForParentId(parentId);
    setNewCategoryName('');
    setNewCategoryColor('#eab308');
    setEditingCategoryId(null);
    if (parentId) {
      setExpandedIds((prev) => new Set([...prev, parentId]));
    }
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      setCreatingForParentId(undefined);
      return;
    }
    await onCreateCategory({
      name: newCategoryName.trim(),
      color: newCategoryColor,
      parent_id: creatingForParentId
    });
    setNewCategoryName('');
    setCreatingForParentId(undefined);
  };

  const handleStartEdit = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategoryId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || '#eab308');
    setEditParentId(cat.parent_id || null);
    setCreatingForParentId(undefined);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryId || !editName.trim() || !onUpdateCategory) return;
    await onUpdateCategory(editingCategoryId, {
      name: editName.trim(),
      color: editColor,
      parent_id: editParentId
    });
    setEditingCategoryId(null);
  };

  const renderNode = (node: CategoryTreeNode) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedCategoryId === node.id;
    const hasChildren = node.children.length > 0;
    const noteCount = countCategoryNotes(node.id, categories, notes);
    const isEditing = editingCategoryId === node.id;

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
              placeholder="Nome da categoria"
            />
            <div className="color-palette-small">
              {PALETTE.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`color-dot-choice ${editColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setEditColor(color)}
                />
              ))}
            </div>
            <select
              value={editParentId || ''}
              onChange={(e) => setEditParentId(e.target.value ? e.target.value : null)}
              className="tree-parent-select"
            >
              <option value="">Raiz (sem pai)</option>
              {categories
                .filter((c) => c.id !== node.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                onClick={() => setEditingCategoryId(null)}
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
          onClick={() => onSelectCategory(isSelected ? null : node.id)}
          title={node.name}
        >
          <button
            type="button"
            className="folder-tree-expand-btn"
            onClick={(e) => toggleExpand(node.id, e)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            aria-label={isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: node.color || '#eab308',
              flexShrink: 0
            }}
          />

          <span className="folder-tree-name">{node.name}</span>

          <span className="nav-badge">{noteCount}</span>

          <div className="folder-tree-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="folder-action-btn"
              title="Nova subcategoria"
              onClick={(e) => handleStartCreate(node.id, e)}
            >
              <Plus size={13} />
            </button>
            {onUpdateCategory && (
              <button
                type="button"
                className="folder-action-btn"
                title="Editar / Mover categoria"
                onClick={(e) => handleStartEdit(node, e)}
              >
                <Edit2 size={12} />
              </button>
            )}
            {onDeleteCategory && (
              <button
                type="button"
                className="folder-action-btn delete"
                title="Excluir categoria"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Deseja excluir a categoria "${node.name}"? As notas serão mantidas.`)) {
                    onDeleteCategory(node.id);
                  }
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Inline Subcategory Creation */}
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
                placeholder="Nome da subcategoria..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="folder-inline-input"
              />
              <div className="color-palette-small">
                {PALETTE.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`color-dot-choice ${newCategoryColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
              </div>
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
        <span className="nav-section-title">Categorias</span>
        <button
          type="button"
          className="folder-add-root-btn"
          title="Criar nova categoria raiz"
          onClick={() => handleStartCreate(null)}
        >
          <Plus size={14} />
          <span>Nova</span>
        </button>
      </div>

      {/* Inline Root Category Creation */}
      {creatingForParentId === null && (
        <form onSubmit={handleConfirmCreate} className="tree-create-form" style={{ paddingLeft: '8px' }}>
          <div className="tree-create-row">
            <input
              type="text"
              autoFocus
              placeholder="Nome da categoria..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="folder-inline-input"
            />
            <div className="color-palette-small">
              {PALETTE.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`color-dot-choice ${newCategoryColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewCategoryColor(color)}
                />
              ))}
            </div>
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
          <small>Nenhuma categoria criada</small>
        </div>
      ) : (
        <div className="folder-tree-list">
          {tree.map((rootNode) => renderNode(rootNode))}
        </div>
      )}
    </div>
  );
};
