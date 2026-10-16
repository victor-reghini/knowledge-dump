import React from 'react';
import { Note, Category } from '../types';
import { FileText, Tag, Link2, AlertCircle, ArrowRight } from 'lucide-react';

interface WikilinkPreviewPopoverProps {
  title: string;
  anchor?: string;
  targetNote?: Note;
  categories: Category[];
  position: { x: number; y: number };
  onClose: () => void;
  onNavigate: () => void;
}

export const WikilinkPreviewPopover: React.FC<WikilinkPreviewPopoverProps> = ({
  title,
  anchor,
  targetNote,
  categories,
  position,
  onNavigate
}) => {
  const category = targetNote?.category_id
    ? categories.find((c) => c.id === targetNote.category_id)
    : null;

  // Clean excerpt
  const excerpt = targetNote
    ? targetNote.content
        .replace(/^[#\-*>\s]+/gm, '')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .slice(0, 180) + (targetNote.content.length > 180 ? '...' : '')
    : null;

  // Clamp popover position so it stays within viewport
  const left = Math.min(position.x, window.innerWidth - 320);
  const top = position.y + 18;

  return (
    <div
      className="wikilink-preview-popover"
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 9999,
        width: '300px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        padding: '12px 14px',
        pointerEvents: 'auto',
        fontSize: '0.85rem'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate();
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <FileText size={15} style={{ color: targetNote ? 'var(--wikilink-color)' : 'var(--wikilink-orphan)' }} />
        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{title}</strong>
        {anchor && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{anchor}</span>
        )}
      </div>

      {targetNote ? (
        <>
          {category && (
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: 6 }}>
              Categoria: <strong>{category.name}</strong>
            </div>
          )}

          <p style={{ margin: '6px 0 10px 0', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {excerpt}
          </p>

          {targetNote.tags && targetNote.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {targetNote.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: '0.72rem',
                    background: 'var(--bg-tertiary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <Tag size={10} />
                  {t}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 6,
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: 'var(--wikilink-color)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link2 size={12} />
              {targetNote.backlinks?.length || 0} backlinks
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              Abrir nota <ArrowRight size={12} />
            </span>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--wikilink-orphan)',
              fontWeight: 600,
              fontSize: '0.8rem',
              marginBottom: 6
            }}
          >
            <AlertCircle size={14} />
            <span>Link Órfão da Wikipédia</span>
          </div>
          <p style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Esta nota conceitual ainda não foi criada no repositório.
          </p>
          <div
            style={{
              paddingTop: 6,
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>Clique para criar nota imediatamente</span>
            <ArrowRight size={12} />
          </div>
        </div>
      )}
    </div>
  );
};
