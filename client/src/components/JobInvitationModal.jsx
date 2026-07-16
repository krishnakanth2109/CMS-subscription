import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, RotateCcw, Search, Send, UserMinus, X } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => EMAIL_RE.test(String(email || '').trim());

const isPresent = (value) => {
  if (Array.isArray(value)) return value.some(isPresent);
  const text = String(value ?? '').trim();
  return Boolean(text) && text !== '-';
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatListValue = (value) => {
  if (Array.isArray(value)) return value.filter(isPresent).map(escapeHtml).join(', ');
  return escapeHtml(value);
};

const getCandidateName = (candidate) => (
  candidate?.name ||
  `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() ||
  'Candidate'
);

const getJobLabel = (job) => [
  job?.position,
  job?.clientName,
  job?.location,
].filter(isPresent).join(' - ');

const generateInviteTemplate = (job) => {
  if (!job) return { subject: '', htmlBody: '' };

  const clientName = isPresent(job.clientName) ? job.clientName : 'our recruitment team';
  const position = isPresent(job.position) ? job.position : 'this role';
  const location = isPresent(job.location) ? job.location : 'the listed location';

  const detailRows = [
    ['Position', job.position],
    ['Location', job.location],
    ['Job Type', job.jobType],
    ['Experience Required', job.experience],
    ['Relevant Experience', job.relevantExperience],
    ['Qualification', job.qualification],
    ['Salary Budget', job.salaryBudget],
    ['Monthly Salary', job.monthlySalary],
    ['Notice Period', job.noticePeriod],
  ].filter(([, value]) => isPresent(value));

  const detailsHtml = detailRows.length
    ? `<p><strong>Job Details:</strong></p><ul>${detailRows.map(([label, value]) => `<li><strong>${label}:</strong> ${formatListValue(value)}</li>`).join('')}</ul>`
    : '';

  const mandatorySkills = isPresent(job.mandatorySkills)
    ? `<p><strong>Mandatory Skills:</strong></p><p>${formatListValue(job.mandatorySkills)}</p>`
    : '';

  const preferredSkills = isPresent(job.preferredSkills)
    ? `<p><strong>Preferred Skills:</strong></p><p>${formatListValue(job.preferredSkills)}</p>`
    : '';

  const jobDescription = isPresent(job.jobDescription)
    ? `<p>${escapeHtml(job.jobDescription).replace(/\n/g, '<br />')}</p>`
    : '';

  return {
    subject: `Job Opportunity - ${position}`,
    htmlBody: `
      <p>Dear Candidate,</p>
      <p>Greetings from ${escapeHtml(clientName)}.</p>
      <p>We are currently hiring for the position of <strong>${escapeHtml(position)}</strong> in <strong>${escapeHtml(location)}</strong>. Based on your profile, we believe your experience may be suitable for this opportunity.</p>
      ${detailsHtml}
      ${mandatorySkills}
      ${preferredSkills}
      ${jobDescription}
      <p>Interested candidates are requested to reply with their updated resume and the following details:</p>
      <ul>
        <li>Current location</li>
        <li>Total experience</li>
        <li>Relevant experience</li>
        <li>Current CTC</li>
        <li>Expected CTC</li>
        <li>Notice period</li>
        <li>Availability for interview</li>
      </ul>
      <p>Regards,<br />Recruitment Team<br />${escapeHtml(clientName)}</p>
    `.replace(/\n\s+/g, '\n').trim(),
  };
};

const stripHtml = (html = '') => String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();

export default function JobInvitationModal({
  open,
  onClose,
  candidates = [],
  jobs = [],
  apiUrl,
  authHeaders,
  onSent,
}) {
  const editorRef = useRef(null);
  const [recipients, setRecipients] = useState([]);
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [sendResult, setSendResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecipients(candidates);
    setJobSearch('');
    setSelectedJobId('');
    setSubject('');
    setHtmlBody('');
    setSendResult(null);
    if (editorRef.current) editorRef.current.innerHTML = '';
  }, [open, candidates]);

  const activeJobs = useMemo(() => jobs.filter((job) => job?.active !== false), [jobs]);
  const selectedJob = useMemo(
    () => activeJobs.find((job) => String(job._id || job.id) === String(selectedJobId)),
    [activeJobs, selectedJobId]
  );
  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return activeJobs;
    return activeJobs.filter((job) => getJobLabel(job).toLowerCase().includes(query));
  }, [activeJobs, jobSearch]);

  const validRecipientCount = recipients.filter((candidate) => isValidEmail(candidate.email)).length;
  const skippedRecipientCount = recipients.length - validRecipientCount;

  const applyGeneratedTemplate = (job) => {
    const generated = generateInviteTemplate(job);
    setSubject(generated.subject);
    setHtmlBody(generated.htmlBody);
    setSendResult(null);
    if (editorRef.current) editorRef.current.innerHTML = generated.htmlBody;
  };

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId);
    const job = activeJobs.find((item) => String(item._id || item.id) === String(jobId));
    if (job) applyGeneratedTemplate(job);
  };

  const handleResetTemplate = () => {
    if (selectedJob) applyGeneratedTemplate(selectedJob);
  };

  const removeRecipient = (candidateId) => {
    setRecipients((prev) => prev.filter((candidate) => String(candidate._id) !== String(candidateId)));
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      setSendResult({ error: 'Select at least one candidate.' });
      return;
    }
    if (!selectedJobId) {
      setSendResult({ error: 'Select a job requirement.' });
      return;
    }
    if (!subject.trim()) {
      setSendResult({ error: 'Email subject is required.' });
      return;
    }
    if (!stripHtml(htmlBody)) {
      setSendResult({ error: 'Email body is required.' });
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      const authH = await authHeaders();
      const response = await fetch(`${apiUrl}/candidates/send-job-invite`, {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: recipients.map((candidate) => candidate._id),
          jobId: selectedJobId,
          subject,
          htmlBody,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to send invitations.');
      setSendResult(data);
      onSent?.(data);
    } catch (error) {
      setSendResult({ error: error.message || 'Failed to send invitations.' });
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const candidateById = new Map(recipients.map((candidate) => [String(candidate._id), candidate]));
  const failedRows = Array.isArray(sendResult?.results)
    ? sendResult.results.filter((item) => item.status === 'failed' || item.status === 'skipped')
    : [];
  const sentRows = Array.isArray(sendResult?.results)
    ? sendResult.results.filter((item) => item.status === 'sent')
    : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={sending ? undefined : onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Job Invitation</h2>
            <p className="mt-1 text-sm text-slate-500">Send one personalized email per selected candidate.</p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:overflow-hidden lg:grid-cols-[0.9fr_1.35fr]">
          <div className="min-h-0 lg:overflow-y-auto border-r border-slate-200 bg-white p-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Selected Candidates</h3>
                  <p className="text-sm text-slate-700">{recipients.length} selected, {validRecipientCount} ready</p>
                </div>
                {skippedRecipientCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {skippedRecipientCount} skipped
                  </span>
                )}
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {recipients.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">No candidates selected.</p>
                ) : recipients.map((candidate) => {
                  const valid = isValidEmail(candidate.email);
                  return (
                    <div key={candidate._id} className={`flex items-start justify-between gap-3 rounded-lg border bg-white p-3 ${valid ? 'border-slate-200' : 'border-amber-200'}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{getCandidateName(candidate)}</p>
                        <p className={`truncate text-xs ${valid ? 'text-slate-500' : 'text-amber-700'}`}>
                          {candidate.email || 'Candidate email is unavailable'}
                        </p>
                      </div>
                      <button type="button" onClick={() => removeRecipient(candidate._id)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Remove candidate">
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Job Requirement</h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={jobSearch}
                  onChange={(event) => setJobSearch(event.target.value)}
                  placeholder="Search position, client, location"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedJobId}
                onChange={(event) => handleJobChange(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select active job requirement</option>
                {filteredJobs.map((job) => (
                  <option key={job._id || job.id} value={job._id || job.id}>
                    {getJobLabel(job)}
                  </option>
                ))}
              </select>
            </section>

            {sendResult && (
              <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                {sendResult.error ? (
                  <div className="flex gap-2 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{sendResult.error}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>{sendResult.sent} invitations sent, {sendResult.failed} failed, {sendResult.skipped} skipped.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-white p-2"><strong>Total Selected</strong><br />{sendResult.total}</div>
                      <div className="rounded-md bg-white p-2"><strong>Successfully Sent</strong><br />{sendResult.sent}</div>
                      <div className="rounded-md bg-white p-2"><strong>Failed</strong><br />{sendResult.failed}</div>
                      <div className="rounded-md bg-white p-2"><strong>Skipped</strong><br />{sendResult.skipped}</div>
                    </div>
                    {failedRows.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-md bg-white p-2 text-xs text-slate-700">
                        {failedRows.map((item) => {
                          const candidate = candidateById.get(String(item.candidateId));
                          return (
                            <div key={`${item.candidateId}-${item.status}`} className="border-b border-slate-100 py-1 last:border-0">
                              <strong>{candidate ? getCandidateName(candidate) : item.candidateId}</strong>
                              <div>{item.email || candidate?.email || '-'}</div>
                              <div className="text-red-600">{item.error || item.status}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {sentRows.length > 0 && (
                      <div className="max-h-28 overflow-y-auto rounded-md bg-white p-2 text-xs text-slate-700">
                        <p className="mb-1 font-semibold text-slate-800">Provider accepted</p>
                        {sentRows.slice(0, 8).map((item) => {
                          const candidate = candidateById.get(String(item.candidateId));
                          return (
                            <div key={`${item.candidateId}-${item.providerMessageId || item.email}`} className="border-b border-slate-100 py-1 last:border-0">
                              <strong>{candidate ? getCandidateName(candidate) : item.email}</strong>
                              <div>{item.provider || 'email service'}{item.providerMessageId ? ` - ${item.providerMessageId}` : ''}</div>
                            </div>
                          );
                        })}
                        {sentRows.length > 8 && <p className="pt-1 text-slate-500">+{sentRows.length - 8} more accepted emails</p>}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="min-h-0 lg:overflow-y-auto bg-slate-100/60 p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email Subject</label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Job Opportunity - Position"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">Email Preview/Editor</label>
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    disabled={!selectedJob || sending}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to Generated Template
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable={!sending}
                  suppressContentEditableWarning
                  onInput={(event) => setHtmlBody(event.currentTarget.innerHTML)}
                  className="min-h-[480px] rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 [&_ul]:list-disc [&_ul]:pl-6"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={sending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleSend} disabled={sending || recipients.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
}
