// import { useState, useEffect, useMemo, useRef } from 'react';
// import { Textarea } from '@/components/ui/textarea';
// import {
//   Search, Plus, Eye, Loader2, MessageCircle,
//   ArrowUpDown, ArrowUp, ArrowDown, UserPlus
// } from 'lucide-react';
// import { useToast } from '@/hooks/use-toast';

// // ── ENV Config ────────────────────────────────────────────────────────────────
// const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// const API_URL = `${BASE_URL}/api`;

// const getAuthHeader = () => {
//   try {
//     const stored = sessionStorage.getItem('currentUser');
//     const token = stored ? JSON.parse(stored)?.idToken : null;
//     return {
//       Authorization: `Bearer ${token || ''}`,
//       'Content-Type': 'application/json',
//     };
//   } catch {
//     return { 'Content-Type': 'application/json' };
//   }
// };

// const inputCls = (err) =>
//   `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
//   } bg-white dark:bg-slate-800`;

// // ── StatCard Component ────────────────────────────────────────────────────────
// const StatCard = ({ title, value, colorTheme, active, onClick, hasDot }) => {
//   const themes = {
//     overall: 'bg-blue-600 text-white border-blue-700 dark:bg-blue-700',
//     shared: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200',
//     turnups: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200',
//     noshow: 'bg-neutral-300 text-black border-neutral-400 dark:bg-neutral-700 dark:text-white',
//     yetToAttend: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200',
//     selected: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/60 dark:text-green-200',
//     joined: 'bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200',
//     rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-200',
//     backout: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200',
//     hold: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/60 dark:text-orange-200',
//     pipeline: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200',
//   };
//   const themeClass = themes[colorTheme] || themes.overall;

//   return (
//     <div onClick={onClick} className={`relative p-4 rounded-xl shadow-sm border transition-all ${themeClass} ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${active ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : ''}`}>
//       {hasDot && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-white opacity-80"></span>}
//       <h3 className="text-2xl font-bold">{value}</h3>
//       <p className="text-sm mt-1 font-medium opacity-90">{title}</p>
//     </div>
//   );
// };

// // ── Helpers ───────────────────────────────────────────────────────────────────
// const getInitials = (name = '') => name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
// const getCandidateId = (c) => c.candidateId || c._id?.substring(c._id.length - 6).toUpperCase();

// const ALL_STATUSES = [
//   'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
//   'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
// ];

// const SOURCES = ['LinkedIn', 'Naukri', 'Indeed', 'Portal', 'Referral', 'Other'];

// // ── Main Component ────────────────────────────────────────────────────────────
// export default function AdminCandidates() {
//   const { toast } = useToast();

//   const [candidates, setCandidates] = useState([]);
//   const [recruiters, setRecruiters] = useState([]);
//   const [clients, setClients] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isParsingResume, setIsParsingResume] = useState(false);

//   const [searchTerm, setSearchTerm] = useState('');
//   const [statusFilter, setStatusFilter] = useState('all');
//   const [recruiterFilter, setRecruiterFilter] = useState('all');
//   const [activeStatFilter, setActiveStatFilter] = useState(null);
//   const [sortConfig, setSortConfig] = useState(null);
//   const [selectedIds, setSelectedIds] = useState([]);
//   const [bulkAssignRecruiterId, setBulkAssignRecruiterId] = useState(''); // New State for Bulk Assign

//   const [isDialogOpen, setIsDialogOpen] = useState(false);
//   const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
//   const [isEditMode, setIsEditMode] = useState(false);
//   const [selectedCandidateId, setSelectedCandidateId] = useState(null);
//   const [viewCandidate, setViewCandidate] = useState(null);
//   const [errors, setErrors] = useState({});

//   const initialFormData = {
//     firstName: '', lastName: '', contact: '', alternateNumber: '', email: '',
//     currentLocation: '', preferredLocation: '', position: '', client: '', currentCompany: '',
//     totalExperience: '', relevantExperience: '',
//     ctc: '', currentTakeHome: '', ectc: '', expectedTakeHome: '',
//     noticePeriod: '', servingNoticePeriod: 'false', lwd: '',
//     reasonForChange: '', offersInHand: 'false', offerPackage: '', source: 'Portal',
//     recruiterId: '', status: 'Submitted',
//     skills: ''
//   };
//   const [formData, setFormData] = useState(initialFormData);

