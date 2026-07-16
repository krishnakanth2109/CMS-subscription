import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const getCandidateProfileId = (candidate) => (
  candidate?._id || candidate?.id || candidate?.candidateId || ''
);

export const getCandidateDisplayName = (candidate) => (
  candidate?.name || `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Unknown Candidate'
);

export const getCandidateProfilePath = (candidateId, userRole) => {
  const base = userRole === 'recruiter' ? '/recruiter' : '/admin';
  return `${base}/candidates/${encodeURIComponent(candidateId)}`;
};

export default function CandidateProfileLink({
  candidate,
  candidateId,
  children,
  className = '',
  title,
}) {
  const { userRole } = useAuth();
  const id = candidateId || getCandidateProfileId(candidate);
  const label = children || getCandidateDisplayName(candidate);

  if (!id) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      to={getCandidateProfilePath(id, userRole)}
      title={title || `Open ${typeof label === 'string' ? label : 'candidate'} profile`}
      className={`font-semibold text-slate-900 underline-offset-4 hover:text-blue-700 hover:underline dark:text-white dark:hover:text-blue-300 ${className}`}
    >
      {label}
    </Link>
  );
}
