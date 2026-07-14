// src/pages/master/CandidateQRSubmissions.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Users, Search, Trash2, ChevronLeft, ChevronRight,
  Loader2, Mail, Phone, Clock, MapPin, Briefcase, GraduationCap,
  ExternalLink, DollarSign, ChevronDown, CheckCircle2, Layers
} from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export default function CandidateQRSubmissions() {
  const { authHeaders } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const ITEMS_PER_PAGE = 10;

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/candidate-qr/default`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch registrations');
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleDelete = async (submissionId) => {
    if (!window.confirm('Are you sure you want to remove this submission?')) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/candidate-qr/${session._id}/submissions/${submissionId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete submission');
      setSession((prev) => ({
        ...prev,
        submissions: prev.submissions.filter((sub) => sub._id !== submissionId),
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const submissions = [...(session?.submissions || [])].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const filtered = submissions.filter((sub) => {
    const q = search.toLowerCase();
    return (
      (sub.firstName || '').toLowerCase().includes(q) ||
      (sub.lastName || '').toLowerCase().includes(q) ||
      (sub.email || '').toLowerCase().includes(q) ||
      (sub.contact || '').includes(q) ||
      (sub.position || '').toLowerCase().includes(q) ||
      (sub.skills || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedList = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Candidate Registrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View and manage candidates who registered using the default Candidate QR code.
          </p>
        </div>
        <button
          onClick={fetchSession}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Search */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, role, skills..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total Candidates: {filtered.length}
          </span>
        </div>

        {/* List Content */}
        <div className="p-6 flex-1 min-h-[300px]">
          {loading && (
            <div className="flex flex-col justify-center items-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
              <p className="text-slate-400 text-sm">Loading registrations...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-20 text-red-600 text-sm bg-red-50 rounded-2xl p-6 border border-red-100">
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && pagedList.length === 0 && (
            <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <span className="text-4xl block mb-2">📭</span>
              <p className="text-slate-500 font-semibold text-sm">No candidate registrations found</p>
              <p className="text-slate-400 text-xs mt-1">Candidates will appear here after scanning the Candidate QR code.</p>
            </div>
          )}

          {!loading && !error && pagedList.length > 0 && (
            <div className="space-y-4">
              {pagedList.map((sub) => (
                <div key={sub._id} className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all bg-white">
                  <div
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50/50 select-none"
                    onClick={() => setExpandedId(expandedId === sub._id ? null : sub._id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {(sub.firstName?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">
                          {sub.firstName} {sub.lastName || ''}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{sub.email} · {sub.contact}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {sub.position && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-semibold">
                          {sub.position}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatDate(sub.submittedAt)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(sub._id); }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedId === sub._id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {expandedId === sub._id && (
                    <div className="border-t border-slate-100 px-6 py-5 bg-slate-50/50 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                        <DetailItem icon={<Users className="w-3.5 h-3.5" />} label="Candidate" value={`${sub.firstName} ${sub.lastName || ''}`} />
                        <DetailItem icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={sub.email} />
                        <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Contact" value={sub.contact} />
                        {sub.alternateNumber && <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Alternate Contact" value={sub.alternateNumber} />}
                        {sub.gender && <DetailItem icon={<Users className="w-3.5 h-3.5" />} label="Gender" value={sub.gender} />}
                        {sub.dateOfBirth && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Date of Birth" value={sub.dateOfBirth} />}
                        {sub.currentLocation && <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Current Location" value={sub.currentLocation} />}
                        {sub.preferredLocation && <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Preferred Location" value={sub.preferredLocation} />}
                        {sub.linkedin && (
                          <div>
                            <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5"><ExternalLink className="w-3.5 h-3.5" />LinkedIn</p>
                            <a href={sub.linkedin.startsWith('http') ? sub.linkedin : `https://${sub.linkedin}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-medium">
                              View Profile <ExternalLink size={11} />
                            </a>
                          </div>
                        )}
                        <div className="border-t border-slate-200 col-span-full my-1" />
                        {sub.position && <DetailItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Position Applied" value={sub.position} />}
                        {sub.currentCompany && <DetailItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Current Company" value={sub.currentCompany} />}
                        {sub.totalExperience && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Total Experience" value={`${sub.totalExperience} Years`} />}
                        {sub.relevantExperience && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Relevant Experience" value={`${sub.relevantExperience} Years`} />}
                        {sub.education && <DetailItem icon={<GraduationCap className="w-3.5 h-3.5" />} label="Education" value={sub.education} />}
                        {sub.skills && <DetailItem icon={<Layers className="w-3.5 h-3.5" />} label="Skills" value={sub.skills} />}
                        <div className="border-t border-slate-200 col-span-full my-1" />
                        {sub.ctc && <DetailItem icon={<DollarSign className="w-3.5 h-3.5" />} label="Current CTC" value={sub.ctc} />}
                        {sub.ectc && <DetailItem icon={<DollarSign className="w-3.5 h-3.5" />} label="Expected CTC" value={sub.ectc} />}
                        {sub.noticePeriod && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Notice Period" value={sub.noticePeriod} />}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} candidates
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-slate-700 flex items-center px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
        {icon}
        {label}
      </p>
      <p className="font-semibold text-slate-700">{value || '—'}</p>
    </div>
  );
}
