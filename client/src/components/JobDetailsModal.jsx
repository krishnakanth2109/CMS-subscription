import React from 'react';
import { createPortal } from 'react-dom';
import {
  Briefcase,
  Building2,
  GraduationCap,
  IndianRupee,
  Users,
  X,
} from 'lucide-react';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-GB');
};

const normalizeValue = (value) => {
  if (value === true) return 'Active';
  if (value === false) return 'Inactive';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || 'N/A';
  return value || 'N/A';
};

function DetailRow({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{normalizeValue(value)}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-black text-slate-950">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
};

export default function JobDetailsModal({ job, onClose }) {
  if (!job) return null;

  const mandatorySkills = job.mandatorySkills?.length ? job.mandatorySkills : job.skills;
  const status = job.active !== undefined ? job.active : job.status || 'Active';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 bg-slate-950 p-6 text-white">
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-black tracking-tight">{job.position || 'Job Details'}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-white">
                  {job.jobCode || 'N/A'}
                </span>
                <span>{job.clientName || 'N/A'}</span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                  {normalizeValue(status)}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto bg-slate-100 p-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Core Details" icon={Briefcase}>
                <DetailRow label="Job Code" value={job.jobCode} />
                <DetailRow label="Client Name" value={job.clientName} />
                <DetailRow label="Role / Position" value={job.position} />
                <DetailRow label="Job Type" value={job.jobType} />
                <DetailRow label="Location" value={job.location} />
                <DetailRow label="Interview Mode" value={job.interviewMode} />
              </Section>

              <Section title="Candidate Criteria" icon={GraduationCap}>
                <DetailRow label="Experience" value={job.experience ? `${job.experience} Years` : ''} />
                <DetailRow label="Relevant Experience" value={job.relevantExperience ? `${job.relevantExperience} Years` : ''} />
                <DetailRow label="Qualification" value={job.qualification} />
                <DetailRow label="Gender" value={job.gender || 'Any'} />
                <DetailRow label="Mandatory Skills" value={mandatorySkills} />
                <DetailRow label="Preferred Skills" value={job.preferredSkills} />
              </Section>

              <Section title="Compensation & Timeline" icon={IndianRupee}>
                <DetailRow label="Salary Budget" value={job.salaryBudget} />
                <DetailRow label="Monthly Salary" value={job.monthlySalary} />
                <DetailRow label="Notice Period" value={job.noticePeriod} />
                <DetailRow label="Expiry / TAT" value={formatDate(job.tatTime)} />
                <DetailRow label="Created At" value={formatDate(job.createdAt)} />
                <DetailRow label="Updated At" value={formatDate(job.updatedAt)} />
              </Section>

              <Section title="Recruiter Assignment" icon={Users}>
                <DetailRow label="Primary Recruiter" value={job.primaryRecruiter} />
                <DetailRow label="Secondary Recruiter" value={job.secondaryRecruiter} />
                <DetailRow label="Assigned Recruiter" value={job.assignedRecruiter || job.recruiterName} />
                <DetailRow label="Status" value={status} />
              </Section>
            </div>

            {(job.description || job.remarks || job.notes) && (
              <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-black text-slate-950">Notes</h3>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-700">
                  {job.description || job.remarks || job.notes}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
