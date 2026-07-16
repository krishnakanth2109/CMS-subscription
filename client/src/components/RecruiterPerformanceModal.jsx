import React from 'react';
import { ClipboardList, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import CandidateProfileLink from '@/components/CandidateProfileLink';
import { RecruiterDetailsTrigger } from '@/components/RecruiterDetailsModal';

const getRecruiterName = (candidate) => {
  const rec = candidate.recruiterId;
  if (!rec) return candidate.recruiterName || 'Unknown';
  if (typeof rec !== 'object') return candidate.recruiterName || 'Unknown';
  return `${rec.firstName || rec.name || ''} ${rec.lastName || ''}`.trim() || rec.username || 'Unknown';
};

const getCandidateName = (candidate) => (
  candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown Candidate'
);

const getRecruiterDetails = (candidate) => (
  candidate.recruiterId && typeof candidate.recruiterId === 'object'
    ? candidate.recruiterId
    : { name: getRecruiterName(candidate) }
);

const getLastStatus = (statusVal) => {
  if (Array.isArray(statusVal)) return statusVal[statusVal.length - 1] || 'Submitted';
  return statusVal || 'Submitted';
};

export default function RecruiterPerformanceModal({ detail, onClose }) {
  const { toast } = useToast();
  if (!detail) return null;

  const rows = Array.isArray(detail.rows) ? detail.rows : [];

  const handleExportExcel = () => {
    if (rows.length === 0) return;

    try {
      const formattedRows = rows.map((candidate, index) => {
        const status = getLastStatus(candidate.status);
        return {
          "S.No": String(index + 1),
          "Candidate ID": candidate.candidateId ? String(candidate.candidateId) : 'N/A',
          "Candidate Name": getCandidateName(candidate),
          "Recruiter Name": getRecruiterName(candidate),
          "Position": candidate.position || '-',
          "Client": candidate.client || '-',
          "Status": status ? String(status).toUpperCase() : 'SUBMITTED'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);

      // Auto-fit column widths
      const headers = Object.keys(formattedRows[0] || {});
      worksheet["!cols"] = headers.map((header) => {
        const maxLength = Math.max(
          String(header).length,
          ...formattedRows.map((row) => String(row[header] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxLength + 3, 10), 40) };
      });

      // Row heights
      worksheet["!rows"] = [
        { hpt: 26 }, // Header row
        ...formattedRows.map(() => ({ hpt: 20 })) // Data rows
      ];

      // Format cells (types, number formats, alignments/styles)
      Object.keys(worksheet).forEach((key) => {
        if (key.startsWith('!')) return;
        const cell = worksheet[key];
        if (!cell) return;

        const rowNum = parseInt(key.replace(/^[A-Z]+/, ''), 10);
        const colLetter = key.replace(/[0-9]+$/, '');

        cell.s = cell.s || {};
        cell.s.font = cell.s.font || {};
        cell.s.alignment = cell.s.alignment || {};

        if (rowNum === 1) {
          // Header styling
          cell.s.font.bold = true;
          cell.s.font.name = 'Segoe UI';
          cell.s.font.sz = 11;
          cell.s.fill = {
            fgColor: { rgb: "F1F5F9" }
          };
          cell.s.alignment.horizontal = "center";
          cell.s.alignment.vertical = "center";
        } else {
          // Data styling
          cell.s.font.name = 'Segoe UI';
          cell.s.font.sz = 10;
          cell.s.alignment.vertical = "center";

          if (colLetter === 'A') { // S.No
            cell.t = 's';
            cell.z = '@';
            cell.s.alignment.horizontal = "left";
          } else if (colLetter === 'B') { // Candidate ID
            cell.t = 's';
            cell.z = '@';
            cell.s.alignment.horizontal = "center";
          } else if (colLetter === 'G') { // Status
            cell.s.alignment.horizontal = "center";
          } else {
            cell.s.alignment.horizontal = "left";
          }
        }
      });

      const workbook = XLSX.utils.book_new();
      const sheetName = (detail.title || 'Recruiter Performance').replace(/[:\\/?*[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const safeTitle = (detail.title || 'Recruiter_Performance').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `${safeTitle}_${dateStr}.xlsx`);

      toast({ title: 'Exported!', description: `${rows.length} candidates exported to Excel.` });
    } catch (error) {
      console.error("Failed to export excel:", error);
      toast({ title: 'Export failed', description: 'Could not export file.', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center gap-4 bg-[#f8faff] dark:bg-slate-950/60">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              {detail.title || 'Recruiter Performance Details'}
            </h2>
            {detail.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">{detail.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-gray-100 dark:bg-slate-855 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 text-slate-500 dark:text-slate-400 rounded-full cursor-pointer transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-full mb-3">
                <ClipboardList className="w-8 h-8 text-gray-400 dark:text-gray-655" />
              </div>
              <h3 className="text-slate-800 dark:text-slate-200 font-bold">No candidates found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">There are no candidates for this count.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm min-w-[800px] text-slate-900 dark:text-slate-100">
                <thead className="bg-[#f8faff] dark:bg-slate-950/80 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100 dark:border-slate-850 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 text-left">Candidate ID</th>
                    <th className="px-6 py-4 text-left">Candidate Name</th>
                    <th className="px-6 py-4 text-left">Recruiter</th>
                    <th className="px-6 py-4 text-left">Position</th>
                    <th className="px-6 py-4 text-left">Client</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-855">
                  {rows.map((candidate) => {
                    const status = getLastStatus(candidate.status);
                    return (
                      <tr key={candidate._id || candidate.candidateId} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-[#283086] dark:text-blue-400">{candidate.candidateId || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <CandidateProfileLink candidate={candidate} className="text-slate-800 dark:text-slate-200">
                            {getCandidateName(candidate)}
                          </CandidateProfileLink>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-650 dark:text-gray-350">
                          <RecruiterDetailsTrigger recruiter={getRecruiterDetails(candidate)} className="text-gray-600 dark:text-gray-400 font-medium">
                            {getRecruiterName(candidate)}
                          </RecruiterDetailsTrigger>
                        </td>
                        <td className="px-6 py-4 text-gray-550 dark:text-gray-400">{candidate.position || '-'}</td>
                        <td className="px-6 py-4 text-gray-550 dark:text-gray-400">{candidate.client || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-50 dark:border-blue-900/20">
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/80 flex justify-between items-center text-xs font-medium text-slate-500 dark:text-slate-400">
          <p>Showing {rows.length} candidate(s)</p>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-700 dark:text-slate-350 hover:text-[#283086] dark:hover:text-blue-400 font-bold uppercase tracking-wider"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
