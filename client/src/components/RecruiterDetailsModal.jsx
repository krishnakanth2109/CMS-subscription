import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, Loader2, Search, UserRound, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import CandidateProfileLink from '@/components/CandidateProfileLink';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');
const API_URL = `${API_BASE}/api`;

const STATUS_COLUMNS = [
  { key: 'total', label: 'Total Candidates' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'sharedProfiles', label: 'Shared Profiles' },
  { key: 'yetToAttend', label: 'Yet to attend' },
  { key: 'turnups', label: 'Turnups' },
  { key: 'selected', label: 'Selected' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'hold', label: 'Hold' },
  { key: 'joined', label: 'Joined' },
  { key: 'backout', label: 'Backout' },
  { key: 'pipeline', label: 'Pipeline' },
];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getRecruiterName = (recruiter = {}) => {
  if (typeof recruiter === 'string') return recruiter;
  return (
    recruiter.name ||
    recruiter.fullName ||
    `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() ||
    recruiter.username ||
    recruiter.email ||
    'Unknown Recruiter'
  );
};

const getRecruiterId = (recruiter = {}) => (
  recruiter.recruiterId || recruiter.employeeId || recruiter.userId || recruiter._id || recruiter.id || '-'
);

const getRecruiterKeys = (recruiter = {}) => {
  const data = typeof recruiter === 'string' ? { name: recruiter } : recruiter;
  return {
    ids: [
      data._id,
      data.id,
      data.userId,
      data.recruiterId,
      data.employeeId,
    ].filter(Boolean).map(String),
    names: [
      getRecruiterName(data),
      data.username,
      data.email,
    ].filter(Boolean).map(normalizeText),
  };
};

const getCandidateName = (candidate = {}) => (
  candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown Candidate'
);

const getCandidateRecruiterValues = (candidate = {}) => {
  const recruiter = candidate.recruiterId || candidate.recruiter || candidate.assignedRecruiter;
  const values = [];

  if (recruiter && typeof recruiter === 'object') {
    values.push(recruiter._id, recruiter.id, recruiter.userId, recruiter.recruiterId, recruiter.employeeId);
    values.push(getRecruiterName(recruiter), recruiter.username, recruiter.email);
  } else {
    values.push(recruiter);
  }

  values.push(candidate.recruiterName, candidate.submittedByName, candidate.assignedRecruiterName);
  return values.filter(Boolean);
};

const candidateBelongsToRecruiter = (candidate, recruiter) => {
  if (!recruiter) return true;
  const recruiterKeys = getRecruiterKeys(recruiter);
  const candidateValues = getCandidateRecruiterValues(candidate);

  return candidateValues.some((value) => {
    const asString = String(value);
    return recruiterKeys.ids.includes(asString) || recruiterKeys.names.includes(normalizeText(value));
  });
};

const getStatusList = (candidate = {}) => {
  const raw = Array.isArray(candidate.status) ? candidate.status : [candidate.status || 'Submitted'];
  const cleaned = raw.map((item) => String(item || '').trim()).filter(Boolean);
  return cleaned.length ? [...new Set(cleaned)] : ['Submitted'];
};

const candidateHasStatus = (candidate, statusLabel) => (
  getStatusList(candidate).some((status) => normalizeText(status) === normalizeText(statusLabel))
);

const getCandidateSubmissions = (candidate = {}) => (
  Array.isArray(candidate.submissions)
    ? [...candidate.submissions].sort((a, b) => {
        const aTime = new Date(a?.submittedAt || a?.createdAt || a?.updatedAt || 0).getTime();
        const bTime = new Date(b?.submittedAt || b?.createdAt || b?.updatedAt || 0).getTime();
        return bTime - aTime;
      })
    : []
);

const getMatchingSubmission = (candidate, statusLabel) => {
  const submissions = getCandidateSubmissions(candidate);
  if (!statusLabel) return submissions[0] || null;
  return submissions.find((submission) => {
    const status = submission?.pipelineStage || submission?.status;
    return normalizeText(status) === normalizeText(statusLabel);
  }) || submissions[0] || null;
};

const getRecordRows = (candidates, recruiter, column) => {
  const scoped = candidates.filter((candidate) => candidateBelongsToRecruiter(candidate, recruiter));
  if (!column || column.key === 'total') return scoped;
  return scoped.filter((candidate) => candidateHasStatus(candidate, column.label));
};

const countColumn = (candidates, recruiter, column) => getRecordRows(candidates, recruiter, column).length;

const getFallbackCount = (stats = {}, column) => {
  if (!stats || !column) return 0;
  const fallbackKeys = {
    total: ['total', 'totalCandidates', 'submissions'],
    submitted: ['submitted', 'pending', 'submissions'],
    sharedProfiles: ['sharedProfiles'],
    yetToAttend: ['yetToAttend'],
    turnups: ['turnups'],
    selected: ['selected'],
    rejected: ['rejected'],
    hold: ['hold'],
    joined: ['joined'],
    backout: ['backout'],
    pipeline: ['pipeline'],
  };
  const keys = fallbackKeys[column.key] || [column.key];
  return keys.reduce((value, key) => value || Number(stats[key] || 0), 0);
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
};

const getAuthHeaders = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const token = stored ? JSON.parse(stored)?.idToken : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
};

const CountButton = ({ value, onClick, disabled = false }) => {
  const count = Number(value) || 0;
  if (count <= 0) {
    return <span className="font-semibold text-slate-400 dark:text-slate-600">0</span>;
  }

  if (disabled) {
    return <span className="font-semibold text-slate-500 dark:text-slate-400">{count}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline cursor-pointer"
    >
      {count}
    </button>
  );
};

const CandidateRecordsModal = ({ detail, onClose }) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  if (!detail) return null;

  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const filteredRows = rows.filter((candidate) => {
    const haystack = [
      getCandidateName(candidate),
      candidate.email,
      candidate.contact,
      candidate.phone,
      candidate.client,
      candidate.position,
      candidate.source,
      getStatusList(candidate).join(' '),
    ].join(' ').toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const handleExportExcel = () => {
    if (filteredRows.length === 0) return;

    try {
      const exportData = filteredRows.map((candidate, index) => {
        const submission = getMatchingSubmission(candidate, detail.column?.label);
        const list = getStatusList(candidate);
        const statusText = detail.column?.key === 'total'
          ? (list[list.length - 1] || 'Submitted')
          : detail.column?.label;

        return {
          "S.No": String(index + 1),
          "Candidate Name": getCandidateName(candidate),
          "Email": candidate.email || '-',
          "Contact": candidate.contact || candidate.phone || '-',
          "Client": submission?.clientName || candidate.client || '-',
          "Job Code": submission?.jobCode || candidate.jobCode || '-',
          "Position": submission?.position || candidate.position || '-',
          "Status": statusText ? String(statusText).toUpperCase() : '-',
          "Source": candidate.source || '-',
          "Date": formatDate(submission?.submittedAt || candidate.dateAdded || candidate.createdAt || candidate.updatedAt)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-fit column widths
      const headers = Object.keys(exportData[0] || {});
      worksheet["!cols"] = headers.map((header) => {
        const maxLength = Math.max(
          String(header).length,
          ...exportData.map((row) => String(row[header] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxLength + 3, 10), 40) };
      });

      // Row heights
      worksheet["!rows"] = [
        { hpt: 26 }, // Header row
        ...exportData.map(() => ({ hpt: 20 })) // Data rows
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
          } else if (colLetter === 'D') { // Contact
            cell.t = 's';
            cell.z = '@';
            cell.s.alignment.horizontal = "center";
          } else if (colLetter === 'H') { // Status
            cell.s.alignment.horizontal = "center";
          } else if (colLetter === 'J') { // Date
            cell.s.alignment.horizontal = "center";
          } else {
            cell.s.alignment.horizontal = "left";
          }
        }
      });

      const workbook = XLSX.utils.book_new();
      const sheetName = (detail.title || 'Candidates').replace(/[:\\/?*[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const safeTitle = (detail.title || 'Candidates_Export').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `${safeTitle}_${dateStr}.xlsx`);

      toast({ title: 'Exported!', description: `${filteredRows.length} candidates exported to Excel.` });
    } catch (error) {
      console.error("Failed to export excel:", error);
      toast({ title: 'Export failed', description: 'Could not export file.', variant: 'destructive' });
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100">
          <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 bg-[#f8faff] dark:bg-slate-950/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-450" />
                {detail.title}
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Showing {filteredRows.length} of {rows.length} matching record(s)
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search records"
                  className="w-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-slate-900 dark:text-white"
                />
              </div>
              {filteredRows.length > 0 && (
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
                className="rounded-full bg-white dark:bg-slate-800 p-2 text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[1050px] text-sm text-slate-900 dark:text-slate-100">
              <thead className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 shadow-sm">
                <tr>
                  <th className="px-5 py-4 text-left">Candidate Name</th>
                  <th className="px-5 py-4 text-left">Email</th>
                  <th className="px-5 py-4 text-left">Contact</th>
                  <th className="px-5 py-4 text-left">Client</th>
                  <th className="px-5 py-4 text-left">Job Code</th>
                  <th className="px-5 py-4 text-left">Position</th>
                  <th className="px-5 py-4 text-left">Status</th>
                  <th className="px-5 py-4 text-left">Source</th>
                  <th className="px-5 py-4 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredRows.map((candidate) => {
                  const submission = getMatchingSubmission(candidate, detail.column?.label);
                  const list = getStatusList(candidate);
                  const statusText = detail.column?.key === 'total'
                    ? (list[list.length - 1] || 'Submitted')
                    : detail.column?.label;
                  return (
                    <tr key={`${candidate._id || candidate.id || candidate.candidateId}-${statusText}`} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        <CandidateProfileLink candidate={candidate} className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                          {getCandidateName(candidate)}
                        </CandidateProfileLink>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-350">{candidate.email || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-350">{candidate.contact || candidate.phone || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-350">{submission?.clientName || candidate.client || '-'}</td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-blue-700 dark:text-blue-400">{submission?.jobCode || candidate.jobCode || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-350">{submission?.position || candidate.position || '-'}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                          {statusText || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-350">{candidate.source || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-350">
                        {formatDate(submission?.submittedAt || candidate.dateAdded || candidate.createdAt || candidate.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredRows.length === 0 && (
              <div className="flex h-56 flex-col items-center justify-center text-center">
                <ClipboardList className="mb-3 h-9 w-9 text-slate-300 dark:text-slate-700" />
                <p className="font-bold text-slate-800 dark:text-slate-200">No records found</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try a different search term.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{rows.length} record(s)</span>
            <button type="button" onClick={onClose} className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400">
              Close Window
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export function RecruiterDetailsModal({ recruiter, stats, onClose, candidates: propCandidates }) {
  const [candidates, setCandidates] = useState(propCandidates || []);
  const [loading, setLoading] = useState(!propCandidates);
  const [recordsLoaded, setRecordsLoaded] = useState(!!propCandidates);
  const [loadError, setLoadError] = useState('');
  const [detail, setDetail] = useState(null);

  const data = typeof recruiter === 'string' ? { name: recruiter } : recruiter || {};
  const name = getRecruiterName(data);

  useEffect(() => {
    if (!recruiter) return;
    if (propCandidates) {
      setCandidates(propCandidates);
      setRecordsLoaded(true);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchCandidates = async () => {
      setLoading(true);
      setRecordsLoaded(false);
      setLoadError('');
      try {
        const response = await fetch(`${API_URL}/candidates?view=recruiters`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Unable to load candidate records.');
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload.candidates || payload.data || [];
        if (!cancelled) {
          setCandidates(Array.isArray(rows) ? rows : []);
          setRecordsLoaded(true);
        }
      } catch (error) {
        if (!cancelled) {
          setCandidates([]);
          setRecordsLoaded(false);
          setLoadError(error.message || 'Unable to load candidate records.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCandidates();
    return () => {
      cancelled = true;
    };
  }, [recruiter, propCandidates]);

  const hasLoadedRecords = recordsLoaded;
  const tableCounts = useMemo(() => (
    STATUS_COLUMNS.reduce((acc, column) => {
      acc[column.key] = hasLoadedRecords
        ? countColumn(candidates, data, column)
        : getFallbackCount(stats || data.stats, column);
      return acc;
    }, {})
  ), [candidates, data, hasLoadedRecords, stats]);

  const openRecords = (column, recruiterScope = data, titleName = name) => {
    const rows = getRecordRows(candidates, recruiterScope, column);
    setDetail({
      column,
      rows,
      title: column.key === 'total'
        ? `${titleName} - Total Candidates`
        : `${titleName} - ${column.label} Candidates`,
    });
  };

  if (!recruiter) return null;

  return (
    <>
      <ModalPortal>
      <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-[#f8faff] dark:bg-slate-950/60 px-6 py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Recruiter Performance</p>
              <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{name}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ID: {getRecruiterId(data)}{data.email ? ` • ${data.email}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white dark:bg-slate-800 p-2 text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-6">
            {loadError && (
              <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-400">
                {loadError} Showing available summary counts only.
              </div>
            )}

            <table className="w-full min-w-[1150px] text-sm text-slate-900 dark:text-slate-100">
              <thead className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 shadow-sm">
                <tr>
                  <th className="px-5 py-4 text-left">Recruiter Name</th>
                  {STATUS_COLUMNS.map((column) => (
                    <th key={column.key} className="px-4 py-4 text-center">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10">
                  <td className="px-5 py-5 font-bold text-slate-900 dark:text-white">{name}</td>
                  {STATUS_COLUMNS.map((column) => (
                    <td key={column.key} className="px-4 py-5 text-center">
                      <CountButton
                        value={tableCounts[column.key]}
                        disabled={!hasLoadedRecords}
                        onClick={() => openRecords(column)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {loading && (
              <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-650" />
                Loading exact candidate records...
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Click any non-zero count to view matching candidates.</span>
            <button type="button" onClick={onClose} className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400">
              Close Window
            </button>
          </div>
        </div>
      </div>
      </ModalPortal>
      <CandidateRecordsModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

export function RecruiterDetailsTrigger({ recruiter, stats, children, className = '', disabled = false, candidates }) {
  const [open, setOpen] = useState(false);
  const canOpen = !disabled && recruiter;

  return (
    <>
      <button
        type="button"
        onClick={() => canOpen && setOpen(true)}
        className={`inline-flex items-center text-left underline-offset-4 ${canOpen ? 'cursor-pointer hover:underline' : 'cursor-default'} ${className}`}
        disabled={!canOpen}
      >
        <UserRound className="mr-1.5 h-3.5 w-3.5 opacity-70" />
        {children || getRecruiterName(recruiter)}
      </button>
      {open && <RecruiterDetailsModal recruiter={recruiter} stats={stats} candidates={candidates} onClose={() => setOpen(false)} />}
    </>
  );
}

export default RecruiterDetailsModal;
