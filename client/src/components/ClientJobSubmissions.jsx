import { useMemo, useState } from 'react';
import { Plus, Trash2, Lock, Loader2, AlertTriangle } from 'lucide-react';

export const PIPELINE_STAGES = [
  'Pipeline',
  'Submitted',
  'Shared Profiles',
  'Yet to attend',
  'Turnups',
  'Selected',
  'Rejected',
  'Hold',
  'Joined',
  'Backout',
];

const inputCls = (hasErr = false) =>
  `w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
    hasErr ? 'border-red-500' : 'border-slate-300'
  }`;

const emptyRow = () => ({
  clientName: '',
  jobId: '',
  jobCode: '',
  position: '',
  pipelineStage: 'Pipeline',
  isExisting: false,
});

const stageBadgeCls = (stage = '') => {
  const s = stage.toLowerCase();
  if (s.includes('join')) return 'bg-emerald-100 text-emerald-800';
  if (s.includes('select')) return 'bg-green-100 text-green-800';
  if (s.includes('reject') || s.includes('backout')) return 'bg-red-100 text-red-700';
  if (s.includes('hold')) return 'bg-amber-100 text-amber-800';
  if (s.includes('turn')) return 'bg-purple-100 text-purple-800';
  if (s.includes('shared')) return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
};

