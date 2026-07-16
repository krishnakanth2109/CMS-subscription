import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_ALIASES = {
  fullName: ['name', 'candidate name', 'candidate', 'full name', 'candidate full name'],
  firstName: ['first name', 'firstname', 'first', 'given name'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name'],
  email: ['email', 'email address', 'mail', 'mail id', 'email id'],
  contact: ['contact', 'phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'candidate phone'],
  alternateNumber: ['alternate number', 'alternate phone', 'alternate mobile', 'secondary contact'],
  currentLocation: ['current location', 'location', 'city', 'current city'],
  preferredLocation: ['preferred location', 'preferred city', 'preferred work location'],
  position: ['position', 'role', 'job role', 'designation', 'job title', 'applied position'],
  client: ['client', 'client name', 'company', 'customer'],
  currentCompany: ['current company', 'current employer', 'employer'],
  industry: ['industry', 'domain'],
  totalExperience: ['total experience', 'experience', 'total exp', 'exp', 'years of experience'],
  relevantExperience: ['relevant experience', 'relevant exp', 'rel exp'],
  education: ['education', 'qualification', 'highest qualification'],
  skills: ['skills', 'skill', 'technical skills', 'key skills'],
  ctc: ['ctc', 'current ctc', 'current salary'],
  ectc: ['ectc', 'expected ctc', 'expected salary'],
  currentTakeHome: ['current take home', 'current takehome', 'take home'],
  expectedTakeHome: ['expected take home', 'expected takehome'],
  noticePeriod: ['notice period', 'notice', 'np'],
  source: ['source', 'profile source', 'candidate source'],
  remarks: ['remarks', 'remark', 'comments', 'comment'],
  notes: ['notes', 'note'],
  resumeUrl: ['resume url', 'resume link', 'cv url', 'cv link'],
  status: ['status', 'candidate status'],
};

const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_LOOKUP = Object.entries(FIELD_ALIASES).reduce((lookup, [field, aliases]) => {
  aliases.forEach((alias) => {
    lookup[normalizeHeader(alias)] = field;
  });
  return lookup;
}, {});

const cleanCell = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const cleanContact = (value) => cleanCell(value).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(-10);

const splitFullName = (name) => {
  const parts = cleanCell(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const buildCandidateName = (candidate) => (
  cleanCell(candidate.name) || `${cleanCell(candidate.firstName)} ${cleanCell(candidate.lastName)}`.trim() || '-'
);

const makeErrorReportRows = (clientRows, serverErrors) => {
  const clientErrors = clientRows
    .filter((row) => row.status === 'invalid')
    .map((row) => ({
      'Row Number': row.rowNumber,
      'Candidate Name': buildCandidateName(row.data),
      Email: row.data.email || '',
      Contact: row.data.contact || '',
      Reason: row.errors.join(' '),
    }));

  const backendErrors = serverErrors.map((error) => ({
    'Row Number': error.rowNumber || '-',
    'Candidate Name': error.candidateName || '-',
    Email: error.email || '',
    Contact: error.contact || '',
    Reason: error.reason || error.error || 'Import failed.',
  }));

  return [...clientErrors, ...backendErrors];
};

export default function BulkCandidateImportModal({ open, onClose, apiUrl, getHeaders, onImported }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [serverErrors, setServerErrors] = useState([]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setRows([]);
      setParseError('');
      setIsParsing(false);
      setIsImporting(false);
      setResult(null);
      setServerErrors([]);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [open]);

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.status === 'valid').length;
    const invalid = rows.length - valid;
    return { total: rows.length, valid, invalid };
  }, [rows]);

  if (!open) return null;

  const mapRawRow = (rawRow) => {
    const candidate = {};
    let fullName = '';

    Object.entries(rawRow).forEach(([header, value]) => {
      const field = HEADER_LOOKUP[normalizeHeader(header)];
      if (!field) return;
      const cleaned = cleanCell(value);
      if (!cleaned) return;

      if (field === 'fullName') {
        fullName = fullName || cleaned;
        candidate.name = candidate.name || cleaned;
        return;
      }

      if (!candidate[field]) candidate[field] = cleaned;
    });

  if (fullName && (!candidate.firstName || !candidate.lastName)) {
      const split = splitFullName(fullName);
      candidate.firstName = candidate.firstName || split.firstName;
      candidate.lastName = candidate.lastName || split.lastName;
    }

    candidate.email = cleanCell(candidate.email).toLowerCase();
    candidate.contact = cleanContact(candidate.contact);
    candidate.alternateNumber = cleanContact(candidate.alternateNumber);
    candidate.name = candidate.name || `${cleanCell(candidate.firstName)} ${cleanCell(candidate.lastName)}`.trim();

    return candidate;
  };

  const validateRows = (mappedRows) => {
    const seenEmails = new Set();
    const seenContacts = new Set();

    return mappedRows.map((row) => {
      const errors = [];
      const data = row.data;

      if (!data.firstName) errors.push('First name is required.');
      if (!data.email || !EMAIL_RE.test(data.email)) errors.push('Valid email is required.');
      if (!data.contact || data.contact.length !== 10) errors.push('Valid 10-digit contact is required.');

      if (data.email && seenEmails.has(data.email)) errors.push('Duplicate email inside file.');
      if (data.contact && seenContacts.has(data.contact)) errors.push('Duplicate contact inside file.');

      if (!errors.length) {
        seenEmails.add(data.email);
        seenContacts.add(data.contact);
      }

      return { ...row, status: errors.length ? 'invalid' : 'valid', errors };
    });
  };

  const parseSelectedFile = async (selectedFile) => {
    setFile(selectedFile);
    setRows([]);
    setResult(null);
    setServerErrors([]);
    setParseError('');

    if (!selectedFile) return;

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      setParseError('Please choose an .xlsx, .xls, or .csv file.');
      return;
    }

    setIsParsing(true);
    try {
      const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('No worksheet found in this file.');

      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
      const nonEmptyRows = rawRows.filter((rawRow) => (
        Object.values(rawRow).some((value) => cleanCell(value))
      ));

      if (!nonEmptyRows.length) throw new Error('No candidate rows found.');

      const mappedRows = nonEmptyRows.map((rawRow, index) => ({
        rowNumber: index + 2,
        data: mapRawRow(rawRow),
        status: 'valid',
        errors: [],
      }));

      setRows(validateRows(mappedRows));
    } catch (error) {
      setParseError(error.message || 'Could not read this file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    parseSelectedFile(event.dataTransfer.files?.[0] || null);
  };

  const handleImport = async () => {
    const validRows = rows.filter((row) => row.status === 'valid');
    if (!validRows.length) {
      setParseError('There are no valid rows to import.');
      return;
    }

    setIsImporting(true);
    setParseError('');
    setServerErrors([]);

    try {
      const authHeaders = typeof getHeaders === 'function' ? await getHeaders() : {};
      const response = await fetch(`${apiUrl}/candidates/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          fileName: file?.name || '',
          candidates: validRows.map((row) => ({ ...row.data, rowNumber: row.rowNumber })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.errors?.[0]?.reason || 'Import failed.');

      const backendErrors = Array.isArray(payload.errors) ? payload.errors : [];
      setResult(payload);
      setServerErrors(backendErrors);

      if ((payload.imported || 0) > 0) {
        toast({ title: 'Bulk import completed', description: `${payload.imported} candidate(s) imported.` });
        onImported?.();
      } else {
        toast({ title: 'No candidates imported', description: 'Review the error report and try again.', variant: 'destructive' });
      }
    } catch (error) {
      setParseError(error.message || 'Import failed.');
      toast({ title: 'Import failed', description: error.message || 'Please check the file and try again.', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([{
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'rahul@example.com',
      contact: '9876543210',
      position: 'Software Engineer',
      client: 'Acme Corp',
      skills: 'React, Node.js',
      totalExperience: '3',
      ctc: '6 LPA',
      ectc: '8 LPA',
      noticePeriod: '30 days',
      currentCompany: 'TCS',
      currentLocation: 'Bangalore',
      source: 'Portal',
      status: 'Submitted',
    }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
    XLSX.writeFile(workbook, 'candidate_import_template.xlsx');
  };

  const downloadErrorReport = () => {
    const reportRows = makeErrorReportRows(rows, serverErrors);
    if (!reportRows.length) return;

    const worksheet = XLSX.utils.json_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Errors');
    XLSX.writeFile(workbook, 'candidate_import_errors.xlsx');
  };

  const reportRows = makeErrorReportRows(rows, serverErrors);
  const previewRows = rows.slice(0, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close import dialog" onClick={onClose} />
      <section className="relative w-full max-w-[96rem] max-h-[96vh] overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Import Bulk Candidates
            </h2>
            <p className="mt-1 text-sm text-slate-500">Upload a spreadsheet, review row status, then import valid candidates.</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(96vh-132px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-semibold">Required columns</p>
                <p className="mt-1 text-xs leading-relaxed">firstName, email, contact. A name/full name column is also accepted and split automatically. Position is optional.</p>
                <button type="button" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 underline" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" />
                  Download template
                </button>
              </div>

              <div
                className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-green-500 hover:bg-green-50"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                {isParsing ? (
                  <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                ) : (
                  <Upload className="h-10 w-10 text-slate-400" />
                )}
                <p className="mt-3 text-sm font-semibold text-slate-700">{file ? file.name : 'Choose or drag spreadsheet'}</p>
                <p className="mt-1 text-xs text-slate-500">.xlsx, .xls, or .csv</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => parseSelectedFile(event.target.files?.[0] || null)}
                />
              </div>

              {parseError && (
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {!!rows.length && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-lg font-semibold text-slate-900">{summary.total}</p>
                    <p className="text-xs text-slate-500">Rows</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-lg font-semibold text-green-700">{summary.valid}</p>
                    <p className="text-xs text-green-700">Valid</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-lg font-semibold text-red-700">{summary.invalid + serverErrors.length}</p>
                    <p className="text-xs text-red-700">Issues</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="rounded-lg border border-slate-200 p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Import result
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div><p className="font-semibold text-green-700">{result.imported || 0}</p><p className="text-xs text-slate-500">Imported</p></div>
                    <div><p className="font-semibold text-amber-700">{result.duplicates || 0}</p><p className="text-xs text-slate-500">Duplicates</p></div>
                    <div><p className="font-semibold text-red-700">{result.failed || 0}</p><p className="text-xs text-slate-500">Failed</p></div>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Preview</p>
                <p className="text-xs text-slate-500">{rows.length > 100 ? 'Showing first 100 rows' : `${rows.length} row(s)`}</p>
              </div>
              <div className="max-h-[640px] overflow-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Candidate</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Contact</th>
                      <th className="px-3 py-2">Position</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!previewRows.length ? (
                      <tr>
                        <td colSpan="6" className="px-3 py-16 text-center text-slate-500">Select a file to see candidate rows.</td>
                      </tr>
                    ) : previewRows.map((row) => (
                      <tr key={row.rowNumber} className={row.status === 'invalid' ? 'bg-red-50/50' : 'bg-white'}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{buildCandidateName(row.data)}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.email || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.contact || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.data.position || '-'}</td>
                        <td className="px-3 py-2">
                          {row.status === 'valid' ? (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Valid</span>
                          ) : (
                            <span className="text-xs font-medium text-red-700">{row.errors.join(' ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            disabled={!reportRows.length}
            onClick={downloadErrorReport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download Error Report
          </button>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!summary.valid || isImporting}
              onClick={handleImport}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Confirm Import
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
