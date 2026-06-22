import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, Loader, AlertCircle, X } from 'lucide-react';
import api from '../services/api';

const PdfViewerModal = ({ isOpen, onClose, pdfUrl, title, filename }) => {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (isOpen && pdfUrl) {
      setLoading(true);
      setError('');
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl('');
      }

      api.get(pdfUrl, { responseType: 'blob' })
        .then((res) => {
          const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          setBlobUrl(url);
        })
        .catch((err) => {
          console.error('PDF fetch error:', err);
          setError('Failed to generate PDF document preview. Please try again.');
        })
        .finally(() => {
          setLoading(false);
        });
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (e) {
        console.error('Print iframe error:', e);
        // Fallback: Open in new window and trigger print
        const printWindow = window.open(blobUrl);
        if (printWindow) {
          printWindow.focus();
          printWindow.print();
        }
      }
    }
  };

  const handleDownload = () => {
    if (blobUrl) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-slide-up">
        {/* Header toolbar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm tracking-wide truncate max-w-[50%]">{title || 'PDF Document Viewer'}</h3>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <>
                <button
                  onClick={handlePrint}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-indigo-900/30"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 p-2 rounded-xl transition-all active:scale-95 border border-slate-700 hover:border-rose-900/30 ml-2"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Frame container */}
        <div className="flex-1 bg-slate-100 flex items-center justify-center relative">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs text-slate-500 font-bold tracking-wide">Generating PDF preview...</span>
            </div>
          ) : error ? (
            <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm max-w-sm text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">Failed to Load PDF</h4>
              <p className="text-xs text-slate-400 font-medium">{error}</p>
              <button
                onClick={onClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                Close Viewer
              </button>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={`${blobUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full border-none"
              title="PDF Document"
            />
          ) : (
            <div className="text-slate-400 text-xs font-semibold">No document loaded</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewerModal;
