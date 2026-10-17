import { buildDocxFromContent } from './docx.js';

export interface CitationItem {
  key: string;
  title: string;
  authors?: string;
  year?: number;
  doi?: string;
  page_number?: number;
  formatted_text?: string;
}

export interface ArticleExportData {
  title: string;
  subtitle?: string;
  authors?: string;
  date?: string;
  abstract?: string;
  keywords?: string[];
  content: string;
  status?: string;
  target_venue?: string;
  citations?: CitationItem[];
}

export interface CompileOptions {
  citationStyle?: 'ABNT' | 'APA' | 'IEEE';
  includeAbstract?: boolean;
  includeBibliography?: boolean;
  includeFrontmatter?: boolean;
}

/**
 * Formata item bibliográfico conforme estilo selecionado
 */
export function formatCitationEntry(cit: CitationItem, index: number, style: 'ABNT' | 'APA' | 'IEEE' = 'ABNT'): string {
  if (cit.formatted_text) return cit.formatted_text;

  const authors = cit.authors || 'AUTOR DESCONHECIDO';
  const year = cit.year ? cit.year.toString() : 's.d.';
  const title = cit.title;
  const doi = cit.doi ? ` DOI: https://doi.org/${cit.doi}` : '';
  const page = cit.page_number ? ` p. ${cit.page_number}.` : '';

  if (style === 'IEEE') {
    return `[${index + 1}] ${authors}, "${title}", ${year}.${page}${doi}`;
  } else if (style === 'APA') {
    return `${authors} (${year}). ${title}.${page}${doi}`;
  } else {
    // Default: ABNT
    const upperAuthors = authors.toUpperCase();
    return `${upperAuthors}. ${title}. ${year}.${page}${doi}`;
  }
}

/**
 * Compila artigo para Markdown universal com YAML frontmatter e bibliografia
 */
export function compileToMarkdown(data: ArticleExportData, options: CompileOptions = {}): string {
  const parts: string[] = [];

  const includeFrontmatter = options.includeFrontmatter !== false;
  if (includeFrontmatter) {
    parts.push('---');
    parts.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
    if (data.subtitle) parts.push(`subtitle: "${data.subtitle.replace(/"/g, '\\"')}"`);
    if (data.authors) parts.push(`authors: "${data.authors.replace(/"/g, '\\"')}"`);
    parts.push(`date: "${data.date || new Date().toISOString().split('T')[0]}"`);
    if (data.keywords && data.keywords.length > 0) {
      parts.push(`keywords: [${data.keywords.map(k => `"${k}"`).join(', ')}]`);
    }
    if (data.status) parts.push(`status: "${data.status}"`);
    if (data.target_venue) parts.push(`target_venue: "${data.target_venue}"`);
    parts.push('---\n');
  }

  // Título e Subtítulo
  parts.push(`# ${data.title}\n`);
  if (data.subtitle) parts.push(`*${data.subtitle}*\n`);
  if (data.authors) parts.push(`**Autor(es):** ${data.authors}\n`);

  // Resumo
  const includeAbstract = options.includeAbstract !== false;
  if (includeAbstract && data.abstract?.trim()) {
    parts.push('## Resumo\n');
    parts.push(`${data.abstract.trim()}\n`);
    if (data.keywords && data.keywords.length > 0) {
      parts.push(`**Palavras-chave:** ${data.keywords.join(', ')}\n`);
    }
  }

  // Corpo do Artigo
  parts.push(data.content.trim());
  parts.push('\n');

  // Bibliografia
  const includeBib = options.includeBibliography !== false;
  if (includeBib && data.citations && data.citations.length > 0) {
    parts.push('## Referências Bibliográficas\n');
    data.citations.forEach((cit, idx) => {
      const entry = formatCitationEntry(cit, idx, options.citationStyle || 'ABNT');
      parts.push(`${idx + 1}. ${entry}`);
    });
    parts.push('\n');
  }

  return parts.join('\n');
}

/**
 * Escapa caracteres especiais de LaTeX
 */
function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Converte blocos de Markdown básico em comandos nativos LaTeX
 */
