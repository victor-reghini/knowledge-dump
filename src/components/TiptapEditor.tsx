import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Link as LinkIcon,
  Sigma,
  Anchor as AnchorIcon
} from 'lucide-react';

interface TiptapEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  onInsertWikilink: () => void;
  onInsertMath: () => void;
  onInsertAnchor: () => void;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onInsertWikilink,
  onInsertMath,
  onInsertAnchor
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      // Return HTML/formatted text to parent
      onChange(editor.getHTML());
    }
  });

  // Sync content if note changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return <div style={{ padding: 16, color: 'var(--text-muted)' }}>Carregando editor Tiptap...</div>;
  }

  return (
    <div className="tiptap-container">
      {/* Rich-Text Formatting Toolbar */}
      <div className="tiptap-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          title="Negrito (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          title="Itálico (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`tiptap-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
          title="Tachado"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`tiptap-btn ${editor.isActive('code') ? 'is-active' : ''}`}
          title="Código inline"
        >
          <Code size={15} />
        </button>

        <div className="tiptap-divider" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`tiptap-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
          title="Título 1"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
          title="Título 2"
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
          title="Título 3"
        >
          <Heading3 size={15} />
        </button>

        <div className="tiptap-divider" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
          title="Lista com Marcadores"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
          title="Lista Numerada"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
          title="Citação"
        >
          <Quote size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="tiptap-btn"
          title="Linha Divisória"
        >
          <Minus size={15} />
        </button>

        <div className="tiptap-divider" />

        {/* Hypertext & Knowledge Buttons */}
        <button
          type="button"
          onClick={onInsertWikilink}
          className="tiptap-btn-action"
          title="Inserir Wikilink [[Nome da Nota]]"
        >
          <LinkIcon size={14} />
          <span>Wikilink</span>
        </button>

        <button
          type="button"
          onClick={onInsertMath}
          className="tiptap-btn-action"
          title="Inserir Fórmula Matemática LaTeX / KaTeX ($E=mc^2$)"
        >
          <Sigma size={14} />
          <span>KaTeX</span>
        </button>

        <button
          type="button"
          onClick={onInsertAnchor}
          className="tiptap-btn-action"
          title="Inserir Âncora Contextual (#secao)"
        >
          <AnchorIcon size={14} />
          <span>Âncora</span>
        </button>

        <div className="tiptap-divider" style={{ marginLeft: 'auto' }} />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="tiptap-btn"
          title="Desfazer (Ctrl+Z)"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="tiptap-btn"
          title="Refazer (Ctrl+Y)"
        >
          <Redo size={15} />
        </button>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} className="tiptap-editor-area" />
    </div>
  );
};