//   const fetchData = async () => {
//     setLoading(true);
//     try {
//       const headers = getAuthHeader();
//       const [resCand, resRec, resCli] = await Promise.all([
//         fetch(`${API_URL}/candidates`, { headers }),
//         fetch(`${API_URL}/recruiters`, { headers }),
//         fetch(`${API_URL}/clients`, { headers }),
//       ]);

//       if (resCand.ok) {
//         const data = await resCand.json();
//         setCandidates(data);
//       }
//       if (resRec.ok) {
//         const data = await resRec.json();
//         setRecruiters(data);
//       }
//       if (resCli.ok) {
//         const data = await resCli.json();
//         setClients(data);
//       }
//     } catch (e) {
//       toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { fetchData(); }, []);

//   const handleInputChange = (field, value) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));
//     if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
//   };

//   const handleResumeUpload = async (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     // Validate size (5MB)
//     if (file.size > 5 * 1024 * 1024) {
//       toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
//       return;
//     }

//     // Validate type
//     const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
//     const validExtensions = ['.pdf', '.doc', '.docx'];
//     const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

//     if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
//       toast({ title: 'Error', description: 'Invalid file type. Only PDF, DOC, and DOCX are supported.', variant: 'destructive' });
//       return;
//     }

//     setIsParsingResume(true);

//     try {
//       const uploadFormData = new FormData();
//       uploadFormData.append('resume', file);

//       const headers = getAuthHeader();
//       delete headers['Content-Type']; // Let browser set multipart/form-data

//       const res = await fetch(`${API_URL}/candidates/parse-resume`, {
//         method: 'POST',
//         headers,
//         body: uploadFormData,
//       });

//       const result = await res.json();

//       if (!res.ok || !result.success) {
//         throw new Error(result.message || 'Failed to parse resume');
//       }

//       const { data } = result;

//       let fName = '', lName = '';
//       if (data.name) {
//         const nameParts = data.name.trim().split(' ');
//         fName = nameParts[0] || '';
//         lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
//       }

//       setFormData(prev => ({
//         ...prev,
//         firstName: prev.firstName || fName,
//         lastName: prev.lastName || lName,
//         email: prev.email || data.email || '',
//         contact: prev.contact || data.contact || '',
//         skills: prev.skills || data.skills || '',
//         totalExperience: prev.totalExperience || data.totalExperience || '',
//         currentCompany: prev.currentCompany || data.currentCompany || '',
//         currentLocation: prev.currentLocation || data.currentLocation || '',
//       }));

//       toast({ title: 'Success', description: 'Resume parsed successfully. Fields auto-filled.' });
//     } catch (error) {
//       console.error('Parsing error:', error);
//       toast({ title: 'Warning', description: 'Could not parse some details. Please fill manually.', variant: 'default' });
//     } finally {
//       setIsParsingResume(false);
//       e.target.value = ''; // Reset input
//     }
//   };

//   const validateForm = () => {
//     const e = {};
//     const d = formData;
//     if (!d.firstName.trim()) e.firstName = 'First Name required';
//     if (!d.lastName.trim()) e.lastName = 'Last Name required';
//     if (!d.email.trim()) e.email = 'Email required';
//     if (!d.contact.trim()) e.contact = 'Phone required';
//     if (!d.position.trim()) e.position = 'Role required';
//     if (!d.client.trim()) e.client = 'Client required';
//     if (d.servingNoticePeriod === 'true' && !d.lwd) e.lwd = 'LWD required';
//     if (d.offersInHand === 'true' && !d.offerPackage) e.offerPackage = 'Enter offer package';
//     setErrors(e);
//     return Object.keys(e).length === 0;
//   };

//   const handleSubmit = async () => {
//     if (!validateForm()) return;
//     setIsSubmitting(true);
//     try {
//       const url = isEditMode ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
//       const method = isEditMode ? 'PUT' : 'POST';

