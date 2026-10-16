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
