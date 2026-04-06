import { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

interface ColumnMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: Record<string, string>) => void;
  availableColumns: string[];
  requiredFields: Array<{ key: string; label: string; required?: boolean }>;
  previewRows?: Array<Record<string, any>>;
}

export default function ColumnMappingDialog({
  isOpen,
  onClose,
  onConfirm,
  availableColumns,
  requiredFields,
  previewRows = []
}: ColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && availableColumns.length > 0) {
      // Auto-map columns based on common patterns
      const autoMapping: Record<string, string> = {};
      requiredFields.forEach(field => {
        const fieldLower = field.key.toLowerCase().replace(/_/g, ' ');
        const fieldUnderscore = field.key.toLowerCase().replace(/\s+/g, '_');
        
        // Try to find matching column
        const match = availableColumns.find(col => {
          const colLower = col.toLowerCase();
          return colLower === fieldLower || 
                 colLower === fieldUnderscore ||
                 colLower.includes(fieldLower) ||
                 fieldLower.includes(colLower);
        });
        
        if (match) {
          autoMapping[field.key] = match;
        }
      });
      
      setMapping(autoMapping);
    }
  }, [isOpen, availableColumns, requiredFields]);

  const handleMappingChange = (fieldKey: string, columnName: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: columnName
    }));
  };

  const handleConfirm = () => {
    onConfirm(mapping);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Map CSV Columns to Fields</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-700 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Instructions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Select the CSV column that corresponds to each field</li>
                  <li>Fields marked with <span className="text-red-500">*</span> are required</li>
                  <li>You can leave optional fields unmapped</li>
                  <li>Auto-mapping has been applied based on column names</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {requiredFields.map(field => (
              <div key={field.key} className="flex items-center gap-4">
                <label className="w-48 text-sm font-medium text-gray-700 flex-shrink-0">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => handleMappingChange(field.key, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">-- Select Column --</option>
                  {availableColumns.map(col => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                {mapping[field.key] && previewRows.length > 0 && (
                  <div className="w-32 text-xs text-gray-500 truncate">
                    Sample: {String(previewRows[0][mapping[field.key]] || 'N/A').substring(0, 20)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {previewRows.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (First Row):</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {availableColumns.slice(0, 10).map(col => (
                          <th key={col} className="px-2 py-1 text-left border-b border-gray-200 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {availableColumns.slice(0, 10).map(col => (
                          <td key={col} className="px-2 py-1 border-b border-gray-100">
                            {String(previewRows[0]?.[col] || '').substring(0, 30)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Confirm Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