//       const payload = {
//         ...formData,
//         offersInHand: formData.offersInHand === 'true',
//         servingNoticePeriod: formData.servingNoticePeriod === 'true',
//       };

//       const res = await fetch(url, {
//         method, headers: getAuthHeader(), body: JSON.stringify(payload),
//       });

//       if (!res.ok) throw new Error(await res.text());
//       toast({ title: 'Success', description: `Candidate ${isEditMode ? 'updated' : 'added'}` });
//       setIsDialogOpen(false);
//       fetchData();
//     } catch (err) {
//       toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDelete = async (id) => {
//     if (!confirm('Are you sure you want to delete this candidate?')) return;
//     try {
//       await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() });
//       toast({ title: 'Deleted', description: 'Candidate removed' });
//       fetchData();
//     } catch (err) {
//       toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
//     }
//   };

//   // ── NEW: Bulk Assign Logic ──────────────────────────────────────────────────
//   const handleBulkAssign = async () => {
//     if (!bulkAssignRecruiterId) {
//       toast({ title: 'Error', description: 'Please select a recruiter to assign.', variant: 'destructive' });
//       return;
//     }
//     if (selectedIds.length === 0) return;

//     if (!confirm(`Assign ${selectedIds.length} candidate(s) to the selected recruiter?`)) return;

//     try {
//       const res = await fetch(`${API_URL}/candidates/bulk-assign`, {
//         method: 'PUT',
//         headers: getAuthHeader(),
//         body: JSON.stringify({
//           candidateIds: selectedIds,
//           recruiterId: bulkAssignRecruiterId
//         })
//       });

//       const result = await res.json();
//       if (!res.ok) throw new Error(result.message);

//       toast({ title: 'Success', description: result.message });
//       setSelectedIds([]);
//       setBulkAssignRecruiterId('');
//       fetchData();
//     } catch (err) {
//       toast({ title: 'Error', description: err.message || 'Bulk assign failed', variant: 'destructive' });
//     }
//   };

//   // ── Dialogs ────────────────────────────────────────────────────────────────
//   const openAddDialog = () => {
//     setIsEditMode(false);
//     setSelectedCandidateId(null);
//     setFormData(initialFormData);
//     setErrors({});
//     setIsDialogOpen(true);
//   };

//   const openEditDialog = (c) => {
//     setIsEditMode(true);
//     setSelectedCandidateId(c._id);
//     setFormData({
//       firstName: c.firstName || '',
//       lastName: c.lastName || '',
//       contact: c.contact || '',
//       alternateNumber: c.alternateNumber || '',
//       email: c.email || '',
//       currentLocation: c.currentLocation || '',
//       preferredLocation: c.preferredLocation || '',
//       position: c.position || '',
//       client: c.client || '',
//       currentCompany: c.currentCompany || '',
//       totalExperience: c.totalExperience || '',
//       relevantExperience: c.relevantExperience || '',
//       ctc: c.ctc || '',
//       currentTakeHome: c.currentTakeHome || '',
//       ectc: c.ectc || '',
//       expectedTakeHome: c.expectedTakeHome || '',
//       noticePeriod: c.noticePeriod || '',
//       servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
//       lwd: c.lwd ? new Date(c.lwd).toISOString().split('T')[0] : '',
//       reasonForChange: c.reasonForChange || '',
//       offersInHand: c.offersInHand ? 'true' : 'false',
//       offerPackage: c.offerPackage || '',
//       source: c.source || 'Portal',
//       status: Array.isArray(c.status) ? c.status[0] : c.status || 'Submitted',
//       recruiterId: typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId || '',
//       skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || ''
//     });
//     setErrors({});
//     setIsDialogOpen(true);
//   };

//   const handleSort = (key) => {
//     let direction = 'asc';
//     if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
//     setSortConfig({ key, direction });
//   };

//   const SortIcon = ({ field }) => {
//     if (!sortConfig || sortConfig.key !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
//     return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500" /> : <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
//   };

