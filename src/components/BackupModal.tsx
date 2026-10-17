import React, { useState, useEffect } from 'react';
import { X, Download, CloudUpload, HardDrive, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { BackupStatus, BackupDriveUploadResult } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('kd_gdrive_token') || '');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BackupDriveUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingStatus(true);
      setError(null);
      setUploadResult(null);
      api.getBackupStatus()
        .then(setStatus)
        .catch(err => setError(err.message || 'Erro ao carregar estatísticas do acervo'))
        .finally(() => setLoadingStatus(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadLocal = () => {
    const url = api.getBackupDownloadUrl();
    window.location.href = url;
  };

  const handleUploadDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) {
      setError('Informe o Access Token OAuth2 do Google Drive');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);
    try {
      localStorage.setItem('kd_gdrive_token', accessToken.trim());
      const res = await api.uploadBackupToGoogleDrive(accessToken.trim());
      setUploadResult(res);
    } catch (err: any) {
      setError(err.message || 'Falha ao realizar upload para o Google Drive');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="backup-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HardDrive size={20} style={{ color: 'var(--primary-yellow-border)' }} />
            <h2 id="backup-title" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              Backup Geral & Google Drive
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--accent-red)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-red)',
              fontSize: '0.85rem'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Acervo Summary Card */}
          <div style={{
            padding: 14,
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Conteúdo do Pacote de Backup:</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Formato Universal .ZIP (RNF-08)</span>
            </div>
            {loadingStatus ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Contabilizando acervo...</p>
            ) : status ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div><strong>{status.counts.notes}</strong> notas (.md/YAML)</div>
                <div><strong>{status.counts.references}</strong> referências anexas</div>
                <div><strong>{status.counts.categories}</strong> categorias</div>
                <div><strong>{status.counts.folders}</strong> pastas estruturais</div>
                <div><strong>{status.counts.bookmarks}</strong> marcadores</div>
                <div><strong>Manifesto</strong> JSON de restauração</div>
              </div>
            ) : null}
          </div>

          {/* Download Local Option */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>Download Local (.ZIP)</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Empacota todo o acervo sem travas proprietárias (no vendor lock-in).
              </div>
            </div>
            <button
              className="btn-blue"
              onClick={handleDownloadLocal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <Download size={15} />
              <span>Baixar ZIP</span>
            </button>
          </div>

          {/* Google Drive Upload Section (RF-35) */}
          <div style={{
            padding: 14,
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloudUpload size={18} style={{ color: 'var(--accent-blue)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload Direto para o Google Drive</div>
            </div>

            {uploadResult ? (
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid var(--accent-green)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>Backup enviado com sucesso ao Google Drive!</span>
                </div>
                <div><strong>Arquivo:</strong> {uploadResult.file.name}</div>
                <div><strong>ID no Drive:</strong> <code>{uploadResult.file.fileId}</code></div>
                {uploadResult.file.webViewLink && (
                  <a
                    href={uploadResult.file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--accent-blue)',
                      marginTop: 4,
                      textDecoration: 'none',
                      fontWeight: 500
                    }}
                  >
                    <span>Abrir arquivo no Google Drive</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ) : (
              <form onSubmit={handleUploadDrive} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Google Drive OAuth2 Access Token:
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="ya29.a0AfH6SM..."
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    API REST v3 oficial com upload multipart
                  </span>
                  <button
                    type="submit"
                    className="sidebar-action-btn"
                    disabled={uploading}
                    style={{
                      margin: 0,
                      padding: '7px 14px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: uploading ? 'wait' : 'pointer'
                    }}
                  >
                    {uploading ? (
                      <>
                        <RefreshCw size={15} className="spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload size={15} />
                        <span>Enviar para o Drive</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