function convertMarkdownToLatex(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inItemize = false;
  let inQuote = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('# ')) {
      if (inItemize) { result.push('\\end{itemize}'); inItemize = false; }
      if (inQuote) { result.push('\\end{quote}'); inQuote = false; }
      result.push(`\\section{${escapeLatex(trimmed.slice(2))}}`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inItemize) { result.push('\\end{itemize}'); inItemize = false; }
      if (inQuote) { result.push('\\end{quote}'); inQuote = false; }
      result.push(`\\subsection{${escapeLatex(trimmed.slice(3))}}`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      if (inItemize) { result.push('\\end{itemize}'); inItemize = false; }
      if (inQuote) { result.push('\\end{quote}'); inQuote = false; }
      result.push(`\\subsubsection{${escapeLatex(trimmed.slice(4))}}`);
      continue;
    }

    // List item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inItemize) {
        result.push('\\begin{itemize}');
        inItemize = true;
      }
      result.push(`  \\item ${escapeLatex(trimmed.slice(2))}`);
      continue;
    } else if (inItemize) {
      result.push('\\end{itemize}');
      inItemize = false;
    }

    // Quote
    if (trimmed.startsWith('> ')) {
      if (!inQuote) {
        result.push('\\begin{quote}');
        inQuote = true;
      }
      result.push(`  ${escapeLatex(trimmed.slice(2))}`);
      continue;
    } else if (inQuote) {
      result.push('\\end{quote}');
      inQuote = false;
    }

    // Blank line
    if (!trimmed) {
      result.push('');
      continue;
    }

    // Normal paragraph with bold / italics
    let p = escapeLatex(trimmed);
    p = p.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
    p = p.replace(/\*(.*?)\*/g, '\\textit{$1}');
    result.push(p + '\n');
  }

  if (inItemize) result.push('\\end{itemize}');
  if (inQuote) result.push('\\end{quote}');

  return result.join('\n');
}

/**
 * Compila artigo para código fonte LaTeX acadêmico pronto para pdflatex
 */
export function compileToLatex(data: ArticleExportData, options: CompileOptions = {}): string {
  const parts: string[] = [];

  parts.push('\\documentclass[12pt,a4paper]{article}');
  parts.push('\\usepackage[utf8]{inputenc}');
  parts.push('\\usepackage[T1]{fontenc}');
  parts.push('\\usepackage{amsmath,amsfonts,amssymb}');
  parts.push('\\usepackage{hyperref}');
  parts.push('\\usepackage[margin=2.5cm]{geometry}');
  parts.push('\\usepackage{microtype}');
  parts.push('');

  parts.push(`\\title{${escapeLatex(data.title)}${data.subtitle ? `\\\\ \\large ${escapeLatex(data.subtitle)}` : ''}}`);
  parts.push(`\\author{${escapeLatex(data.authors || 'Knowledge Dump Researcher')}}`);
  parts.push(`\\date{${data.date ? escapeLatex(data.date) : '\\today'}}`);
  parts.push('');

  parts.push('\\begin{document}');
  parts.push('\\maketitle');
  parts.push('');

  const includeAbstract = options.includeAbstract !== false;
  if (includeAbstract && data.abstract?.trim()) {
    parts.push('\\begin{abstract}');
    parts.push(escapeLatex(data.abstract.trim()));
    parts.push('\\end{abstract}');
    if (data.keywords && data.keywords.length > 0) {
      parts.push(`\\noindent \\textbf{Palavras-chave:} ${escapeLatex(data.keywords.join(', '))}\\\\`);
    }
    parts.push('');
  }

  // Conteúdo convertido
  parts.push(convertMarkdownToLatex(data.content));
  parts.push('');

  // Bibliografia LaTeX
  const includeBib = options.includeBibliography !== false;
  if (includeBib && data.citations && data.citations.length > 0) {
    parts.push('\\begin{thebibliography}{99}');
    data.citations.forEach((cit, idx) => {
      const citeKey = cit.key || `ref${idx + 1}`;
      const entry = formatCitationEntry(cit, idx, options.citationStyle || 'ABNT');
      parts.push(`\\bibitem{${citeKey}} ${escapeLatex(entry)}`);
    });
    parts.push('\\end{thebibliography}');
    parts.push('');
  }

  parts.push('\\end{document}');

  return parts.join('\n');
}

/**
 * Compila artigo para formato DOCX com metadados e referências
 */