//   const filteredCandidates = useMemo(() => {
//     let result = candidates.filter((c) => {
//       const matchSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.candidateId || '').toLowerCase().includes(searchTerm.toLowerCase());
//       const statusArr = Array.isArray(c.status) ? c.status : [c.status || ''];
//       const matchStatus = statusFilter === 'all' || statusArr.includes(statusFilter);
//       const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
//       const matchRec = recruiterFilter === 'all' || recId === recruiterFilter;
//       const statMatch = activeStatFilter ? statusArr.includes(activeStatFilter) : true;
//       return matchSearch && matchStatus && matchRec && statMatch;
//     });

//     if (sortConfig) {
//       result.sort((a, b) => {
//         const av = a[sortConfig.key] || '';
//         const bv = b[sortConfig.key] || '';
//         if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
//         if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
//         return 0;
//       });
//     }
//     return result;
//   }, [candidates, searchTerm, statusFilter, recruiterFilter, activeStatFilter, sortConfig]);

//   const stats = useMemo(() => {
//     const count = (s) => candidates.filter((c) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s)).length;
//     return {
//       total: candidates.length, turnups: count('Turnups'), noShow: count('No Show'), yetToAttend: count('Yet to attend'),
//       selected: count('Selected'), rejected: count('Rejected'), hold: count('Hold'), pipeline: count('Pipeline'),
//       joined: count('Joined'), backout: count('Backout'), sharedProfiles: count('Shared Profiles'),
//     };
//   }, [candidates]);

//   // Bulk Selection Logic
//   const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
//   const toggleSelectAll = () => setSelectedIds(selectedIds.length === filteredCandidates.length ? [] : filteredCandidates.map(c => c._id));

//   // Bulk Delete
//   const handleBulkDelete = async () => {
//     if (!selectedIds.length || !confirm(`Delete ${selectedIds.length} candidate(s)?`)) return;
//     try {
//       await Promise.all(selectedIds.map(id => fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() })));
//       toast({ title: 'Deleted', description: `${selectedIds.length} candidates removed` });
//       setSelectedIds([]);
//       fetchData();
//     } catch {
//       toast({ title: 'Error', description: 'Bulk delete failed', variant: 'destructive' });
//     }
//   };

//   const handleWhatsApp = (c) => {
//     if (!c.contact) return;
//     let phone = c.contact.replace(/\D/g, '');
//     if (phone.length === 10) phone = '91' + phone;
//     const msg = `Hi ${c.firstName || c.name.split(' ')[0]}, regarding your application for ${c.position} at ${c.client}.`;
//     window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
//   };

//   return (
//     <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 min-h-screen">
//       <div className="max-w-[1800px] mx-auto space-y-6">

//         {/* Header */}
//         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
//           <div>
//             <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Candidate Database</h1>
//             <p className="text-slate-500 mt-1">Manage and track pipeline across all sources</p>
//           </div>

//           <div className="flex items-center gap-3 flex-wrap">
//             {selectedIds.length > 0 && (
//               <div className="flex items-center gap-2 bg-white p-1 pr-2 rounded-lg border shadow-sm">
//                 <select
//                   value={bulkAssignRecruiterId}
//                   onChange={(e) => setBulkAssignRecruiterId(e.target.value)}
//                   className="text-sm border-none focus:ring-0 bg-transparent py-1.5 pl-2"
//                 >
//                   <option value="">Select Recruiter to Assign</option>
//                   {recruiters.map(r => <option key={r._id || r.id} value={r._id || r.id}>{r.name}</option>)}
//                 </select>
//                 <button onClick={handleBulkAssign} className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 flex items-center gap-1">
//                   <UserPlus className="h-3 w-3" /> Assign ({selectedIds.length})
//                 </button>
//                 <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
//                 <button onClick={handleBulkDelete} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md text-xs font-medium">
//                   Delete
//                 </button>
//               </div>
//             )}
//             <button onClick={openAddDialog} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
//               <Plus className="h-4 w-4" /> Add Candidate
//             </button>
//           </div>
//         </div>

