import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, ChevronDown, FileText, Upload, X, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const InputGroup = ({ label, name, type = "text", placeholder, value, onChange, disabled, required = false, options = null, error = false }) => (
    <div className="flex flex-col gap-1.5 w-full">
        <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none mb-0.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {options ? (
            <div className="relative">
                <select
                    name={name}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl text-zinc-900 dark:text-white outline-none text-sm cursor-pointer transition-all duration-150 appearance-none disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed font-medium"
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-zinc-500 flex">
                    <ChevronDown size={18} />
                </div>
            </div>
        ) : (
            <input
                type={type}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                autoComplete="off"
                className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border ${error ? 'border-red-500 focus:ring-red-500/10' : 'border-zinc-250 dark:border-zinc-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'} rounded-xl text-zinc-900 dark:text-white outline-none text-sm transition-all duration-150 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed font-medium`}
            />
        )}
    </div>
);

const AddCompanyModal = ({ onClose, onSave, initialData, isViewOnly, apiUrl }) => {
    const parseDuration = (val) => {
        if (!val) return { days: '', hours: '', minutes: '' };
        const parts = String(val).split(':');
        if (parts.length === 3) {
            return {
                days: parts[0] || '0',
                hours: parts[1] || '0',
                minutes: parts[2] || '0'
            };
        }
        return {
            days: val || '0',
            hours: '0',
            minutes: '0'
        };
    };

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            const existingSig = initialData.signature || '';
            const sigParts = existingSig.includes(' - ') ? existingSig.split(' - ') : [existingSig, ''];
            const pct = initialData.compensation?.percentage ?? initialData.percentage ?? 0;
            let jd = initialData.joining_date || '';
            if (jd && jd.includes('T')) jd = jd.split('T')[0];

            return {
                emp_id: initialData.emp_id || '',
                name: initialData.name || '',
                email: initialData.email || '',
                percentage: pct,
                joining_date: jd,
                address: initialData.address || '',
                replacement: initialData.replacement || '',
                invoice_post_joining: initialData.invoice_post_joining || '',
                payment_release: initialData.payment_release || '15',
                sig_name: sigParts[0]?.trim() || '',
                sig_designation: sigParts[1]?.trim() || '',
                templateUrl: initialData.templateUrl || '',
                templateName: initialData.templateName || '',
            };
        }
        return {
            emp_id: '',
            name: '',
            email: '',
            percentage: '',
            joining_date: '',
            address: '',
            replacement: '',
            sig_name: '',
            sig_designation: '',
            invoice_post_joining: '',
            payment_release: '15',
            templateUrl: '',
            templateName: ''
        };
    });

    const [duration, setDuration] = useState(() => parseDuration(formData.invoice_post_joining));
    const [uploading, setUploading] = useState(false);
    const { authHeaders } = useAuth();
    const [clients, setClients] = useState([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isManual, setIsManual] = useState(false);

    const handleDurationChange = (field, val) => {
        const num = val.replace(/[^0-9]/g, '');
        let newDuration = { ...duration, [field]: num };
        
        if (field === 'hours' && parseInt(num) > 23) newDuration.hours = '23';
        if (field === 'minutes' && parseInt(num) > 59) newDuration.minutes = '59';
        
        setDuration(newDuration);
        const dStr = `${newDuration.days || '0'}:${newDuration.hours || '0'}:${newDuration.minutes || '0'}`;
        setFormData(prev => ({ ...prev, invoice_post_joining: dStr }));
    };

    const handleTemplateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert("Only PDF files are accepted!");
            return;
        }

        setUploading(true);
        const fData = new FormData();
        fData.append('file', file);
        fData.append('name', `${formData.name || 'Client'}_Template`);

        try {
            const baseUrl = apiUrl?.replace(/\/+$/, '') || 'http://localhost:5000';
            const headers = {
                ...(await authHeaders()),
            };
            const res = await fetch(`${baseUrl}/upload/templates`, {
                method: 'POST',
                headers,
                body: fData
            });

            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success' && data.template) {
                    setFormData(prev => ({
                        ...prev,
                        templateUrl: data.template.url,
                        templateName: data.template.fileName || file.name
                    }));
                }
            } else {
                const err = await res.json();
                alert(`Upload failed: ${err.detail || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("An error occurred during file upload.");
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoadingClients(true);
            try {
                const baseUrl = apiUrl?.replace(/\/+$/, '') || 'http://localhost:5000';
                const headers = {
                    "Content-Type": "application/json",
                    ...(await authHeaders()),
                };
                const response = await fetch(`${baseUrl}/api/clients`, { headers });
                if (response.ok) {
                    const data = await response.json();
                    setClients(data);
                }
            } catch (err) {
                console.error("Failed to fetch clients:", err);
            } finally {
                setIsLoadingClients(false);
            }
        };
        if (!isViewOnly && !initialData) {
            fetchClients();
        }
    }, [apiUrl, isViewOnly, initialData, authHeaders]);

    const handleClientSelect = (e) => {
        const clientName = e.target.value;
        if (!clientName || clientName === 'Select a Company') {
            setFormData({ ...formData, name: '' });
            return;
        }

        if (clientName === 'Manual Entry') {
            setIsManual(true);
            setFormData({ ...formData, name: '' });
            return;
        }

        const client = clients.find(c => c.companyName === clientName);
        if (client) {
            const lockingDays = client.lockingPeriod || '0';
            setFormData({
                ...formData,
                name: client.companyName || '',
                email: client.email || '',
                percentage: client.percentage || '',
                address: client.address || client.clientLocation || '',
                replacement: client.replacementPeriod || '',
                payment_release: client.paymentMode || '15',
                invoice_post_joining: `${lockingDays}:0:0`
            });
            setDuration({
                days: lockingDays,
                hours: '0',
                minutes: '0'
            });
        }
    };

    const handleChange = (e) => {
        let { name, value } = e.target;

        if (name === 'email') {
            const lowerVal = value.toLowerCase();
            const dotComIndex = lowerVal.indexOf('.com');
            if (dotComIndex !== -1 && value.length > dotComIndex + 4) {
                value = value.substring(0, dotComIndex + 4);
            }
        }

        if (name === 'name') {
            value = value.replace(/[^a-zA-Z\s]/g, '');
            if (value.length > 0) {
                value = value.replace(/\b\w/g, c => c.toUpperCase());
            }
        }

        if (name === 'sig_name') {
            value = value.replace(/[^a-zA-Z\s]/g, '');
            if (value.length > 0) {
                value = value.replace(/\b\w/g, c => c.toUpperCase());
            }
        }

        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const sigName = formData.sig_name?.trim() || '';
        const sigDesig = formData.sig_designation?.trim() || '';
        const signature = sigDesig ? `${sigName} - ${sigDesig}` : sigName;

        const payload = {
            emp_id: formData.emp_id || '',
            name: formData.name || '',
            email: formData.email || '',
            percentage: formData.percentage ? parseFloat(formData.percentage) : 0,
            joining_date: formData.joining_date || null,
            address: formData.address || '',
            replacement: formData.replacement || '',
            invoice_post_joining: formData.invoice_post_joining || '',
            payment_release: formData.payment_release || '15',
            signature,
            templateUrl: formData.templateUrl || '',
            templateName: formData.templateName || '',
        };
        onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`relative bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 shadow-2xl rounded-3xl w-full ${isViewOnly && formData.templateUrl ? 'max-w-6xl' : 'max-w-3xl'} max-h-[92vh] flex flex-col overflow-hidden`}
            >
                <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-8 py-6 text-white shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <h2 className="text-xl font-black text-white leading-tight">
                        {isViewOnly ? 'View Company Details' : initialData ? 'Update Company Details' : 'Add New Company'}
                    </h2>
                    <p className="text-indigo-200 text-xs mt-1 font-semibold">
                        {isViewOnly ? 'Review details below.' : initialData ? 'Refine details for business agreement.' : 'Onboard a new company for agreement generation.'}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-zinc-50/50 dark:bg-zinc-955/30">
                    <div style={{ display: 'grid', gridTemplateColumns: (isViewOnly && formData.templateUrl) ? '1.1fr 0.9fr' : '1fr', gap: '2rem', alignItems: 'stretch' }}>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/60 p-5 rounded-2xl shadow-sm space-y-4">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-2">
                                    <Building2 size={16} />
                                    <span className="font-bold">Company Information</span>
                                </h3>

                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-6">
                                        {!isViewOnly && !initialData && !isManual && clients.length > 0 ? (
                                            <InputGroup
                                                label="Company Name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleClientSelect}
                                                required
                                                options={['Select a Company', 'Manual Entry', ...clients.map(c => c.companyName)]}
                                            />
                                        ) : (
                                            <div className="relative">
                                                <InputGroup label="Company Name" name="name" placeholder="e.g. Arah Infotech" value={formData.name} onChange={handleChange} required disabled={isViewOnly} />
                                                {!isViewOnly && !initialData && clients.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsManual(false); setFormData({ ...formData, name: '' }); }}
                                                        className="absolute top-0 right-0 bg-transparent text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:underline px-2 py-0.5 cursor-pointer"
                                                    >
                                                        [ Use Dropdown ]
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <InputGroup label="Email Contact" name="email" type="email" placeholder="contact@arah.com" value={formData.email} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <InputGroup label="Date of Agreement" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <InputGroup label="Compensation %" name="percentage" type="number" placeholder="8.33" value={formData.percentage} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>
                                    <div className="col-span-12">
                                        <InputGroup label="Registered Office Address" name="address" placeholder="123 Tech Park, Hyderabad" value={formData.address} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>

                                    <div className="col-span-12 md:col-span-6">
                                        <InputGroup label="Replacement (Days)" name="replacement" type="number" placeholder="e.g. 60" value={formData.replacement} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <div className="flex flex-col gap-1.5 w-full">
                                            <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none mb-0.5">
                                                Invoice Duration <span className="text-red-500">*</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col flex-1 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="Days"
                                                        value={duration.days}
                                                        onChange={e => handleDurationChange('days', e.target.value)}
                                                        disabled={isViewOnly}
                                                        required
                                                        className="w-full px-2 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl text-center text-zinc-900 dark:text-white outline-none text-sm transition-all duration-150 disabled:bg-zinc-100 disabled:text-zinc-400 font-mono font-medium"
                                                    />
                                                    <span className="text-[9px] font-bold text-zinc-400 mt-1 select-none">DD</span>
                                                </div>
                                                <span className="font-bold text-zinc-400 text-lg leading-none -mt-4">:</span>
                                                <div className="flex flex-col flex-1 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="Hrs"
                                                        value={duration.hours}
                                                        onChange={e => handleDurationChange('hours', e.target.value)}
                                                        disabled={isViewOnly}
                                                        required
                                                        className="w-full px-2 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl text-center text-zinc-900 dark:text-white outline-none text-sm transition-all duration-150 disabled:bg-zinc-100 disabled:text-zinc-400 font-mono font-medium"
                                                    />
                                                    <span className="text-[9px] font-bold text-zinc-400 mt-1 select-none">HH</span>
                                                </div>
                                                <span className="font-bold text-zinc-400 text-lg leading-none -mt-4">:</span>
                                                <div className="flex flex-col flex-1 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="Min"
                                                        value={duration.minutes}
                                                        onChange={e => handleDurationChange('minutes', e.target.value)}
                                                        disabled={isViewOnly}
                                                        required
                                                        className="w-full px-2 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl text-center text-zinc-900 dark:text-white outline-none text-sm transition-all duration-150 disabled:bg-zinc-100 disabled:text-zinc-400 font-mono font-medium"
                                                    />
                                                    <span className="text-[9px] font-bold text-zinc-400 mt-1 select-none">MM</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-6">
                                        <InputGroup label="Signatory Name" name="sig_name" placeholder="e.g. Navya S" value={formData.sig_name} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <InputGroup label="Designation" name="sig_designation" placeholder="e.g. Managing Director" value={formData.sig_designation} onChange={handleChange} required disabled={isViewOnly} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/60 p-5 rounded-2xl shadow-sm space-y-4">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-2">
                                    <FileText size={16} />
                                    <span className="font-bold">Agreement Template (PDF)</span>
                                </h3>
                                
                                {formData.templateUrl ? (
                                    <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-250/80 dark:border-zinc-800 p-3.5 rounded-xl">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={18} className="text-emerald-600 shrink-0" />
                                            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-350 truncate">
                                                {formData.templateName || "client_template.pdf"}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 shrink-0 ml-4">
                                            <button
                                                type="button"
                                                onClick={() => window.open(formData.templateUrl, '_blank')}
                                                className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
                                            >
                                                View
                                            </button>
                                            {!isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, templateUrl: '', templateName: '' }))}
                                                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl text-xs font-bold border border-red-200/50 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : isViewOnly ? (
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No custom PDF template uploaded for this client.</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={handleTemplateUpload}
                                            disabled={uploading}
                                            className="hidden"
                                            id="client-pdf-template"
                                        />
                                        <label
                                            htmlFor="client-pdf-template"
                                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl cursor-pointer bg-white dark:bg-zinc-900 text-center hover:bg-zinc-50/50 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <Upload size={24} className="text-zinc-400 dark:text-zinc-500 mb-2" />
                                            <span className="text-xs font-bold text-zinc-650 dark:text-zinc-300">
                                                {uploading ? "Uploading PDF Template..." : "Click to upload Client PDF Template"}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 mt-1">Only PDF files are supported</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold border border-zinc-250 hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors uppercase tracking-wider"
                                >
                                    {isViewOnly ? 'Close' : 'Cancel'}
                                </button>
                                {!isViewOnly && (
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                                    >
                                        {initialData ? 'Apply Updates' : 'Add Company'}
                                        <Check size={14} />
                                    </button>
                                )}
                            </div>
                        </form>

                        {isViewOnly && formData.templateUrl && (
                            <div className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-955 min-h-[450px]">
                                <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-500">PDF Template Preview</span>
                                    <a href={formData.templateUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Open in New Tab</a>
                                </div>
                                <iframe
                                    src={`${formData.templateUrl}#navpanes=0&view=FitH`}
                                    title="Client Template Preview"
                                    className="w-full border-none flex-1 min-h-[400px]"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AddCompanyModal;
