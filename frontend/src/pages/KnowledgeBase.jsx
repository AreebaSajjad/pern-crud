import { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const STATUS_LABELS = {
  processing: { label: 'processing', className: 'kb-status-processing' },
  ready: { label: 'ready', className: 'kb-status-ready' },
  failed: { label: 'failed', className: 'kb-status-failed' },
};

const PAGE_SIZE = 10;

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const HOW_IT_WORKS = [
  'PDF uploaded',
  'Text extracted page by page',
  'Text split into overlapping chunks',
  'Chunks converted to embeddings',
  'RAG retrieves relevant chunks for your question',
];

const KnowledgeBase = () => {
  const { user } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const { askConfirm } = useConfirm();
  const isAdmin = user?.role === 'admin';

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef(null);

  const loadDocuments = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get('/kb/documents');
      setDocuments(res.data.documents);
    } catch (err) {
      showToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jab tak koi document "processing" mein ho, har 4 second baad khud-ba-khud refresh
  // karte raho — taake status "ready" hote hi table apne aap update ho jaye.
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(() => loadDocuments(false), 4000);
    return () => clearInterval(interval);
  }, [documents]);

  const totalPages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE));
  const pagedDocuments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return documents.slice(start, start + PAGE_SIZE);
  }, [documents, page]);

  // ---- File selection (drag & drop + choose file) ----

  const handleFilePicked = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showToast('Only PDF files are supported', 'error');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFilePicked(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      await api.post('/kb/documents', formData);
      showToast('Upload received — processing in the background');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPage(1);
      loadDocuments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc) => {
    try {
      const res = await api.get(`/kb/documents/${doc.id}/file`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      showToast('Could not open this document', 'error');
    }
  };

  const handleDelete = async (doc) => {
    const ok = await askConfirm(`Delete "${doc.title}" from the knowledge base? This cannot be undone.`, 'Delete Document');
    if (!ok) return;
    try {
      await api.delete(`/kb/documents/${doc.id}`);
      showToast('Document deleted');
      loadDocuments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete document', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-header kb-header">
        <span className="kb-header-icon">📚</span>
        <div>
          <h2>Knowledge Base</h2>
          <p className="kb-subtitle">
            Upload PDF documents. They are automatically extracted, chunked, embedded, and made searchable by{' '}
            <Link to="/chatbot">RAG</Link>.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="kb-card">
          <div className="kb-card-heading">
            <span className="kb-card-icon">⬆️</span>
            <div>
              <h4>Upload a PDF Document</h4>
              <p className="kb-upload-hint">No file-size or page limit — large PDFs (200+ pages) are fully supported.</p>
            </div>
          </div>

          <div className="kb-upload-grid">
            <div
              className={`kb-dropzone ${dragActive ? 'kb-dropzone-active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <span className="kb-dropzone-icon">☁️</span>
              {selectedFile ? (
                <p className="kb-selected-file">📄 {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
              ) : (
                <p>Drag & drop your PDF here</p>
              )}
              <span className="kb-or">or</span>
              <button type="button" className="btn-primary kb-choose-file-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                Choose File
              </button>
              <input
                type="file"
                accept=".pdf,application/pdf"
                ref={fileInputRef}
                onChange={(e) => handleFilePicked(e.target.files?.[0])}
                disabled={uploading}
                hidden
              />
            </div>

            <div className="kb-how-it-works">
              <h4>How it works</h4>
              <ol>
                {HOW_IT_WORKS.map((step, i) => (
                  <li key={i}>
                    <span className="kb-step-number">{i + 1}</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <button className="btn-primary kb-upload-btn" onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? 'Uploading...' : '⬆ Upload & Process'}
          </button>
        </div>
      )}

      <div className="kb-card">
        <div className="kb-table-header">
          <div className="kb-card-heading">
            <span className="kb-card-icon">📄</span>
            <div>
              <h4>Uploaded Documents</h4>
              <p className="kb-upload-hint">Manage and view your uploaded knowledge base documents.</p>
            </div>
          </div>
          <button className="kb-refresh-btn" onClick={() => loadDocuments()} title="Refresh">
            🔄
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : documents.length === 0 ? (
          <p className="empty-text">No documents uploaded yet.</p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Pages</th>
                    <th>Chunks</th>
                    <th>Status</th>
                    <th>Uploaded By</th>
                    <th>Uploaded At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDocuments.map((d) => {
                    const statusInfo = STATUS_LABELS[d.status] || STATUS_LABELS.processing;
                    return (
                      <tr key={d.id}>
                        <td>
                          <div className="kb-doc-name-cell">
                            <span className="kb-doc-icon">📕</span>
                            <div>
                              <div className="kb-doc-title">{d.title}</div>
                              <div className="kb-doc-size">{formatFileSize(d.file_size_bytes)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{d.page_count ?? '—'}</td>
                        <td>{d.chunk_count || '—'}</td>
                        <td>
                          <span className={`kb-status-badge ${statusInfo.className}`}>● {statusInfo.label}</span>
                        </td>
                        <td>{d.uploaded_by_name || '—'}</td>
                        <td>{formatDateTime(d.created_at)}</td>
                        <td>
                          <div className="kb-actions-cell">
                            {isAdmin && (
                              <button className="kb-icon-btn kb-icon-delete" title="Delete" onClick={() => handleDelete(d)}>
                                🗑️
                              </button>
                            )}
                            <button
                              className="kb-icon-btn kb-icon-view"
                              title="View"
                              onClick={() => handleView(d)}
                              disabled={d.status !== 'ready'}
                            >
                              👁️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="kb-pagination">
              <span className="kb-pagination-info">
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, documents.length)} of {documents.length} documents
              </span>
              <div className="kb-pagination-controls">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  ‹
                </button>
                <span className="kb-page-number">{page}</span>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default KnowledgeBase;
