import React, { useState, useRef, useEffect } from 'react';
import { ReferenceFile } from '../types';
import { api } from '../api';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Quote,
  X,
  BookmarkCheck,
  Film,
  Music,
  Image as ImageIcon
} from 'lucide-react';

interface MediaViewerProps {
  reference: ReferenceFile;
  initialTimestamp?: number; // em segundos
  onCite?: (citation: {
    quoteText: string;
    pageNumber: number;
    referenceId: string;
    referenceTitle: string;
    anchorData?: string;
  }) => void;
  onClose?: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  reference,
  initialTimestamp,
  onCite,
  onClose
}) => {
  const isVideo = reference.file_type === 'video' || /\.(mp4|webm|mov|mkv)$/i.test(reference.file_path);
  const isAudio = reference.file_type === 'audio' || /\.(mp3|wav|ogg|m4a|flac)$/i.test(reference.file_path);
  const isImage = reference.file_type === 'image' || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(reference.file_path);

  // Playback state for Video/Audio
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [copiedCite, setCopiedCite] = useState(false);
  const [quoteInput, setQuoteInput] = useState('');

  // Image manipulation state
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const fileUrl = api.getReferenceFileUrl(reference.id);

  // Handle deep-linked timestamp
  useEffect(() => {
    if (initialTimestamp && mediaRef.current) {
      mediaRef.current.currentTime = initialTimestamp;
      setCurrentTime(initialTimestamp);
    }
  }, [initialTimestamp]);

  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
      if (initialTimestamp) {
        mediaRef.current.currentTime = initialTimestamp;
      }
    }
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play();
      setIsPlaying(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = rate;
    }
  };

  const handleCiteTimestamp = () => {
    if (!onCite) return;
    const timeFormatted = formatTime(currentTime);
    const secs = Math.floor(currentTime);
    const quote = quoteInput.trim() || `Trecho em ${timeFormatted}`;

    onCite({
      quoteText: quote,
      pageNumber: Math.max(1, Math.floor(secs / 60) + 1),
      referenceId: reference.id,
      referenceTitle: `${reference.title} (${timeFormatted})`,
      anchorData: `t=${secs}`
    });

    setCopiedCite(true);
    setTimeout(() => {
      setCopiedCite(false);
      setQuoteInput('');
    }, 1500);
  };

  return (
    <div className="pdf-viewer-container">
      {/* Top Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          {isVideo ? (
            <Film size={16} className="text-accent" style={{ color: '#eab308' }} />
          ) : isAudio ? (
            <Music size={16} className="text-accent" style={{ color: '#06b6d4' }} />
          ) : (
            <ImageIcon size={16} className="text-accent" style={{ color: '#22c55e' }} />
          )}
          <span className="pdf-title truncate" title={reference.title}>
            {reference.title}
          </span>
          <span
            className="badge"
            style={{
              fontSize: '0.68rem',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              color: '#eab308',
              border: '1px solid #eab308'
            }}
          >
            {reference.file_type.toUpperCase()}
          </span>
        </div>

        <div className="pdf-toolbar-group">
          {/* Controls for Media Playback */}
          {(isVideo || isAudio) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Playback rate selector (RF-18: 0.75x a 2x) */}
              <div className="segmented-control" style={{ display: 'flex', gap: 2, background: 'var(--bg-tertiary)', padding: 2, borderRadius: 6 }}>
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    className={`toolbar-btn ${playbackRate === rate ? 'active' : ''}`}
                    onClick={() => changePlaybackRate(rate)}
                    style={{ padding: '2px 5px', fontSize: '0.72rem' }}
                    title={`Velocidade ${rate}x`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls for Image */}
          {isImage && (
            <>
              <button className="toolbar-btn" onClick={() => setImageScale((s) => Math.max(0.4, s - 0.2))} title="Diminuir Zoom">
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.8rem', minWidth: 36, textAlign: 'center' }}>
                {Math.round(imageScale * 100)}%
              </span>
              <button className="toolbar-btn" onClick={() => setImageScale((s) => Math.min(3, s + 0.2))} title="Aumentar Zoom">
                <ZoomIn size={15} />
              </button>
              <button className="toolbar-btn" onClick={() => setImageRotation((r) => (r + 90) % 360)} title="Girar 90°">
                <RotateCw size={15} />
              </button>
              <button className="toolbar-btn" onClick={() => { setImageScale(1); setImageRotation(0); }} title="Redefinir Imagem">
                <RotateCcw size={15} />
              </button>
            </>
          )}

          {/* Close */}
          {onClose && (
            <button className="toolbar-btn close-btn" onClick={onClose} title="Fechar Visualizador">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div
        className="pdf-viewport"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: 'var(--bg-tertiary)',
          overflow: 'auto'
        }}
      >
        {isVideo && (
          <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={fileUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{
                width: '100%',
                maxHeight: '60vh',
                borderRadius: 8,
                backgroundColor: '#000',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
              }}
            />
          </div>
        )}

        {isAudio && (
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              backgroundColor: 'var(--bg-primary)',
              padding: 28,
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#06b6d4'
              }}
            >
              <Music size={32} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{reference.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{reference.authors || 'Áudio / Gravação'}</div>
            </div>
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={fileUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {isImage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <img
              src={fileUrl}
              alt={reference.title}
              style={{
                maxWidth: '90%',
                maxHeight: '75vh',
                objectFit: 'contain',
                transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                transition: 'transform 0.2s ease',
                borderRadius: 6,
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
            />
          </div>
        )}

        {/* Timestamp Citation Box for Video / Audio */}
        {(isVideo || isAudio) && onCite && (
          <div
            style={{
              marginTop: 20,
              width: '100%',
              maxWidth: 520,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Citar Trecho com Marcação de Tempo (Timestamp)
              </span>
              <span className="badge" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                ⏱️ {formatTime(currentTime)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Comentário sobre este momento do vídeo/áudio..."
                value={quoteInput}
                onChange={(e) => setQuoteInput(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem' }}
              />
              <button
                className="btn btn-primary"
                onClick={handleCiteTimestamp}
                style={{ padding: '6px 12px', fontSize: '0.82rem', gap: 6 }}
              >
                {copiedCite ? (
                  <>
                    <BookmarkCheck size={14} />
                    <span>Citado!</span>
                  </>
                ) : (
                  <>
                    <Quote size={14} />
                    <span>Citar {formatTime(currentTime)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
