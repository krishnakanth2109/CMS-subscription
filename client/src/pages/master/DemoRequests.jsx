import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Search, Mail, Phone, Building2, CalendarClock, Clock3, User, MessageSquare, CircleAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const statusOptions = [
  { value: 'new', label: 'New', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'contacted', label: 'Contacted', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'scheduled', label: 'Scheduled', tone: 'bg-violet-50 text-violet-700 border-violet-100' },
  { value: 'closed', label: 'Closed', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
];

const statusLookup = statusOptions.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

const formatDateTime = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getRequestLabel = (item) => {
  const fullName = item.fullName || 'Demo Request';
  return fullName;
};

const getSearchText = (item) =>
  [item.fullName, item.workEmail, item.companyName, item.phoneNumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const formatPhoneNumber = (value) => {
  if (!value) return 'Not set';
  const digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }
  if (String(value).startsWith('+91 ')) return String(value);
  if (String(value).startsWith('+91')) return String(value).replace(/^\+91/, '+91 ');
  return String(value);
};

function DetailRow({ Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-0.5 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
            {value || 'Not set'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DemoRequests() {
  const { authHeaders } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/demo-requests`, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load demo requests.');
      }

      const list = Array.isArray(data) ? data : [];
      setRequests(list);

      if (!selectedId && list.length > 0) {
        setSelectedId(list[0]._id);
        if (list[0].isRead === false) {
          markAsRead(list[0]._id, list[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load demo requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch = !query || getSearchText(item).includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

  useEffect(() => {
    if (filteredRequests.length === 0) {
      setSelectedId('');
      return;
    }

    const currentSelected = filteredRequests.find((item) => item._id === selectedId);
    if (!currentSelected) {
      setSelectedId(filteredRequests[0]._id);
    }
  }, [filteredRequests, selectedId]);

  const selectedRequest = useMemo(
    () => requests.find((item) => item._id === selectedId) || null,
    [requests, selectedId],
  );

  const unreadCount = useMemo(
    () => requests.filter((item) => item.isRead === false).length,
    [requests],
  );

  const syncBadge = () => {
    window.dispatchEvent(new Event('demo-requests-updated'));
  };

  const markAsRead = async (requestId, requestItem = null) => {
    const target = requestItem || requests.find((item) => item._id === requestId);
    if (!target || target.isRead) return;

    try {
      setSavingId(requestId);
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/demo-requests/${requestId}/read`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to mark request as read.');
      }

      setRequests((prev) =>
        prev.map((item) =>
          item._id === requestId ? { ...item, isRead: true } : item,
        ),
      );
      syncBadge();
    } catch (err) {
      toast({
        title: 'Could not update request.',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingId('');
    }
  };

  const updateStatus = async (requestId, status) => {
    try {
      setSavingId(requestId);
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/demo-requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update request status.');
      }

      setRequests((prev) =>
        prev.map((item) =>
          item._id === requestId ? { ...item, status: data.demoRequest.status, isRead: true } : item,
        ),
      );
      syncBadge();
      toast({
        title: 'Status updated.',
        description: 'Demo request status has been saved.',
      });
    } catch (err) {
      toast({
        title: 'Could not update status.',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingId('');
    }
  };

  const handleSelect = (item) => {
    setSelectedId(item._id);
    if (item.isRead === false) {
      markAsRead(item._id, item);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Demo Requests</h1>
        <p className="text-sm text-slate-500">Review and manage incoming demo requests from the public form.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Requests</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{loading ? '...' : requests.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Unread</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{loading ? '...' : unreadCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Latest Status</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loading || requests.length === 0 ? '—' : statusLookup[requests[0].status]?.label || 'New'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Search name, email, company, phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All Statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadRequests}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Request List</h2>
            <p className="mt-0.5 text-xs text-slate-500">Click a request to view details and mark it as read.</p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="animate-pulse rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="h-4 w-32 rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-48 rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-36 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-700">No demo requests found</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Try a different search term or clear the status filter.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredRequests.map((item) => {
                  const status = statusLookup[item.status] || statusLookup.new;
                  const isSelected = item._id === selectedId;
                  const isUnread = item.isRead === false;

                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full px-5 py-4 text-left transition-colors hover:bg-slate-50 ${isSelected ? 'bg-blue-50/60' : ''
                        } ${isUnread ? 'border-l-4 border-l-blue-500' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-slate-900">{getRequestLabel(item)}</p>
                            {isUnread && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{item.companyName || 'No company set'}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <span className="truncate">{item.workEmail}</span>
                        <span className="truncate">{formatPhoneNumber(item.phoneNumber)}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                          <Building2 className="h-3 w-3" />
                          {item.companySize}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Request Details</h2>
            <p className="mt-0.5 text-xs text-slate-500">Status changes and read tracking update the badge automatically.</p>
          </div>

          <div className="p-5">
            {!selectedRequest ? (
              <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
                <User className="h-10 w-10 text-slate-300" />
                <p className="mt-4 text-sm font-semibold text-slate-700">Select a request to view details</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  The detail pane shows the full request, preferred demo time, and status controls.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-2xl font-bold tracking-tight text-slate-900">
                      {selectedRequest.fullName || 'Demo Request'}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-500">{selectedRequest.companyName || 'No company set'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedRequest.status}
                      onChange={(event) => updateStatus(selectedRequest._id, event.target.value)}
                      disabled={savingId === selectedRequest._id}
                      className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusLookup[selectedRequest.status]?.tone || statusLookup.new.tone}`}>
                    {statusLookup[selectedRequest.status]?.label || 'New'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {selectedRequest.isRead ? 'Read' : 'Unread'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Source: {selectedRequest.source || 'CMS Demo Request'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailRow Icon={Mail} label="Work Email" value={selectedRequest.workEmail} />
                  <DetailRow Icon={Phone} label="Phone Number" value={formatPhoneNumber(selectedRequest.phoneNumber)} />
                  <DetailRow Icon={Building2} label="Company Name" value={selectedRequest.companyName} />
                  <DetailRow Icon={Clock3} label="Company Size" value={selectedRequest.companySize} />
                  <DetailRow Icon={CalendarClock} label="Preferred Demo Time" value={formatDateTime(selectedRequest.preferredDemoTime)} />
                  <DetailRow Icon={CalendarClock} label="Created On" value={formatDateTime(selectedRequest.createdAt)} />
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Role / Designation</p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                    {selectedRequest.designation || 'Not set'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Message</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {selectedRequest.message || 'No message provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => markAsRead(selectedRequest._id)}
                    disabled={savingId === selectedRequest._id || selectedRequest.isRead}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {selectedRequest.isRead ? 'Already Read' : 'Mark as Read'}
                  </button>

                  <button
                    type="button"
                    onClick={loadRequests}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reload List
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
