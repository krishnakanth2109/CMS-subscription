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
  const items = [
    { label: 'Skills (55)', value: breakdown?.skills || 0, max: 55, color: 'bg-blue-500' },
    { label: 'Role Relevance (25)', value: breakdown?.role || 0, max: 25, color: 'bg-indigo-500' },
    { label: 'Experience (10)', value: breakdown?.experience || 0, max: 10, color: 'bg-teal-500' },
    { label: 'Education (5)', value: breakdown?.education || 0, max: 5, color: 'bg-purple-500' },
    { label: 'Location/Other (5)', value: breakdown?.location || 0, max: 5, color: 'bg-pink-500' },
  ];

  return (
    <div className="space-y-2.5 mt-3">
      {items.map((item) => {
        const percentage = item.max ? Math.round((item.value / item.max) * 100) : 0;
        return (
          <div key={item.label} className="text-xs">
            <div className="flex justify-between text-zinc-500 mb-1 font-medium">
              <span>{item.label}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                {percentage}%
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5">
              <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SkillChips ────────────────────────────────────────────────────────────────
export function SkillChips({
  matchedMandatory = [],
  missingMandatory = [],
  matchedPreferred = [],
  missingPreferred = [],
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wide">Mandatory Skills</div>
        <div className="flex flex-wrap gap-1.5">
          {matchedMandatory.map((skill) => (
            <span key={`matched-${skill}`} className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 rounded-md font-medium">
              {skill} (Match)
            </span>
          ))}
          {missingMandatory.map((skill) => (
            <span key={`missing-${skill}`} className="bg-red-50 text-red-600 border border-red-200 text-xs px-2 py-0.5 rounded-md font-medium">
              {skill} (Missing)
            </span>
          ))}
          {!matchedMandatory.length && !missingMandatory.length && (
            <span className="text-xs text-zinc-400">No mandatory skills listed.</span>
          )}
        </div>
      </div>

      {(matchedPreferred.length > 0 || missingPreferred.length > 0) && (
        <div>
          <div className="text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wide">Preferred Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {matchedPreferred.map((skill) => (
              <span key={`pref-matched-${skill}`} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-md font-medium">
                {skill} (Match)
              </span>
            ))}
            {missingPreferred.map((skill) => (
              <span key={`pref-missing-${skill}`} className="bg-zinc-100 text-zinc-500 border border-zinc-200 text-xs px-2 py-0.5 rounded-md font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
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
