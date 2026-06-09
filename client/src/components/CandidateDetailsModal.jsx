import React from 'react';
import { X, FileText } from 'lucide-react';

const asList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const formatValue = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || 'N/A';
  return value || 'N/A';
};

const getResumeHref = (candidate, baseUrl) => {
  const url = candidate?.resumeUrl;
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
};

const DetailItem = ({ label, value }) => (
  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatValue(value)}</div>
  </div>
);

export default function CandidateDetailsModal({ candidate, status, clientName, baseUrl, onClose }) {
  if (!candidate) return null;

  const name = candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';
  const skills = asList(candidate.skills);
  const exp = candidate.totalExperience || candidate.relevantExperience || candidate.experience;
  const location = candidate.currentLocation || candidate.preferredLocation;
  const qualification = candidate.education || candidate.qualification;
  const role = candidate.position || candidate.currentRole;
  const company = clientName || candidate.clientName || candidate.client || candidate.currentCompany;
  const statusText = Array.isArray(status || candidate.status)
    ? (status || candidate.status).filter(Boolean).join(', ')
    : (status || candidate.status);
  const resumeHref = getResumeHref(candidate, baseUrl);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-zinc-900 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h3 className="text-lg font-bold text-white">{name}</h3>
            <p className="mt-0.5 text-xs text-zinc-400">{candidate.candidateId || candidate._id?.slice(-6).toUpperCase() || 'Candidate'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem label="Current Role" value={role} />
            <DetailItem label="Experience" value={exp} />
            <DetailItem label="Location" value={location} />
            <DetailItem label="Qualification" value={qualification} />
            <DetailItem label="Client / Company" value={company} />
            <DetailItem label="Status" value={statusText} />
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Skills</div>
            {skills.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span key={skill} className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-sm font-semibold text-zinc-500">N/A</div>
            )}
          </div>

          {resumeHref && (
            <a
              href={resumeHref}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <FileText className="h-4 w-4" />
              {candidate.resumeOriginalName || 'View Resume'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