//         {/* Stats */}
//         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//           <StatCard title="Overall Submissions" value={stats.total} colorTheme="overall" hasDot={true} active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} />
//           <StatCard title="Turnups" value={stats.turnups} colorTheme="turnups" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} />
//           <StatCard title="No Show" value={stats.noShow} colorTheme="noshow" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} />
//           <StatCard title="Yet to attend" value={stats.yetToAttend} colorTheme="yetToAttend" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} />
//           <StatCard title="Selected" value={stats.selected} colorTheme="selected" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} />
//           <StatCard title="Rejected" value={stats.rejected} colorTheme="rejected" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} />
//         </div>
//         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
//           <StatCard title="Hold" value={stats.hold} colorTheme="hold" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
//           <StatCard title="Pipeline" value={stats.pipeline} colorTheme="pipeline" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} />
//           <StatCard title="Joined" value={stats.joined} colorTheme="joined" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} />
//           <StatCard title="Backout" value={stats.backout} colorTheme="backout" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
//           <StatCard title="Shared Profiles" value={stats.sharedProfiles} colorTheme="shared" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
//         </div>

//         {/* Filters */}
//         <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white shadow-sm">
//           <div className="flex flex-col md:flex-row gap-4 justify-between">
//             <div className="relative w-full md:max-w-md">
//               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
//               <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, email, ID..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
//             </div>
//             <div className="flex gap-3 w-full md:w-auto">
//               <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
//                 <option value="all">All Status</option>
//                 {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
//               </select>
//               <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
//                 <option value="all">All Recruiters</option>
//                 {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{r.name}</option>)}
//               </select>
//             </div>
//           </div>
//         </div>

//         {/* Table */}
//         <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
//           {loading ? (
//             <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-sm text-left border-collapse">
//                 <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="px-4 py-3 w-10">
//                       <input type="checkbox" checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-slate-300" />
//                     </th>
//                     <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
//                     <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('name')}>Name <SortIcon field="name" /></th>
//                     <th className="px-4 py-3">Phone</th>
//                     <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('position')}>Role <SortIcon field="position" /></th>
//                     <th className="px-4 py-3">Recruiter</th>
//                     <th className="px-4 py-3">Status</th>
//                     <th className="px-4 py-3">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {filteredCandidates.map((c) => {
//                     const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
//                     const recName = typeof c.recruiterId === 'object' ? c.recruiterId?.name : c.recruiterName || '-';

//                     return (
//                       <tr key={c._id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(c._id) ? 'bg-blue-50' : ''}`}>
//                         <td className="px-4 py-3">
//                           <input type="checkbox" checked={selectedIds.includes(c._id)} onChange={() => toggleSelect(c._id)} className="h-4 w-4 rounded border-slate-300" />
//                         </td>
//                         <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold cursor-pointer" onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: 'Copied!' }); }}>{getCandidateId(c)}</td>
//                         <td className="px-4 py-3">
//                           <div className="flex items-center gap-2">
//                             <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">{getInitials(c.name)}</div>
//                             <div>
//                               <div className="font-medium text-slate-900">{c.name}</div>
//                               <div className="text-xs text-slate-400">{c.email}</div>
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-4 py-3 text-slate-500">{c.contact || '-'}</td>
//                         <td className="px-4 py-3">
//                           <div className="font-medium text-slate-900">{c.position || '-'}</div>
//                           <div className="text-xs text-slate-400">{c.client || '-'}</div>
//                         </td>
//                         <td className="px-4 py-3 text-slate-600">{recName}</td>
//                         <td className="px-4 py-3">
//                           {statusArr.map((s) => (
//                             <span key={s} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-1">{s}</span>
//                           ))}
//                         </td>
//                         <td className="px-4 py-3">
//                           <div className="flex items-center gap-1">
//                             <button onClick={() => handleWhatsApp(c)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md" title="WhatsApp"><MessageCircle className="h-4 w-4" /></button>
//                             <button onClick={() => setViewCandidate(c) || setIsViewDialogOpen(true)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="View"><Eye className="h-4 w-4" /></button>
//                             <button onClick={() => openEditDialog(c)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md text-xs font-medium">Edit</button>
//                             <button onClick={() => handleDelete(c._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md text-xs font-medium">Del</button>
//                           </div>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ── Add / Edit Full Screen Dialog ──────────────────────────────────── */}
//       {isDialogOpen && (
//         <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
//           <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
//             <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
//               <div>
//                 <h2 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Candidate' : 'Add New Candidate'}</h2>
//                 <p className="text-sm text-slate-500 mt-0.5">Fill out all the details required for the candidate profile.</p>
//               </div>
//               <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2">×</button>
//             </div>

