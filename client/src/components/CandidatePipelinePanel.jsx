import { useEffect, useState, useCallback } from 'react';
import { Building2, Briefcase, Loader2, RefreshCw, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { RecruiterDetailsTrigger } from '@/components/RecruiterDetailsModal';

const STAGE_LABELS = {
  'Pipeline': 'Pipeline',
  'Submitted': 'Submitted',
  'Shared Profiles': 'Shared',
  'Yet to attend': 'Scheduled',
  'Turnups': 'Turnups',
  'Selected': 'Selected',
  'Rejected': 'Rejected',
  'Hold': 'Hold',
  'Joined': 'Joined',
  'Backout': 'Backout',
};

const FLOW_STAGES = [
  'Pipeline',
  'Submitted',
  'Shared Profiles',
  'Yet to attend',
  'Turnups',
  'Selected',
  'Joined',
];

const getSubmittedByName = (sub = {}) => {
  if (sub.submittedByName) return sub.submittedByName;
  const submittedBy = sub.submittedBy;
  if (!submittedBy || typeof submittedBy !== 'object') return '-';
  const fullName = `${submittedBy.firstName || ''} ${submittedBy.lastName || ''}`.trim();
  return fullName || submittedBy.name || submittedBy.username || submittedBy.email || '-';
};

const getSubmittedByDetails = (sub = {}) => (
  sub.submittedBy && typeof sub.submittedBy === 'object'
    ? sub.submittedBy
    : { name: getSubmittedByName(sub) }
);

const TERMINAL_STAGES = new Set(['Rejected', 'Hold', 'Backout']);

const stageColor = (stage = '', isActive = false) => {
  const s = stage.toLowerCase();
  if (s.includes('join')) return { dot: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-300', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (s.includes('select')) return { dot: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-300', badge: 'bg-green-100 text-green-800 border-green-200' };
  if (s.includes('reject') || s.includes('backout')) return { dot: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-300', badge: 'bg-red-100 text-red-700 border-red-200' };
  if (s.includes('hold')) return { dot: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-300', badge: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (s.includes('turn')) return { dot: 'bg-purple-500', text: 'text-purple-700', ring: 'ring-purple-300', badge: 'bg-purple-100 text-purple-800 border-purple-200' };
  if (s.includes('shared')) return { dot: 'bg-blue-500', text: 'text-blue-700', ring: 'ring-blue-300', badge: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (s.includes('yet') || s.includes('attend')) return { dot: 'bg-indigo-500', text: 'text-indigo-700', ring: 'ring-indigo-300', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return isActive
    ? { dot: 'bg-blue-500', text: 'text-blue-700', ring: 'ring-blue-300', badge: 'bg-blue-100 text-blue-800 border-blue-200' }
    : { dot: 'bg-slate-400', text: 'text-slate-500', ring: 'ring-slate-200', badge: 'bg-slate-100 text-slate-600 border-slate-200' };
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

function StageProgressGraph({ currentStage }) {
  const isTerminal = TERMINAL_STAGES.has(currentStage);
  const currentFlowIdx = FLOW_STAGES.indexOf(currentStage);

  const activeFlowIdx = isTerminal
    ? FLOW_STAGES.indexOf('Turnups')
    : currentFlowIdx;

  return (
    <div className="mt-4 space-y-3">
      <div className="relative flex items-center gap-0">
        {FLOW_STAGES.map((stage, idx) => {
          const isPast = idx < activeFlowIdx;
          const isCurrent = idx === activeFlowIdx && !isTerminal;
          const isFuture = idx > activeFlowIdx || (isTerminal && idx > activeFlowIdx);
          const colors = stageColor(stage, isCurrent || isPast);
          const isLast = idx === FLOW_STAGES.length - 1;

          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all
                    ${isCurrent
                      ? `${colors.dot} border-white ring-2 ${colors.ring} shadow-md`
                      : isPast
                        ? `${colors.dot} border-white`
                        : 'bg-white border-slate-200'
                    }
                  `}
                >
                  {isPast ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-white block" />
                  ) : (
                    <Circle className="h-3 w-3 text-slate-300" />
                  )}
                </div>
                <span className={`text-[9px] font-semibold mt-1 text-center leading-tight max-w-[52px] truncate
                  ${isCurrent ? colors.text : isPast ? 'text-slate-600' : 'text-slate-400'}`}>
                  {STAGE_LABELS[stage] || stage}
                </span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-0.5 transition-all ${isPast || isCurrent ? 'bg-blue-400' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {isTerminal && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-7 h-7" />
          <div className="h-px flex-1 border-t-2 border-dashed border-slate-200" />
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold
              ${stageColor(currentStage).badge}`}
          >
            <ChevronRight className="h-3 w-3" />
            {currentStage}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CandidatePipelinePanel({ candidateId, apiUrl, authHeaders }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSubmissions = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    setError('');
    try {
      const headers = typeof authHeaders === 'function' ? await authHeaders() : authHeaders || {};
      const res = await fetch(
        `${apiUrl}/submissions?candidateId=${encodeURIComponent(candidateId)}`,
        { headers }
      );
      if (!res.ok) throw new Error('Failed to load submissions');
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [candidateId, apiUrl, authHeaders]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading pipeline...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Client-wise Pipeline
          </p>
          {submissions.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSubmissions}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {!error && submissions.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No client/job submissions yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Add submissions from the candidate form.
          </p>
        </div>
      )}

      {submissions.length > 0 && (
        <div className="space-y-4">
          {submissions.map((sub) => {
            const jobObj = sub.jobId && typeof sub.jobId === 'object' ? sub.jobId : null;
            const jobCode = sub.jobCode || jobObj?.jobCode || '-';
            const position = sub.position || jobObj?.position || '-';
            const byName = getSubmittedByName(sub);

            const currentStage = sub.pipelineStage || sub.status || 'Pipeline';
            const submittedDate = formatDate(sub.submittedAt || sub.createdAt);
            const colors = stageColor(currentStage);

            return (
              <div
                key={sub._id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{sub.clientName}</p>
                      <p className="text-xs font-mono text-blue-600 font-semibold mt-0.5">
                        {jobCode}
                        {position !== '-' && (
                          <span className="font-sans text-slate-500 ml-1 font-normal">- {position}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors.badge}`}
                  >
                    {currentStage}
                  </span>
                </div>

                <div className="px-5 pb-4 pt-2">
                  <StageProgressGraph currentStage={currentStage} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Client</p>
                      <p className="font-medium text-slate-800">{sub.clientName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Job Code</p>
                      <p className="font-mono font-semibold text-blue-700">{jobCode}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Job Position</p>
                      <p className="font-medium text-slate-800">{position}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pipeline Stage</p>
                      <p className="font-medium text-slate-800">{currentStage}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
                      <p className="font-medium text-slate-800">{sub.status || currentStage}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submitted Date</p>
                      <p className="font-medium text-slate-800">{submittedDate}</p>
                    </div>
                    {sub.updatedAt && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status Changed Date</p>
                        <p className="font-medium text-slate-800">
                          {new Date(sub.updatedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recruiter / Submitted By</p>
                      <RecruiterDetailsTrigger recruiter={getSubmittedByDetails(sub)} className="font-medium text-slate-800">
                        {byName}
                      </RecruiterDetailsTrigger>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
