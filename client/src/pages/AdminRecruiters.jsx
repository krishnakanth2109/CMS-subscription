import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, UserPlus, Search, Mail, Phone, TrendingUp,
  Download, Grid3X3, List, Edit, Trash2, UserX, UserCheck,
  Camera, Briefcase, MoreVertical, Users, Eye, EyeOff, ArrowUpDown, ShieldAlert,
  Loader2, Plus, ChevronDown
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { RecruiterDetailsTrigger } from "@/components/RecruiterDetailsModal";

// ── ENV ───────────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const getInitials = (fName = '', lName = '') =>
  `${fName.charAt(0)}${lName.charAt(0)}`.toUpperCase();

const getCandidateInitials = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getRecruiterName = (recruiter = {}) => {
  if (typeof recruiter === 'string') return recruiter;
  return (
    recruiter.name ||
    recruiter.fullName ||
    `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() ||
    recruiter.username ||
    recruiter.email ||
    'Unknown Recruiter'
  );
};

const getRecruiterKeys = (recruiter = {}) => {
  const data = typeof recruiter === 'string' ? { name: recruiter } : recruiter;
  return {
    ids: [
      data._id,
      data.id,
      data.userId,
      data.recruiterId,
      data.employeeId,
    ].filter(Boolean).map(String),
    names: [
      getRecruiterName(data),
      data.username,
      data.email,
    ].filter(Boolean).map(normalizeText),
  };
};

const getCandidateRecruiterValues = (candidate = {}) => {
  const recruiter = candidate.recruiterId || candidate.recruiter || candidate.assignedRecruiter;
  const values = [];

  if (recruiter && typeof recruiter === 'object') {
    values.push(recruiter._id, recruiter.id, recruiter.userId, recruiter.recruiterId, recruiter.employeeId);
    values.push(getRecruiterName(recruiter), recruiter.username, recruiter.email);
  } else {
    values.push(recruiter);
  }

  values.push(candidate.recruiterName, candidate.submittedByName, candidate.assignedRecruiterName);
  return values.filter(Boolean);
};

const candidateBelongsToRecruiter = (candidate, recruiter) => {
  if (!recruiter) return true;
  const recruiterKeys = getRecruiterKeys(recruiter);
  const candidateValues = getCandidateRecruiterValues(candidate);

  return candidateValues.some((value) => {
    const asString = String(value);
    return recruiterKeys.ids.includes(asString) || recruiterKeys.names.includes(normalizeText(value));
  });
};

const getStatusTagBadge = (statusStr) => {
  const s = statusStr || '';
  if (s === 'Joined') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
        Joined
      </Badge>
    );
  }
  if (s === 'Selected') {
    return (
      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
        Selected
      </Badge>
    );
  }
  if (s === 'Rejected') {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
        Rejected
      </Badge>
    );
  }
  if (s === 'Turnups') {
    return (
      <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
        Turnup
      </Badge>
    );
  }
  if (s === 'No Show') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
        No Show
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-955/20 dark:text-slate-400 dark:border-slate-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
      {s}
    </Badge>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminRecruiters() {
  const navigate = useNavigate();
  const { authHeaders } = useAuth();

  // ── Auth helper ──────────────────────────────────────────────────────────
  const getAuthHeader = async () => {
    const ah = await authHeaders();
    return {
      'Content-Type': 'application/json',
      ...ah,
    };
  };

  // ── Data ──────────────────────────────────────────────────────────────────
  const [recruiters, setRecruiters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  // FIX: Added openActionMenuId for custom menu control
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);

  const [selectedStatsRecruiters, setSelectedStatsRecruiters] = useState([]);
  const [statsModalTitle, setStatsModalTitle] = useState("");
  const [candidatesModalTitle, setCandidatesModalTitle] = useState("");
  const [candidateFilterType, setCandidateFilterType] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);
  const [recruiterToDelete, setRecruiterToDelete] = useState(null);
  const [recruiterToToggle, setRecruiterToToggle] = useState(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  // ── Password visibility ───────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // ── Errors ────────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

  // ── Success Banner ────────────────────────────────────────────────────────
  const [successBanner, setSuccessBanner] = useState({ show: false, message: '' });
  const showSuccess = (message) => {
    setSuccessBanner({ show: true, message });
    setTimeout(() => setSuccessBanner({ show: false, message: '' }), 4000);
  };

  // ── Form State ────────────────────────────────────────────────────────────
  const EMPTY_RECRUITER = {
    recruiterId: "", firstName: "", lastName: "", email: "", phone: "",
    username: "", password: "", profilePicture: "", role: "recruiter",
  };

  const [newRecruiter, setNewRecruiter] = useState(EMPTY_RECRUITER);
  const [editRecruiter, setEditRecruiter] = useState({ id: "", ...EMPTY_RECRUITER });

  // ── Performance ───────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [performanceData, setPerformanceData] = useState([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeader();
      const [rr, rc] = await Promise.all([
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/candidates?view=recruiters`, { headers }),
      ]);

      if (!rr.ok) { const e = await rr.json().catch(() => ({})); throw new Error(e.message || 'Failed to fetch users'); }
      if (!rc.ok) { const e = await rc.json().catch(() => ({})); throw new Error(e.message || 'Failed to fetch candidates'); }

      const recruiterData = await rr.json();
      const candidateData = await rc.json();

      const allUsers = recruiterData
        .filter((user) => ['recruiter', 'admin'].includes(user.role))
        .map((r) => ({ ...r, id: r._id }));

      setRecruiters(allUsers);
      setCandidates(candidateData.map((c) => ({ ...c, id: c._id })));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = (data, isEdit = false) => {
    const e = {};
    const nameRegex = /^[A-Za-z\s\-'.]+$/;

    // First Name
    if (!data.firstName.trim())
      e.firstName = "First name is required";
    else if (!nameRegex.test(data.firstName.trim()))
      e.firstName = "First name must contain letters only";
    else if (data.firstName.trim().length < 2)
      e.firstName = "First name must be at least 2 characters";

    // Last Name
    if (!data.lastName.trim())
      e.lastName = "Last name is required";
    else if (!nameRegex.test(data.lastName.trim()))
      e.lastName = "Last name must contain letters only";
    else if (data.lastName.trim().length < 2)
      e.lastName = "Last name must be at least 2 characters";

    // Email
    if (!data.email.trim())
      e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      e.email = "Enter a valid email address";

    // Phone (optional but must be 10 digits if filled)
    if (data.phone && !/^[6-9]\d{9}$/.test(data.phone))
      e.phone = "Enter a valid 10-digit mobile number";

    // Username (optional but letters only if filled)
    if (data.username && data.username.trim()) {
      if (/[^A-Za-z]/.test(data.username.trim()))
        e.username = "Username must contain letters only";
      else if (data.username.trim().length < 2)
        e.username = "Username must be at least 2 characters";
    }

    // Password
    if (!isEdit && !data.password)
      e.password = "Password is required";
    else if (data.password && data.password.length < 6)
      e.password = "Password must be at least 6 characters";

    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleInputChange = (field, value, isEdit) => {
    if ((field === 'firstName' || field === 'lastName') && value && /[^A-Za-z\s\-'.]/.test(value)) return;
    if (field === 'username' && value && /[^A-Za-z]/.test(value)) return;
    if (field === 'phone' && value && !/^\d*$/.test(value)) return;
    if (field === 'phone' && value.length > 10) return;

    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });

    if (isEdit) setEditRecruiter((p) => ({ ...p, [field]: value }));
    else setNewRecruiter((p) => ({ ...p, [field]: value }));
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAddRecruiter = async () => {
    if (!validateForm(newRecruiter)) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/recruiters`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newRecruiter),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      const addedName = `${newRecruiter.firstName} ${newRecruiter.lastName}`;
      const addedRole = newRecruiter.role;
      setRecruiters(prev => [...prev, { ...data, id: data._id }]);
      setShowModal(false);
      setNewRecruiter(EMPTY_RECRUITER);
      setErrors({});
      showSuccess(`Added ${addedName} successfully as ${addedRole}.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditRecruiter = async () => {
    if (!validateForm(editRecruiter, true)) return;
    try {
      const headers = await getAuthHeader();
      const payload = { ...editRecruiter };
      if (!payload.password) delete payload.password;

      const res = await fetch(`${API_URL}/recruiters/${editRecruiter.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update user');

      const editedName = `${editRecruiter.firstName} ${editRecruiter.lastName}`;
      setRecruiters(prev => prev.map(r => r.id === editRecruiter.id ? { ...r, ...data, id: data._id || r.id } : r));
      setShowEditModal(false);
      setErrors({});
      showSuccess(`Updated ${editedName}'s profile successfully.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteRecruiter = async () => {
    if (!recruiterToDelete) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/recruiters/${recruiterToDelete.id}`, {
        method: 'DELETE', headers,
      });
      if (!res.ok) throw new Error('Failed to delete user');

      const deletedName = `${recruiterToDelete.firstName} ${recruiterToDelete.lastName}`;
      setRecruiters(prev => prev.filter(r => r.id !== recruiterToDelete.id));
      setShowDeleteModal(false);
      setRecruiterToDelete(null);
      showSuccess(`Deleted ${deletedName} permanently.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async () => {
    if (!recruiterToToggle) return;
    const wasActive = isActive(recruiterToToggle);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/recruiters/${recruiterToToggle.id}/status`, {
        method: 'PATCH', headers,
      });
      if (!res.ok) throw new Error('Failed to update status');
      const toggledName = `${recruiterToToggle.firstName} ${recruiterToToggle.lastName}`;
      setRecruiters(prev => prev.map(r => r.id === recruiterToToggle.id ? { ...r, active: !wasActive } : r));
      setShowDeactivateModal(false);
      setRecruiterToToggle(null);
      showSuccess(wasActive
        ? `Deactivated ${toggledName}.`
        : `Activated ${toggledName}.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ── Modal openers ─────────────────────────────────────────────────────────
  const openEditModal = (r) => {
    // FIX: Close menu when opening modal
    setOpenActionMenuId(null);
    setEditRecruiter({
      id: r.id, recruiterId: r.recruiterId || "",
      firstName: r.firstName, lastName: r.lastName,
      email: r.email, phone: r.phone || "", username: r.username || "",
      profilePicture: r.profilePicture || "", role: r.role || "recruiter", password: "",
    });
    setErrors({});
    setShowEditModal(true);
  };

  // ── Profile Picture ───────────────────────────────────────────────────────
  const handleFileUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (isEdit) setEditRecruiter((p) => ({ ...p, profilePicture: result }));
      else setNewRecruiter((p) => ({ ...p, profilePicture: result }));
    };
    reader.readAsDataURL(file);
  };

  // ── Pre-computed stats map ──
  const statsMap = useMemo(() => {
    const map = {};
    recruiters.forEach(r => {
      map[r.id] = { total: 0, joined: 0, selected: 0, rejected: 0, turnups: 0, noShow: 0 };
    });

    candidates.forEach(c => {
      recruiters.forEach(r => {
        if (candidateBelongsToRecruiter(c, r)) {
          const rid = r.id;
          if (!map[rid]) map[rid] = { total: 0, joined: 0, selected: 0, rejected: 0, turnups: 0, noShow: 0 };
          const sa = Array.isArray(c.status) ? c.status : [c.status || ''];
          map[rid].total++;
          if (sa.includes('Joined')) map[rid].joined++;
          if (sa.includes('Selected')) map[rid].selected++;
          if (sa.includes('Rejected')) map[rid].rejected++;
          if (sa.includes('Turnups')) map[rid].turnups++;
          if (sa.includes('No Show')) map[rid].noShow++;
        }
      });
    });
    return map;
  }, [candidates, recruiters]);

  const calcStats = useCallback((recruiterId) => {
    return statsMap[recruiterId] || { total: 0, joined: 0, selected: 0, rejected: 0, turnups: 0, noShow: 0 };
  }, [statsMap]);

  const getCandidateStatusList = (candidate) => (
    Array.isArray(candidate.status) ? candidate.status : [candidate.status || '']
  );

  const candidateHasStatus = (candidate, status) => (
    getCandidateStatusList(candidate).includes(status)
  );

  const openCandidatesForRecruiter = (recruiter, filter, label) => {
    // FIX: Close menu when opening modal
    setOpenActionMenuId(null);
    setSelectedRecruiter(recruiter);
    setCandidatesModalTitle(`${label} — ${recruiter.firstName} ${recruiter.lastName}`);
    setCandidateFilterType(filter);
    setShowCandidatesModal(true);
    setModalSearchTerm("");
  };

  // ── Sort / Filter ────────
  const toggleSort = (field) => {
    if (sortField === field) setSortOrder((o) => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const SortIcon = ({ field }) =>
    sortField !== field
      ? <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
      : <span className="ml-1 text-indigo-600 dark:text-indigo-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>;

  const filteredRecruiters = useMemo(() => recruiters
    .filter((r) => {
      const q = searchTerm.toLowerCase();
      const fullName = `${r.firstName || ''} ${r.lastName || ''}`.toLowerCase();
      return fullName.includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.username || '').toLowerCase().includes(q) ||
        (r.recruiterId || '').toLowerCase().includes(q) ||
        (r.role || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const sa = calcStats(a.id), sb = calcStats(b.id);
      let av = '', bv = '';
      switch (sortField) {
        case 'name': av = a.firstName; bv = b.firstName; break;
        case 'email': av = a.email; bv = b.email; break;
        case 'id': av = a.recruiterId || ''; bv = b.recruiterId || ''; break;
        case 'total': av = sa.total; bv = sb.total; break;
        case 'joined': av = sa.joined; bv = sb.joined; break;
        case 'selected': av = sa.selected; bv = sb.selected; break;
        default: break;
      }
      return (av > bv ? 1 : -1) * (sortOrder === 'asc' ? 1 : -1);
    }), [recruiters, searchTerm, sortField, sortOrder, calcStats]);

  const filteredCandidatesForModal = useMemo(() => {
    if (!selectedRecruiter) return [];
    let list = candidates.filter((c) => candidateBelongsToRecruiter(c, selectedRecruiter));
    if (candidateFilterType === 'joined') list = list.filter((c) => candidateHasStatus(c, 'Joined'));
    if (candidateFilterType === 'selected') list = list.filter((c) => candidateHasStatus(c, 'Selected'));
    if (candidateFilterType === 'rejected') list = list.filter((c) => candidateHasStatus(c, 'Rejected'));
    if (candidateFilterType === 'turnups') list = list.filter((c) => candidateHasStatus(c, 'Turnups'));
    if (candidateFilterType === 'noShow') list = list.filter((c) => candidateHasStatus(c, 'No Show'));

    if (modalSearchTerm.trim()) {
      const query = modalSearchTerm.toLowerCase();
      list = list.filter((c) =>
        (c.name || "").toLowerCase().includes(query) ||
        (c.position || "").toLowerCase().includes(query) ||
        (c.client || "").toLowerCase().includes(query) ||
        (c.email || "").toLowerCase().includes(query) ||
        (c.contact || "").toLowerCase().includes(query)
      );
    }
    return list;
  }, [candidates, selectedRecruiter, candidateFilterType, modalSearchTerm]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const isActive = (r) => r.active !== false && r.active !== 'false';
  const isInactive = (r) => r.active === false || r.active === 'false';

  const totalR = recruiters.length;
  const activeR = recruiters.filter(isActive).length;
  const inactiveR = recruiters.filter(isInactive).length;

  const StatusBadge = ({ recruiter }) => {
    const active = recruiter.active !== false && recruiter.active !== 'false';
    return (
      <Badge variant="outline"
        className={active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-955/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-900/30 cursor-default transition-colors"
          : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-955/20 hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/30 cursor-default transition-colors"}>
        {active
          ? <><UserCheck className="h-3 w-3 mr-1 animate-pulse" />Active</>
          : <><UserX className="h-3 w-3 mr-1" />Inactive</>}
      </Badge>
    );
  };

  // ── Performance report ────────────────────────────────────────────────────
  const generatePerformanceData = () => {
    if (!startDate || !endDate) {
      toast({ title: "Error", description: "Select start and end dates.", variant: "destructive" });
      return;
    }
    const data = [];
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      data.push({
        date: d.toISOString().split("T")[0],
        submissions: Math.floor(Math.random() * 5),
        turnups: Math.floor(Math.random() * 3),
        joined: Math.floor(Math.random() * 2),
      });
    }
    setPerformanceData(data);
  };

  const downloadPDF = () => {
    if (!selectedRecruiter || !performanceData.length) return;
    const doc = new jsPDF();
    doc.text(`Performance Report: ${selectedRecruiter.firstName} ${selectedRecruiter.lastName}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [["Date", "Submissions", "Turnups", "Joined"]],
      body: performanceData.map((d) => [d.date, d.submissions, d.turnups, d.joined]),
    });
    doc.save(`${selectedRecruiter.firstName}_${selectedRecruiter.lastName}_report.pdf`);
  };

  // FIX: Custom ActionMenu component with proper positioning
  const ActionMenu = ({ recruiter, compactLabel = "Performance Report" }) => {
    const isOpen = openActionMenuId === recruiter.id;
    const active = isActive(recruiter);

    return (
      <div
        className="relative inline-flex"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpenActionMenuId(null);
          }
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${recruiter.firstName} ${recruiter.lastName}`}
          aria-expanded={isOpen}
          onClick={(event) => {
            event.stopPropagation();
            setOpenActionMenuId((current) => current === recruiter.id ? null : recruiter.id);
          }}
          className="h-8 w-8 rounded-lg shrink-0 text-slate-400 hover:text-slate-655 hover:bg-slate-50 dark:hover:text-slate-200 dark:hover:bg-slate-800"
        >
          <MoreVertical className="h-4.5 w-4.5" />
        </Button>

        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-sm text-gray-800 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800" onMouseDown={(e) => e.preventDefault()} onClick={() => openEditModal(recruiter)}>
              <Edit className="h-4 w-4" /> Edit Credentials
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSelectedRecruiter(recruiter); setShowPerformanceModal(true); setPerformanceData([]); }}>
              <TrendingUp className="h-4 w-4" /> {compactLabel}
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800" onMouseDown={(e) => e.preventDefault()} onClick={() => openCandidatesForRecruiter(recruiter, null, 'All Candidates')}>
              <Users className="h-4 w-4" /> View Candidates
            </button>
            <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${active ? 'text-amber-600' : 'text-emerald-600'}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setRecruiterToToggle(recruiter); setShowDeactivateModal(true); }}
            >
              {active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              {active ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-955/40" onMouseDown={(e) => e.preventDefault()} onClick={() => { setRecruiterToDelete(recruiter); setShowDeleteModal(true); }}>
              <Trash2 className="h-4 w-4" /> Delete Account
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50/30 py-8 px-4 text-slate-800 dark:bg-[#060608] dark:text-slate-100 sm:px-6 lg:px-8 font-sans">
      {/* Premium Background decoration gradient blobs */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-500/5 via-violet-500/2 to-transparent dark:from-indigo-500/5 pointer-events-none" />
      <div className="absolute top-12 right-12 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-12 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative">

        {/* ── Animated Success Toast Alert ─────────────────────────────── */}
        {successBanner.show && (
          <div className="fixed top-6 right-6 z-[9999] flex items-center gap-3.5 rounded-2xl bg-emerald-600 px-5 py-4 text-white shadow-2xl shadow-emerald-955/20 transition-all duration-300 animate-in fade-in slide-in-from-top-4 sm:slide-in-from-right-4 max-w-sm border border-emerald-500/30">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm tracking-wide">Success</div>
              <div className="text-xs text-white/90 mt-0.5">{successBanner.message}</div>
            </div>
            <button
              onClick={() => setSuccessBanner({ show: false, message: '' })}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Header Banner ────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-6 sm:p-8 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/40">
          <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 font-sans">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400">Admin Control Panel</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Users Management
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Create, update, and manage administrative agents and recruiters</p>
            </div>
            <Button
              onClick={() => { setShowModal(true); setErrors({}); setNewRecruiter(EMPTY_RECRUITER); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-155 py-5 px-6"
            >
              <UserPlus className="h-4 w-4 mr-2" /> Add New Recruiter
            </Button>
          </div>
        </div>

        {/* ── Summary Stats Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none font-sans">
          {/* Total Users */}
          <div
            onClick={() => { setSelectedStatsRecruiters(recruiters); setStatsModalTitle("All Users"); setShowStatsModal(true); }}
            className="group relative overflow-hidden rounded-3xl border border-indigo-500/10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 p-6 text-white shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-600/20 cursor-pointer dark:border-indigo-955/20"
          >
            <div className="absolute top-0 right-0 -mt-6 -mr-6 h-28 w-28 rounded-full bg-white/10 blur-xl transition-all group-hover:scale-110" />
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Total System Users</p>
                <p className="text-4xl font-extrabold tracking-tight">{totalR}</p>
              </div>
              <div className="rounded-2xl bg-white/20 p-3 text-white">
                <Users className="h-7 w-7" />
              </div>
            </div>
          </div>

          {/* Active Users */}
          <div
            onClick={() => { setSelectedStatsRecruiters(recruiters.filter(isActive)); setStatsModalTitle("Active Users"); setShowStatsModal(true); }}
            className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-emerald-500/20 transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer dark:border-slate-800/80 dark:bg-slate-900"
          >
            <div className="absolute top-0 right-0 -mt-6 -mr-6 h-28 w-28 rounded-full bg-emerald-50/40 blur-xl transition-all group-hover:scale-110 dark:bg-emerald-955/5" />
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Active Directory</p>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{activeR}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                <UserCheck className="h-7 w-7" />
              </div>
            </div>
          </div>

          {/* Inactive Users */}
          <div
            onClick={() => { setSelectedStatsRecruiters(recruiters.filter(isInactive)); setStatsModalTitle("Inactive Users"); setShowStatsModal(true); }}
            className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-rose-500/20 transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer dark:border-slate-800/80 dark:bg-slate-900"
          >
            <div className="absolute top-0 right-0 -mt-6 -mr-6 h-28 w-28 rounded-full bg-rose-50/40 blur-xl transition-all group-hover:scale-110 dark:bg-rose-955/5" />
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Inactive Accounts</p>
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{inactiveR}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-505 dark:bg-rose-950/20 dark:text-rose-400">
                <UserX className="h-7 w-7" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Controls Filter Bar ──────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/60 font-sans">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, ID, role…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-850 dark:bg-slate-950/65 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Sort:</span>
              <select
                 value={sortField}
                 onChange={(e) => setSortField(e.target.value)}
                 className="h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
               <option value="name">Name</option>
               <option value="email">Email</option>
               <option value="id">User ID</option>
               <option value="total">Candidates</option>
               <option value="joined">Joined</option>
               <option value="selected">Selected</option>
              </select>
            </div>

            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white dark:border-slate-800 dark:bg-slate-950 p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 rounded-lg"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="h-8 w-8 rounded-lg"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Main View Area ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          </div>
        ) : filteredRecruiters.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40">
            <Users className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-bold text-slate-850 dark:text-white">No users found</p>
            <p className="text-sm text-slate-400 mt-1">Try broadening your search term or filters.</p>
          </div>
        ) : (
          <>
            {/* ── Grid View ── */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 font-sans">
                {filteredRecruiters.map((r) => {
                  const st = calcStats(r.id);
                  const isAdmin = r.role === 'admin';
                  const isAct = isActive(r);
                  return (
                    <div
                      key={r.id}
                      className={`group relative overflow-visible rounded-2xl border bg-white p-6 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-305 dark:bg-slate-900/60 dark:backdrop-blur-sm ${!isAct
                          ? 'border-red-200/60 bg-red-50/5 dark:border-red-955/10'
                          : isAdmin
                            ? 'border-indigo-100 hover:border-indigo-200/80 dark:border-indigo-950/30'
                            : 'border-slate-200/80 hover:border-indigo-500/20 dark:border-slate-800/80'
                        }`}
                    >
                      {/* Top border highlight line */}
                      <div className={`absolute top-0 left-0 right-0 h-[3px] ${!isAct ? 'bg-red-500' :
                          isAdmin ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                        }`} />

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          {/* Circular Avatar with Gradient Ring */}
                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md overflow-hidden ring-4 ring-slate-100/50 dark:ring-slate-900/50 ${isAdmin
                              ? 'bg-gradient-to-tr from-indigo-500 to-purple-600'
                              : 'bg-gradient-to-tr from-blue-500 to-indigo-600'
                            }`}>
                            {r.profilePicture ? (
                              <img src={r.profilePicture} className="w-full h-full object-cover animate-fade-in" alt="avatar" />
                            ) : (
                              getInitials(r.firstName, r.lastName)
                            )}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <h3 className="font-bold text-slate-900 dark:text-white truncate text-base leading-tight">
                              <RecruiterDetailsTrigger recruiter={r} stats={st} candidates={candidates}>
                                <span className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors">
                                  {r.firstName} {r.lastName}
                                  {isAdmin && <ShieldAlert className="h-4 w-4 text-purple-505 flex-shrink-0" />}
                                </span>
                              </RecruiterDetailsTrigger>
                            </h3>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {r.recruiterId && (
                                <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                  {r.recruiterId}
                                </span>
                              )}
                              <StatusBadge recruiter={r} />
                            </div>
                          </div>
                        </div>

                        {/* FIX: Using custom ActionMenu instead of DropdownMenu */}
                        <ActionMenu recruiter={r} />
                      </div>

                      {/* Info lines (Email & Phone) */}
                      <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span title={r.email} className="truncate">{r.email || 'No email registered'}</span>
                        </div>
                        {r.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{r.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Metrics counts grid */}
                      <div className="mt-5 grid grid-cols-4 gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/60 text-center">
                        {[
                          { label: 'Total', val: st.total, filter: null, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 hover:bg-indigo-100/50 dark:bg-indigo-950/30' },
                          { label: 'Turnups', val: st.turnups, filter: 'turnups', color: 'text-teal-600 dark:text-teal-400 bg-teal-50/40 hover:bg-teal-100/50 dark:bg-teal-950/30' },
                          { label: 'Selected', val: st.selected, filter: 'selected', color: 'text-purple-600 dark:text-purple-400 bg-purple-50/40 hover:bg-purple-100/50 dark:bg-purple-950/30' },
                          { label: 'Joined', val: st.joined, filter: 'joined', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 hover:bg-emerald-100/50 dark:bg-emerald-950/30' },
                        ].map(({ label, val, filter, color }) => (
                          <div
                            key={label}
                            onClick={() => openCandidatesForRecruiter(r, filter, label)}
                            className={`cursor-pointer rounded-xl p-2 transition-all duration-150 hover:-translate-y-0.5 active:scale-95 ${color}`}
                          >
                            <div className="text-base font-extrabold">{val}</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-505 mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── List View ── */}
            {viewMode === "list" && (
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 overflow-hidden shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-sm font-sans">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:bg-slate-950/80 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-4.5 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors" onClick={() => toggleSort('name')}>
                          <span className="flex items-center">User Name <SortIcon field="name" /></span>
                        </th>
                        <th className="px-6 py-4.5 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors" onClick={() => toggleSort('id')}>
                          <span className="flex items-center">ID <SortIcon field="id" /></span>
                        </th>
                        <th className="px-6 py-4.5">System Role</th>
                        <th className="px-6 py-4.5">Status</th>
                        <th className="px-6 py-4.5 text-center cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors" onClick={() => toggleSort('total')}>
                          <span className="flex items-center justify-center">Total <SortIcon field="total" /></span>
                        </th>
                        <th className="px-6 py-4.5 text-center">Turnups</th>
                        <th className="px-6 py-4.5 text-center cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors" onClick={() => toggleSort('selected')}>
                          <span className="flex items-center justify-center">Selected <SortIcon field="selected" /></span>
                        </th>
                        <th className="px-6 py-4.5 text-center cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors" onClick={() => toggleSort('joined')}>
                          <span className="flex items-center justify-center">Joined <SortIcon field="joined" /></span>
                        </th>
                        <th className="px-6 py-4.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {filteredRecruiters.map((r) => {
                        const st = calcStats(r.id);
                        const isAdmin = r.role === 'admin';
                        const isAct = isActive(r);
                        return (
                          <tr key={r.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors duration-150 ${!isAct ? 'opacity-60 bg-red-50/5' :
                              isAdmin ? 'bg-indigo-50/5 dark:bg-indigo-955/5' : ''
                            }`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 text-white shadow-sm ring-2 ring-slate-100 dark:ring-slate-800 ${isAdmin ? 'bg-gradient-to-tr from-indigo-500 to-purple-600' : 'bg-gradient-to-tr from-blue-500 to-indigo-600'}`}>
                                  {r.profilePicture ? (
                                    <img src={r.profilePicture} className="w-full h-full object-cover" alt="avatar" />
                                  ) : (
                                    getInitials(r.firstName, r.lastName)
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <RecruiterDetailsTrigger recruiter={r} stats={st} candidates={candidates}>
                                    <span className="font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors">
                                      {r.firstName} {r.lastName}
                                      {isAdmin && <ShieldAlert className="h-3.5 w-3.5 text-purple-500 shrink-0 animate-pulse" />}
                                    </span>
                                  </RecruiterDetailsTrigger>
                                  <div className="text-[11px] text-slate-400 dark:text-slate-505 truncate mt-0.5" title={r.email}>{r.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500 dark:text-slate-450">{r.recruiterId || '-'}</td>
                            <td className="px-6 py-4 capitalize text-xs">
                              <span className={isAdmin ? 'text-purple-600 font-bold dark:text-purple-400' : 'text-slate-600 dark:text-slate-400 font-semibold'}>
                                {isAdmin ? 'Admin' : (r.role || 'Recruiter')}
                              </span>
                            </td>
                            <td className="px-6 py-4"><StatusBadge recruiter={r} /></td>
                            <td className="px-6 py-4 text-center font-extrabold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                              onClick={() => openCandidatesForRecruiter(r, null, 'All')}>
                              {st.total}
                            </td>
                            <td className="px-6 py-4 text-center font-extrabold text-teal-600 dark:text-teal-400 cursor-pointer hover:underline"
                              onClick={() => openCandidatesForRecruiter(r, 'turnups', 'Turnups')}>
                              {st.turnups}
                            </td>
                            <td className="px-6 py-4 text-center font-extrabold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline"
                              onClick={() => openCandidatesForRecruiter(r, 'selected', 'Selected')}>
                              {st.selected}
                            </td>
                            <td className="px-6 py-4 text-center font-extrabold text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline"
                              onClick={() => openCandidatesForRecruiter(r, 'joined', 'Joined')}>
                              {st.joined}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {/* FIX: Using custom ActionMenu instead of DropdownMenu */}
                              <ActionMenu recruiter={r} compactLabel="Performance" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            MODALS & DIALOGS
        ════════════════════════════════════════════════════════════ */}

        {/* ── Add User Modal ── */}
        <Dialog open={showModal} onClose={() => setShowModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-950/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white w-full max-w-xl rounded-[24px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-slate-100 transform transition-all duration-300 ease-out scale-100">
              <div className="bg-slate-50/80 border-b border-slate-100 px-6 py-5 dark:bg-slate-950/70 dark:border-slate-800">
                <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">Add New User</DialogTitle>
                <p className="text-xs text-slate-400 mt-1">Fill out the credentials to add an administrative user or recruiter.</p>
              </div>

              <div className="space-y-4 p-6 overflow-y-auto max-h-[70vh]">
                {/* Profile Photo Uploader */}
                <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 dark:bg-slate-955/10 dark:border-slate-800">
                  <div className="relative group h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    {newRecruiter.profilePicture ? (
                      <img src={newRecruiter.profilePicture} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, false)} />
                  <div className="space-y-1">
                    <Button variant="outline" size="sm" className="rounded-xl h-8.5 text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => fileInputRef.current?.click()}>Upload Avatar</Button>
                    <p className="text-[10px] text-slate-400">JPEG, PNG formats. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">User Identifier ID</label>
                    <Input value={newRecruiter.recruiterId}
                      onChange={(e) => handleInputChange('recruiterId', e.target.value, false)}
                      className="mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl"
                      placeholder="e.g., AGT088" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1 font-semibold">System Role <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        value={newRecruiter.role || 'recruiter'}
                        onChange={(e) => handleInputChange('role', e.target.value, false)}
                        className="w-full pl-4 pr-10 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-800 dark:bg-slate-955 rounded-xl text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white appearance-none cursor-pointer shadow-sm h-10"
                      >
                        <option value="recruiter">Recruiter</option>
                        <option value="admin">System Admin</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.firstName ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>First Name <span className="text-red-500">*</span></label>
                    <Input value={newRecruiter.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value, false)}
                      placeholder="Letters only"
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.firstName ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`} />
                    {errors.firstName && <p className="text-[10px] text-red-500 mt-1 font-semibold">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.lastName ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>Last Name <span className="text-red-500">*</span></label>
                    <Input value={newRecruiter.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value, false)}
                      placeholder="Letters only"
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.lastName ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`} />
                    {errors.lastName && <p className="text-[10px] text-red-500 mt-1 font-semibold">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.email ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>Email Address <span className="text-red-500">*</span></label>
                  <Input type="email" value={newRecruiter.email}
                    onChange={(e) => handleInputChange('email', e.target.value, false)}
                    placeholder="name@agency.com"
                    className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.email ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`} />
                  {errors.email && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Mobile Phone</label>
                    <Input value={newRecruiter.phone} maxLength={10}
                      onChange={(e) => handleInputChange('phone', e.target.value, false)}
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.phone ? "border-red-500" : ""}`}
                      placeholder="10 digits" />
                    {errors.phone && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Account Username</label>
                    <Input value={newRecruiter.username}
                      onChange={(e) => handleInputChange('username', e.target.value, false)}
                      placeholder="Letters only"
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.username ? "border-red-500" : ""}`} />
                    {errors.username && <p className="text-[10px] text-red-550 mt-1 font-semibold">{errors.username}</p>}
                  </div>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.password ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>Security Password <span className="text-red-500">*</span></label>
                  <div className="relative mt-1">
                    <Input type={showPassword ? "text" : "password"}
                      value={newRecruiter.password}
                      onChange={(e) => handleInputChange('password', e.target.value, false)}
                      className={`pr-10 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.password ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`}
                      placeholder="Min 6 characters" />
                    <button type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.password}</p>}
                </div>

                <div className="flex justify-end gap-2.5 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                  <Button variant="outline" className="rounded-xl px-5 h-10 border border-slate-200 text-slate-700 bg-white dark:bg-transparent dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={handleAddRecruiter} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-5 h-10 shadow-md">Create User</Button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Edit User Modal ── */}
        <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-950/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white w-full max-w-xl rounded-[24px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-slate-100 transform transition-all duration-300 ease-out scale-100">
              <div className="bg-slate-50/80 border-b border-slate-100 px-6 py-5 dark:bg-slate-950/70 dark:border-slate-800">
                <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">Edit User Credentials</DialogTitle>
                <p className="text-xs text-slate-400 mt-1">Make adjustments to the user's profiling and authorization records.</p>
              </div>

              <div className="space-y-4 p-6 overflow-y-auto max-h-[70vh]">
                {/* Photo uploader */}
                <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 dark:bg-slate-955/10 dark:border-slate-800">
                  <div className="relative group h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    {editRecruiter.profilePicture ? (
                      <img src={editRecruiter.profilePicture} className="w-full h-full object-cover" alt="edit-preview" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <input type="file" ref={editFileInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                  <div className="space-y-1">
                    <Button variant="outline" size="sm" className="rounded-xl h-8.5 text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => editFileInputRef.current?.click()}>Change Photo</Button>
                    <p className="text-[10px] text-slate-400">JPEG, PNG formats. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">User Identifier ID</label>
                    <Input value={editRecruiter.recruiterId}
                      onChange={(e) => handleInputChange('recruiterId', e.target.value, true)}
                      className="mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">System Role <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        value={editRecruiter.role || 'recruiter'}
                        onChange={(e) => handleInputChange('role', e.target.value, true)}
                        className="w-full pl-4 pr-10 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-800 dark:bg-slate-955 rounded-xl text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white appearance-none cursor-pointer shadow-sm h-10"
                      >
                        <option value="recruiter">Recruiter</option>
                        <option value="admin">System Admin</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.firstName ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>First Name <span className="text-red-500">*</span></label>
                    <Input value={editRecruiter.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value, true)}
                      placeholder="Letters only"
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.firstName ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`} />
                    {errors.firstName && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.lastName ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>Last Name <span className="text-red-500">*</span></label>
                    <Input value={editRecruiter.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value, true)}
                      placeholder="Letters only"
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.lastName ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`} />
                    {errors.lastName && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 transition-colors ${errors.email ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>Email Address <span className="text-red-505">*</span></label>
                  <Input type="email" value={editRecruiter.email}
                    onChange={(e) => handleInputChange('email', e.target.value, true)}
                    className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.email ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`} />
                  {errors.email && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Mobile Phone</label>
                    <Input value={editRecruiter.phone} maxLength={10}
                      onChange={(e) => handleInputChange('phone', e.target.value, true)}
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.phone ? "border-red-500" : ""}`} />
                    {errors.phone && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Account Username</label>
                    <Input value={editRecruiter.username}
                      onChange={(e) => handleInputChange('username', e.target.value, true)}
                      placeholder="Letters only"
                      className={`mt-1 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.username ? "border-red-500" : ""}`} />
                    {errors.username && <p className="text-[10px] text-red-550 mt-1 font-semibold">{errors.username}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-455 block mb-1">
                    Overwrite Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
                  </label>
                  <div className="relative mt-1">
                    <Input type={showEditPassword ? "text" : "password"}
                      value={editRecruiter.password}
                      onChange={(e) => handleInputChange('password', e.target.value, true)}
                      className={`pr-10 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl ${errors.password ? "border-red-500 focus-visible:ring-red-500 ring-2 ring-red-500/20" : ""}`}
                      placeholder="Leave blank to keep current password" />
                    <button type="button"
                      onClick={() => setShowEditPassword((p) => !p)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-650 transition-colors">
                      {showEditPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[10px] text-red-505 mt-1 font-semibold">{errors.password}</p>}
                </div>

                <div className="flex justify-end gap-2.5 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                  <Button variant="outline" className="rounded-xl px-5 h-10 border border-slate-200 text-slate-700 bg-white dark:bg-transparent dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-955 dark:hover:bg-slate-800 dark:hover:text-white" onClick={() => setShowEditModal(false)}>Cancel</Button>
                  <Button onClick={handleEditRecruiter} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-5 h-10 shadow-md">Update Profile</Button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Delete User Confirmation Modal ── */}
        <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-955/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:bg-[#0c0d12] dark:border-slate-800/80 text-slate-900 dark:text-slate-100 transform transition-all duration-300 ease-out scale-100 font-sans">
              <div className="flex flex-col items-center text-center gap-3.5">
                <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 dark:bg-rose-955/30">
                  <Trash2 className="h-7 w-7 animate-bounce" />
                </div>
                <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Permanently Delete User?
                </DialogTitle>
                <p className="text-slate-500 text-sm leading-relaxed dark:text-slate-400">
                  Are you absolutely sure you want to delete{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {recruiterToDelete?.firstName} {recruiterToDelete?.lastName}
                  </span>?
                  <br />
                  <span className="text-rose-600 text-xs font-bold mt-2 inline-block bg-rose-50 dark:bg-rose-955/40 px-3 py-1 rounded-lg">This action is irreversible. All records will be cleared.</span>
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 rounded-xl h-10 border border-slate-200 text-slate-700 bg-white dark:bg-transparent dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white"
                  onClick={() => { setShowDeleteModal(false); setRecruiterToDelete(null); }}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-10 shadow-lg shadow-red-500/10"
                  onClick={handleDeleteRecruiter}>
                  Confirm Delete
                </Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Status Toggling Confirmation Modal ── */}
        <Dialog open={showDeactivateModal} onClose={() => setShowDeactivateModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-955/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:bg-[#0c0d12] dark:border-slate-800/80 text-slate-900 dark:text-slate-100 transform transition-all duration-300 ease-out scale-100 font-sans">
              <div className="flex flex-col items-center text-center gap-3.5">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center ${recruiterToToggle && isActive(recruiterToToggle)
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-955/20'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-955/20'
                  }`}>
                  {recruiterToToggle && isActive(recruiterToToggle)
                    ? <UserX className="h-7 w-7" />
                    : <UserCheck className="h-7 w-7" />}
                </div>
                <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {recruiterToToggle && isActive(recruiterToToggle) ? 'Deactivate Account?' : 'Activate Account?'}
                </DialogTitle>
                <p className="text-slate-500 text-sm leading-relaxed dark:text-slate-400">
                  Are you sure you want to{" "}
                  <span className={`font-bold ${recruiterToToggle && isActive(recruiterToToggle) ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                  {recruiterToToggle && isActive(recruiterToToggle) ? 'deactivate' : 'activate'}
                  </span>{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {recruiterToToggle?.firstName} {recruiterToToggle?.lastName}
                  </span>?
                  {recruiterToToggle && isActive(recruiterToToggle) && (
                    <><br /><span className="text-amber-600 text-xs font-bold mt-2 inline-block bg-amber-50 dark:bg-amber-955/40 px-3 py-1 rounded-lg">
                      Deactivated users will be locked out of the panel.
                    </span></>
                  )}
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 rounded-xl h-10 border border-slate-200 text-slate-700 bg-white dark:bg-transparent dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white"
                  onClick={() => { setShowDeactivateModal(false); setRecruiterToToggle(null); }}>
                  Cancel
                </Button>
                <Button
                  className={`flex-1 text-white font-bold rounded-xl h-10 shadow-lg ${recruiterToToggle && isActive(recruiterToToggle)
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                    }`}
                  onClick={handleToggleStatus}>
                  {recruiterToToggle && isActive(recruiterToToggle) ? 'Deactivate User' : 'Activate User'}
                </Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Recruiter Performance Modal ── */}
        <Dialog open={showPerformanceModal} onClose={() => setShowPerformanceModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-955/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white w-full max-w-4xl rounded-[24px] shadow-2xl p-6 overflow-y-auto max-h-[90vh] border border-slate-100 dark:bg-[#0c0d12] dark:border-slate-800/80 transform transition-all duration-300 ease-out scale-100 font-sans">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-6">
                <div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Performance Analysis
                  </DialogTitle>
                  <p className="text-xs text-slate-400 mt-1">Review activity stats for recruiter: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedRecruiter?.firstName} {selectedRecruiter?.lastName}</span></p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800" onClick={() => setShowPerformanceModal(false)}>✕</Button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl dark:bg-slate-955/40 border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-455 block mb-1">Start Date</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 border-slate-200 dark:border-slate-855 dark:bg-slate-955 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-505 dark:text-slate-400 block mb-1">End Date</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 border-slate-200 dark:border-slate-855 dark:bg-slate-955 rounded-xl" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={generatePerformanceData} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold h-10 shadow-md">
                      Generate
                    </Button>
                    {performanceData.length > 0 && (
                      <Button onClick={downloadPDF} variant="outline" className="rounded-xl h-10 border-slate-200 text-slate-705 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white flex items-center justify-center gap-1.5 px-3">
                        <Download className="h-4 w-4" /> Export PDF
                      </Button>
                    )}
                  </div>
                </div>

                {performanceData.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl dark:border-slate-800">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-955 border-b border-slate-150 dark:border-slate-855">
                        <tr>
                          <th className="p-4">Date</th>
                          <th className="p-4 text-center">Submissions</th>
                          <th className="p-4 text-center">Turnups</th>
                          <th className="p-4 text-center">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/85">
                        {performanceData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                            <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{row.date}</td>
                            <td className="p-4 text-center text-slate-600 dark:text-slate-400">{row.submissions}</td>
                            <td className="p-4 text-center text-slate-600 dark:text-slate-400">{row.turnups}</td>
                            <td className="p-4 text-center text-slate-600 dark:text-slate-400">{row.joined}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl dark:border-slate-800">
                    <p className="text-sm text-slate-400 italic">Select start and end dates and click generate to visualize activity report.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <Button className="rounded-xl px-5 h-10 border-slate-200 text-slate-705 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white" variant="outline" onClick={() => setShowPerformanceModal(false)}>Close</Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Stats Listings Modal ── */}
        <Dialog open={showStatsModal} onClose={() => setShowStatsModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-955/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white w-full max-w-2xl rounded-[24px] shadow-2xl p-6 overflow-y-auto max-h-[90vh] border border-slate-100 dark:bg-[#0c0d12] dark:border-slate-800/80 text-slate-900 dark:text-slate-100 transform transition-all duration-300 ease-out scale-100 font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white">{statsModalTitle}</DialogTitle>
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800" onClick={() => setShowStatsModal(false)}>✕</Button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[60vh] overflow-y-auto pr-1">
                {selectedStatsRecruiters.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-3.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold overflow-hidden text-white shrink-0 shadow-sm ${r.role === 'admin' ? 'bg-gradient-to-tr from-indigo-500 to-purple-600' : 'bg-gradient-to-tr from-blue-500 to-indigo-600'}`}>
                        {r.profilePicture ? (
                          <img src={r.profilePicture} className="w-full h-full object-cover" alt="avatar" />
                        ) : (
                          getInitials(r.firstName, r.lastName)
                        )}
                      </div>
                      <div className="min-w-0">
                        <RecruiterDetailsTrigger recruiter={r} stats={calcStats(r.id)} candidates={candidates}>
                          <span className="font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1">
                            {r.firstName} {r.lastName}
                            {r.role === 'admin' && <ShieldAlert className="h-3.5 w-3.5 text-purple-600 shrink-0" />}
                          </span>
                        </RecruiterDetailsTrigger>
                        <div className="text-[10px] text-slate-455 capitalize font-medium mt-0.5">{r.role} • {r.email}</div>
                      </div>
                    </div>
                    <StatusBadge recruiter={r} />
                  </div>
                ))}
                {selectedStatsRecruiters.length === 0 && (
                  <p className="text-center text-slate-400 py-12 italic">No users available in this category.</p>
                )}
              </div>
              <div className="flex justify-end mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <Button className="rounded-xl px-5 h-10 border-slate-200 text-white dark:border-slate-705 dark:text-slate-300 hover:bg-slate-400 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white" variant="outline" onClick={() => setShowStatsModal(false)}>Close View</Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Candidates Listings Modal ── */}
        <Dialog open={showCandidatesModal} onClose={() => setShowCandidatesModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-slate-955/45 backdrop-blur-md transition-opacity duration-300" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white w-full max-w-5xl rounded-[24px] shadow-2xl p-6 overflow-hidden max-h-[90vh] border border-slate-100 flex flex-col dark:bg-[#0c0d12] dark:border-slate-800/80 text-slate-900 dark:text-slate-100 transform transition-all duration-300 ease-out scale-100 font-sans">

              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                      {candidatesModalTitle}
                    </DialogTitle>
                    <p className="text-xs text-slate-400 mt-0.5">Showing matching candidates mapped under this agent status</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800" onClick={() => setShowCandidatesModal(false)}>✕</Button>
              </div>

              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search candidate by name, role, email, phone, or client..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="pl-9 h-9 border-slate-200 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-955 rounded-xl text-sm"
                  />
                </div>
                <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-slate-505 dark:text-slate-400 shrink-0 text-center sm:text-left">
                  {filteredCandidatesForModal.length} Candidate{filteredCandidatesForModal.length !== 1 ? 's' : ''} Mapped
                </div>
              </div>

              {/* Scrollable Content Container */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden dark:border-slate-800/80">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-sm text-left border-collapse">
                    <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:bg-slate-955 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="p-4">Candidate Name</th>
                        <th className="p-4">Applied Role / Client</th>
                        <th className="p-4">Status Tag</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Phone contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredCandidatesForModal.length > 0 ? (
                        filteredCandidatesForModal.map((c, i) => {
                          const initials = getCandidateInitials(c.name);
                          return (
                            <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-700 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 shrink-0 border border-indigo-100/50 dark:border-indigo-955/20">
                                    {initials}
                                  </div>
                                  <span
                                    onClick={() => { setShowCandidatesModal(false); navigate(`/admin/candidates/${c.id}`); }}
                                    className="font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-650 dark:hover:text-indigo-400 cursor-pointer hover:underline transition-colors"
                                  >
                                    {c.name}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="font-semibold text-slate-700 dark:text-slate-300">{c.position}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{c.client}</div>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {(() => {
                                    const statusList = Array.isArray(c.status) ? c.status.filter(Boolean) : [c.status || ''];
                                    const lastStatus = statusList[statusList.length - 1];
                                    return lastStatus ? getStatusTagBadge(lastStatus) : null;
                                  })()}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1.5 text-slate-550 text-xs dark:text-slate-400">
                                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[180px]" title={c.email}>{c.email}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1.5 text-slate-555 text-xs dark:text-slate-400">
                                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>{c.contact}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-slate-400 dark:text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <UserX className="h-10 w-10 text-slate-300 dark:text-slate-700 animate-pulse" />
                              <p className="text-sm font-medium italic">No candidate records mapping to this selection query.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
                <Button className="rounded-xl px-5 h-10 border-slate-200 text-slate-750 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-955 dark:hover:bg-slate-800 dark:hover:text-white" variant="outline" onClick={() => setShowCandidatesModal(false)}>Close Mappings</Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

      </div>
    </div>
  );
}