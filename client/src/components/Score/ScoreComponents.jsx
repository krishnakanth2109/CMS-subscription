import { Info } from 'lucide-react';

export const getScoreValue = (data) => data?.matchPercentage ?? data?.totalScore ?? null;

export const getMatchLevelClass = (level, includeDark = false) => {
  const base = {
    'Excellent Match': 'bg-green-50 text-green-700 border-green-200',
    'Good Match': 'bg-blue-50 text-blue-700 border-blue-200',
    'Average Match': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Partial Match': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Weak Match': 'bg-orange-50 text-orange-700 border-orange-200',
    'Poor Match': 'bg-red-50 text-red-700 border-red-200',
    'Low Match': 'bg-red-50 text-red-700 border-red-200',
  }[level] || 'bg-red-50 text-red-700 border-red-200';

  if (!includeDark) return base;

  const dark = {
    'Excellent Match': 'dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    'Good Match': 'dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    'Average Match': 'dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    'Partial Match': 'dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    'Weak Match': 'dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
    'Poor Match': 'dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    'Low Match': 'dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  }[level] || 'dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';

  return `${base} ${dark}`;
};

// ── ScoreBadge ───────────────────────────────────────────────────────────────
export function ScoreBadge({ score }) {
  if (score == null)
    return (
      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 font-medium">
        --
      </div>
    );

  let color = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
  if (score >= 85) color = 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
  else if (score >= 70) color = 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
  else if (score >= 50) color = 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
  else if (score >= 30) color = 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';

  return (
    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full border-4 font-bold text-sm ${color} shadow-sm`}>
      {Math.round(score)}%
    </div>
  );
}

// ── MatchBreakdownBar ─────────────────────────────────────────────────────────
export function MatchBreakdownBar({ breakdown }) {
  if (!breakdown) return null;

  const labels = {
    mandatorySkills: 'Mandatory Skills',
    preferredSkills: 'Preferred Skills',
    skills: 'Skills',
    experience: 'Experience',
    role: 'Role',
    education: 'Education',
    qualification: 'Education',
    location: 'Location',
  };
  const maxes = {
    mandatorySkills: 40,
    preferredSkills: 10,
    skills: 50,
    experience: 25,
    role: 10,
    education: 10,
    qualification: 10,
    location: 5,
  };

  return (
    <div className="space-y-2.5 mt-4">
      {Object.entries(breakdown).map(([k, v]) => {
        const maxScore = Number(maxes[k]) || 0;
        const currentScore = Number(v) || 0;
        const percent = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;
        const barPercent = Math.min(Math.max(percent, 0), 100);
        let color = 'bg-red-500';
        if (percent >= 80) color = 'bg-green-500';
        else if (percent >= 50) color = 'bg-blue-500';
        else if (percent >= 30) color = 'bg-yellow-500';

        return (
          <div key={k} className="flex items-center text-sm">
            <span className="w-32 text-zinc-500 dark:text-zinc-400 text-xs font-medium truncate">{labels[k] || k}</span>
            <div className="flex-1 mx-3 bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
              <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${barPercent}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-300">{percent}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── SkillChips ────────────────────────────────────────────────────────────────
export function SkillChips({
  matched = [],
  missing = [],
  matchedMandatory = [],
  missingMandatory = [],
  matchedPreferred = [],
  missingPreferred = [],
}) {
  const hasAtsSkills = matchedMandatory.length > 0 || missingMandatory.length > 0 || matchedPreferred.length > 0 || missingPreferred.length > 0;
  if (!hasAtsSkills && matched.length === 0 && missing.length === 0) return null;
  const groups = hasAtsSkills
    ? [
        { label: 'Matched Mandatory Skills', items: matchedMandatory, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800' },
        { label: 'Missing Mandatory Skills', items: missingMandatory, className: 'bg-white text-red-600 border-red-200 dark:bg-zinc-900 dark:border-red-900/50 dark:text-red-400' },
        { label: 'Matched Preferred Skills', items: matchedPreferred, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
        { label: 'Missing Preferred Skills', items: missingPreferred, className: 'bg-white text-amber-600 border-amber-200 dark:bg-zinc-900 dark:border-amber-900/50 dark:text-amber-400' },
      ]
    : [
        { label: 'Matched Skills', items: matched, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800' },
        { label: 'Missing Skills', items: missing, className: 'bg-white text-red-600 border-red-200 dark:bg-zinc-900 dark:border-red-900/50 dark:text-red-400' },
      ];

  return (
    <div className="mt-5 space-y-3">
      {groups.filter(group => group.items.length > 0).map(group => (
        <div key={group.label}>
          <span className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map(s => (
              <span key={`${group.label}-${s}`} className={`px-2 py-1 border rounded text-xs font-medium ${group.className}`}>
                {s}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MatchReasonBox ────────────────────────────────────────────────────────────
export function MatchReasonBox({ reason, flags = [] }) {
  if (!reason && flags.length === 0) return null;
  return (
    <div className="mt-5 p-3.5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-start gap-3">
      <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
      <div className="space-y-2">
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flags.map(flag => (
              <span key={flag} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                {flag}
              </span>
            ))}
          </div>
        )}
        {reason && <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed font-medium">{reason}</p>}
      </div>
    </div>
  );
}

// ── ScorePanel (collapsible panel used inside candidate view dialogs) ─────────
export function ScorePanel({ data, expanded, onToggle }) {
  if (!data) return null;

  const levelCls = getMatchLevelClass(data.matchLevel);

  return (
    <div className="border-b border-slate-200 bg-white">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <ScoreBadge score={getScoreValue(data)} />
          <div>
            <h3 className="font-bold text-slate-900">Score Match</h3>
            <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-semibold border ${levelCls}`}>
              {data.matchLevel}
            </span>
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-6 pb-6 pt-2 bg-slate-50/50 border-t border-slate-100">
          <MatchBreakdownBar breakdown={data.breakdown} />
          <MatchReasonBox reason={data.reason} flags={data.atsFlags} />
          <SkillChips
            matched={data.matchedSkills}
            missing={data.missingSkills}
            matchedMandatory={data.matchedMandatorySkills}
            missingMandatory={data.missingMandatorySkills}
            matchedPreferred={data.matchedPreferredSkills}
            missingPreferred={data.missingPreferredSkills}
          />
        </div>
      )}
    </div>
  );
}
