import { useState, useEffect, useCallback } from 'react';
import AddCompanyModal from '@/components/agreement/AddCompanyModal';
import AgreementLetterModal from '@/components/agreement/AgreementLetterModal';
import AgreementBulkSendModal from '@/components/agreement/AgreementBulkSendModal';
import { generatePdfWithTemplate } from '@/utils/pdfTemplateGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Handshake, Send, Clock, Search, LayoutGrid, List, Plus,
  Upload, Eye, Pencil, Trash2, Calendar, XCircle, FileText
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const AGREEMENT_API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');

export default function AgreementGenerator() {
  const { authHeaders } = useAuth();

  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = await authHeaders();
    const isFormData = options.body instanceof FormData;
    return fetch(url, {
      ...options,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
        ...options.headers,
      }
    });
  }, [authHeaders]);
  // ─── AGREEMENT STATE ───
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  // Custom Templates states
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // ─── DATA FETCHING ───
  const fetchCompanies = () => {
    setLoading(true);
    apiFetch(`${AGREEMENT_API}/agreement-companies/`)
      .then(res => res.json())
      .then(data => {
        // Sort companies: newest first
        const sorted = (data || []).sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        });
        setCompanies(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // ────────── HANDLERS ──────────
  const handleSaveCompany = (data) => {
    const isEdit = !!selectedCompanyForEdit;
    apiFetch(`${AGREEMENT_API}/agreement-companies/${isEdit ? selectedCompanyForEdit.id : ''}`, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }).then(async res => {
      if (res.ok) { setIsCompanyModalOpen(false); setSelectedCompanyForEdit(null); fetchCompanies(); }
      else { const e = await res.json(); alert(`Failed: ${e.detail}`); }
    });
  };

  const handleEditCompany = (co) => { setSelectedCompanyForEdit(co); setIsViewOnly(false); setIsCompanyModalOpen(true); };
  const handleViewCompany = (co) => { setSelectedCompanyForEdit(co); setIsViewOnly(true); setIsCompanyModalOpen(true); };

  const handleDeleteCompany = async (id) => {
    if (!confirm("Delete this company?")) return;
    await apiFetch(`${AGREEMENT_API}/agreement-companies/${id}`, { method: 'DELETE' });
    fetchCompanies();
  };

  const toggleAllSelection = () => {
    const visibleIds = filteredCompanies.map(c => c.id);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setSelectedIds(next);
  };

  const handleBulkSendAgreements = async (template, company) => {
    setShowBulkModal(false);
    setIsBulkSending(true);
    const idsArray = Array.from(selectedIds);
    let count = 0;
    for (const id of idsArray) {
      const co = companies.find(c => c.id === id);
      if (!co) continue;
      setBulkProgress(`Processing ${++count}/${idsArray.length}: ${co.name}`);
      try {
        const genRes = await apiFetch(`${AGREEMENT_API}/agreement-letters/generate`, {
          method: 'POST',
          body: JSON.stringify({ employee_id: id, letter_type: "Agreement", company_name: company })
        });
        const genData = await genRes.json();
        const contentWithoutHeader = genData.content.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
        const pdfDataUri = await generatePdfWithTemplate(contentWithoutHeader, template);
        await apiFetch(`${AGREEMENT_API}/agreement-email/send`, {
          method: 'POST',
          body: JSON.stringify({
            employee_id: id,
            letter_content: genData.content,
            pdf_base64: pdfDataUri,
            subject: `Agreement - ${co.name}`,
            company_name: company
          })
        });
      } catch (err) { console.error(err); }
    }
    setIsBulkSending(false);
    setBulkProgress("");
    setSelectedIds(new Set());
    fetchCompanies();
    alert("Bulk sending process completed! Check individual statuses.");
  };

  // Custom Templates Handlers
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await apiFetch(`${AGREEMENT_API}/upload/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data || []);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await apiFetch(`${AGREEMENT_API}/upload/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("Template deleted successfully!");
        if (previewTemplate && previewTemplate.id === id) {
          setPreviewTemplate(null);
        }
        fetchTemplates();
      } else {
        alert("Failed to delete template.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred while deleting.");
    }
  };

  const filteredCompanies = companies.filter(co => {
    const s = searchTerm.toLowerCase();
    const matchSearch = (co.name || "").toLowerCase().includes(s) || (co.email || "").toLowerCase().includes(s);
    const matchStatus = filterStatus === 'All' || co.status === filterStatus;

    let matchDate = true;
    if (fromDate || toDate) {
      const dateVal = co.joining_date;
      const d = dateVal ? new Date(dateVal) : null;
      if (d && !isNaN(d.getTime())) {
        if (fromDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          if (d < start) matchDate = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (d > end) matchDate = false;
        }
      } else {
        matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const stats = {
    total: companies.length,
    sent: companies.filter(e => e.status === 'Agreement Sent').length,
    pending: companies.filter(e => e.status === 'Pending' || !e.status).length
  };

  const selectedBg = 'rgba(40, 48, 134, 0.08)';

  // ─── CSS Variables scoped to this component ───
  const vars = {
    '--ag-bg-primary': '#f8fafc',
    '--ag-bg-secondary': '#ffffff',
    '--ag-bg-tertiary': '#f1f5f9',
    '--ag-text-primary': '#0f172a',
    '--ag-text-secondary': '#334155',
    '--ag-text-muted': '#64748b',
    '--ag-border-color': '#e2e8f0',
    '--ag-accent-color': '#283086',
    '--ag-accent-hover': '#1e2570',
    '--ag-accent-soft': '#eef0ff',
    '--ag-card-bg': '#ffffff',
    '--ag-card-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    '--ag-success-bg': '#f0fdf4',
    '--ag-success-text': '#16a34a',
    '--ag-pending-bg': '#fffbeb',
    '--ag-pending-text': '#d97706',
    '--ag-error-text': '#dc2626',
  };

  return (
    <div style={{ ...vars, minHeight: '100%', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* HEADER */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '48px', height: '48px', background: 'var(--ag-accent-color)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(40, 48, 134, 0.3)' }}>
          <Handshake size={26} style={{ color: 'white' }} />
        </div>
        <div>
          <h1 style={{ fontWeight: 900, color: 'var(--ag-accent-color)', margin: 0, letterSpacing: '-0.025em', fontSize: '1.6rem', lineHeight: 1.2 }}>Agreement Generator</h1>
          <p style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Professional Agreement Document Automation</p>
        </div>
      </header>

      {/* STATS */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Companies', val: stats.total, color: 'var(--ag-accent-color)', icon: <Handshake size={18} /> },
          { label: 'Agreements Sent', val: stats.sent, color: 'var(--ag-success-text)', icon: <Send size={18} /> },
          { label: 'Pending', val: stats.pending, color: 'var(--ag-pending-text)', icon: <Clock size={18} /> }
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--ag-border-color)', boxShadow: 'var(--ag-card-shadow)', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(0,0,0,0.12)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--ag-card-shadow)'; }}
          >
            <div style={{ color: s.color, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {s.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ag-text-primary)', margin: 0 }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', padding: '0.6rem 0.8rem', background: 'white', borderRadius: '14px', border: '1px solid var(--ag-border-color)', boxShadow: 'var(--ag-card-shadow)', flexWrap: 'wrap' }}>
        {/* Status filters */}
        <div style={{ display: 'flex', background: 'var(--ag-bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
          {['All', 'Pending', 'Agreement Sent'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: filterStatus === s ? 'var(--ag-accent-color)' : 'transparent', color: filterStatus === s ? 'white' : 'var(--ag-text-muted)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{s}</button>
          ))}
        </div>

        {/* View mode */}
        <div style={{ display: 'flex', background: 'var(--ag-bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
          <button onClick={() => setViewMode('grid')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: viewMode === 'grid' ? 'var(--ag-accent-color)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'var(--ag-text-muted)', cursor: 'pointer', display: 'flex' }}><LayoutGrid size={16} /></button>
          <button onClick={() => setViewMode('list')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: viewMode === 'list' ? 'var(--ag-accent-color)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--ag-text-muted)', cursor: 'pointer', display: 'flex' }}><List size={16} /></button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 120px', minWidth: '120px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input type="text" placeholder="Search companies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '10px', border: '1px solid var(--ag-border-color)', background: 'var(--ag-bg-tertiary)', outline: 'none', fontSize: '0.8rem', color: 'var(--ag-text-primary)' }} />
        </div>

        {/* Date filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--ag-bg-tertiary)', padding: '4px 8px', borderRadius: '10px', border: '1px solid var(--ag-border-color)' }}>
          <Calendar size={14} style={{ color: 'var(--ag-text-muted)' }} />
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: 'var(--ag-text-primary)', outline: 'none', width: '100px' }} title="From Date" />
          <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>→</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: 'var(--ag-text-primary)', outline: 'none', width: '100px' }} title="To Date" />
          {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ag-error-text)', padding: '0', display: 'flex' }}><XCircle size={14} /></button>}
        </div>

        {/* Select All */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--ag-bg-tertiary)', padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--ag-border-color)', cursor: 'pointer' }} onClick={toggleAllSelection}>
          <input
            type="checkbox"
            checked={filteredCompanies.length > 0 && filteredCompanies.every(c => selectedIds.has(c.id))}
            onChange={() => { }}
            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--ag-accent-color)' }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ag-text-muted)' }}>Select All</span>
        </div>

        {/* Bulk Send */}
        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            style={{ background: 'var(--ag-accent-color)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(40, 48, 134, 0.3)', fontSize: '0.8rem' }}
          >
            <Send size={14} /> Bulk Send ({selectedIds.size})
          </button>
        )}

        {/* Template Manager */}
        <button 
          onClick={() => { fetchTemplates(); setIsManageTemplatesOpen(true); }} 
          style={{ 
            background: 'transparent', 
            color: 'var(--ag-accent-color)', 
            border: '1px solid var(--ag-accent-color)', 
            padding: '8px 14px', 
            borderRadius: '10px', 
            fontWeight: 700, 
            fontSize: '0.8rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'var(--ag-accent-soft)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <FileText size={14} /> Templates
        </button>

        {/* New Company */}
        <button onClick={() => { setSelectedCompanyForEdit(null); setIsViewOnly(false); setIsCompanyModalOpen(true); }} style={{ background: 'var(--ag-accent-color)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(40, 48, 134, 0.3)' }}><Plus size={14} /> New Company</button>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid var(--ag-bg-tertiary)', borderTop: '4px solid var(--ag-accent-color)', borderRadius: '50%', animation: 'ag-spin 1s linear infinite' }} />
          <style>{`@keyframes ag-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'var(--ag-text-muted)', fontWeight: 600, fontSize: '1rem' }}>Loading companies...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '24px', border: '2px dashed var(--ag-border-color)', color: 'var(--ag-text-muted)' }}>
          <Handshake size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No companies found matching your filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filteredCompanies.map(co => (
            <div key={co.id} style={{
              background: selectedIds.has(co.id) ? selectedBg : 'white',
              padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--ag-border-color)',
              boxShadow: 'var(--ag-card-shadow)', position: 'relative', display: 'flex', flexDirection: 'column',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              minHeight: '160px', cursor: 'pointer'
            }} onClick={(e) => {
              if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'svg' && e.target.tagName !== 'path' && e.target.tagName !== 'INPUT') {
                const s = new Set(selectedIds); s.has(co.id) ? s.delete(co.id) : s.add(co.id); setSelectedIds(s);
              }
            }}
              onMouseOver={e => { if (!selectedIds.has(co.id)) e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(0,0,0,0.12)'; }}
              onMouseOut={e => { e.currentTarget.style.boxShadow = 'var(--ag-card-shadow)'; }}
            >
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '4px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleViewCompany(co); }} style={{ padding: '6px', border: 'none', background: 'var(--ag-bg-tertiary)', cursor: 'pointer', color: 'var(--ag-text-muted)', borderRadius: '8px', display: 'flex' }} title="View"><Eye size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleEditCompany(co); }} style={{ padding: '6px', border: 'none', background: 'var(--ag-bg-tertiary)', cursor: 'pointer', color: 'var(--ag-text-muted)', borderRadius: '8px', display: 'flex' }} title="Edit"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteCompany(co.id); }} style={{ padding: '6px', border: 'none', background: '#fef2f2', cursor: 'pointer', color: 'var(--ag-error-text)', borderRadius: '8px', display: 'flex' }} title="Delete"><Trash2 size={14} /></button>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1rem' }}>
                <input type="checkbox" checked={selectedIds.has(co.id)} onChange={() => {
                  const s = new Set(selectedIds); s.has(co.id) ? s.delete(co.id) : s.add(co.id); setSelectedIds(s);
                }} style={{ cursor: 'pointer', marginTop: '4px', accentColor: 'var(--ag-accent-color)' }} onClick={e => e.stopPropagation()} />
                <div style={{ flex: 1, minWidth: 0, paddingRight: '80px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--ag-text-primary)', lineHeight: 1.25 }}>{co.name || "Unnamed Entity"}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--ag-text-muted)', fontWeight: 500 }}>{co.email || "No email"}</p>
                </div>
              </div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--ag-border-color)', paddingTop: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--ag-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }} title="Agreement Date">
                  <Calendar size={12} /> {co.joining_date ? new Date(co.joining_date).toLocaleDateString() : 'N/A'}
                </div>
                <div style={{
                  background: co.status === 'Agreement Sent' ? 'var(--ag-success-bg)' : 'var(--ag-pending-bg)',
                  padding: '4px 10px', borderRadius: '8px',
                  fontSize: '0.65rem', fontWeight: 800, color: co.status === 'Agreement Sent' ? 'var(--ag-success-text)' : 'var(--ag-pending-text)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
                }}>
                  {co.status || 'PENDING'}
                </div>
                <div style={{ flex: 1 }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedCompany(co); }}
                  style={{
                    background: 'var(--ag-accent-color)', color: 'white', border: 'none',
                    padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                    fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(40, 48, 134, 0.2)', whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--ag-accent-hover)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--ag-accent-color)'}
                >
                  MANAGE
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--ag-border-color)', overflow: 'hidden', boxShadow: 'var(--ag-card-shadow)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead style={{ background: 'var(--ag-bg-tertiary)', borderBottom: '1px solid var(--ag-border-color)' }}>
                <tr>
                  <th style={{ padding: '1rem', width: '48px', textAlign: 'center' }}>
                    <input type="checkbox" checked={filteredCompanies.length > 0 && filteredCompanies.every(c => selectedIds.has(c.id))} onChange={toggleAllSelection} style={{ cursor: 'pointer', accentColor: 'var(--ag-accent-color)' }} />
                  </th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company Name</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Contact</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ag-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map(co => (
                  <tr key={co.id} style={{ borderBottom: '1px solid var(--ag-border-color)', background: selectedIds.has(co.id) ? selectedBg : 'transparent', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                       <input type="checkbox" checked={selectedIds.has(co.id)} onChange={() => { const s = new Set(selectedIds); s.has(co.id) ? s.delete(co.id) : s.add(co.id); setSelectedIds(s); }} style={{ cursor: 'pointer', accentColor: 'var(--ag-accent-color)' }} />
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 750, color: 'var(--ag-text-primary)', fontSize: '0.95rem' }}>{co.name || "Unnamed"}</div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--ag-text-secondary)', fontWeight: 500 }}>{co.email || "N/A"}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--ag-text-muted)', fontWeight: 600 }}>{co.joining_date ? new Date(co.joining_date).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '8px',
                        background: co.status === 'Agreement Sent' ? 'var(--ag-success-bg)' : 'var(--ag-pending-bg)',
                        color: co.status === 'Agreement Sent' ? 'var(--ag-success-text)' : 'var(--ag-pending-text)',
                        display: 'inline-block'
                      }}>
                        {co.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={() => setSelectedCompany(co)} style={{ background: 'var(--ag-accent-color)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>MANAGE</button>
                        <button onClick={() => handleViewCompany(co)} style={{ padding: '6px', border: 'none', background: 'var(--ag-bg-tertiary)', cursor: 'pointer', color: 'var(--ag-text-muted)', borderRadius: '6px', display: 'flex' }} title="View"><Eye size={16} /></button>
                        <button onClick={() => handleEditCompany(co)} style={{ padding: '6px', border: 'none', background: 'var(--ag-bg-tertiary)', cursor: 'pointer', color: 'var(--ag-text-muted)', borderRadius: '6px', display: 'flex' }} title="Edit"><Pencil size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {isCompanyModalOpen && <AddCompanyModal apiUrl={AGREEMENT_API} onClose={() => setIsCompanyModalOpen(false)} onSave={handleSaveCompany} initialData={selectedCompanyForEdit} isViewOnly={isViewOnly} />}
        {selectedCompany && <AgreementLetterModal apiUrl={AGREEMENT_API} employee={selectedCompany} onClose={() => setSelectedCompany(null)} onSuccess={() => { setSelectedCompany(null); fetchCompanies(); }} />}
        {showBulkModal && <AgreementBulkSendModal selectedCount={selectedIds.size} onClose={() => setShowBulkModal(false)} onConfirm={handleBulkSendAgreements} />}

        {/* Unified Template Manager Modal */}
        {isManageTemplatesOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setIsManageTemplatesOpen(false)} />
            
            <motion.div
              initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
              style={{ position: 'relative', zIndex: 50, background: 'white', borderRadius: '24px', width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'hidden' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Template Manager</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Upload and manage custom backgrounds</p>
                  </div>
                </div>
                <button onClick={() => setIsManageTemplatesOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px' }}><XCircle size={22} /></button>
              </div>

              {/* Scrollable Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 1. LINK TO COMPANY */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LINK TO COMPANY (OPTIONAL)</label>
                  <input
                    type="text"
                    placeholder="Example: Arah Infotech"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', background: '#f1f5f9', outline: 'none', fontSize: '0.9rem', color: '#1e293b', fontWeight: '600', width: '100%', boxSizing: 'border-box' }}
                  />
                  <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Linking to a company name helps auto-select the template in the workshop.</p>
                </div>

                {/* 2. UPLOAD ZONE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', position: 'relative', background: '#f8fafc', transition: 'all 0.2s' }}>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setIsUploadingTemplate(true);
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('name', newTemplateName || file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
                        
                        try {
                          const res = await apiFetch(`${AGREEMENT_API}/upload/templates`, {
                            method: 'POST',
                            body: formData
                          });
                          if (res.ok) {
                            setNewTemplateName('');
                            fetchTemplates();
                          } else {
                            const errData = await res.json();
                            alert(`Upload failed: ${errData.detail || 'Unknown error'}`);
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Error uploading template.');
                        } finally {
                          setIsUploadingTemplate(false);
                          e.target.value = '';
                        }
                      }}
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                    />
                    
                    {isUploadingTemplate ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'ag-spin 1s linear infinite' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Uploading template to Cloudinary...</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', margin: '0 auto 0.75rem', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.1)' }}>
                          <Upload size={20} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Click or drag & drop to upload</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Supported: PDF, JPG, PNG (Max 5MB)</p>
                      </>
                    )}
                  </div>
                </div>

                {/* 3. EXISTING TEMPLATES list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXISTING TEMPLATES ({templates.length})</label>
                  
                  {templatesLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                      <div style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'ag-spin 1s linear infinite' }} />
                    </div>
                  ) : templates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '12px', background: '#f8fafc', color: '#94a3b8' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>No custom templates yet. Upload one above to get started.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                      {templates.map(tpl => {
                        const isImage = tpl.mimeType?.startsWith('image/');
                        return (
                          <div
                            key={tpl.id}
                            className="template-card"
                            style={{
                              height: '140px',
                              borderRadius: '12px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              overflow: 'hidden',
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                              group: 'true'
                            }}
                          >
                            {/* Template Preview Background */}
                            <div style={{ flex: 1, width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', overflow: 'hidden' }}>
                              {isImage ? (
                                <img src={tpl.url} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#0284c7' }}>
                                  <FileText size={32} />
                                  <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', background: '#e0f2fe', borderRadius: '4px' }}>PDF</span>
                                </div>
                              )}
                              
                              {/* Hover controls overlay */}
                              <div
                                className="template-hover-overlay"
                                style={{
                                  position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                  opacity: 0, transition: 'opacity 0.2s', cursor: 'default', zIndex: 5
                                }}
                              >
                                <button
                                  onClick={() => setPreviewTemplate(tpl)}
                                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                  title="Preview Template"
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTemplate(tpl.id)}
                                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                  title="Delete Template"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Bottom bar with name */}
                            <div style={{ padding: '8px 12px', background: 'white', borderTop: '1px solid #cbd5e1', zIndex: 2 }}>
                              <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{tpl.name}</h4>
                            </div>

                            {/* Hover effect styling tag */}
                            <style>{`
                              .template-card:hover .template-hover-overlay {
                                opacity: 1 !important;
                              }
                            `}</style>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <button
                  onClick={() => setIsManageTemplatesOpen(false)}
                  style={{ background: '#0284c7', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)' }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Lightbox / Preview Sub-Modal */}
        {previewTemplate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setPreviewTemplate(null)} />
            
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ position: 'relative', zIndex: 50, background: 'white', borderRadius: '24px', width: '90vw', maxWidth: '850px', height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}
            >
              {/* Preview Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{previewTemplate.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Uploaded on {new Date(previewTemplate.createdAt).toLocaleDateString()}</span>
                </div>
                <button onClick={() => setPreviewTemplate(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px' }}><XCircle size={22} /></button>
              </div>

              {/* Preview Canvas */}
              <div style={{ flex: 1, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1rem' }}>
                <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  {previewTemplate.mimeType?.startsWith('image/') ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#94a3b8', boxSizing: 'border-box' }}>
                      <img src={previewTemplate.url} alt={previewTemplate.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    </div>
                  ) : (
                    <iframe src={`${previewTemplate.url}#navpanes=0&view=FitH`} title="Template Preview" style={{ width: '100%', height: '100%', border: 'none' }} />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isBulkSending && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}
          >
            <div style={{ width: '80px', height: '80px', border: '4px solid var(--ag-accent-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ag-spin 1s linear infinite', marginBottom: '2rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>🚀 Dispatching In Progress</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', fontWeight: 600 }}>{bulkProgress}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
