import { useState } from 'react';
import { Upload, FileText, Download, CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { usePopupContext } from '../contexts/PopupContext';

interface CSVUploadProps {
  type: 'offers' | 'orders' | 'purchase-orders' | 'sale-orders' | 'quality' | 'mandi' | 'logistics-shipments' | 'weather' | 'supply-transactions';
  onUploadSuccess?: () => void;
  label?: string;
}

export default function CSVUpload({ type, onUploadSuccess, label }: CSVUploadProps) {
  const { showAlert } = usePopupContext();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
        setStatus('error');
        setMessage('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('error');
      setMessage('Please select a file first');
      return;
    }

    setUploading(true);
    setStatus('idle');
    setMessage('');

    try {
      const session = await api.auth.getSession();
      const token = session.data.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/uploads/${type}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || ''}`
          },
          body: formData
        }
      );

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(`Successfully uploaded ${result.count || 0} records`);
        setFile(null);
        
        // Reset file input
        const fileInput = document.getElementById(`file-${type}`) as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        // Call success callback
        if (onUploadSuccess) {
          setTimeout(() => {
            onUploadSuccess();
          }, 1000);
        }
      } else {
        setStatus('error');
        setMessage(result.message || result.error || 'Upload failed');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadSample = async (format: 'csv' | 'excel') => {
    try {
      const session = await api.auth.getSession();
      const token = session.data.session?.access_token;

      const extension = format === 'excel' ? 'xlsx' : 'csv';
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/uploads/sample/${type}?format=${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token || ''}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download sample file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sample_${type}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download sample error:', error);
      await showAlert({
        title: 'Download Failed',
        message: 'Failed to download sample file',
        tone: 'danger',
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          {label || `Upload ${type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => downloadSample('csv')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Sample CSV
          </button>
          <button
            onClick={() => downloadSample('excel')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Sample Excel
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex-1 cursor-pointer">
            <input
              id={`file-${type}`}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
              <FileText className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {file ? file.name : 'Choose CSV or Excel file'}
              </span>
            </div>
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload
              </>
            )}
          </button>
        </div>

        {status !== 'idle' && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              status === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {status === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