const ConfirmDeleteDialog = ({ submission, onConfirm, onCancel, isDeleting }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative bg-white rounded-2xl shadow-2xl border border-red-100 p-6 max-w-sm w-full">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Delete Submission?</h3>
          <p className="text-sm text-slate-500 mt-1">
            Remove the submission for{' '}
            <span className="font-semibold text-slate-800">{submission?.clientName}</span>
            {submission?.jobCode ? ` (${submission.jobCode})` : ''}?
            This cannot be undone.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-70"
        >
          {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default function ClientJobSubmissions({
  submissions = [],
  clients = [],
  jobs = [],
  onChange,
  errors = {},
  isEditMode = false,
  onDeleteExisting,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getJobsForClient = (clientName) => {
    if (!clientName) return [];
    return jobs.filter(
      (j) => (j.clientName || '').toLowerCase() === clientName.toLowerCase()
    );
  };

  const handleAddRow = () => {
    onChange([emptyRow(), ...submissions]);
  };

  const handleRemoveNewRow = (index) => {
    const row = submissions[index];
    if (row?.isExisting) return;
    onChange(submissions.filter((_, i) => i !== index));
  };

  const handleConfirmDeleteExisting = async () => {
    if (!deleteTarget) return;
    const { index, submission } = deleteTarget;

    if (onDeleteExisting && submission._id) {
      setIsDeleting(true);
      try {
        await onDeleteExisting(submission._id);
        onChange(submissions.filter((_, i) => i !== index));
      } catch (e) {
        console.error('[ClientJobSubmissions] delete failed:', e);
      } finally {
        setIsDeleting(false);
        setDeleteTarget(null);
      }
    } else {
      onChange(submissions.filter((_, i) => i !== index));
      setDeleteTarget(null);
    }
  };

  const handleRowChange = (index, field, value) => {
    const updated = submissions.map((row, i) => {
      if (i !== index) return row;
      const newRow = { ...row, [field]: value };

      if (field === 'clientName' && !row.isExisting) {
        newRow.jobId = '';
        newRow.jobCode = '';
        newRow.position = '';
      }
      if (field === 'jobId' && !row.isExisting) {
        const selectedJob = jobs.find((j) => j._id === value);
        if (selectedJob) {
          newRow.jobCode = selectedJob.jobCode || '';
          newRow.position = selectedJob.position || '';
          newRow.clientName = selectedJob.clientName || newRow.clientName;
        } else {
          newRow.jobCode = '';
          newRow.position = '';
        }
      }
      return newRow;
    });
    onChange(updated);
  };

  const selectedJobIds = useMemo(
    () => new Set(submissions.map((r) => r.jobId).filter(Boolean)),
    [submissions]
  );

  const existingRows = submissions.filter((r) => r.isExisting);
  const newRows = submissions.filter((r) => !r.isExisting);

  return (
    <div className="flex flex-col gap-4">
      {deleteTarget && (
        <ConfirmDeleteDialog
          submission={deleteTarget.submission}
          onConfirm={handleConfirmDeleteExisting}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Client &amp; Job Submissions
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isEditMode
              ? 'Existing submissions shown below. Add new ones or update pipeline stages.'
              : 'Submit this candidate to one or more client jobs. Each tracks its own pipeline.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Client / Job
        </button>
      </div>

      {errors.submissions && (
        <p className="text-xs text-red-500">{errors.submissions}</p>
      )}

      {submissions.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">No client/job submissions yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Click <span className="font-semibold text-blue-600">+ Add Client / Job</span> to begin.
          </p>
        </div>
      )}

      {existingRows.length > 0 && (
        <div className="space-y-2 order-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Existing Submissions
            <span className="ml-2 text-slate-400 normal-case font-normal">
              (update pipeline stage or delete)
            </span>
          </p>
          {submissions.map((row, index) => {
            if (!row.isExisting) return null;
            return (
              <div
                key={row._id || `existing-${index}`}
                className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-500">Client</label>
                    <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm text-slate-700">
                      <Lock className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      {row.clientName}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-500">Job Code</label>
                    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm font-mono text-blue-700">
                      {row.jobCode} - {row.position}
                    </div>
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Pipeline Stage
                      <span className="ml-1 text-blue-600">(editable)</span>
                    </label>
                    <select
                      value={row.pipelineStage || 'Pipeline'}
                      onChange={(e) => handleRowChange(index, 'pipelineStage', e.target.value)}
                      className={`${inputCls(false)} border-blue-300 focus:ring-blue-500`}
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Current:</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${stageBadgeCls(row.pipelineStage)}`}>
                      {row.pipelineStage || 'Pipeline'}
                    </span>
                    {row._originalStage && row._originalStage !== row.pipelineStage && (
                      <span className="text-xs text-amber-600 font-medium">
                        ← was: {row._originalStage}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ index, submission: row })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 transition"
                    title="Delete this submission"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newRows.length > 0 && (
        <div className="space-y-2 order-2">
          {isEditMode && existingRows.length > 0 && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              New Submissions to Add
            </p>
          )}
          {submissions.map((row, index) => {
            if (row.isExisting) return null;

            const availableJobs = getJobsForClient(row.clientName);
            const isDuplicateRow =
              row.jobId &&
              submissions.some(
                (other, otherIdx) => otherIdx !== index && other.jobId === row.jobId
              );

            return (
              <div
                key={`new-row-${index}`}
                className={`rounded-xl border p-4 bg-white shadow-sm ${
                  isDuplicateRow ? 'border-red-400' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-600">
                    {isEditMode ? 'New Submission' : `Submission #${index - existingRows.length + 1}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemoveNewRow(index)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-lg transition"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">Client *</label>
                    <select
                      value={row.clientName}
                      onChange={(e) => handleRowChange(index, 'clientName', e.target.value)}
                      className={inputCls(!row.clientName && isDuplicateRow)}
                    >
                      <option value="">Select Client</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c.companyName || c.name}>
                          {c.companyName || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">Job / Requirement *</label>
                    <select
                      value={row.jobId}
                      onChange={(e) => handleRowChange(index, 'jobId', e.target.value)}
                      disabled={!row.clientName}
                      className={inputCls(isDuplicateRow)}
                    >
                      <option value="">
                        {row.clientName ? 'Select Job' : 'Select Client first'}
                      </option>
                      {availableJobs.map((j) => {
                        const alreadyPicked =
                          selectedJobIds.has(j._id) && j._id !== row.jobId;
                        return (
                          <option key={j._id} value={j._id} disabled={alreadyPicked}>
                            {j.jobCode} - {j.position}
                            {alreadyPicked ? ' (already added)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {isDuplicateRow && (
                      <p className="text-xs text-red-500">Duplicate — already in another row.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">Job Code</label>
                    <input
                      type="text"
                      readOnly
                      value={row.jobCode || '-'}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-default"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">Pipeline Stage</label>
                    <select
                      value={row.pipelineStage || 'Pipeline'}
                      onChange={(e) => handleRowChange(index, 'pipelineStage', e.target.value)}
                      className={inputCls(false)}
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {row.position && (
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-semibold">Position:</span> {row.position}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
