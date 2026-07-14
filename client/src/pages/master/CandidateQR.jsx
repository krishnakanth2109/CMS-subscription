// src/pages/master/CandidateQR.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  QrCode, Plus, Trash2, RefreshCw, Eye, EyeOff, Copy, Check,
  X, ChevronLeft, ChevronRight, Search, Download, User,
  Mail, Phone, MapPin, Briefcase, Calendar, Loader2,
  ToggleLeft, ToggleRight, ExternalLink, Clock, Users,
  GraduationCap, Banknote, AlertCircle, ChevronDown
} from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

// ── QR code via public API (no npm needed) ────────────────────────────────────
const getQRUrl = (url, size = 220) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png&margin=1`;

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const FRONTEND_URL = (import.meta.env.VITE_FRONTEND_URL || window.location.origin);

/* ════════════════════════════════════════════════════════════════════════════ */
export default function CandidateQR() {
  const { authHeaders } = useAuth();

  // Sessions list
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Create QR modal
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel]     = useState('');
  const [newExpiry, setNewExpiry]   = useState('');
  const [creating, setCreating]     = useState(false);

  // Submissions modal
  const [viewSession, setViewSession]     = useState(null);
  const [submissionsData, setSubmissionsData] = useState(null);
  const [submLoading, setSubmLoading]     = useState(false);
  const [submSearch, setSubmSearch]       = useState('');
  const [submPage, setSubmPage]           = useState(1);
  const SUBM_PER_PAGE = 8;

  // Copied state
  const [copiedId, setCopiedId] = useState(null);

  /* ── fetch sessions ───────────────────────────────────────────────────────── */
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/candidate-qr`, { headers: h });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  /* ── create session ──────────────────────────────────────────────────────── */
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/candidate-qr`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel || 'Candidate Registration', expiresAt: newExpiry || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create session');
      setSessions((prev) => [data.session, ...prev]);
      setShowCreate(false);
      setNewLabel('');
      setNewExpiry('');
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  /* ── toggle active ───────────────────────────────────────────────────────── */
  const handleToggle = async (id) => {
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/candidate-qr/${id}/toggle`, { method: 'PATCH', headers: h });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSessions((prev) => prev.map((s) => s._id === id ? { ...s, active: data.active } : s));
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── delete session ──────────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this QR session and all its submissions?')) return;
    try {
      const h = await authHeaders();
      await fetch(`${API_URL}/candidate-qr/${id}`, { method: 'DELETE', headers: h });
      setSessions((prev) => prev.filter((s) => s._id !== id));
      if (viewSession?._id === id) setViewSession(null);
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── view submissions ────────────────────────────────────────────────────── */
  const openSubmissions = async (session) => {
    setViewSession(session);
    setSubmLoading(true);
    setSubmSearch('');
    setSubmPage(1);
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/candidate-qr/${session._id}`, { headers: h });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubmissionsData(data.session);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmLoading(false);
    }
  };

  /* ── delete submission ───────────────────────────────────────────────────── */
  const handleDeleteSubmission = async (submissionId) => {
    if (!window.confirm('Remove this submission?')) return;
    try {
      const h = await authHeaders();
      await fetch(`${API_URL}/candidate-qr/${viewSession._id}/submissions/${submissionId}`, {
        method: 'DELETE', headers: h,
      });
      setSubmissionsData((prev) => ({
        ...prev,
        submissions: prev.submissions.filter((s) => s._id !== submissionId),
      }));
      setSessions((prev) => prev.map((s) =>
        s._id === viewSession._id
          ? { ...s, submissionCount: Math.max(0, (s.submissionCount || 1) - 1) }
          : s
      ));
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── copy link ───────────────────────────────────────────────────────────── */
  const copyLink = (token, id) => {
    const url = `${FRONTEND_URL}/candidate-form/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  /* ── download QR ─────────────────────────────────────────────────────────── */
  const downloadQR = async (token, label) => {
    const url = getQRUrl(`${FRONTEND_URL}/candidate-form/${token}`, 400);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch image');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qr-${label.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('QR download failed, falling back to opening in new tab:', err);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.click();
    }
  };

  /* ── filtered submissions ────────────────────────────────────────────────── */
  const allSubs = submissionsData?.submissions || [];
  const filteredSubs = allSubs.filter((s) => {
    const q = submSearch.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.contact?.includes(q) ||
      s.position?.toLowerCase().includes(q)
    );
  });
  const totalSubmPages = Math.max(1, Math.ceil(filteredSubs.length / SUBM_PER_PAGE));
  const pagedSubs = filteredSubs.slice((submPage - 1) * SUBM_PER_PAGE, submPage * SUBM_PER_PAGE);

  /* ════════════════════ RENDER ════════════════════════════════════════════ */
  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <QrCode className="w-7 h-7 text-indigo-600" />
              Candidate QR Portal
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Generate QR codes · Candidates scan &amp; fill the form · View submissions in real-time
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg hover:shadow-indigo-200 hover:scale-105 transition-all"
          >
            <Plus className="w-4 h-4" /> Generate New QR
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total QR Codes', value: sessions.length, icon: <QrCode className="w-5 h-5 text-indigo-500" />, bg: 'bg-indigo-50' },
          { label: 'Active QR Codes', value: sessions.filter(s => s.active).length, icon: <ToggleRight className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
          { label: 'Inactive', value: sessions.filter(s => !s.active).length, icon: <ToggleLeft className="w-5 h-5 text-slate-400" />, bg: 'bg-slate-50' },
          { label: 'Total Responses', value: sessions.reduce((sum, s) => sum + (s.submissionCount || 0), 0), icon: <Users className="w-5 h-5 text-violet-500" />, bg: 'bg-violet-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 border border-white shadow-sm flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="ml-3 text-slate-500">Loading QR sessions…</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={fetchSessions} className="ml-auto text-red-600 hover:text-red-800 flex items-center gap-1 text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && !error && (
        <>
          {sessions.length === 0 ? (
            <EmptyState onGenerate={() => setShowCreate(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onCopy={copyLink}
                  onDownload={downloadQR}
                  onView={() => openSubmissions(session)}
                  copied={copiedId === session._id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create QR Modal */}
      {showCreate && (
        <Modal title="Generate New QR Code" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Session Label</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Walk-in Drive July 2025"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
              />
              <p className="text-xs text-slate-400 mt-1">Visible to candidates on the form page</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expiry Date (optional)</label>
              <input
                type="datetime-local"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
              />
              <p className="text-xs text-slate-400 mt-1">Leave empty for no expiry</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><QrCode className="w-4 h-4" /> Generate QR</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Submissions Drawer / Modal */}
      {viewSession && (
        <SubmissionsModal
          session={viewSession}
          data={submissionsData}
          loading={submLoading}
          search={submSearch}
          onSearchChange={(v) => { setSubmSearch(v); setSubmPage(1); }}
          paged={pagedSubs}
          page={submPage}
          totalPages={totalSubmPages}
          total={filteredSubs.length}
          onPage={setSubmPage}
          onClose={() => { setViewSession(null); setSubmissionsData(null); }}
          onDeleteSubmission={handleDeleteSubmission}
        />
      )}
    </div>
  );
}

/* ════════════════════ SESSION CARD ═════════════════════════════════════════ */
function SessionCard({ session, onToggle, onDelete, onCopy, onDownload, onView, copied }) {
  const formUrl = `${FRONTEND_URL}/candidate-form/${session.token}`;
  const qrImg   = getQRUrl(formUrl, 180);
  const [toggling, setToggling] = React.useState(false);

  const isExpired = session.expiresAt && new Date() > new Date(session.expiresAt);
  const isActive  = session.active && !isExpired;

  const handleToggleClick = async () => {
    setToggling(true);
    await onToggle(session._id);
    setToggling(false);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md overflow-hidden ${!isActive ? 'opacity-70' : ''}`}>
      {/* Status bar */}
      <div className={`h-1 w-full ${isActive ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-slate-200'}`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-base truncate">{session.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Created {formatDate(session.createdAt)}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
            isExpired ? 'bg-orange-100 text-orange-600'
              : isActive ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {isExpired ? 'Expired' : isActive ? 'Active' : 'Paused'}
          </span>
        </div>

        {/* QR code */}
        <div className="flex justify-center mb-4">
          <div className={`p-3 rounded-xl border-2 ${isActive ? 'border-indigo-100 bg-indigo-50' : 'border-slate-100 bg-slate-50 grayscale'}`}>
            <img
              src={qrImg}
              alt="QR Code"
              width={130}
              height={130}
              className="block rounded"
            />
          </div>
        </div>

        {/* Submissions count */}
        <button
          onClick={onView}
          className="w-full flex items-center justify-between bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl px-4 py-2.5 mb-4 transition-all group"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:text-indigo-700">
            <Users className="w-4 h-4" />
            View Submissions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-indigo-600">
              {session.submissionCount ?? 0}
            </span>
            <ChevronDown className="w-4 h-4 text-indigo-400" />
          </span>
        </button>

        {/* Expiry info */}
        {session.expiresAt && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Clock className="w-3.5 h-3.5" />
            Expires: {formatDate(session.expiresAt)}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {/* Copy link */}
          <button
            onClick={() => onCopy(session.token, session._id)}
            title="Copy form link"
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-slate-600"
          >
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
          </button>

          {/* Download QR */}
          <button
            onClick={() => onDownload(session.token, session.label)}
            title="Download QR image"
            className="flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-slate-500"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Toggle active/inactive — labeled button */}
          {!isExpired && (
            <button
              onClick={handleToggleClick}
              disabled={toggling}
              title={isActive ? 'Click to Deactivate' : 'Click to Activate'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all disabled:opacity-60 ${
                isActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {toggling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isActive ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              {toggling ? '…' : isActive ? 'Active' : 'Inactive'}
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(session._id)}
            title="Delete session"
            className="flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all text-slate-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ SUBMISSIONS MODAL ════════════════════════════════════ */
function SubmissionsModal({ session, data, loading, search, onSearchChange, paged, page, totalPages, total, onPage, onClose, onDeleteSubmission }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> {session.label} — Submissions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{total} result{total !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, email, position…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="ml-3 text-slate-400 text-sm">Loading submissions…</span>
            </div>
          )}

          {!loading && paged.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-slate-500 font-medium">No submissions yet</p>
              <p className="text-slate-400 text-sm mt-1">Share the QR code to start collecting candidate details</p>
            </div>
          )}

          {!loading && paged.length > 0 && (
            <div className="space-y-3">
              {paged.map((sub) => (
                <SubmissionRow
                  key={sub._id}
                  sub={sub}
                  expanded={expanded === sub._id}
                  onToggle={() => setExpanded(expanded === sub._id ? null : sub._id)}
                  onDelete={() => onDeleteSubmission(sub._id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Single submission row ───────────────────────────────────────────────── */
function SubmissionRow({ sub, expanded, onToggle, onDelete }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-200 transition-colors">
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 select-none" onClick={onToggle}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {(sub.firstName?.[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">
            {sub.firstName} {sub.lastName}
          </p>
          <p className="text-xs text-slate-400 truncate">{sub.email} · {sub.contact}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {sub.position && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {sub.position}
            </span>
          )}
          <span className="text-xs text-slate-400">{formatDate(sub.submittedAt)}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <DetailItem icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={sub.email} />
            <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Mobile" value={sub.contact} />
            {sub.alternateNumber && <DetailItem icon={<Phone className="w-3.5 h-3.5" />} label="Alternate" value={sub.alternateNumber} />}
            {sub.gender && <DetailItem icon={<User className="w-3.5 h-3.5" />} label="Gender" value={sub.gender} />}
            {sub.dateOfBirth && <DetailItem icon={<Calendar className="w-3.5 h-3.5" />} label="DOB" value={sub.dateOfBirth} />}
            {sub.currentLocation && <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={sub.currentLocation} />}
            {sub.preferredLocation && <DetailItem icon={<MapPin className="w-3.5 h-3.5" />} label="Preferred" value={sub.preferredLocation} />}
            {sub.position && <DetailItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Position" value={sub.position} />}
            {sub.currentCompany && <DetailItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Company" value={sub.currentCompany} />}
            {sub.totalExperience && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Total Exp" value={`${sub.totalExperience} yrs`} />}
            {sub.relevantExperience && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Relevant Exp" value={`${sub.relevantExperience} yrs`} />}
            {sub.education && <DetailItem icon={<GraduationCap className="w-3.5 h-3.5" />} label="Education" value={sub.education} />}
            {sub.ctc && <DetailItem icon={<Banknote className="w-3.5 h-3.5" />} label="Current CTC" value={`${sub.ctc} LPA`} />}
            {sub.ectc && <DetailItem icon={<Banknote className="w-3.5 h-3.5" />} label="Expected CTC" value={`${sub.ectc} LPA`} />}
            {sub.noticePeriod && <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Notice Period" value={sub.noticePeriod} />}
            {sub.linkedin && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400 mb-0.5">LinkedIn</p>
                <a href={sub.linkedin.startsWith('http') ? sub.linkedin : `https://${sub.linkedin}`} target="_blank" rel="noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  {sub.linkedin} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {sub.skills && (
              <div className="col-span-full">
                <p className="text-xs text-slate-400 mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {sub.skills.split(',').map((sk) => sk.trim()).filter(Boolean).map((sk) => (
                    <span key={sk} className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">{sk}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">{icon}{label}</p>
      <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
    </div>
  );
}

/* ── Generic Modal ──────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" /> {title}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────────── */
function EmptyState({ onGenerate }) {
  return (
    <div className="text-center py-24 flex flex-col items-center">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-5">
        <QrCode className="w-12 h-12 text-indigo-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-700 mb-2">No QR Codes Yet</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-sm">
        Generate your first QR code to start collecting candidate registrations at walk-ins, job fairs, or campus drives.
      </p>
      <button
        onClick={onGenerate}
        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg"
      >
        <Plus className="w-4 h-4" /> Generate First QR Code
      </button>
    </div>
  );
}