export function compileToDocx(data: ArticleExportData, options: CompileOptions = {}): Buffer {
  let docContent = '';

  if (data.subtitle) {
    docContent += `### ${data.subtitle}\n\n`;
  }
  if (data.authors) {
    docContent += `**Autor(es):** ${data.authors}\n\n`;
  }

  const includeAbstract = options.includeAbstract !== false;
  if (includeAbstract && data.abstract?.trim()) {
    docContent += `## Resumo\n\n> ${data.abstract.trim()}\n\n`;
    if (data.keywords && data.keywords.length > 0) {
      docContent += `**Palavras-chave:** ${data.keywords.join(', ')}\n\n`;
    }
  }

  docContent += data.content.trim() + '\n\n';

  const includeBib = options.includeBibliography !== false;
  if (includeBib && data.citations && data.citations.length > 0) {
    docContent += '## Referências Bibliográficas\n\n';
    data.citations.forEach((cit, idx) => {
      const entry = formatCitationEntry(cit, idx, options.citationStyle || 'ABNT');
      docContent += `- ${entry}\n`;
    });
  }

  return buildDocxFromContent(data.title, docContent);
}

/**
 * Escapa texto para inclusão em PDF com codificação WinAnsi
 */
function escapePdfWinAnsi(str: string): string {
  let res = '';
  const buf = Buffer.from(str, 'latin1');
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x28) res += '\\(';
    else if (b === 0x29) res += '\\)';
    else if (b === 0x5c) res += '\\\\';
    else if (b < 32 || b >= 127) {
      res += '\\' + b.toString(8).padStart(3, '0');
    } else {
      res += String.fromCharCode(b);
    }
  }
  return res;
}

/**
 * Quebra texto em linhas de largura máxima para o canvas do PDF
 */
