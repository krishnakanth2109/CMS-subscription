import React from 'react';
import {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Flag,
  MessageSquare,
  PauseCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';

const STYLES = {
  emerald: {
    accent: '#059669',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    chip: 'bg-emerald-600',
    icon: 'bg-emerald-100 text-emerald-700',
    rail: '#10b981',
  },
  blue: {
    accent: '#2563eb',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    chip: 'bg-blue-600',
    icon: 'bg-blue-100 text-blue-700',
    rail: '#3b82f6',
  },
  violet: {
    accent: '#7c3aed',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-800',
    chip: 'bg-violet-600',
    icon: 'bg-violet-100 text-violet-700',
    rail: '#8b5cf6',
  },
  orange: {
    accent: '#ea580c',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    chip: 'bg-orange-500',
    icon: 'bg-orange-100 text-orange-700',
    rail: '#f97316',
  },
  slate: {
    accent: '#475569',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    chip: 'bg-slate-600',
    icon: 'bg-slate-100 text-slate-600',
    rail: '#64748b',
  },
};

const GUIDE_OVERVIEW = [
  {
    id: 'WF-1',
    title: 'Candidate Lifecycle Flow',
    desc: 'Creation - Parsing - Shortlisting - Submission - Interview - Outcome',
    tone: 'emerald',
  },
  {
    id: 'WF-2',
    title: 'Job Requirement & Client Submission',
    desc: 'Client creation - Job posting - Assignment - Submission - Review - Multi-client',
    tone: 'violet',
  },
  {
    id: 'WF-3',
    title: 'Interview Scheduling & Tracking',
    desc: 'Shortlisting - Scheduling - Notification - Interview - Feedback - Status update',
    tone: 'orange',
  },
];

const ROLE_FLOW = [
  {
    role: 'Admin',
    desc: 'Full operational control',
    note: 'Only role that can create clients',
    tone: 'emerald',
  },
  {
    role: 'Manager',
    desc: 'Team management',
    note: 'Assigns jobs to Recruiters',
    tone: 'violet',
  },
  {
    role: 'Recruiter',
    desc: 'Sources candidates',
    note: 'Manages pipeline submissions',
    tone: 'slate',
  },
];

const WORKFLOWS = [
  {
    id: 'WF-1',
    step: 'Step 1',
    title: 'Candidate Lifecycle Flow',
    subtitle: 'Creation - Profile parsing - Shortlisting - Submission - Interview - Outcome',
    tone: 'emerald',
    icon: Users,
    noteTitle: 'About this workflow',
    notes: [
      'Candidate records are created by Admin, Manager, or Recruiter.',
      'Resume is uploaded, parsed, and stored as a completed candidate profile.',
      'Recruiter shortlists the candidate, submits parsed profile data, and tracks interview outcome.',
    ],
    steps: [
      {
        title: 'Admin / Manager / Recruiter creates candidate record',
        subtitle: 'Candidates never self-register - record initiated manually',
        icon: Users,
        tone: 'emerald',
      },
      {
        title: 'Resume uploaded & parsed by system',
        subtitle: 'Extracted: skills - experience - qualifications ',
        icon: Upload,
        tone: 'emerald',
      },
      {
        title: 'Parsed data stored - candidate profile completed',
        subtitle: 'Recruiter reviews and confirms profile accuracy',
        icon: Database,
        tone: 'emerald',
      },
      {
        title: 'Recruiter searches & shortlists candidate',
        subtitle: 'Matched to an open job requirement by role and skills',
        icon: Search,
        tone: 'blue',
      },
      {
        title: 'Parsed candidate profile submitted to client',
        subtitle: 'Only extracted profile data forwarded - NO raw resume file transmitted',
        icon: Send,
        tone: 'blue',
      },
      {
        title: 'Interview scheduled',
        subtitle: 'Date - time - mode set | Recruiter notified | Recruiter informs candidate',
        icon: Calendar,
        tone: 'blue',
      },
      {
        title: 'Interview conducted - outcome & feedback recorded',
        subtitle: 'Managing role logs result and client feedback in system',
        icon: ClipboardList,
        tone: 'blue',
      },
    ],
    decision: {
      title: 'Outcome?',
      subtitle: 'Client decision',
      tone: 'emerald',
      branches: [
        {
          label: 'Selected',
          title: 'Selected',
          subtitle: 'Offer & onboarding begins',
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'On Hold',
          title: 'On Hold',
          subtitle: 'Awaiting next round',
          icon: PauseCircle,
          tone: 'orange',
        },
        {
          label: 'Rejected',
          title: 'Rejected',
          subtitle: 'Reason logged - returns to pool',
          icon: XCircle,
          tone: 'slate',
          danger: true,
        },
      ],
    },
    ending: {
      title: 'Talent Pool',
      icon: RefreshCw,
      tone: 'blue',
    },
  },
  {
    id: 'WF-2',
    step: 'Step 2',
    title: 'Job Requirement & Client Submission Flow',
    subtitle: 'Client creation (Admin only) - Requirement posting - Assignment - Submission - Review - Multi-client',
    tone: 'violet',
    icon: Briefcase,
    noteTitle: 'About this workflow',
    notes: [
      'Only Admin can create clients - prerequisite for all job requirements.',
      'Job requirements are created by Admin or Manager and linked to the client record.',
      'Each client tracks independently. Only Admin can create/manage client records.',
    ],
    steps: [
      {
        title: 'Admin adds client to system [ADMIN ONLY]',
        subtitle: 'Only Admin can create clients - prerequisite for all job requirements',
        icon: Building2,
        tone: 'emerald',
      },
      {
        title: 'Job requirement created - role - skills - headcount',
        subtitle: 'Created by Admin or Manager - linked to the client record',
        icon: ClipboardList,
        tone: 'violet',
      },
      {
        title: 'Job requirement assigned to Recruiter(s)',
        subtitle: 'Admin or Manager assigns to one or more Recruiters on the team',
        icon: Users,
        tone: 'violet',
      },
      {
        title: 'Recruiter searches & shortlists candidates',
        subtitle: 'Searches talent pool using job criteria - skill and profile matching',
        icon: Search,
        tone: 'blue',
      },
      {
        title: 'Parsed candidate profile submitted to client',
        subtitle: 'Extracted data only (name - skills - qualifications - experience) - NO raw resume',
        icon: Send,
        tone: 'blue',
      },
    ],
    decision: {
      title: 'Client review',
      subtitle: 'decision',
      tone: 'violet',
      branches: [
        {
          label: 'Approved',
          title: 'Approved',
          subtitle: 'Proceeds to Workflow 3',
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'Rejected',
          title: 'Rejected',
          subtitle: 'Returns to talent pool',
          icon: XCircle,
          tone: 'slate',
          danger: true,
        },
      ],
    },
    fanout: {
      title: 'Multi-Client Delivery',
      subtitle: 'Same candidate submitted to multiple clients in parallel',
      clients: ['Client A', 'Client B', 'Client C'],
    },
  },
  {
    id: 'WF-3',
    step: 'Step 3',
    title: 'Interview Scheduling & Tracking Flow',
    subtitle: 'Client shortlisting - Scheduling - Notification - Interview - Feedback - Status update',
    tone: 'orange',
    icon: Calendar,
    noteTitle: 'Tracking note',
    notes: [
      'Client reviews parsed profile data and confirms interview interest.',
      'System notification is delivered to the assigned Recruiter with full interview details.',
      'All outcomes visible to Admin and Manager for reporting. Recruiters see own candidate data only.',
    ],
    steps: [
      {
        title: 'Client shortlists candidate from submitted profiles',
        subtitle: 'Client reviews parsed profile data and confirms interview interest',
        icon: UserCheck,
        tone: 'orange',
      },
      {
        title: 'Interview scheduled in system',
        subtitle: 'Date - time - mode (virtual / in-person) recorded by Admin / Manager / Recruiter',
        icon: Calendar,
        tone: 'orange',
      },
      {
        title: 'Recruiter notified - system notification triggered automatically',
        subtitle: 'Notification delivered to assigned Recruiter with full interview details',
        icon: MessageSquare,
        tone: 'blue',
      },
      {
        title: 'Recruiter informs candidate',
        subtitle: 'Interview schedule details communicated to candidate by Recruiter',
        icon: UserCheck,
        tone: 'blue',
      },
      {
        title: 'Interview conducted',
        subtitle: 'Candidate attends with client at scheduled date and time',
        icon: Users,
        tone: 'slate',
      },
      {
        title: 'Outcome & feedback recorded',
        subtitle: 'Managing role logs result and client feedback - feeds reporting & status update',
        icon: ClipboardList,
        tone: 'slate',
      },
    ],
    decision: {
      title: 'Final outcome?',
      subtitle: 'Client decision',
      tone: 'orange',
      branches: [
        {
          label: 'Selected',
          title: 'Selected',
          subtitle: 'Status updated - offer begins',
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'On Hold',
          title: 'On Hold',
          subtitle: 'Awaiting next round',
          icon: PauseCircle,
          tone: 'orange',
        },
        {
          label: 'Rejected',
          title: 'Rejected',
          subtitle: 'Reason noted - candidate flagged',
          icon: XCircle,
          tone: 'slate',
          danger: true,
        },
      ],
    },
    ending: {
      title: 'END',
      icon: Flag,
      tone: 'emerald',
    },
  },
];

function ToneIcon({ icon: Icon, tone = 'blue', className = '' }) {
  const style = STYLES[tone] || STYLES.blue;

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.icon} ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Pill({ children, tone = 'blue' }) {
  const style = STYLES[tone] || STYLES.blue;

  return (
    <div className="flex justify-center">
      <div className={`rounded-lg px-8 py-2 text-sm font-extrabold text-white shadow-sm ${style.chip}`}>
        {children}
      </div>
    </div>
  );
}

function Connector({ tone = 'slate', label }) {
  const color = (STYLES[tone] || STYLES.slate).rail;

  return (
    <div className="relative flex h-11 items-center justify-center">
      <svg width="24" height="44" viewBox="0 0 24 44" className="overflow-visible">
        <line x1="12" y1="0" x2="12" y2="31" stroke={color} strokeWidth="2" />
        <polygon points="12,41 6,30 18,30" fill={color} />
      </svg>
      {label && (
        <span className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white bg-white px-2 py-0.5 text-[10px] font-extrabold shadow-sm" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}

function ProcessCard({ step }) {
  const style = STYLES[step.tone] || STYLES.blue;

  return (
    <article className={`mx-auto w-full max-w-[560px] rounded-xl border-2 ${style.border} ${style.bg} p-3 shadow-sm`}>
      <div className="flex items-start gap-3">
        <ToneIcon icon={step.icon} tone={step.tone} />
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold leading-snug text-slate-900">{step.title}</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{step.subtitle}</p>
        </div>
      </div>
    </article>
  );
}

function DecisionDiamond({ decision }) {
  const style = STYLES[decision.tone] || STYLES.blue;

  return (
    <div className="flex justify-center py-3">
      <div className="relative flex h-[118px] w-[210px] items-center justify-center sm:h-[132px] sm:w-[240px]">
        <svg className="absolute inset-0 h-full w-full drop-shadow-sm" viewBox="0 0 240 132" preserveAspectRatio="none">
          <polygon
            points="120,4 236,66 120,128 4,66"
            fill={style.accent}
            fillOpacity="0.1"
            stroke={style.rail}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="relative z-10 max-w-[118px] text-center sm:max-w-[140px]">
          <p className="text-sm font-extrabold leading-tight text-slate-900">{decision.title}</p>
          <p className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${style.text}`}>{decision.subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Branches({ decision }) {
  const branchCount = decision.branches.length;
  const gridClass = branchCount === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="hidden sm:block">
        <svg width="100%" viewBox="0 0 620 62" className="overflow-visible">
          <line x1="310" y1="0" x2="310" y2="28" stroke="#94a3b8" strokeWidth="2" />
          <line x1={branchCount === 2 ? '155' : '95'} y1="28" x2={branchCount === 2 ? '465' : '525'} y2="28" stroke="#94a3b8" strokeWidth="2" />
          {decision.branches.map((branch, index) => {
            const x = branchCount === 2 ? [155, 465][index] : [95, 310, 525][index];
            const color = branch.danger ? '#ef4444' : (STYLES[branch.tone] || STYLES.blue).rail;
            return (
              <React.Fragment key={branch.label}>
                <line x1={x} y1="28" x2={x} y2="50" stroke="#94a3b8" strokeWidth="2" />
                <polygon points={`${x},60 ${x - 6},49 ${x + 6},49`} fill="#94a3b8" />
                <rect x={x - 35} y="5" width="70" height="22" rx="6" fill="#ffffff" stroke={color} strokeWidth="1.5" />
                <text x={x} y="20" textAnchor="middle" fontSize="10" fill={color} fontWeight="800">{branch.label}</text>
              </React.Fragment>
            );
          })}
        </svg>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${gridClass}`}>
        {decision.branches.map((branch) => {
          const style = STYLES[branch.danger ? 'slate' : branch.tone] || STYLES.blue;
          const Icon = branch.icon;

          return (
            <article key={branch.label} className={`rounded-xl border-2 ${branch.danger ? 'border-red-200 bg-red-50' : `${style.border} ${style.bg}`} p-3 text-center shadow-sm`}>
              <div className="flex justify-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${branch.danger ? 'bg-red-100 text-red-600' : style.icon}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <h4 className="mt-2 text-xs font-extrabold text-slate-900">{branch.title}</h4>
              <p className="mt-1 text-[11px] font-medium leading-snug text-slate-600">{branch.subtitle}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Fanout({ fanout }) {
  return (
    <div className="mx-auto w-full max-w-[560px] rounded-xl border-2 border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="text-center">
        <p className="text-sm font-extrabold text-orange-800">{fanout.title}</p>
        <p className="mt-1 text-xs font-medium text-slate-600">{fanout.subtitle}</p>
      </div>
      <svg width="100%" viewBox="0 0 320 48" className="my-2 hidden overflow-visible sm:block">
        <line x1="160" y1="0" x2="160" y2="22" stroke="#fb923c" strokeWidth="2" />
        <line x1="55" y1="22" x2="265" y2="22" stroke="#fb923c" strokeWidth="2" />
        {[55, 160, 265].map((x) => (
          <React.Fragment key={x}>
            <line x1={x} y1="22" x2={x} y2="38" stroke="#fb923c" strokeWidth="2" />
            <polygon points={`${x},47 ${x - 6},37 ${x + 6},37`} fill="#fb923c" />
          </React.Fragment>
        ))}
      </svg>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {fanout.clients.map((client) => (
          <div key={client} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-center">
            <p className="text-xs font-extrabold text-orange-800">{client}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">Independent review</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageCard({ workflow }) {
  const style = STYLES[workflow.tone] || STYLES.blue;
  const Icon = workflow.icon;

  return (
    <aside className={`rounded-xl border-2 ${style.border} ${style.bg} p-4 text-center shadow-sm lg:sticky lg:top-28`}>
      <span className={`inline-flex rounded-md px-3 py-1 text-xs font-extrabold text-white ${style.chip}`}>
        {workflow.step}
      </span>
      <h2 className="mt-4 text-base font-extrabold uppercase leading-tight text-slate-900">{workflow.title}</h2>
      <div className={`mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-2xl ${style.icon}`}>
        <Icon className="h-10 w-10" />
      </div>
    </aside>
  );
}

function NotePanel({ workflow }) {
  const style = STYLES[workflow.tone] || STYLES.blue;

  return (
    <aside className={`rounded-xl border-2 ${style.border} bg-white p-4 shadow-sm lg:sticky lg:top-28`}>
      <div className="flex items-center gap-2">
        <ToneIcon icon={ShieldCheck} tone={workflow.tone} className="h-8 w-8" />
        <p className={`text-xs font-extrabold uppercase tracking-wide ${style.text}`}>{workflow.noteTitle}</p>
      </div>
      <ul className="mt-4 space-y-3">
        {workflow.notes.map((note) => (
          <li key={note} className="flex gap-2 text-xs font-semibold leading-relaxed text-slate-600">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function WorkflowDiagram({ workflow }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-6 border-b border-slate-100 pb-4 text-center">
        <span className={`inline-flex rounded-md px-3 py-1 text-xs font-extrabold text-white ${STYLES[workflow.tone].chip}`}>
          {workflow.id}
        </span>
        <h2 className="mt-2 text-lg font-extrabold text-slate-900">{workflow.title}</h2>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{workflow.subtitle}</p>
      </div>

      <div className="flex flex-col items-center">
        <Pill tone={workflow.tone}>START</Pill>
        {workflow.steps.map((step) => (
          <React.Fragment key={step.title}>
            <Connector tone={step.tone} />
            <ProcessCard step={step} />
          </React.Fragment>
        ))}

        {workflow.decision && (
          <>
            <Connector tone={workflow.tone} />
            <DecisionDiamond decision={workflow.decision} />
            <Branches decision={workflow.decision} />
          </>
        )}

        {workflow.fanout && (
          <>
            <Connector tone="orange" />
            <Fanout fanout={workflow.fanout} />
          </>
        )}

        {workflow.ending && (
          <>
            <Connector tone={workflow.ending.tone} />
            <Pill tone={workflow.ending.tone}>
              <span className="inline-flex items-center gap-2">
                <workflow.ending.icon className="h-4 w-4" />
                {workflow.ending.title}
              </span>
            </Pill>
          </>
        )}
      </div>
    </div>
  );
}

function OverviewPanel() {
  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Guide Map</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-900">Workflows & Role Hierarchy</h2>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-[#283086]">
          <BookOpen className="h-3.5 w-3.5" />
          3 workflow stages
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Workflows</p>
            <span className="text-[11px] font-bold text-slate-400">Process map</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {GUIDE_OVERVIEW.map((item) => {
              const style = STYLES[item.tone];
              const workflow = WORKFLOWS.find((entry) => entry.id === item.id);
              const Icon = workflow?.icon || FileText;

              return (
                <article key={item.id} className="group relative border-b border-slate-100 px-3 py-3 last:border-b-0 hover:bg-slate-50">
                  <div className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ backgroundColor: style.rail }} />
                  <div className="flex items-start gap-3 pl-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold text-white ${style.chip}`}>
                          {item.id}
                        </span>
                        <h3 className="text-sm font-extrabold leading-snug text-slate-900">{item.title}</h3>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{item.desc}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-extrabold ${style.icon}`}>
                      {workflow?.step}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-[#283086] p-3 text-white shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/55">Role Hierarchy</p>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-extrabold text-white/75">Access flow</span>
          </div>

          <div className="grid gap-2">
            {ROLE_FLOW.map((role, index) => {
              const style = STYLES[role.tone];

              return (
                <article key={role.role} className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-extrabold text-[#283086]">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white ${style.chip}`}>
                          {role.role}
                        </span>
                        <span className="text-xs font-bold text-white/85">{role.desc}</span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-white/60">{role.note}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ workflow }) {
  return (
    <section className="grid gap-5 border-t border-slate-200 bg-slate-50/70 px-4 py-8 first:border-t-0 sm:px-6 lg:grid-cols-[190px_minmax(0,1fr)_250px] lg:px-8">
      <StageCard workflow={workflow} />
      <WorkflowDiagram workflow={workflow} />
      <NotePanel workflow={workflow} />
    </section>
  );
}

export default function UserGuidePage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-6 overflow-hidden rounded-2xl bg-[#283086] text-white shadow-lg">
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">VTS Tracker User Guide</h1>
              <p className="mt-1 text-sm font-semibold text-white/70">Workflow Flowcharts</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-extrabold text-white/80">
            Admin - Manager - Recruiter
          </div>
        </div>
      </header>

      <OverviewPanel />

      <main className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {WORKFLOWS.map((workflow) => (
          <WorkflowSection key={workflow.id} workflow={workflow} />
        ))}
      </main>
    </div>
  );
}