//             <div className="p-6 overflow-y-auto flex-1 space-y-8">

//               {/* SECTION 0: Resume Upload */}
//               {!isEditMode && (
//                 <section>
//                   <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Upload Resume (Auto Fill)</h3>
//                   <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
//                     {isParsingResume ? (
//                       <div className="flex flex-col items-center">
//                         <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
//                         <p className="text-sm text-blue-800 font-medium">Parsing resume details...</p>
//                       </div>
//                     ) : (
//                       <>
//                         <div className="bg-white p-3 rounded-full mb-3 shadow-sm border border-blue-100">
//                           <Plus className="h-6 w-6 text-blue-600" />
//                         </div>
//                         <p className="text-sm text-slate-600 mb-4 text-center">
//                           Upload a CV to automatically fill candidate details.<br />
//                           <span className="text-xs text-slate-400">Supported: PDF, DOC, DOCX (Max 5MB)</span>
//                         </p>
//                         <input
//                           type="file"
//                           id="resume-upload"
//                           className="hidden"
//                           accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//                           onChange={handleResumeUpload}
//                         />
//                         <label
//                           htmlFor="resume-upload"
//                           className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer transition shadow-sm"
//                         >
//                           Browse Files
//                         </label>
//                       </>
//                     )}
//                   </div>
//                 </section>
//               )}

//               {/* SECTION 1: Personal Info */}
//               <section>
//                 <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Personal Information</h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">First Name *</label>
//                     <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} className={inputCls(errors.firstName)} />
//                     {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Last Name *</label>
//                     <input type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} className={inputCls(errors.lastName)} />
//                     {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Contact Number *</label>
//                     <input type="text" value={formData.contact} onChange={(e) => handleInputChange('contact', e.target.value)} className={inputCls(errors.contact)} />
//                     {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Alternate Number</label>
//                     <input type="text" value={formData.alternateNumber} onChange={(e) => handleInputChange('alternateNumber', e.target.value)} className={inputCls(false)} />
//                   </div>
//                   <div className="md:col-span-2">
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
//                     <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className={inputCls(errors.email)} />
//                     {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Current Location</label>
//                     <input type="text" value={formData.currentLocation} onChange={(e) => handleInputChange('currentLocation', e.target.value)} className={inputCls(false)} />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Preferred Location</label>
//                     <input type="text" value={formData.preferredLocation} onChange={(e) => handleInputChange('preferredLocation', e.target.value)} className={inputCls(false)} />
//                   </div>
//                 </div>
//               </section>

//               {/* SECTION 2: Professional Info */}
//               <section>
//                 <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Professional Details</h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Role (Position) *</label>
//                     <input type="text" value={formData.position} onChange={(e) => handleInputChange('position', e.target.value)} className={inputCls(errors.position)} />
//                     {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Client / Target Company *</label>
//                     <select value={formData.client} onChange={(e) => handleInputChange('client', e.target.value)} className={inputCls(errors.client)}>
//                       <option value="">Select Client</option>
//                       {clients.map(c => (
//                         <option key={c._id} value={c.companyName || c.name}>{c.companyName || c.name}</option>
//                       ))}
//                     </select>
//                     {errors.client && <p className="text-xs text-red-500 mt-1">{errors.client}</p>}
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Current Company</label>
//                     <input type="text" value={formData.currentCompany} onChange={(e) => handleInputChange('currentCompany', e.target.value)} className={inputCls(false)} />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Reason for Change</label>
//                     <input type="text" value={formData.reasonForChange} onChange={(e) => handleInputChange('reasonForChange', e.target.value)} className={inputCls(false)} />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Total Experience (Years)</label>
//                     <input type="text" value={formData.totalExperience} onChange={(e) => handleInputChange('totalExperience', e.target.value)} className={inputCls(false)} placeholder="e.g. 5" />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Relevant Experience (Years)</label>
//                     <input type="text" value={formData.relevantExperience} onChange={(e) => handleInputChange('relevantExperience', e.target.value)} className={inputCls(false)} placeholder="e.g. 3" />
//                   </div>
//                   <div className="md:col-span-2">
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Skills (Comma Separated)</label>
//                     <input type="text" value={formData.skills} onChange={(e) => handleInputChange('skills', e.target.value)} className={inputCls(false)} placeholder="React, Node, Python..." />
//                   </div>
//                 </div>
//               </section>