function wrapPdfLines(text: string, maxLen = 82): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxLen) {
      if (current.trim()) lines.push(current.trim());
      current = w;
    } else {
      current += (current ? ' ' : '') + w;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

interface PdfPageContent {
  header: string;
  items: Array<{
    type: 'title' | 'subtitle' | 'meta' | 'heading' | 'subheading' | 'paragraph' | 'quote' | 'bullet' | 'bib';
    text: string;
  }>;
}

/**
 * Compila artigo para PDF acadêmico (PDF 1.4) de alta fidelidade
 */
export function compileToPdf(data: ArticleExportData, options: CompileOptions = {}): Buffer {
  const pages: PdfPageContent[] = [];
  let currentPage: PdfPageContent = {
    header: (data.title || 'Knowledge Dump').toUpperCase().slice(0, 48),
    items: []
  };

  const startNewPage = () => {
    pages.push(currentPage);
    currentPage = {
      header: (data.title || 'Knowledge Dump').toUpperCase().slice(0, 48),
      items: []
    };
  };

  // Primeira página: Título e metadados
  currentPage.items.push({ type: 'title', text: data.title });
  if (data.subtitle) currentPage.items.push({ type: 'subtitle', text: data.subtitle });
  if (data.authors) currentPage.items.push({ type: 'meta', text: `Autor(es): ${data.authors}` });

  const includeAbstract = options.includeAbstract !== false;
  if (includeAbstract && data.abstract?.trim()) {
    currentPage.items.push({ type: 'heading', text: 'Resumo' });
    const abstractLines = wrapPdfLines(data.abstract.trim(), 80);
    for (const l of abstractLines) {
      currentPage.items.push({ type: 'quote', text: l });
    }
    if (data.keywords && data.keywords.length > 0) {
      currentPage.items.push({ type: 'meta', text: `Palavras-chave: ${data.keywords.join(', ')}` });
    }
  }

  // Parsing do corpo
  const rawSections = data.content.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  let estLinesOnPage = currentPage.items.length * 2;

  for (const sec of rawSections) {
    if (sec.startsWith('# ')) {
      if (estLinesOnPage > 28) {
        startNewPage();
        estLinesOnPage = 0;
      }
      currentPage.items.push({ type: 'heading', text: sec.slice(2).trim() });
      estLinesOnPage += 3;
    } else if (sec.startsWith('## ')) {
      if (estLinesOnPage > 30) {
        startNewPage();
        estLinesOnPage = 0;
      }
      currentPage.items.push({ type: 'subheading', text: sec.slice(3).trim() });
      estLinesOnPage += 2;
    } else if (sec.startsWith('- ') || sec.startsWith('* ')) {
      const bulletLines = sec.split('\n');
      for (const b of bulletLines) {
        const cleanB = b.replace(/^[-*]\s*/, '').trim();
        const wrapped = wrapPdfLines(cleanB, 78);
        for (let i = 0; i < wrapped.length; i++) {
          currentPage.items.push({ type: 'bullet', text: (i === 0 ? '• ' : '  ') + wrapped[i] });
          estLinesOnPage += 1;
        }
      }
    } else if (sec.startsWith('> ')) {
      const cleanQ = sec.replace(/^>\s*/gm, '').trim();
      const wrapped = wrapPdfLines(cleanQ, 78);
      for (const w of wrapped) {
        currentPage.items.push({ type: 'quote', text: w });
        estLinesOnPage += 1;
      }
    } else {
      const cleanP = sec.replace(/<[^>]+>/g, '').trim();
      const wrapped = wrapPdfLines(cleanP, 82);
      for (const w of wrapped) {
        currentPage.items.push({ type: 'paragraph', text: w });
        estLinesOnPage += 1;
        if (estLinesOnPage > 36) {
          startNewPage();
          estLinesOnPage = 0;
        }
      }
    }
  }

  // Bibliografia
  const includeBib = options.includeBibliography !== false;
  if (includeBib && data.citations && data.citations.length > 0) {
    if (estLinesOnPage > 24) {
      startNewPage();
      estLinesOnPage = 0;
    }
    currentPage.items.push({ type: 'heading', text: 'Referências Bibliográficas' });
    estLinesOnPage += 3;

    data.citations.forEach((cit, idx) => {
      const formatted = formatCitationEntry(cit, idx, options.citationStyle || 'ABNT');
      const lines = wrapPdfLines(`[${idx + 1}] ${formatted}`, 80);
      for (const l of lines) {
        currentPage.items.push({ type: 'bib', text: l });
        estLinesOnPage += 1;
        if (estLinesOnPage > 36) {
          startNewPage();
          estLinesOnPage = 0;
        }
      }
    });
  }

  pages.push(currentPage);

  const totalPages = pages.length;
  const kids: string[] = [];
  for (let i = 0; i < totalPages; i++) {
    kids.push(`${5 + 2 * i} 0 R`);
  }

  const objects: string[] = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${totalPages} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`;

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const page = pages[i];
    const pageObjNum = 5 + 2 * i;
    const streamObjNum = 6 + 2 * i;

    const commands: string[] = [];

    // Header
    commands.push(`BT /F2 8 Tf 54 756 Td (${escapePdfWinAnsi(page.header)}) Tj ET`);
    commands.push(`BT /F1 8 Tf 490 756 Td (Pág. ${pageNum} de ${totalPages}) Tj ET`);
    commands.push(`0.5 w 54 750 m 558 750 l S`);

    let y = 720;
    for (const item of page.items) {
      if (item.type === 'title') {
        commands.push(`BT /F2 16 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 26;
      } else if (item.type === 'subtitle') {
        commands.push(`BT /F1 11 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 18;
      } else if (item.type === 'meta') {
        commands.push(`BT /F1 9 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 16;
      } else if (item.type === 'heading') {
        y -= 8;
        commands.push(`BT /F2 12 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 18;
      } else if (item.type === 'subheading') {
        y -= 4;
        commands.push(`BT /F2 10.5 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 15;
      } else if (item.type === 'quote') {
        commands.push(`BT /F1 9 Tf 70 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 13;
      } else if (item.type === 'bullet') {
        commands.push(`BT /F1 9.5 Tf 60 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 13;
      } else if (item.type === 'bib') {
        commands.push(`BT /F1 8.5 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 12;
      } else {
        // paragraph
        commands.push(`BT /F1 9.5 Tf 54 ${y} Td (${escapePdfWinAnsi(item.text)}) Tj ET`);
        y -= 13;
      }

      if (y < 60) break;
    }

    // Footer
    commands.push(`0.5 w 54 45 m 558 45 l S`);
    commands.push(`BT /F1 8 Tf 54 32 Td (Knowledge Dump - Produção Científica & Síntese Soberana) Tj ET`);
    commands.push(`BT /F1 8 Tf 500 32 Td (Página ${pageNum}) Tj ET`);

    const streamContent = commands.join('\n');
    const streamLen = Buffer.byteLength(streamContent, 'utf8');

    objects[pageObjNum] = `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjNum} 0 R >>\nendobj\n`;
    objects[streamObjNum] = `${streamObjNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  }

  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [0];

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'utf8');
    pdf += objects[i];
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let i = 1; i < objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
