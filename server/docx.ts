import zlib from 'node:zlib';
import fs from 'node:fs';

export interface DocxParagraph {
  index: number;
  type: 'title' | 'heading' | 'paragraph' | 'list-item' | 'table';
  level?: number;
  text: string;
  html: string;
}

export interface DocxContent {
  title?: string;
  paragraphs: DocxParagraph[];
  rawText: string;
}

/**
 * Descompacta entradas de um arquivo ZIP (DOCX) usando node:zlib nativo sem bibliotecas externas
 */
export function extractZipEntries(buffer: Buffer): Record<string, Buffer> {
  const entries: Record<string, Buffer> = {};
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break; // Não é um cabeçalho de arquivo local PK

    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fnLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    if (offset + 30 + fnLen > buffer.length) break;
    const name = buffer.toString('utf8', offset + 30, offset + 30 + fnLen);
    const dataOffset = offset + 30 + fnLen + extraLen;

    if (dataOffset + compressedSize > buffer.length) break;
    const rawData = buffer.subarray(dataOffset, dataOffset + compressedSize);

    try {
      if (method === 0) {
        entries[name] = rawData;
      } else if (method === 8) {
        entries[name] = zlib.inflateRawSync(rawData);
      }
    } catch {
      // Ignora arquivo corrompido ou formato não suportado
    }

    offset = dataOffset + compressedSize;
  }

  return entries;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Analisa e extrai parágrafos, cabeçalhos e formatações de um buffer .docx
 */
export function parseDocxBuffer(buffer: Buffer): DocxContent {
  const entries = extractZipEntries(buffer);
  const docXmlBuffer = entries['word/document.xml'];

  if (!docXmlBuffer) {
    // Se não encontrou word/document.xml, tenta extrair texto puro como fallback
    const raw = buffer.toString('utf8').replace(/[^\x20-\x7E\u00A0-\u024F\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      title: 'Documento Word',
      paragraphs: raw ? [{ index: 1, type: 'paragraph', text: raw, html: `<p>${escapeHtml(raw)}</p>` }] : [],
      rawText: raw
    };
  }

  const xml = docXmlBuffer.toString('utf8');
  const paragraphs: DocxParagraph[] = [];
  let detectedTitle: string | undefined;

  // Regex para parágrafos (<w:p>...</w:p>)
  const pRegex = /<w:p(?:\s+[^>]*)?>(.*?)<\/w:p>/gs;
  let pMatch: RegExpExecArray | null;
  let pIndex = 1;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pBody = pMatch[1];

    // Detecta estilo do parágrafo (Heading1, Heading2, Title, etc.)
    const styleMatch = pBody.match(/<w:pStyle\s+[^>]*w:val="([^"]+)"/i);
    const styleVal = styleMatch ? styleMatch[1].toLowerCase() : '';

    let type: DocxParagraph['type'] = 'paragraph';
    let level: number | undefined;

    if (styleVal.includes('title')) {
      type = 'title';
      level = 1;
    } else if (styleVal.includes('heading1') || styleVal.includes('heading 1')) {
      type = 'heading';
      level = 1;
    } else if (styleVal.includes('heading2') || styleVal.includes('heading 2')) {
      type = 'heading';
      level = 2;
    } else if (styleVal.includes('heading3') || styleVal.includes('heading 3')) {
      type = 'heading';
      level = 3;
    } else if (pBody.includes('<w:numPr>')) {
      type = 'list-item';
    }

    // Processa runs de texto (<w:r>...</w:r>) com negrito/itálico
    const rRegex = /<w:r(?:\s+[^>]*)?>(.*?)<\/w:r>/gs;
    let rMatch: RegExpExecArray | null;
    let plainText = '';
    let htmlContent = '';

    while ((rMatch = rRegex.exec(pBody)) !== null) {
      const rBody = rMatch[1];
      const isBold = /<w:b(?:\s|\/|>)/.test(rBody) && !/<w:b\s+w:val="(?:0|false)"/.test(rBody);
      const isItalic = /<w:i(?:\s|\/|>)/.test(rBody) && !/<w:i\s+w:val="(?:0|false)"/.test(rBody);
      const isUnderline = /<w:u(?:\s|\/|>)/.test(rBody) && !/<w:u\s+w:val="(?:none|0|false)"/.test(rBody);

      // Extrai texto <w:t>
      const tMatches = rBody.match(/<w:t(?:\s+[^>]*)?>(.*?)<\/w:t>/gs);
      if (tMatches) {
        for (const tTag of tMatches) {
          const rawTextContent = tTag.replace(/^<w:t(?:\s+[^>]*)?>|<\/w:t>$/g, '');
          const cleanText = decodeXmlEntities(rawTextContent);
          plainText += cleanText;

          let formattedSnippet = escapeHtml(cleanText);
          if (isBold) formattedSnippet = `<strong>${formattedSnippet}</strong>`;
          if (isItalic) formattedSnippet = `<em>${formattedSnippet}</em>`;
          if (isUnderline) formattedSnippet = `<u>${formattedSnippet}</u>`;

          htmlContent += formattedSnippet;
        }
      }
    }

    const trimmedText = plainText.trim();
    if (trimmedText) {
      if (!detectedTitle && (type === 'title' || (type === 'heading' && level === 1))) {
        detectedTitle = trimmedText;
      }

      let finalHtml = '';
      if (type === 'title') {
        finalHtml = `<h1 class="docx-title">${htmlContent}</h1>`;
      } else if (type === 'heading') {
        finalHtml = `<h${(level || 1) + 1} class="docx-heading-${level}">${htmlContent}</h${(level || 1) + 1}>`;
      } else if (type === 'list-item') {
        finalHtml = `<li class="docx-list-item">${htmlContent}</li>`;
      } else {
        finalHtml = `<p class="docx-paragraph">${htmlContent}</p>`;
      }

      paragraphs.push({
        index: pIndex++,
        type,
        level,
        text: trimmedText,
        html: finalHtml
      });
    }
  }

  const rawText = paragraphs.map((p) => p.text).join('\n\n');

  return {
    title: detectedTitle || 'Documento Word',
    paragraphs,
    rawText
  };
}