//               {/* SECTION 3: Compensation & Availability */}
//               <section>
//                 <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Financial & Availability</h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div className="flex flex-col sm:flex-row gap-2">
//                     <div className="w-full sm:w-1/2">
//                       <label className="block text-sm font-medium mb-1 text-slate-700">Current CTC</label>
//                       <input type="text" value={formData.ctc} onChange={(e) => handleInputChange('ctc', e.target.value)} className={inputCls(false)} placeholder="e.g. 10 LPA" />
//                     </div>
//                     <div className="w-full sm:w-1/2">
//                       <label className="block text-sm font-medium mb-1 text-slate-700">Current Take Home</label>
//                       <input type="text" value={formData.currentTakeHome} onChange={(e) => handleInputChange('currentTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 60k/mo" />
//                     </div>
//                   </div>

//                   <div className="flex flex-col sm:flex-row gap-2">
//                     <div className="w-full sm:w-1/2">
//                       <label className="block text-sm font-medium mb-1 text-slate-700">Expected CTC</label>
//                       <input type="text" value={formData.ectc} onChange={(e) => handleInputChange('ectc', e.target.value)} className={inputCls(false)} placeholder="e.g. 15 LPA" />
//                     </div>
//                     <div className="w-full sm:w-1/2">
//                       <label className="block text-sm font-medium mb-1 text-slate-700">Expected Take Home</label>
//                       <input type="text" value={formData.expectedTakeHome} onChange={(e) => handleInputChange('expectedTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 90k/mo" />
//                     </div>
//                   </div>

//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Notice Period (N/P)</label>
//                     <input type="text" value={formData.noticePeriod} onChange={(e) => handleInputChange('noticePeriod', e.target.value)} className={inputCls(false)} placeholder="e.g. 30 Days" />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Serving Notice Period?</label>
//                     <select value={formData.servingNoticePeriod} onChange={(e) => handleInputChange('servingNoticePeriod', e.target.value)} className={inputCls(false)}>
//                       <option value="false">No</option>
//                       <option value="true">Yes</option>
//                     </select>
//                   </div>

//                   {formData.servingNoticePeriod === 'true' && (
//                     <div>
//                       <label className="block text-sm font-medium mb-1 text-slate-700">LWD (Last Working Day) *</label>
//                       <input type="date" value={formData.lwd} onChange={(e) => handleInputChange('lwd', e.target.value)} className={inputCls(errors.lwd)} />
//                       {errors.lwd && <p className="text-xs text-red-500 mt-1">{errors.lwd}</p>}
//                     </div>
//                   )}

//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Offer in Hand?</label>
//                     <select value={formData.offersInHand} onChange={(e) => handleInputChange('offersInHand', e.target.value)} className={inputCls(false)}>
//                       <option value="false">No</option>
//                       <option value="true">Yes</option>
//                     </select>
//                   </div>

//                   {formData.offersInHand === 'true' && (
//                     <div>
//                       <label className="block text-sm font-medium mb-1 text-slate-700">Package in Hand *</label>
//                       <input type="text" value={formData.offerPackage} onChange={(e) => handleInputChange('offerPackage', e.target.value)} className={inputCls(errors.offerPackage)} placeholder="e.g. 15 LPA" />
//                       {errors.offerPackage && <p className="text-xs text-red-500 mt-1">{errors.offerPackage}</p>}
//                     </div>
//                   )}
//                 </div>
//               </section>

