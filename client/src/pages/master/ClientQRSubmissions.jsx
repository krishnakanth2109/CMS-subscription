// src/pages/master/ClientQRSubmissions.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Building2, Search, Trash2, ChevronLeft, ChevronRight,
  Loader2, Mail, Phone, Clock, MapPin, Briefcase, Globe,
  ExternalLink, DollarSign, ChevronDown, Tag, Layers, FileText, Users
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

export default function ClientQRSubmissions() {
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
      const res = await fetch(`${API_URL}/client-qr/default`, { headers });
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
      const res = await fetch(`${API_URL}/client-qr/${session._id}/submissions/${submissionId}`, {
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
      (sub.companyName || '').toLowerCase().includes(q) ||
      (sub.contactPerson || '').toLowerCase().includes(q) ||
      (sub.email || '').toLowerCase().includes(q) ||
      (sub.phone || '').includes(q) ||
      (sub.industry || '').toLowerCase().includes(q)
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
            <Building2 className="w-7 h-7 text-sky-600" />
            Client Registrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View and manage companies who registered using the default Client QR code.
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
              placeholder="Search by company, contact, industry..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total Companies: {filtered.length}
          </span>
        </div>

        {/* List Content */}
        <div className="p-6 flex-1 min-h-[300px]">
          {loading && (
            <div className="flex flex-col justify-center items-center py-20">
              <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-3" />
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
              <span className="text-4xl block mb-2">🏢</span>
              <p className="text-slate-500 font-semibold text-sm">No client registrations found</p>
              <p className="text-slate-400 text-xs mt-1">Companies will appear here after scanning the Client QR code.</p>
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {(sub.companyName?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">
                          {sub.companyName}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{sub.contactPerson || 'No contact'} · {sub.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {sub.industry && (
                        <span className="text-xs bg-sky-50 text-sky-700 px-3 py-1 rounded-full font-semibold">
                          {sub.industry}
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
                        <DetailItem icon={<Building2 className="w-3.5 h-3.5" />} label="Company Name" value={sub.companyName} />
                        <DetailItem icon={<Tag className="w-3.5 h-3.5" />} label="Industry" value={sub.industry} />
                        {sub.companySize && <DetailItem icon={<Layers className="w-3.5 h-3.5" />} label="Company Size" value={sub.companySize} />}
                        {sub.gstNumber && <DetailItem icon={<FileText className="w-3.5 h-3.5" />} label="GST No." value={sub.gstNumber} />}
                        {sub.website && (
                          <div>
                            <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5"><Globe className="w-3.5 h-3.5" />Website</p>
                            <a href={sub.website.startsWith('http') ? sub.website : `https://${sub.website}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline inline-flex items-center gap-0.5 font-medium">
                              {sub.website} <ExternalLink size={11} />
                            </a>
                          </div>
                        )}
                        {sub.address && <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={[sub.address, sub.city, sub.state, sub.country].filter(Boolean).join(', ')} />}
                        <div className="border-t border-slate-200 col-span-full my-1" />
                        <DetailItem icon={<Users className="w-3.5 h-3.5" />} label="Contact Person" value={sub.contactPerson} />
                        {sub.designation && <DetailItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Designation" value={sub.designation} />}
                        <DetailItem icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={sub.email} />
                        <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={sub.phone} />
                        {sub.alternatePhone && <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Alternate Phone" value={sub.alternatePhone} />}
                        {sub.linkedin && (
                          <div>
                            <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5"><ExternalLink className="w-3.5 h-3.5" />LinkedIn</p>
                            <a href={sub.linkedin.startsWith('http') ? sub.linkedin : `https://${sub.linkedin}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline font-medium">
                              {sub.linkedin}
                            </a>
                          </div>
                        )}
                        <div className="border-t border-slate-200 col-span-full my-1" />
                        {sub.hiringFor && <DetailItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Hiring For" value={sub.hiringFor} />}
                        {sub.hiringVolume && <DetailItem icon={<Users className="w-3.5 h-3.5" />} label="Positions" value={sub.hiringVolume} />}
                        {sub.urgency && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Urgency" value={sub.urgency} />}
                        {sub.budgetRange && <DetailItem icon={<DollarSign className="w-3.5 h-3.5" />} label="Budget" value={sub.budgetRange} />}
                        {sub.preferredEngagement && <DetailItem icon={<Layers className="w-3.5 h-3.5" />} label="Engagement" value={sub.preferredEngagement} />}
                        {sub.notes && (
                          <div className="col-span-full mt-1">
                            <p className="text-[10px] text-slate-400 mb-1">Notes</p>
                            <p className="text-[11px] text-slate-700 bg-white rounded-lg p-2.5 border border-slate-200 whitespace-pre-wrap leading-relaxed">{sub.notes}</p>
                          </div>
                        )}
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
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} companies
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