/**
 * Lê e analisa arquivo DOCX a partir do caminho no disco
 */
export function parseDocxFile(filePath: string): DocxContent {
  const buffer = fs.readFileSync(filePath);
  return parseDocxBuffer(buffer);
}

/**
 * Empacota entradas de arquivo em um buffer ZIP válido usando node:zlib
 */
export function packZipEntries(entries: Record<string, Buffer>): Buffer {
  const localChunks: Buffer[] = [];
  const cdChunks: Buffer[] = [];
  let offset = 0;

  for (const [name, data] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = (zlib as any).crc32 ? (zlib as any).crc32(data) : 0;
    const compressed = zlib.deflateRawSync(data);
    const compSize = compressed.length;
    const uncompSize = data.length;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8); // Deflate
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compSize, 18);
    localHeader.writeUInt32LE(uncompSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, compressed);

    // Central directory header (46 bytes + nameBuf.length)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(8, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compSize, 20);
    cdHeader.writeUInt32LE(uncompSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);

    cdChunks.push(cdHeader, nameBuf);

    offset += 30 + nameBuf.length + compSize;
  }

  const cdOffset = offset;
  const cdTotalSize = cdChunks.reduce((acc, c) => acc + c.length, 0);
  const entryCount = Object.keys(entries).length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(cdTotalSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, ...cdChunks, eocd]);
}

/**
 * Salva texto editado de volta no arquivo DOCX
 */
export function saveDocxFile(filePath: string, updatedText: string): void {
  let entries: Record<string, Buffer> = {};
  if (fs.existsSync(filePath)) {
    try {
      const existingBuf = fs.readFileSync(filePath);
      entries = extractZipEntries(existingBuf);
    } catch {}
  }

  // Se não possuir estrutura básica de DOCX, inicializa arquivos obrigatórios
  if (!entries['[Content_Types].xml']) {
    entries['[Content_Types].xml'] = Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      '  <Default Extension="xml" ContentType="application/xml"/>\n' +
      '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
      '</Types>',
      'utf8'
    );
  }

  if (!entries['_rels/.rels']) {
    entries['_rels/.rels'] = Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
      '</Relationships>',
      'utf8'
    );
  }

  // Gera o XML de parágrafos
  const paragraphs = updatedText.split(/\n\s*\n/).filter((p) => p.trim());
  const paragraphsXml = paragraphs
    .map((p) => {
      const clean = escapeHtml(p.trim());
      return `<w:p><w:r><w:t xml:space="preserve">${clean}</w:t></w:r></w:p>`;
    })
    .join('\n    ');

  const newDocXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
    '  <w:body>\n' +
    `    ${paragraphsXml || '<w:p><w:r><w:t></w:t></w:r></w:p>'}\n` +
    '  </w:body>\n' +
    '</w:document>';

  entries['word/document.xml'] = Buffer.from(newDocXml, 'utf8');

  const packedBuffer = packZipEntries(entries);
  fs.writeFileSync(filePath, packedBuffer);
}

/**
 * Converte título e conteúdo HTML/Markdown em um Buffer de documento DOCX válido
 */
export function buildDocxFromContent(title: string, content: string): Buffer {
  const entries: Record<string, Buffer> = {};
  entries['[Content_Types].xml'] = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="xml" ContentType="application/xml"/>\n' +
    '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
    '</Types>',
    'utf8'
  );
  entries['_rels/.rels'] = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
    '</Relationships>',
    'utf8'
  );

  // Normaliza HTML / Markdown para blocos de texto estruturados
  const normalized = content
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n\n> $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const blocks = normalized.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const pXmls = blocks.map((b) => {
    if (b.startsWith('# ')) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${escapeHtml(b.slice(2))}</w:t></w:r></w:p>`;
    } else if (b.startsWith('## ')) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeHtml(b.slice(3))}</w:t></w:r></w:p>`;
    } else if (b.startsWith('### ')) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeHtml(b.slice(4))}</w:t></w:r></w:p>`;
    } else if (b.startsWith('> ')) {
      return `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>${escapeHtml(b.slice(2))}</w:t></w:r></w:p>`;
    } else if (b.startsWith('- ') || b.startsWith('* ')) {
      return `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t>• ${escapeHtml(b.slice(2))}</w:t></w:r></w:p>`;
    }
    return `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(b)}</w:t></w:r></w:p>`;
  });

  const docXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
    '  <w:body>\n' +
    `    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="44"/></w:rPr><w:t>${escapeHtml(title)}</w:t></w:r></w:p>\n` +
    `    ${pXmls.join('\n    ') || '<w:p><w:r><w:t></w:t></w:r></w:p>'}\n` +
    '  </w:body>\n' +
    '</w:document>';

  entries['word/document.xml'] = Buffer.from(docXml, 'utf8');
  return packZipEntries(entries);
}
