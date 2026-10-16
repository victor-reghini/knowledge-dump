import React, { useEffect, useState } from 'react';
import { Note } from '../types';
import { api } from '../api';
import { Globe, ArrowLeft, BookOpen, Network, FileText, User } from 'lucide-react';

interface PublicNoteViewProps {
  shareToken: string;
  onBackToApp: () => void;
  onNavigateToToken: (token: string) => void;
}

export const PublicNoteView: React.FC<PublicNoteViewProps> = ({
  shareToken,
  onBackToApp,
  onNavigateToToken
}) => {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getPublicNote(shareToken)
      .then((data) => setNote(data))
      .catch((err) => setError(err.message || 'Falha ao carregar nota pública'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <p>Carregando nota pública compartilhada...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <FileText size={48} style={{ opacity: 0.3 }} />
        <h3>Nota indisponível</h3>
        <p>{error || 'Esta nota não existe ou seu compartilhamento foi desativado.'}</p>
        <button className="sidebar-action-btn" onClick={onBackToApp}>
          <ArrowLeft size={16} />
          <span>Voltar ao Knowledge Dump</span>
        </button>
      </div>
    );
  }

  const renderContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} style={{ fontSize: '2rem', margin: '20px 0 12px', fontWeight: 700 }}>{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} style={{ fontSize: '1.5rem', margin: '18px 0 10px', fontWeight: 600 }}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ fontSize: '1.2rem', margin: '14px 0 8px', fontWeight: 600 }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('- ')) {
        return <li key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>{line.replace('- ', '')}</li>;
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: 12 }} />;
      }
      return <p key={idx} style={{ marginBottom: 12, lineHeight: 1.7 }}>{line}</p>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', overflowY: 'auto' }}>
      {/* Top Banner */}
      <header
        style={{
          padding: '12px 30px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button className="btn-blue" onClick={onBackToApp}>
          <ArrowLeft size={16} />
          <span>Entrar no Knowledge Dump</span>
        </button>

        <div className="public-badge">
          <Globe size={13} />
          <span>Documento Público Compartilhado</span>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 840, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {note.category_name && (
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 12,
                backgroundColor: 'var(--primary-yellow)',
                color: 'var(--primary-yellow-text)',
                border: '1px solid var(--primary-yellow-border)'
              }}
            >
              {note.category_name}
            </span>
          )}

          {note.author_name && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <User size={14} />
              <span>{note.author_name}</span>
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>
          {note.title}
        </h1>

        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 32, marginBottom: 32 }}>
          {renderContent(note.content)}
        </div>

        {/* Sources & Citations if shared (RF-37) */}
        {note.citations && note.citations.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <BookOpen size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>Fontes e Referências Citadas</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {note.citations.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 14,
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--accent-blue)'
                  }}
                >
                  <div style={{ fontStyle: 'italic', marginBottom: 6, color: 'var(--text-primary)' }}>
                    "{c.quote_text}"
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Fonte: <strong>{c.source_title}</strong> {c.page_number ? `(Página ${c.page_number})` : ''}
                    {c.authors ? ` — ${c.authors}` : ''} {c.year ? `(${c.year})` : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Notes if shared (RF-37) */}
        {note.related_notes && note.related_notes.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Network size={18} style={{ color: 'var(--primary-yellow-border)' }} />
              <span>Notas e Conceitos Relacionados</span>
            </h3>
            <div className="notes-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {note.related_notes.map((rel) => (
                <div
                  key={rel.id}
                  className="note-card"
                  style={{ height: 'auto', minHeight: 120 }}
                  onClick={() => rel.share_token && onNavigateToToken(rel.share_token)}
                >
                  <div className="note-card-title">{rel.title}</div>
                  <p className="note-card-snippet">{rel.snippet || 'Ver detalhes do conceito...'}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