//               {/* SECTION 4: Tracking & Assignment */}
//               <section>
//                 <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Tracking & Assignment</h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Source</label>
//                     <select value={formData.source} onChange={(e) => handleInputChange('source', e.target.value)} className={inputCls(false)}>
//                       {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
//                     </select>
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Status</label>
//                     <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className={inputCls(false)}>
//                       {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
//                     </select>
//                   </div>
//                   <div className="md:col-span-2">
//                     <label className="block text-sm font-medium mb-1 text-slate-700">Assign Recruiter</label>
//                     <select value={formData.recruiterId} onChange={(e) => handleInputChange('recruiterId', e.target.value)} className={inputCls(false)}>
//                       <option value="">Select Recruiter</option>
//                       {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
//                     </select>
//                   </div>
//                 </div>
//               </section>

//             </div>

//             <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
//               <button onClick={() => setIsDialogOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
//               <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
//                 {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
//                 {isSubmitting ? 'Saving...' : isEditMode ? 'Update Profile' : 'Save Candidate'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── View Full Details Dialog ────────────────────────────────────────── */}
//       {isViewDialogOpen && viewCandidate && (
//         <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
//           <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
//             <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
//               <div>
//                 <h2 className="text-xl font-bold text-slate-900">{viewCandidate.name}</h2>
//                 <p className="text-sm font-mono text-blue-600 mt-1">{getCandidateId(viewCandidate)}</p>
//               </div>
//               <button onClick={() => setIsViewDialogOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none px-2">×</button>
//             </div>
//             <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
//               <div className="grid grid-cols-2 gap-4">
//                 {[
//                   ['First Name', viewCandidate.firstName],
//                   ['Last Name', viewCandidate.lastName],
//                   ['Email', viewCandidate.email],
//                   ['Contact', viewCandidate.contact],
//                   ['Alt Contact', viewCandidate.alternateNumber],
//                   ['Role', viewCandidate.position],
//                   ['Client', viewCandidate.client],
//                   ['Current Company', viewCandidate.currentCompany],
//                   ['Current Location', viewCandidate.currentLocation],
//                   ['Preferred Location', viewCandidate.preferredLocation],
//                   ['Total Exp', viewCandidate.totalExperience ? `${viewCandidate.totalExperience} Yrs` : null],
//                   ['Relevant Exp', viewCandidate.relevantExperience ? `${viewCandidate.relevantExperience} Yrs` : null],
//                   ['Current CTC', viewCandidate.ctc],
//                   ['Current Take Home', viewCandidate.currentTakeHome],
//                   ['Expected CTC', viewCandidate.ectc],
//                   ['Expected Take Home', viewCandidate.expectedTakeHome],
//                   ['Notice Period', viewCandidate.noticePeriod],
//                   ['Serving Notice?', viewCandidate.servingNoticePeriod ? 'Yes' : 'No'],
//                   ['LWD', viewCandidate.lwd ? new Date(viewCandidate.lwd).toLocaleDateString() : null],
//                   ['Reason for Change', viewCandidate.reasonForChange],
//                   ['Offers in Hand', viewCandidate.offersInHand ? `Yes (${viewCandidate.offerPackage})` : 'No'],
//                   ['Source', viewCandidate.source],
//                   ['Assigned Recruiter', typeof viewCandidate.recruiterId === 'object' ? viewCandidate.recruiterId?.name : viewCandidate.recruiterName],
//                   ['Status', Array.isArray(viewCandidate.status) ? viewCandidate.status.join(', ') : viewCandidate.status]
//                 ].map(([label, val]) => val ? (
//                   <div key={label} className="col-span-2 md:col-span-1 border-b border-slate-100 pb-2">
//                     <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">{label}</span>
//                     <span className="text-slate-900 font-medium">{val}</span>
//                   </div>
//                 ) : null)}
//               </div>
//             </div>
//             <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
//               <button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewCandidate); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Edit Details</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }