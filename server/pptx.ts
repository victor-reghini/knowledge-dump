import fs from 'node:fs';
import { extractZipEntries, packZipEntries } from './docx.js';

export interface PptxSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  text: string;
  notes?: string;
}

export interface PptxContent {
  title: string;
  slideCount: number;
  slides: PptxSlide[];
  rawText: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Analisa buffer de arquivo PowerPoint (.pptx ou fallback .ppt)
 */
export function parsePptxBuffer(buffer: Buffer): PptxContent {
  const entries = extractZipEntries(buffer);
  const slideKeys = Object.keys(entries)
    .filter((k) => /^ppt\/slides\/slide(\d+)\.xml$/i.test(k))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slideKeys.length === 0) {
    // Fallback para arquivo binário .ppt legado ou formato simples
    const raw = buffer
      .toString('utf8')
      .replace(/[^\x20-\x7E\u00A0-\u024F\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const slideChunks = raw.split(/(?:Slide\s*\d+|Apresentação)/i).filter((s) => s.trim().length > 10);
    const fallbackSlides: PptxSlide[] = (slideChunks.length > 0 ? slideChunks : [raw]).map((chunk, idx) => ({
      slideNumber: idx + 1,
      title: `Slide ${idx + 1}`,
      bullets: chunk.split(/\.\s+/).filter(Boolean).slice(0, 5),
      text: chunk
    }));

    return {
      title: 'Apresentação PowerPoint',
      slideCount: fallbackSlides.length,
      slides: fallbackSlides,
      rawText: raw
    };
  }

  const slides: PptxSlide[] = [];
  let presentationTitle: string | undefined;

  for (let idx = 0; idx < slideKeys.length; idx++) {
    const key = slideKeys[idx];
    const slideNumber = idx + 1;
    const xml = entries[key].toString('utf8');

    // Extrai parágrafos <a:p>...</a:p>
    const pRegex = /<a:p(?:\s+[^>]*)?>(.*?)<\/a:p>/gs;
    let pMatch: RegExpExecArray | null;
    const paragraphs: string[] = [];

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pBody = pMatch[1];
      const tRegex = /<a:t(?:\s+[^>]*)?>(.*?)<\/a:t>/gs;
      let tMatch: RegExpExecArray | null;
      let fullParagraphText = '';

      while ((tMatch = tRegex.exec(pBody)) !== null) {
        fullParagraphText += decodeXmlEntities(tMatch[1]);
      }

      const clean = fullParagraphText.trim();
      if (clean) {
        paragraphs.push(clean);
      }
    }

    const slideTitle = paragraphs[0] || `Slide ${slideNumber}`;
    const bullets = paragraphs.slice(1);
    const fullText = paragraphs.join('\n');

    if (!presentationTitle && paragraphs[0]) {
      presentationTitle = paragraphs[0];
    }

    // Busca notas do slide em ppt/notesSlides/notesSlideX.xml
    let notes: string | undefined;
    const noteKey = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    if (entries[noteKey]) {
      const noteXml = entries[noteKey].toString('utf8');
      const noteMatches: string[] = [];
      const noteRegex = /<a:t(?:\s+[^>]*)?>(.*?)<\/a:t>/gs;
      let ntMatch: RegExpExecArray | null;
      while ((ntMatch = noteRegex.exec(noteXml)) !== null) {
        noteMatches.push(decodeXmlEntities(ntMatch[1]));
      }
      notes = noteMatches.join(' ').trim();
    }

    slides.push({
      slideNumber,
      title: slideTitle,
      bullets: bullets.length > 0 ? bullets : [fullText || 'Conteúdo do slide'],
      text: fullText,
      notes
    });
  }

  const rawText = slides.map((s) => `[Slide ${s.slideNumber}: ${s.title}]\n${s.text}`).join('\n\n');

  return {
    title: presentationTitle || 'Apresentação PowerPoint',
    slideCount: slides.length,
    slides,
    rawText
  };
}

/**
 * Lê e analisa apresentação PowerPoint (.pptx ou .ppt) a partir do disco
 */
export function parsePptxFile(filePath: string): PptxContent {
  const buffer = fs.readFileSync(filePath);
  return parsePptxBuffer(buffer);
}

/**
 * Cria buffer .pptx válido sem dependências externas
 */
export function createMockPptxBuffer(
  presentationTitle: string,
  slides: { title: string; bullets: string[] }[]
): Buffer {
  const entries: Record<string, Buffer> = {};

  // [Content_Types].xml
  let contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="xml" ContentType="application/xml"/>\n' +
    '  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>\n';

  slides.forEach((_, idx) => {
    contentTypes += `  <Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
  });
  contentTypes += '</Types>';
  entries['[Content_Types].xml'] = Buffer.from(contentTypes, 'utf8');

  // _rels/.rels
  entries['_rels/.rels'] = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>\n' +
    '</Relationships>',
    'utf8'
  );

  // ppt/presentation.xml
  let presRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';

  slides.forEach((_, idx) => {
    presRels += `  <Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>\n`;
  });
  presRels += '</Relationships>';
  entries['ppt/_rels/presentation.xml.rels'] = Buffer.from(presRels, 'utf8');

  let sldIdLst = '';
  slides.forEach((_, idx) => {
    sldIdLst += `    <p:sldId id="${256 + idx}" r:id="rId${idx + 1}"/>\n`;
  });

  entries['ppt/presentation.xml'] = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
    '  <p:sldIdLst>\n' +
    sldIdLst +
    '  </p:sldIdLst>\n' +
    '</p:presentation>',
    'utf8'
  );

  // Gera cada slide XML
  slides.forEach((s, idx) => {
    const sldNum = idx + 1;
    let paragraphsXml = `      <a:p><a:r><a:t>${escapeXml(s.title)}</a:t></a:r></a:p>\n`;
    s.bullets.forEach((b) => {
      paragraphsXml += `      <a:p><a:r><a:t>${escapeXml(b)}</a:t></a:r></a:p>\n`;
    });

    const slideXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">\n' +
      '  <p:cSld>\n' +
      '    <p:spTree>\n' +
      '      <p:sp>\n' +
      '        <p:txBody>\n' +
      paragraphsXml +
      '        </p:txBody>\n' +
      '      </p:sp>\n' +
      '    </p:spTree>\n' +
      '  </p:cSld>\n' +
      '</p:sld>';

    entries[`ppt/slides/slide${sldNum}.xml`] = Buffer.from(slideXml, 'utf8');
  });

  return packZipEntries(entries);
}
