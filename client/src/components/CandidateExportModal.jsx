import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formatExportValue = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(' | ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return '';
  return String(value);
};

const EXCLUDED_TOP_LEVEL_FIELDS = new Set(['_id', '__v', 'customFields']);

const prettifyFieldName = (fieldName) => {
  const withSpaces = String(fieldName || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!withSpaces) return 'Field';
  return withSpaces
    .split(/\s+/)
    .map(word => word.length <= 3 && word === word.toLowerCase() ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const isSimpleValue = (value) => (
  value === null
  || value === undefined
  || Array.isArray(value)
  || ['string', 'number', 'boolean'].includes(typeof value)
);

export default function CandidateExportModal({
  open,
  onClose,
  candidates = [],
  standardColumns = [],
  customFields = [],
  fileNamePrefix = 'Candidates_Export',
}) {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState([]);

  const exportFields = useMemo(() => {
    const fields = [];
    const usedIds = new Set();
    const usedTopLevelKeys = new Set();

    standardColumns.forEach(column => {
      if (!column?.key || usedIds.has(`field:${column.key}`)) return;
      fields.push({
        id: `field:${column.key}`,
        label: column.label || prettifyFieldName(column.key),
        value: candidate => typeof column.value === 'function' ? column.value(candidate) : candidate[column.key],
      });
      usedIds.add(`field:${column.key}`);
      usedTopLevelKeys.add(column.key);
    });

    candidates.forEach(candidate => {
      Object.keys(candidate || {}).forEach(key => {
        if (EXCLUDED_TOP_LEVEL_FIELDS.has(key) || usedTopLevelKeys.has(key) || usedIds.has(`field:${key}`)) return;
        const hasSimpleValue = candidates.some(item => isSimpleValue(item?.[key]) && formatExportValue(item?.[key]) !== '');
        if (!hasSimpleValue) return;

        fields.push({
          id: `field:${key}`,
          label: prettifyFieldName(key),
          value: item => item?.[key],
        });
        usedIds.add(`field:${key}`);
        usedTopLevelKeys.add(key);
      });
    });

    const customFieldMap = new Map();
    customFields.forEach(field => {
      if (field?.fieldName) customFieldMap.set(field.fieldName, field.label || prettifyFieldName(field.fieldName));
    });
    candidates.forEach(candidate => {
      Object.keys(candidate?.customFields || {}).forEach(fieldName => {
        if (!customFieldMap.has(fieldName)) customFieldMap.set(fieldName, prettifyFieldName(fieldName));
      });
    });

    customFieldMap.forEach((label, fieldName) => {
      if (usedIds.has(`custom:${fieldName}`)) return;
      fields.push({
        id: `custom:${fieldName}`,
        label,
        value: candidate => candidate?.customFields?.[fieldName],
      });
      usedIds.add(`custom:${fieldName}`);
    });

    return fields;
  }, [candidates, customFields, standardColumns]);

  useEffect(() => {
    if (!open) return;
    setSelectedFields(exportFields.map(field => field.id));
  }, [open, exportFields]);

  if (!open) return null;

  const toggleField = (fieldId) => {
    setSelectedFields(prev => prev.includes(fieldId) ? prev.filter(item => item !== fieldId) : [...prev, fieldId]);
  };

  const selectAll = () => {
    setSelectedFields(exportFields.map(field => field.id));
  };

  const clearAll = () => {
    setSelectedFields([]);
  };

  const downloadExcel = () => {
    const fieldsToExport = exportFields.filter(field => selectedFields.includes(field.id));

    if (!fieldsToExport.length) {
      toast({ title: 'Select fields', description: 'Choose at least one field to export.', variant: 'destructive' });
      return;
    }

    try {
      const rows = candidates.map(candidate => {
        const row = {};

        fieldsToExport.forEach(field => {
          row[field.label] = formatExportValue(field.value(candidate));
        });

        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(row => String(row[key] || '').length), 10),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
      XLSX.writeFile(workbook, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({ title: 'Exported!', description: `${rows.length} candidate(s) exported to Excel.` });
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export failed', description: 'Could not export file.', variant: 'destructive' });
    }
  };

  const selectedCount = selectedFields.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close export dialog" onClick={onClose} />
      <section className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              Download Excel
            </h2>
            <p className="mt-1 text-sm text-slate-500">Choose the fields to include in the Excel file.</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-132px)] overflow-y-auto px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{candidates.length}</span> candidate(s),
              <span className="ml-1 font-semibold text-slate-900">{selectedCount}</span> field(s) selected
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Select All
              </button>
              <button type="button" onClick={clearAll} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Clear
              </button>
            </div>
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Fields</h3>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {exportFields.map(field => (
                  <label key={field.id} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
                      onChange={() => toggleField(field.id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="min-w-0 truncate text-slate-700" title={field.label}>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={downloadExcel}>
            <Download className="h-4 w-4" />
            Download Excel
          </button>
        </div>
      </section>
    </div>
  );
}
