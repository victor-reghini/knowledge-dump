import React from 'react';
import { ReferenceFile } from '../types';
import { PdfViewer } from './PdfViewer';
import { DocxViewer } from './DocxViewer';
import { LatexViewer } from './LatexViewer';
import { MediaViewer } from './MediaViewer';
import { TextViewer } from './TextViewer';
import { PptxViewer } from './PptxViewer';

interface ReferenceViewerProps {
  reference: ReferenceFile;
  initialPage?: number;
  initialParagraph?: number;
  initialLine?: number;
  initialTimestamp?: number;
  highlightText?: string;
  onCite?: (citation: {
    quoteText: string;
    pageNumber: number;
    referenceId: string;
    referenceTitle: string;
    anchorData?: string;
  }) => void;
  onClose?: () => void;
}

export const ReferenceViewer: React.FC<ReferenceViewerProps> = ({
  reference,
  initialPage = 1,
  initialParagraph,
  initialLine,
  initialTimestamp,
  highlightText,
  onCite,
  onClose
}) => {
  const type = reference.file_type?.toLowerCase() || '';
  const path = reference.file_path?.toLowerCase() || '';

  if (type === 'pdf' || path.endsWith('.pdf')) {
    return (
      <PdfViewer
        reference={reference}
        initialPage={initialPage}
        highlightText={highlightText}
        onCite={onCite}
        onClose={onClose}
      />
    );
  }

  if (type === 'pptx' || type === 'ppt' || /\.(pptx|ppt|pps|ppsx|odp)$/i.test(path)) {
    return (
      <PptxViewer
        reference={reference}
        initialSlide={initialParagraph || initialLine || initialPage}
        initialPage={initialPage}
        highlightText={highlightText}
        onCite={onCite}
        onClose={onClose}
      />
    );
  }

  if (
    type === 'txt' ||
    type === 'text' ||
    type === 'md' ||
    type === 'markdown' ||
    /\.(txt|text|md|markdown)$/i.test(path)
  ) {
    return (
      <TextViewer
        reference={reference}
        initialLine={initialLine || (initialPage > 1 ? initialPage : undefined)}
        highlightText={highlightText}
        onCite={onCite}
        onClose={onClose}
      />
    );
  }

  if (type === 'docx' || type === 'doc' || path.endsWith('.docx') || path.endsWith('.doc')) {
    return (
      <DocxViewer
        reference={reference}
        initialParagraph={initialParagraph || initialPage}
        highlightText={highlightText}
        onCite={onCite}
        onClose={onClose}
      />
    );
  }

  if (type === 'tex' || type === 'latex' || path.endsWith('.tex')) {
    return (
      <LatexViewer
        reference={reference}
        initialLine={initialLine || (initialPage > 1 ? initialPage : undefined)}
        highlightText={highlightText}
        onCite={onCite}
        onClose={onClose}
      />
    );
  }

  if (
    type === 'video' ||
    type === 'audio' ||
    type === 'image' ||
    /\.(mp4|webm|mov|mkv|mp3|wav|ogg|m4a|png|jpg|jpeg|gif|svg|webp)$/i.test(path)
  ) {
    return (
      <MediaViewer
        reference={reference}
        initialTimestamp={initialTimestamp}
        onCite={onCite}
        onClose={onClose}
      />
    );
  }

  // Fallback para outros tipos de arquivo de texto (TXT / MD / HTML)
  return (
    <TextViewer
      reference={reference}
      initialLine={initialLine}
      highlightText={highlightText}
      onCite={onCite}
      onClose={onClose}
    />
  );
};
