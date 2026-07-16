import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import CandidateProfileLink from "@/components/CandidateProfileLink";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";

import {
  BuildingOfficeIcon,
  CalculatorIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "").replace(/\/api$/, "") + "/api";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800";

/* ================= Helpers ================= */

const getOrdinalDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "short" });
  const year = date.getFullYear();
  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${getOrdinal(day)} ${month} ${year}`;
};

const numberToWords = (num) => {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertGroup = (n) => {
    if (n === 0) return "";
    if (n < 20) return a[n] + " ";
    if (n < 100) return b[Math.floor(n / 10)] + " " + a[n % 10] + " ";
    return a[Math.floor(n / 100)] + " Hundred " + convertGroup(n % 100);
  };

  if (num === 0) return "Zero";
  let output = "";
  let n = Math.floor(num);
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;

  if (crore > 0) output += convertGroup(crore) + "Crore ";
  if (lakh > 0) output += convertGroup(lakh) + "Lakh ";
  if (thousand > 0) output += convertGroup(thousand) + "Thousand ";
  if (n > 0) output += convertGroup(n);

  return output.trim() + " Rupees Only";
};

const triggerFileDownload = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/* ================= Main Component ================= */

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-6 mb-6">
    <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-blue-600" />
      {title}
    </h3>
    {children}
  </div>
);

const PlacementCountdown = ({ placement, ready, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);
  const hasTriggered = useRef(false);
  const latestOnComplete = useRef(onComplete);
  useEffect(() => { latestOnComplete.current = onComplete; });

  const targetMs = placement.targetDate.getTime();

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const diff = targetMs - now.getTime();

      if (diff <= 0) {
        setIsOverdue(true);
        setTimeLeft('Ready for Billing');
        if (ready && !hasTriggered.current && latestOnComplete.current) {
          hasTriggered.current = true;
          latestOnComplete.current();
        }
        return;
      }

      setIsOverdue(false);
      const totalSec = Math.floor(diff / 1000);
      const m = Math.floor((totalSec / 60) % 60);
      const h = Math.floor((totalSec / 3600) % 24);
      const d = Math.floor(totalSec / 86400);
      setTimeLeft(`${d}d ${h}h ${m}m remaining`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 15000);
    return () => clearInterval(interval);
  }, [targetMs, ready]);

  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
      placement.hasInvoice 
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' 
        : isOverdue 
          ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 animate-pulse' 
          : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
    }`}>
      {placement.hasInvoice ? 'Billed (Auto)' : timeLeft}
    </span>
  );
};

const defaultAccountDetails = {
  accountNumber: "6000805022576",
  name: "Vagarious Solutions Pvt Ltd.",
  bank: "ICICI Bank",
  branch: "Begumpet Branch",
  ifsc: "ICICI0000183",
  pan: "AAHCV0176E",
  gst: "36AAHCV0176E1ZE"
};

const AdminClientInvoice = () => {
  const { toast } = useToast();
  const { authHeaders } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editInvoiceId, setEditInvoiceId] = useState(null);

  const handleEditInvoice = async (invoice) => {
    toast({ title: "Loading invoice details..." });
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/invoices/${invoice._id}`, { headers });
      if (res.ok) {
        const fullInvoice = await res.json();
        
        setEditInvoiceId(fullInvoice._id);
        
        let resolvedClientId = "";
        if (fullInvoice.clientId) {
          resolvedClientId = typeof fullInvoice.clientId === 'object' 
            ? (fullInvoice.clientId._id || fullInvoice.clientId.id) 
            : fullInvoice.clientId;
        }

        const matchedClient = clients.find(c => {
          const idMatch = String(c.id || c._id || "").toLowerCase().trim() === String(resolvedClientId).toLowerCase().trim();
          const nameMatch = String(c.companyName || "").toLowerCase().trim() === String(fullInvoice.clientName || "").toLowerCase().trim();
          return idMatch || nameMatch;
        });

        if (matchedClient) {
          resolvedClientId = String(matchedClient.id || matchedClient._id);
        } else {
          resolvedClientId = String(resolvedClientId || "");
        }

        setEditForm({
          invoiceNumber: fullInvoice.invoiceNumber,
          invoiceDate: fullInvoice.invoiceDate ? fullInvoice.invoiceDate.split('T')[0] : new Date().toISOString().split("T")[0],
          clientId: resolvedClientId,
          clientName: fullInvoice.clientName || "",
          cgstPercentage: String(fullInvoice.cgstPercentage ?? "9"),
          sgstPercentage: String(fullInvoice.sgstPercentage ?? "9"),
          accountType: fullInvoice.accountType || "default",
          accountDetails: fullInvoice.accountDetails || defaultAccountDetails,
          selectedCandidates: (fullInvoice.candidates || []).map(c => ({
            id: c._id || c.candidateProfileId || Date.now() + Math.random(),
            candidateProfileId: c.candidateProfileId,
            name: c.name,
            role: c.role,
            joiningDate: c.joiningDate ? c.joiningDate.split('T')[0] : "",
            actualSalary: c.actualSalary,
            percentage: c.percentage,
            payment: c.payment
          }))
        });
        
        setIsEditModalOpen(true);
      } else {
        toast({ title: "Failed to load complete invoice details", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error loading invoice details", variant: "destructive" });
    }
  };

  const handleEditCandidateField = (candId, field, value) => {
    if (!editForm) return;
    setEditForm(prev => {
      const updatedCandidates = prev.selectedCandidates.map(c => {
        if (c.id === candId) {
          const updated = { ...c, [field]: value };
          if (field === 'actualSalary' || field === 'percentage') {
            const salary = parseFloat(field === 'actualSalary' ? value : updated.actualSalary) || 0;
            const percentage = parseFloat(field === 'percentage' ? value : updated.percentage) || 0;
            updated.payment = Math.round((salary * percentage) / 100);
          }
          return updated;
        }
        return c;
      });
      return { ...prev, selectedCandidates: updatedCandidates };
    });
  };

  const getEditFormTotals = () => {
    if (!editForm) return { subtotal: 0, cgst: 0, sgst: 0, grandTotal: 0 };
    const subtotal = editForm.selectedCandidates.reduce((sum, c) => sum + (parseFloat(c.payment) || 0), 0);
    const cgst = Math.round((subtotal * (parseFloat(editForm.cgstPercentage) || 0)) / 100);
    const sgst = Math.round((subtotal * (parseFloat(editForm.sgstPercentage) || 0)) / 100);
    const grandTotal = subtotal + cgst + sgst;
    return { subtotal, cgst, sgst, grandTotal };
  };

  const handleEditBankSelect = (val) => {
    if (!editForm) return;
    if (val === 'manual') {
      setEditForm(prev => ({ ...prev, accountType: val, accountDetails: { accountNumber: '', name: '', bank: '', branch: '', ifsc: '', pan: '', gst: '' } }));
    } else if (val === 'no') {
      setEditForm(prev => ({ ...prev, accountType: val, accountDetails: { accountNumber: '', name: '', bank: '', branch: '', ifsc: '', pan: '', gst: '' } }));
    } else {
      const selectedBank = companyBanks.find(b => b._id === val);
      if (selectedBank) {
        setEditForm(prev => ({
          ...prev,
          accountType: val,
          accountDetails: {
            accountNumber: selectedBank.accountNumber,
            name: selectedBank.name,
            bank: selectedBank.bank,
            branch: selectedBank.branch,
            ifsc: selectedBank.ifsc,
            pan: selectedBank.pan || '',
            gst: selectedBank.gst || ''
          }
        }));
      }
    }
  };

  const handleSaveEditedInvoice = async (e) => {
    e.preventDefault();
    if (!editForm || !editInvoiceId) return;

    setIsSaving(true);
    try {
      const editClient = clients.find(c => c.id === editForm.clientId);
      const matchedCompany = agreementCompanies.find(co => 
        String(co.name || '').toLowerCase() === String(editClient?.companyName || '').toLowerCase()
      );
      const templateToUse = matchedCompany?.templateUrl || '/New_Template.pdf';

      const blob = await generateFilledPdf(editForm, templateToUse);
      if (!blob) {
        throw new Error("Could not regenerate PDF for the invoice.");
      }

      const headers = await getAuthHeader();
      delete headers['Content-Type'];

      const cands = editForm.selectedCandidates;
      let totalPay = 0;
      cands.forEach((c) => { totalPay += (parseFloat(c.payment) || 0); });
      const totalCgstAmt = Math.round((totalPay * parseFloat(editForm.cgstPercentage || 0)) / 100);
      const totalSgstAmt = Math.round((totalPay * parseFloat(editForm.sgstPercentage || 0)) / 100);
      const grandTotalAmt = totalPay + totalCgstAmt + totalSgstAmt;

      const metadata = {
        invoiceNumber: editForm.invoiceNumber,
        invoiceDate: editForm.invoiceDate,
        clientId: editForm.clientId,
        clientName: editClient?.companyName || "Unknown Client",
        candidates: cands.map(c => ({
          candidateProfileId: c.candidateProfileId || null,
          name: c.name,
          role: c.role || "",
          joiningDate: c.joiningDate || null,
          actualSalary: parseFloat(c.actualSalary) || 0,
          percentage: parseFloat(c.percentage) || 0,
          payment: parseFloat(c.payment) || 0
        })),
        candidateCount: cands.length,
        subtotal: totalPay,
        cgstPercentage: parseFloat(editForm.cgstPercentage) || 0,
        cgstAmount: totalCgstAmt,
        sgstPercentage: parseFloat(editForm.sgstPercentage) || 0,
        sgstAmount: totalSgstAmt,
        grandTotal: grandTotalAmt,
        accountType: editForm.accountType,
        accountDetails: editForm.accountDetails,
        format: 'pdf',
        isAutogenerated: true
      };

      const formData = new FormData();
      formData.append('file', blob, `Invoice_${editForm.invoiceNumber}.pdf`);
      formData.append('metadata', JSON.stringify(metadata));

      const res = await fetch(`${API_URL}/invoices/${editInvoiceId}`, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Invoice file could not be saved.');
      }

      toast({ title: "Invoice updated successfully. 🎉" });
      setIsEditModalOpen(false);
      setEditForm(null);
      setEditInvoiceId(null);

      fetchBilledCandidates();
      fetchHistory(historyPage);
    } catch (err) {
      console.error(err);
      toast({ title: err.message || "Failed to update invoice", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    clientId: "",
    candidateProfileId: "",
    candidateName: "",
    joiningDate: "",
    role: "",
    actualSalary: "",
    percentage: "",
    payment: 0,
    cgstPercentage: "9",
    sgstPercentage: "9",
    accountType: "manual",
    accountDetails: { accountNumber: '', name: '', bank: '', branch: '', ifsc: '', pan: '', gst: '' },
    selectedCandidates: [],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [showCandidateList, setShowCandidateList] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [isCustomCandidate, setIsCustomCandidate] = useState(false);
  const [isCandidateDropdownOpen, setIsCandidateDropdownOpen] = useState(false);
  const [candSearchInput, setCandSearchInput] = useState("");
  const [history, setHistory] = useState([]);
  
  const [legacyHistory, setLegacyHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('server');
  const [isSaving, setIsSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateModalInvoice, setCandidateModalInvoice] = useState(null);

  const [invoiceTemplates, setInvoiceTemplates] = useState([]);
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState('/New_Template.pdf');
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [agreementCompanies, setAgreementCompanies] = useState([]);
  const [autoGeneratingIds] = useState(() => new Set());
  const sessionBilledCandidates = useRef(new Set());
  const [historyFirstLoaded, setHistoryFirstLoaded] = useState(false);
  const [billedCandidateIds, setBilledCandidateIds] = useState(new Set());

  const parseDuration = (val) => {
    if (!val) return { days: 0, hours: 0, minutes: 0 };
    const parts = String(val).split(':');
    if (parts.length === 3) {
      return {
        days: parseInt(parts[0]) || 0,
        hours: parseInt(parts[1]) || 0,
        minutes: parseInt(parts[2]) || 0
      };
    }
    return {
      days: parseInt(val) || 0,
      hours: 0,
      minutes: 0
    };
  };

  const activePlacements = useMemo(() => {
    const list = [];
    candidates.forEach(cand => {
      const isJoinedDirect = String(cand.status || '').toLowerCase() === 'joined';
      const joinedSubmission = cand.submissions?.find(sub => 
        String(sub.pipelineStage || sub.status || '').toLowerCase() === 'joined'
      );

      if (isJoinedDirect || joinedSubmission) {
        const clientName = joinedSubmission ? joinedSubmission.clientName : cand.client;
        if (!clientName) return;

        const clientNameLower = String(clientName).toLowerCase().trim();
        const matchingCompany = agreementCompanies.find(co => {
          const coName = String(co.company_name || co.name || '').toLowerCase().trim();
          return coName && (coName === clientNameLower || coName.includes(clientNameLower) || clientNameLower.includes(coName));
        });

        const clientObj = clients.find(c => {
          const cName = String(c.companyName || '').toLowerCase().trim();
          return cName && (cName === clientNameLower || cName.includes(clientNameLower) || clientNameLower.includes(cName));
        });

        const hasInvoice = billedCandidateIds.has(String(cand._id || cand.id));

        const durationVal = matchingCompany?.invoice_post_joining || clientObj?.lockingPeriod || '0:0:0';
        const duration = parseDuration(durationVal);

        const rawJoinDate = joinedSubmission 
          ? (joinedSubmission.updatedAt || joinedSubmission.createdAt) 
          : (cand.statusChangedAt || cand.createdAt);

        const joinDate = new Date(rawJoinDate || new Date());
        const targetDate = new Date(joinDate.getTime());
        targetDate.setDate(targetDate.getDate() + duration.days);
        targetDate.setHours(targetDate.getHours() + duration.hours);
        targetDate.setMinutes(targetDate.getMinutes() + duration.minutes);

        const ctcValue = parseFloat(cand.ctc ? cand.ctc.replace(/[^0-9.]/g, "") : "0") * 100000 || 0;
        const percentage = matchingCompany
          ? (parseFloat(matchingCompany.compensation?.percentage) || parseFloat(matchingCompany.percentage) || 8.33)
          : 8.33;

        list.push({
          candidate: {
            ...cand,
            client: clientName,
            status: 'Joined',
            _resolvedJoinDate: joinDate.toISOString()
          },
          company: matchingCompany,
          joinDate,
          targetDate,
          hasInvoice,
          durationVal,
          ctcValue,
          percentage,
          billingAmount: Math.round(ctcValue * (percentage / 100))
        });
      }
    });
    return list;
  }, [candidates, agreementCompanies, billedCandidateIds, clients]);

  const autoGenerateInvoice = async (candidate, company, placementOverride = null) => {
    if (autoGeneratingIds.has(candidate._id)) return;
    autoGeneratingIds.add(candidate._id);
    
    toast({ title: `Auto-billing: ${candidate.name}...`, description: "Generating placement invoice." });
    
    try {
      const ctcValue = placementOverride?.ctcValue ?? (parseFloat(candidate.ctc ? candidate.ctc.replace(/[^0-9.]/g, "") : "0") * 100000 || 0);
      const percentage = placementOverride?.percentage
        ?? parseFloat(company?.compensation?.percentage)
        ?? parseFloat(company?.percentage)
        ?? 8.33;
      const resolvedJoinDate = placementOverride?.joinDate || (candidate._resolvedJoinDate ? new Date(candidate._resolvedJoinDate) : null) || new Date();
      const lockingPeriod = placementOverride?.durationVal || company?.invoice_post_joining || 'N/A';
      const payment = Math.round(ctcValue * (percentage / 100));
      
      const cgstPercentage = 9;
      const sgstPercentage = 9;
      const cgstAmount = Math.round(payment * 0.09);
      const sgstAmount = Math.round(payment * 0.09);
      const grandTotal = payment + cgstAmount + sgstAmount;
      
      const defaultBank = companyBanks.find(b => b.isDefault) || companyBanks[0];
      const accountDetails = defaultBank ? {
        accountNumber: defaultBank.accountNumber,
        name: defaultBank.name,
        bank: defaultBank.bank,
        branch: defaultBank.branch,
        ifsc: defaultBank.ifsc,
        pan: defaultBank.pan || '',
        gst: defaultBank.gst || ''
      } : defaultAccountDetails;
      
      const templateToUse = company.templateUrl || '/New_Template.pdf';
      const response = await fetch(`${templateToUse}?v=${new Date().getTime()}`);
      const existingPdfBytes = await response.arrayBuffer();
      
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const drawText = (text, x, y, size = 9.5, isBold = false) => {
        if (!text) return;
        firstPage.drawText(String(text).trim(), {
          x,
          y: height - y - (size / 3),
          size,
          color: rgb(0, 0, 0),
          font: isBold ? helveticaBold : helvetica,
        });
      };
      
      const drawTextCentered = (text, centerX, y, maxW, isBold = false, size = 9.5) => {
        if (!text) return;
        const font = isBold ? helveticaBold : helvetica;
        let sz = size;
        let t = String(text).trim();
        let w = font.widthOfTextAtSize(t, sz);
        while (w > maxW && sz > 5) {
          sz -= 0.5;
          w = font.widthOfTextAtSize(t, sz);
        }
        const x = centerX - (w / 2);
        firstPage.drawText(t, {
          x,
          y: height - y - (sz / 3),
          size: sz,
          color: rgb(0, 0, 0),
          font,
        });
      };
      
      const invNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const invDateStr = new Date().toISOString().split("T")[0];
      
      drawText("To,", 68, 140, 10, true);
      drawText(company.name || "", 68, 155, 11, true);
      
      const rawParts = (company.address || "").split(",").map(p => p.trim()).filter(Boolean);
      let addressLines = [];
      if (rawParts.length <= 2) {
        addressLines = rawParts;
      } else {
        const city = rawParts[rawParts.length - 2];
        const state = rawParts[rawParts.length - 1];
        const middleParts = rawParts.slice(0, rawParts.length - 2);
        const buildingPattern = /\d|floor|f\.no|no\.|h\.no|plot|flat|door|d\.no|beside|above|below|near|opp|block|wing|phase|sector|tower|unit|suite|rd\s|street|building|complex|nagar/i;
        const buildingParts = middleParts.filter(p => buildingPattern.test(p));
        const areaParts = middleParts.filter(p => !buildingPattern.test(p));
        const lines = [];
        if (buildingParts.length > 0) lines.push(buildingParts.join(", "));
        areaParts.forEach(a => lines.push(a));
        lines.push(city, state);
        addressLines = lines;
      }
      
      const invoiceDateFormatted = getOrdinalDate(invDateStr);
      let addressEndY = 170;
      const contactPerson = company.sig_name || company.signature || '';
      if (contactPerson) {
        drawText(contactPerson, 68, 170, 10, true);
        addressLines.forEach((line, i) => drawText(line, 68, 185 + i * 13, 10, true));
        const gstY = 185 + addressLines.length * 13;
        if (company.gstNumber || company.gst_number || company.gst) {
          drawText(`GST : ${company.gstNumber || company.gst_number || company.gst}`, 68, gstY, 10, true);
          addressEndY = gstY + 13;
        } else {
          addressEndY = gstY;
        }
      } else {
        addressLines.forEach((line, i) => drawText(line, 68, 170 + i * 13, 10, true));
        const gstY = 170 + addressLines.length * 13;
        if (company.gstNumber || company.gst_number || company.gst) {
          drawText(`GST : ${company.gstNumber || company.gst_number || company.gst}`, 68, gstY, 10, true);
          addressEndY = gstY + 13;
        } else {
          addressEndY = gstY;
        }
      }
      
      drawText(invoiceDateFormatted, 468, addressEndY + 15, 10, true);
      const afterAddressY = addressEndY + 35;
      
      drawText(`No: ${invNumber}`, 68, Math.max(280, afterAddressY), 10, true);
      drawText("SUB: Final Invoice", 68, Math.max(298, afterAddressY + 18), 10, true);
      drawTextCentered("TAX INVOICE", width / 2, Math.max(320, afterAddressY + 40), 200, true, 14);
      
      const rowHR = 18;
      const rowDR = 18;
      let currentY = 345;
      const headerFs = 8.5;
      const dataFs = 8;
      const accFs = 9;
      const accSpacing = 13;
      
      const colStarts = [68, 96, 201, 281, 356, 426, 476];
      const colWidths = [28, 105, 80, 75, 70, 50, 70];
      const colCenters = colStarts.map((s, i) => s + colWidths[i] / 2);
      const headersList = ["S.No", "Candidate Name", "Role", "Joining Date", "Actual Salary", "Percentage", "Payment"];
      
      const drawCell = (text, x, w, y, h, align = 'center', isBold = false, fs = dataFs) => {
        firstPage.drawRectangle({
          x, y: height - (y + h / 2), width: w, height: h,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        if (text) {
          if (align === 'center') drawTextCentered(text, x + w / 2, y, w - 4, isBold, fs);
          else if (align === 'left') drawText(text, x + 4, y, fs, isBold);
          else drawTextCentered(text, x + w / 2, y, w - 4, isBold, fs);
        }
      };
      
      headersList.forEach((h, i) => {
        drawCell(h, colStarts[i], colWidths[i], currentY, rowHR, 'center', true, headerFs);
      });
      currentY += (rowHR / 2 + rowDR / 2);
      
      drawCell("1", colStarts[0], colWidths[0], currentY, rowDR);
      
      const candidateFullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
      firstPage.drawRectangle({
        x: colStarts[1], y: height - (currentY + rowDR / 2), width: colWidths[1], height: rowDR,
        borderColor: rgb(0, 0, 0), borderWidth: 0.7
      });
      if (candidateFullName.length > 18) {
        const splitIdx = candidateFullName.lastIndexOf(" ", 18) || 18;
        const line1 = candidateFullName.substring(0, splitIdx).trim();
        const line2 = candidateFullName.substring(splitIdx).trim();
        drawTextCentered(line1, colCenters[1], currentY - 4, colWidths[1] - 4, false, dataFs - 1);
        drawTextCentered(line2, colCenters[1], currentY + 4, colWidths[1] - 4, false, dataFs - 1);
      } else {
        drawTextCentered(candidateFullName, colCenters[1], currentY, colWidths[1] - 4, false, dataFs);
      }
      
      drawCell(candidate.position || candidate.role || "Developer", colStarts[2], colWidths[2], currentY, rowDR);
      const candJoinDateFormatted = getOrdinalDate(resolvedJoinDate);
      drawCell(candJoinDateFormatted, colStarts[3], colWidths[3], currentY, rowDR, 'center', false);
      drawCell(Number(ctcValue).toLocaleString("en-IN"), colStarts[4], colWidths[4], currentY, rowDR);
      drawCell(`${percentage}%`, colStarts[5], colWidths[5], currentY, rowDR);
      drawCell(Number(payment).toLocaleString("en-IN"), colStarts[6], colWidths[6], currentY, rowDR);
      
      currentY += rowDR;
      
      const tH = 18;
      
      const drawSummaryRow = (label, amount, yOffset, isBold = true) => {
        const y = currentY + yOffset;
        firstPage.drawRectangle({
          x: colStarts[0], y: height - (y + tH / 2), width: colStarts[6] - colStarts[0], height: tH,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        firstPage.drawRectangle({
          x: colStarts[6], y: height - (y + tH / 2), width: colWidths[6], height: tH,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        const w = (isBold ? helveticaBold : helvetica).widthOfTextAtSize(label, 10);
        firstPage.drawText(label, {
          x: colStarts[6] - 15 - w,
          y: height - y - 3.33,
          size: 10,
          font: isBold ? helveticaBold : helvetica,
          color: rgb(0, 0, 0)
        });
        drawTextCentered(amount.toLocaleString("en-IN"), colCenters[6], y, colWidths[6] - 4, isBold, 10);
      };
      
      drawSummaryRow(`CGST (9%)`, cgstAmount, 0, false);
      drawSummaryRow(`SGST (9%)`, sgstAmount, tH, false);
      drawSummaryRow("Grand Total", grandTotal, tH * 2, true);
      
      currentY += tH * 2;
      
      const footerY = currentY + 40;
      drawText("In Words : ", 68, footerY, 10, true);
      drawText(numberToWords(grandTotal).toUpperCase(), 125, footerY, 9.5);
      
      const accY = footerY + 50;
      if (company.accountType !== "no") {
        drawText("Account Details: -", 68, accY - 18, 11, true);
        const detailsLines = [
          `Account No. : ${accountDetails.accountNumber}`,
          `Name : ${accountDetails.name}`,
          `Bank : ${accountDetails.bank}`,
          `Branch : ${accountDetails.branch}`,
          `IFSC Code : ${accountDetails.ifsc}`,
          `PAN No. : ${accountDetails.pan}`,
          `GST : ${accountDetails.gst}`
        ];
        detailsLines.forEach((line, idx) => {
          drawText(line, 68, accY + (idx * accSpacing), accFs, true);
        });
      }
      
      const sigOffset = (accSpacing * 10) + 80;
      const sigY = accY + sigOffset;
      drawText("Navya S", 68, sigY, 11, true);
      drawText("Vagarious Solutions Pvt Ltd", 68, sigY + 16, 11, true);
      
      const finalPdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([finalPdfBytes], { type: "application/pdf" });
      
      const formData = new FormData();
      formData.append("file", pdfBlob, `Invoice_${invNumber}.pdf`);
      
      const invoiceMetadata = {
        invoiceNumber: invNumber,
        invoiceDate: invDateStr,
        clientId: company.id || company._id,
        clientName: company.name,
        candidates: [{
          candidateProfileId: candidate._id || candidate.id,
          name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
          role: candidate.position || candidate.role || "",
          joiningDate: resolvedJoinDate.toISOString(),
          actualSalary: ctcValue,
          percentage: percentage,
          payment: payment
        }],
        candidateCount: 1,
        subtotal: payment,
        cgstPercentage,
        cgstAmount,
        sgstPercentage,
        sgstAmount,
        grandTotal,
        accountType: defaultBank ? defaultBank._id : 'manual',
        accountDetails,
        isAutogenerated: true,
        agreementData: {
          lockingPeriod,
          commissionPercentage: percentage,
          agreementCompanyId: company.id || company._id
        }
      };
      
      formData.append("metadata", JSON.stringify(invoiceMetadata));
      
      const headers = await authHeaders();
      const uploadRes = await fetch(`${API_URL}/invoices`, {
        method: "POST",
        headers,
        body: formData
      });
      
      if (uploadRes.ok) {
        toast({ title: "Invoice Auto-Generated! 🎉", description: `Created INV ${invNumber} for ${candidate.name}.` });
        fetchBilledCandidates();
        fetchHistory(1);
      } else {
        const err = await uploadRes.json();
        console.error("Auto-generate upload failed:", err);
      }
    } catch (err) {
      console.error("Auto-generate invoice error:", err);
    } finally {
      autoGeneratingIds.delete(candidate._id);
    }
  };

  const [companyBanks, setCompanyBanks] = useState([]);
  const [isManageBanksOpen, setIsManageBanksOpen] = useState(false);
  const [banksLoading, setBanksLoading] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const initialBankForm = {
    label: "",
    accountNumber: "",
    name: "",
    bank: "",
    branch: "",
    ifsc: "",
    pan: "",
    gst: "",
    isDefault: false,
  };
  const [bankForm, setBankForm] = useState(initialBankForm);

  const getAuthHeader = async () => ({
    "Content-Type": "application/json",
    ...(await authHeaders()),
  });

  const fetchHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const headers = await getAuthHeader();
      let queryUrl = `${API_URL}/invoices?page=${page}&limit=10`;
      if (historySearch) queryUrl += `&search=${encodeURIComponent(historySearch)}`;
      if (historyStartDate) queryUrl += `&startDate=${historyStartDate}`;
      if (historyEndDate) queryUrl += `&endDate=${historyEndDate}`;
      if (form.clientId) queryUrl += `&clientId=${form.clientId}`;

      const res = await fetch(queryUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        const sanitizedInvoices = (data.invoices || []).map(item => {
          if (item.invoiceNumber && String(item.invoiceNumber).toUpperCase().includes('-AUTO-')) {
            return {
              ...item,
              isAutogenerated: true,
              invoiceNumber: String(item.invoiceNumber).replace(/-AUTO-/i, '-')
            };
          }
          return item;
        });
        setHistory(sanitizedInvoices);
        setHistoryPage(data.pagination.page);
        setHistoryTotalPages(data.pagination.totalPages);
        setHistoryFirstLoaded(true);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchBilledCandidates = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/invoices?all=true`, { headers });
      if (res.ok) {
        const data = await res.json();
        const ids = new Set();
        (data.invoices || []).forEach(inv => {
          inv.candidates?.forEach(c => {
            if (c.candidateProfileId) {
              ids.add(String(c.candidateProfileId));
            }
          });
        });
        setBilledCandidateIds(ids);
        setHistoryFirstLoaded(true);
      }
    } catch (err) {
      console.error("Error loading billed candidates:", err);
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const headers = await getAuthHeader();
      const u = API_URL.replace(/\/api$/, "") + "/upload/templates";
      const res = await fetch(u, { headers });
      if (res.ok) {
        const data = await res.json();
        const filteredTemplates = (data || []).filter(t => 
          t.mimeType === 'application/pdf' ||
          t.mimeType?.includes('word') ||
          t.mimeType?.includes('officedocument') ||
          t.fileName?.endsWith('.docx')
        );
        setInvoiceTemplates(filteredTemplates);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const headers = await getAuthHeader();
      const u = API_URL.replace(/\/api$/, "") + `/upload/templates/${id}`;
      const res = await fetch(u, { method: "DELETE", headers });
      if (res.ok) {
        toast({ title: "Template deleted successfully." });
        if (previewTemplate && previewTemplate.id === id) {
          setPreviewTemplate(null);
        }
        fetchTemplates();
      } else {
        toast({ title: "Failed to delete template.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast({ title: "Error deleting template.", variant: "destructive" });
    }
  };

  const fetchCompanyBanks = async () => {
    setBanksLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/company-banks`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCompanyBanks(data || []);
        
        const defaultBank = (data || []).find(b => b.isDefault);
        if (defaultBank) {
          setForm(prev => {
            const isEmptyDetails = !prev.accountDetails.accountNumber && !prev.accountDetails.bank;
            if (prev.accountType === 'manual' && isEmptyDetails) {
              return {
                ...prev,
                accountType: defaultBank._id,
                accountDetails: {
                  accountNumber: defaultBank.accountNumber,
                  name: defaultBank.name,
                  bank: defaultBank.bank,
                  branch: defaultBank.branch,
                  ifsc: defaultBank.ifsc,
                  pan: defaultBank.pan || '',
                  gst: defaultBank.gst || ''
                }
              };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error("Error loading bank details:", err);
    } finally {
      setBanksLoading(false);
    }
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    try {
      const headers = await getAuthHeader();
      const method = editingBank ? 'PUT' : 'POST';
      const url = editingBank 
        ? `${API_URL}/company-banks/${editingBank._id}` 
        : `${API_URL}/company-banks`;

      const payload = {
        ...bankForm,
        label: bankForm.label || `${bankForm.bank} (${bankForm.accountNumber.slice(-4)})`
      };

      const res = await fetch(url, {
        method,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: editingBank ? "Bank account updated successfully" : "Bank account added successfully" });
        setBankForm(initialBankForm);
        setEditingBank(null);
        fetchCompanyBanks();
      } else {
        const err = await res.json();
        toast({ title: err.message || "Failed to save bank account", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error saving bank details", variant: "destructive" });
    }
  };

  const handleDeleteBank = async (id) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/company-banks/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        toast({ title: "Bank account deleted successfully" });
        fetchCompanyBanks();
      } else {
        toast({ title: "Failed to delete bank account", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error deleting bank account", variant: "destructive" });
    }
  };

  const fetchAgreementCompanies = async () => {
    try {
      const headers = await getAuthHeader();
      const u = API_URL.replace(/\/api$/, "") + "/agreement-companies";
      const res = await fetch(u, { headers });
      if (res.ok) {
        const data = await res.json();
        setAgreementCompanies(data || []);
      }
    } catch (err) {
      console.error("Error loading agreement companies:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();
        const [resClients, resCandidates] = await Promise.all([
          fetch(`${API_URL}/clients`, { headers }),
          fetch(`${API_URL}/candidates?view=invoice&includeSubmissions=true`, { headers }),
        ]);
        if (resClients.ok) setClients((await resClients.json()).map((c) => ({ ...c, id: c._id })));
        if (resCandidates.ok) setCandidates((await resCandidates.json()).map((c) => ({ ...c, id: c._id })));
      } catch {
        toast({ title: "Error fetching clients/candidates data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    try {
      const saved = localStorage.getItem("invoice_history");
      if (saved) {
        const parsed = JSON.parse(saved).map(item => {
          const isAuto = item.isAutogenerated || String(item.invoiceNumber || '').toUpperCase().includes('-AUTO-');
          return {
            ...item,
            isLegacy: true,
            isAutogenerated: isAuto,
            invoiceNumber: String(item.invoiceNumber || '').replace(/-AUTO-/i, '-')
          };
        });
        setLegacyHistory(parsed);
      }
    } catch (e) {
      console.error("Error loading legacy history:", e);
    }
 
    fetchData();
    fetchTemplates();
    fetchCompanyBanks();
    fetchAgreementCompanies();
    fetchBilledCandidates();
  }, []);

  useEffect(() => {
    fetchHistory(historyPage);
  }, [historyPage]);

  const handleAddCandidate = (candidate) => {
    const ctc = parseFloat(candidate.ctc ? candidate.ctc.replace(/[^0-9.]/g, "") : "0") * 100000 || 0;
    setForm(p => {
      let resolvedPct = p.percentage || "";
      if (!resolvedPct && p.clientId) {
        const client = clients.find(c => c.id === p.clientId);
        if (client) {
          const clientPct = String(client.percentage || '').replace(/[^0-9.]/g, '');
          if (clientPct) {
            resolvedPct = clientPct;
          } else {
            const clientNameLower = (client.companyName || '').toLowerCase().trim();
            const matchedAC = agreementCompanies.find(ac => {
              const acName = (ac.company_name || ac.name || '').toLowerCase().trim();
              return acName && (acName === clientNameLower || acName.includes(clientNameLower) || clientNameLower.includes(acName));
            });
            const acPct = parseFloat(matchedAC?.compensation?.percentage);
            if (!isNaN(acPct) && acPct > 0) resolvedPct = String(acPct);
          }
        }
      }
      return {
        ...p,
        candidateProfileId: candidate._id || candidate.id || "",
        candidateName: candidate.name || "",
        role: candidate.position || "",
        joiningDate: candidate._resolvedJoinDate ? candidate._resolvedJoinDate.split('T')[0] : (candidate.joiningDate ? candidate.joiningDate.split('T')[0] : new Date().toISOString().split("T")[0]),
        actualSalary: ctc,
        percentage: resolvedPct,
        cgstPercentage: "9",
        sgstPercentage: "9"
      };
    });
    setIsCustomCandidate(false);
    toast({ title: `Auto-filled details for ${candidate.name}` });
  };

  const addCandidateToList = () => {
    if (!form.candidateName) {
      toast({ title: "Please select or enter a candidate name", variant: "destructive" });
      return;
    }
    const newCandidate = {
      id: Date.now(),
      candidateProfileId: form.candidateProfileId,
      name: form.candidateName,
      role: form.role,
      joiningDate: form.joiningDate,
      actualSalary: form.actualSalary,
      percentage: form.percentage,
      payment: form.payment
    };
    setForm(prev => ({
      ...prev,
      selectedCandidates: [...prev.selectedCandidates, newCandidate],
      candidateProfileId: "",
      candidateName: "",
      joiningDate: "",
      role: "",
      actualSalary: "",
      percentage: "",
      payment: 0
    }));
    setIsCustomCandidate(false);
    setShowCandidateList(true);
    toast({ title: "Candidate added to list" });
  };

  const removeCandidateFromList = (id) => {
    setForm(prev => ({
      ...prev,
      selectedCandidates: prev.selectedCandidates.filter(c => c.id !== id)
    }));
  };

  const selectedClient = useMemo(() => clients.find((c) => c.id === form.clientId), [clients, form.clientId]);

  const currentSelectedCand = useMemo(() => {
    return candidates.find(c => (c._id || c.id) === form.candidateProfileId);
  }, [candidates, form.candidateProfileId]);

  const filteredCandidates = useMemo(() => {
    if (!selectedClient) return [];
    const targetCompany = String(selectedClient.companyName || "").toLowerCase().trim();
    if (!targetCompany) return [];

    const placements = activePlacements.filter(p => {
      const clientName = String(p.candidate.client || "").toLowerCase().trim();
      return clientName === targetCompany;
    });

    return placements.map(p => p.candidate);
  }, [activePlacements, selectedClient]);

  const searchedCandidates = useMemo(() => {
    return filteredCandidates.filter(c => 
      !candSearchInput || 
      c.name?.toLowerCase().includes(candSearchInput.toLowerCase())
    );
  }, [filteredCandidates, candSearchInput]);

  useEffect(() => {
    const salary = parseFloat(form.actualSalary) || 0;
    const perc = parseFloat(form.percentage) || 0;
    const payment = Math.round((salary * perc) / 100);
    setForm(prev => ({ ...prev, payment }));
  }, [form.actualSalary, form.percentage]);

  useEffect(() => {
    if (!form.clientId) return;
    const client = clients.find(c => c.id === form.clientId);
    if (!client) return;

    const rawClientPct = String(client.percentage || '').replace(/[^0-9.]/g, '');
    if (rawClientPct) {
      setForm(prev => ({ ...prev, percentage: rawClientPct }));
      return;
    }

    const clientNameLower = (client.companyName || '').toLowerCase().trim();
    const matchedAgreement = agreementCompanies.find(ac => {
      const acName = (ac.company_name || ac.name || '').toLowerCase().trim();
      return acName && (acName === clientNameLower || acName.includes(clientNameLower) || clientNameLower.includes(acName));
    });
    const agreementPct = parseFloat(matchedAgreement?.compensation?.percentage);
    if (!isNaN(agreementPct) && agreementPct > 0) {
      setForm(prev => ({ ...prev, percentage: String(agreementPct) }));
    }
  }, [form.clientId, clients, agreementCompanies]);

  const generateFilledPdf = async (overrideForm = null, overrideTemplate = null) => {
    const f = overrideForm || form;
    const templateToUse = overrideTemplate || selectedInvoiceTemplate;
    const resolvedClient = clients.find(c => c.id === f.clientId);

    const isDocx = invoiceTemplates.some(t => 
      t.url === templateToUse && 
      (t.mimeType?.includes('word') || t.mimeType?.includes('officedocument') || t.fileName?.endsWith('.docx'))
    );
    if (isDocx) {
      alert("Word document templates (.docx) cannot be used as background templates for rendering the invoice PDF. Please select a PDF background template instead.");
      setIsGenerating(false);
      return null;
    }
    setIsGenerating(true);
    try {
      const response = await fetch(`${templateToUse}?v=${new Date().getTime()}`);
      const existingPdfBytes = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const { width, height } = firstPage.getSize();

      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const drawText = (text, x, y, size = 9.5, isBold = false) => {
        if (!text || text === "undefined") return;
        firstPage.drawText(String(text).trim(), {
          x,
          y: height - y - (size / 3),
          size,
          color: rgb(0, 0, 0),
          font: isBold ? helveticaBold : helvetica,
        });
      };

      const drawTextCentered = (text, centerX, y, maxW, isBold = false, size = 9.5) => {
        if (!text || text === "undefined") return;
        const font = isBold ? helveticaBold : helvetica;
        let sz = size;
        let t = String(text).trim();
        let w = font.widthOfTextAtSize(t, sz);
        while (w > maxW && sz > 5) {
          sz -= 0.5;
          w = font.widthOfTextAtSize(t, sz);
        }
        const x = centerX - (w / 2);
        firstPage.drawText(t, {
          x,
          y: height - y - (sz / 3),
          size: sz,
          color: rgb(0, 0, 0),
          font,
        });
      };

      drawText("To,", 68, 140, 10, true);
      drawText(resolvedClient?.companyName || "", 68, 155, 11, true);

      const rawParts = (resolvedClient?.address || "").split(",").map(p => p.trim()).filter(Boolean);
      let addressLines = [];
      if (rawParts.length <= 2) {
        addressLines = rawParts;
      } else {
        const city = rawParts[rawParts.length - 2];
        const state = rawParts[rawParts.length - 1];
        const middleParts = rawParts.slice(0, rawParts.length - 2);
        const buildingPattern = /\d|floor|f\.no|no\.|h\.no|plot|flat|door|d\.no|beside|above|below|near|opp|block|wing|phase|sector|tower|unit|suite|rd\s|street|building|complex|nagar/i;
        const buildingParts = middleParts.filter(p => buildingPattern.test(p));
        const areaParts = middleParts.filter(p => !buildingPattern.test(p));
        const lines = [];
        if (buildingParts.length > 0) lines.push(buildingParts.join(", "));
        areaParts.forEach(a => lines.push(a));
        lines.push(city, state);
        addressLines = lines;
      }

      const invoiceDateStr = getOrdinalDate(f.invoiceDate);
      let addressEndY = 170;
      if (resolvedClient?.contactPerson) {
        drawText(resolvedClient.contactPerson, 68, 170, 10, true);
        addressLines.forEach((line, i) => drawText(line, 68, 185 + i * 13, 10, true));
        const gstY = 185 + addressLines.length * 13;
        if (resolvedClient?.gstNumber) {
          drawText(`GST : ${resolvedClient.gstNumber}`, 68, gstY, 10, true);
          addressEndY = gstY + 13;
        } else {
          addressEndY = gstY;
        }
      } else {
        addressLines.forEach((line, i) => drawText(line, 68, 170 + i * 13, 10, true));
        const gstY = 170 + addressLines.length * 13;
        if (resolvedClient?.gstNumber) {
          drawText(`GST : ${resolvedClient.gstNumber}`, 68, gstY, 10, true);
          addressEndY = gstY + 13;
        } else {
          addressEndY = gstY;
        }
      }

      drawText(invoiceDateStr, 468, addressEndY + 15, 10, true);
      const afterAddressY = addressEndY + 35;

      drawText(`No: ${f.invoiceNumber}`, 68, Math.max(280, afterAddressY), 10, true);
      drawText("SUB: Final Invoice", 68, Math.max(298, afterAddressY + 18), 10, true);
      drawTextCentered("TAX INVOICE", width / 2, Math.max(320, afterAddressY + 40), 200, true, 14);

      const cands = f.selectedCandidates.length > 0 ? f.selectedCandidates : (f.candidateName ? [{ name: f.candidateName, role: f.role, joiningDate: f.joiningDate, actualSalary: f.actualSalary, percentage: f.percentage, payment: f.payment }] : []);

      const candidateCount = cands.length;
      const isLargeList = candidateCount > 5;

      let rowHR = 18;
      let rowDR = isLargeList ? 15 : 18;
      let currentY = isLargeList ? 342 : 345;
      const headerFs = 8.5;
      const dataFs = isLargeList ? 7.5 : 8;
      const accFs = isLargeList ? 8 : 9;
      const accSpacing = isLargeList ? 11 : 13;

      const colStarts = [68, 96, 201, 281, 356, 426, 476];
      const colWidths = [28, 105, 80, 75, 70, 50, 70];
      const colCenters = colStarts.map((s, i) => s + colWidths[i] / 2);
      const headers = ["S.No", "Candidate Name", "Role", "Joining Date", "Actual Salary", "Percentage", "Payment"];

      const drawCell = (text, x, w, y, h, align = 'center', isBold = false, fs = dataFs) => {
        firstPage.drawRectangle({
          x, y: height - (y + h / 2), width: w, height: h,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        if (text) {
          if (align === 'center') drawTextCentered(text, x + w / 2, y, w - 4, isBold, fs);
          else if (align === 'left') drawText(text, x + 4, y, fs, isBold);
          else drawTextCentered(text, x + w / 2, y, w - 4, isBold, fs);
        }
      };

      headers.forEach((h, i) => {
        drawCell(h, colStarts[i], colWidths[i], currentY, rowHR, 'center', true, headerFs);
      });
      currentY += (rowHR / 2 + rowDR / 2);

      let totalPay = 0;
      cands.forEach((c, i) => {
        totalPay += (parseFloat(c.payment) || 0);
        drawCell(String(i + 1), colStarts[0], colWidths[0], currentY, rowDR);
        const nameText = String(c.name || "");
        firstPage.drawRectangle({
          x: colStarts[1], y: height - (currentY + rowDR / 2), width: colWidths[1], height: rowDR,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        if (nameText.length > 18) {
          const splitIdx = nameText.lastIndexOf(" ", 18) || 18;
          const line1 = nameText.substring(0, splitIdx).trim();
          const line2 = nameText.substring(splitIdx).trim();
          drawTextCentered(line1, colCenters[1], currentY - 4, colWidths[1] - 4, false, dataFs - 1);
          drawTextCentered(line2, colCenters[1], currentY + 4, colWidths[1] - 4, false, dataFs - 1);
        } else {
          drawTextCentered(nameText, colCenters[1], currentY, colWidths[1] - 4, false, dataFs);
        }
        drawCell(c.role || "", colStarts[2], colWidths[2], currentY, rowDR);
        drawCell(c.joiningDate ? getOrdinalDate(c.joiningDate) : "", colStarts[3], colWidths[3], currentY, rowDR, 'center', false);
        drawCell(Number(c.actualSalary || 0).toLocaleString("en-IN"), colStarts[4], colWidths[4], currentY, rowDR);
        drawCell(`${c.percentage || 0}%`, colStarts[5], colWidths[5], currentY, rowDR);
        drawCell(Number(c.payment || 0).toLocaleString("en-IN"), colStarts[6], colWidths[6], currentY, rowDR);
        currentY += rowDR;
      });

      const totalCgstAmt = Math.round((totalPay * parseFloat(f.cgstPercentage || 0)) / 100);
      const totalSgstAmt = Math.round((totalPay * parseFloat(f.sgstPercentage || 0)) / 100);
      const grandTotalAmt = totalPay + totalCgstAmt + totalSgstAmt;

      const tH = isLargeList ? 16 : 18;

      const drawSummaryRow = (label, amount, yOffset, isBold = true) => {
        const y = currentY + yOffset;
        firstPage.drawRectangle({
          x: colStarts[0], y: height - (y + tH / 2), width: colStarts[6] - colStarts[0], height: tH,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        firstPage.drawRectangle({
          x: colStarts[6], y: height - (y + tH / 2), width: colWidths[6], height: tH,
          borderColor: rgb(0, 0, 0), borderWidth: 0.7
        });
        const w = (isBold ? helveticaBold : helvetica).widthOfTextAtSize(label, 10);
        firstPage.drawText(label, {
          x: colStarts[6] - 15 - w,
          y: height - y - 3.33,
          size: 10,
          font: isBold ? helveticaBold : helvetica,
          color: rgb(0, 0, 0)
        });
        drawTextCentered(amount.toLocaleString("en-IN"), colCenters[6], y, colWidths[6] - 4, isBold, 10);
      };

      drawSummaryRow(`CGST (${f.cgstPercentage || 0}%)`, totalCgstAmt, 0, false);
      drawSummaryRow(`SGST (${f.sgstPercentage || 0}%)`, totalSgstAmt, tH, false);
      drawSummaryRow("Grand Total", grandTotalAmt, tH * 2, true);

      currentY += tH * 2;

      const footerY = currentY + (isLargeList ? 25 : 40);
      drawText("In Words : ", 68, footerY, 10, true);
      drawText(numberToWords(grandTotalAmt).toUpperCase(), 125, footerY, isLargeList ? 8.5 : 9.5);

      const accY = footerY + (isLargeList ? 35 : 50);
      if (f.accountType !== "no") {
        drawText("Account Details: -", 68, accY - (isLargeList ? 14 : 18), isLargeList ? 10 : 11, true);
        const details = [
          `Account No. : ${f.accountDetails.accountNumber}`,
          `Name : ${f.accountDetails.name}`,
          `Bank : ${f.accountDetails.bank}`,
          `Branch : ${f.accountDetails.branch}`,
          `IFSC Code : ${f.accountDetails.ifsc}`,
          `PAN No. : ${f.accountDetails.pan}`,
          `GST : ${f.accountDetails.gst}`
        ];
        details.forEach((line, idx) => {
          drawText(line, 68, accY + (idx * accSpacing), accFs, true);
        });
      }

      const sigOffset = f.accountType !== "no" ? (accSpacing * 10) + 80 : 110;
      const sigY = accY + sigOffset;
      drawText("Navya S", 68, sigY, 11, true);
      drawText("Vagarious Solutions Pvt Ltd", 68, sigY + 16, 11, true);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      return blob;

    } catch (error) {
      console.error("PDF Generation error:", error);
      toast({ title: `PDF Error: ${error?.message || error}`, variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      setCurrentPdfBlob(null);
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl("");
      }
      setForm({
        invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        clientId: "",
        candidateProfileId: "",
        candidateName: "",
        joiningDate: "",
        role: "",
        actualSalary: "",
        percentage: "",
        payment: 0,
        cgstPercentage: "9",
        sgstPercentage: "9",
        accountType: "default",
        accountDetails: defaultAccountDetails,
        selectedCandidates: [],
      });
      setIsCustomCandidate(false);
      setEditingInvoiceId(null);
      return;
    }
    
    setIsGenerating(true);
    setIsSaving(true);
    try {
      const blob = await generateFilledPdf();
      if (!blob) {
        throw new Error("Invoice could not be generated.");
      }

      const headers = await getAuthHeader();
      delete headers['Content-Type'];

      const cands = form.selectedCandidates.length > 0
        ? form.selectedCandidates
        : (form.candidateName ? [{ name: form.candidateName, role: form.role, joiningDate: form.joiningDate, actualSalary: form.actualSalary, percentage: form.percentage, payment: form.payment }] : []);

      let totalPay = 0;
      cands.forEach((c) => { totalPay += (parseFloat(c.payment) || 0); });
      const totalCgstAmt = Math.round((totalPay * parseFloat(form.cgstPercentage || 0)) / 100);
      const totalSgstAmt = Math.round((totalPay * parseFloat(form.sgstPercentage || 0)) / 100);
      const grandTotalAmt = totalPay + totalCgstAmt + totalSgstAmt;

      const metadata = {
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        clientId: form.clientId,
        clientName: selectedClient?.companyName || "Unknown Client",
        candidates: cands.map(c => ({
          candidateProfileId: c.candidateProfileId || null,
          name: c.name,
          role: c.role || "",
          joiningDate: c.joiningDate || null,
          actualSalary: parseFloat(c.actualSalary) || 0,
          percentage: parseFloat(c.percentage) || 0,
          payment: parseFloat(c.payment) || 0
        })),
        candidateCount: cands.length,
        subtotal: totalPay,
        cgstPercentage: parseFloat(form.cgstPercentage) || 0,
        cgstAmount: totalCgstAmt,
        sgstPercentage: parseFloat(form.sgstPercentage) || 0,
        sgstAmount: totalSgstAmt,
        grandTotal: grandTotalAmt,
        accountType: form.accountType,
        accountDetails: form.accountDetails,
        format: 'pdf',
        isAutogenerated: !!editingInvoiceId
      };

      const formData = new FormData();
      formData.append('file', blob, `Invoice_${form.invoiceNumber}.pdf`);
      formData.append('metadata', JSON.stringify(metadata));

      const isEdit = !!editingInvoiceId;
      const url = isEdit ? `${API_URL}/invoices/${editingInvoiceId}` : `${API_URL}/invoices`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Invoice file could not be saved.');
      }

      const savedInvoice = await res.json();
      toast({ title: isEdit ? "Invoice updated successfully." : "Invoice generated and saved successfully." });
      setEditingInvoiceId(null);

      setCurrentPdfBlob(blob);
      const urlBlob = URL.createObjectURL(blob);
      setPdfPreviewUrl(urlBlob);
      setShowPreview(true);

      setActiveTab('server');
      setHistoryPage(1);
      fetchBilledCandidates();
      fetchHistory(1);
    } catch (err) {
      console.error(err);
      toast({ title: err.message || "Failed to generate and save invoice", variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    let blob = currentPdfBlob;
    if (!blob) {
      setIsGenerating(true);
      blob = await generateFilledPdf();
      if (blob) {
        setCurrentPdfBlob(blob);
      }
      setIsGenerating(false);
    }

    if (!blob) {
      toast({ title: "Invoice file is not ready for download.", variant: "destructive" });
      return;
    }

    if (downloadFormat === 'pdf') {
      const link = document.createElement('a');
      const durl = URL.createObjectURL(blob);
      link.href = durl;
      link.download = `Invoice_${form.invoiceNumber}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(durl), 2000);
    } else if (downloadFormat === 'word') {
      await downloadAsWord();
    } else if (downloadFormat === 'excel') {
      downloadAsExcel();
    }
  };

  const handleCloseInvoiceModal = () => {
    setIsModalOpen(false);
    setSelectedInvoice(null);
    setSelectedInvoiceDetails(null);
  };

  const handleOpenInvoiceModal = async (invoice) => {
    if (invoice.isLegacy) {
      toast({ 
        title: "Preview unavailable", 
        description: "This invoice was not previously saved as a file on the server.", 
        variant: "destructive" 
      });
      return;
    }
    setSelectedInvoice(invoice);
    setModalLoading(true);
    setIsModalOpen(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/invoices/${invoice._id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoiceDetails(data);
      } else {
        toast({ title: "Failed to fetch invoice details", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error fetching invoice details", variant: "destructive" });
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenCandidatesModal = (invoice) => {
    setCandidateModalInvoice(invoice);
    setIsCandidateModalOpen(true);
  };

  const handleCloseCandidatesModal = () => {
    setIsCandidateModalOpen(false);
    setCandidateModalInvoice(null);
  };

  useEffect(() => {
    if (isModalOpen || isCandidateModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isCandidateModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseInvoiceModal();
        handleCloseCandidatesModal();
      }
    };
    if (isModalOpen || isCandidateModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isCandidateModalOpen]);

  const handleFilterSearch = (e) => {
    e.preventDefault();
    setHistoryPage(1);
    fetchHistory(1);
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to permanently delete this invoice? This action cannot be undone.")) {
      return;
    }
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        toast({ title: "Invoice deleted successfully" });
        fetchBilledCandidates();
        fetchHistory(historyPage);
      } else {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete invoice");
      }
    } catch (err) {
      console.error(err);
      toast({ title: err.message || "Error deleting invoice", variant: "destructive" });
    }
  };

  const downloadAsExcel = () => {
    const wsData = [
      ["TAX INVOICE"],
      [],
      ["Invoice Number:", form.invoiceNumber, "", "Date:", getOrdinalDate(form.invoiceDate)],
      ["To:"],
      [selectedClient?.companyName || ""],
      [selectedClient?.address || ""],
      ["Contact:", selectedClient?.contactPerson || "", "GST:", selectedClient?.gstNumber || ""],
      [],
      ["S.No", "Candidate Name", "Role", "Joining Date", "Actual Salary", "Percentage", "Payment"]
    ];

    let totalPay = 0;
    const cands = form.selectedCandidates.length > 0 ? form.selectedCandidates : (form.candidateName ? [{ name: form.candidateName, role: form.role, joiningDate: form.joiningDate, actualSalary: form.actualSalary, percentage: form.percentage, payment: form.payment }] : []);

    cands.forEach((c, i) => {
      totalPay += parseFloat(c.payment) || 0;
      wsData.push([
        i + 1,
        c.name,
        c.role,
        getOrdinalDate(c.joiningDate),
        c.actualSalary,
        `${c.percentage || 0}%`,
        c.payment
      ]);
    });

    const totalCgstAmt = Math.round((totalPay * parseFloat(form.cgstPercentage || 0)) / 100);
    const totalSgstAmt = Math.round((totalPay * parseFloat(form.sgstPercentage || 0)) / 100);
    const grandTotalAmt = totalPay + totalCgstAmt + totalSgstAmt;

    wsData.push([]);
    wsData.push(["", "", "", "", "", `CGST (${form.cgstPercentage || 0}%):`, totalCgstAmt]);
    wsData.push(["", "", "", "", "", `SGST (${form.sgstPercentage || 0}%):`, totalSgstAmt]);
    wsData.push(["", "", "", "", "", "Grand Total:", grandTotalAmt]);
    wsData.push([]);
    wsData.push(["In Words:", numberToWords(grandTotalAmt).toUpperCase()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    XLSX.writeFile(wb, `Invoice_${form.invoiceNumber}.xlsx`);
    toast({ title: "Invoice downloaded as Excel" });
  };

  const downloadAsWord = async () => {
    const isDocx = invoiceTemplates.some(t => 
      t.url === selectedInvoiceTemplate && 
      (t.mimeType?.includes('word') || t.mimeType?.includes('officedocument') || t.fileName?.endsWith('.docx'))
    );
    if (isDocx) {
      alert("Word document templates (.docx) cannot be used as background templates for rendering the invoice layout. Please select a PDF background template instead.");
      setIsGenerating(false);
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch(`${selectedInvoiceTemplate}?v=${new Date().getTime()}`);
      const existingPdfBytes = await response.arrayBuffer();
      const tempPdfDoc = await PDFDocument.load(existingPdfBytes);
      const tempPage = tempPdfDoc.getPages()[0];
      const { height } = tempPage.getSize();

      const cleanPdfBytes = await tempPdfDoc.save();
      const pdfBlob = new Blob([cleanPdfBytes], { type: "application/pdf" });

      const pdfjsLib = await import('pdfjs-dist');
      const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 5.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error("Unable to prepare Word background");
      }

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imageBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to build Word background"));
        }, 'image/png', 1.0);
      });
      const imageArrayBuffer = await imageBlob.arrayBuffer();

      const {
        Document: DocxDocument,
        Packer: DocxPacker,
        Paragraph: DocxParagraph,
        TextRun: DocxTextRun,
        ImageRun: DocxImageRun,
        Table,
        TableRow,
        TableCell,
        WidthType,
        AlignmentType,
        VerticalAlign,
        BorderStyle,
        HorizontalPositionRelativeFrom,
        HorizontalPositionAlign,
        VerticalPositionRelativeFrom,
        VerticalPositionAlign,
        TableLayoutType,
      } = await import("docx");

      const cands = form.selectedCandidates.length > 0
        ? form.selectedCandidates
        : (form.candidateName
          ? [{ name: form.candidateName, role: form.role, joiningDate: form.joiningDate, actualSalary: form.actualSalary, percentage: form.percentage, payment: form.payment }]
          : []);

      let totalPay = 0;
      cands.forEach((c) => { totalPay += (parseFloat(c.payment) || 0); });

      const totalCgstAmt = Math.round((totalPay * parseFloat(form.cgstPercentage || 0)) / 100);
      const totalSgstAmt = Math.round((totalPay * parseFloat(form.sgstPercentage || 0)) / 100);
      const grandTotalAmt = totalPay + totalCgstAmt + totalSgstAmt;

      const ptToTwip = (pt) => Math.round(pt * 20);

      const makeText = (text, opts = {}) => new DocxTextRun({
        text: String(text || ""),
        font: "Helvetica",
        size: ptToTwip(opts.size || 9.5) / 10,
        bold: opts.bold || false,
        color: opts.color || "000000",
      });

      const makeParagraph = (text, opts = {}) => new DocxParagraph({
        children: [makeText(text, opts)],
        alignment: opts.align === 'right'
          ? AlignmentType.RIGHT
          : opts.align === 'center'
            ? AlignmentType.CENTER
            : AlignmentType.LEFT,
        spacing: { after: ptToTwip(opts.spaceAfter || 0), before: ptToTwip(opts.spaceBefore || 0) },
      });

      const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: "000000" };
      const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

      const rawParts = (selectedClient?.address || "").split(",").map(p => p.trim()).filter(Boolean);
      let addressLines = [];
      if (rawParts.length <= 2) {
        addressLines = rawParts;
      } else {
        const city = rawParts[rawParts.length - 2];
        const state = rawParts[rawParts.length - 1];
        const middleParts = rawParts.slice(0, rawParts.length - 2);
        const buildingPattern = /\d|floor|f\.no|no\.|h\.no|plot|flat|door|d\.no|beside|above|below|near|opp|block|wing|phase|sector|tower|unit|suite|rd\s|street|building|complex|nagar/i;
        const buildingParts = middleParts.filter(p => buildingPattern.test(p));
        const areaParts = middleParts.filter(p => !buildingPattern.test(p));
        const lines = [];
        if (buildingParts.length > 0) lines.push(buildingParts.join(", "));
        areaParts.forEach(a => lines.push(a));
        lines.push(city, state);
        addressLines = lines;
      }

      const children = [];

      children.push(new DocxParagraph({
        children: [
          new DocxImageRun({
            data: imageArrayBuffer,
            transformation: { width: 794, height: 1123 },
            floating: {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                align: HorizontalPositionAlign.CENTER,
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                align: VerticalPositionAlign.TOP,
              },
              behindDocument: true,
              wrap: { type: 0 },
            },
          }),
        ],
        spacing: { after: 0, before: 0 },
      }));

      const headerTable = new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [makeParagraph("", { size: 10, bold: true, spaceAfter: 0 })],
                borders: noBorders,
                width: { size: ptToTwip(239), type: WidthType.DXA },
              }),
              new TableCell({
                children: [makeParagraph("", { size: 10, bold: true, align: 'right', spaceAfter: 0 })],
                borders: noBorders,
                width: { size: ptToTwip(239), type: WidthType.DXA },
              }),
            ],
          }),
        ],
        columnWidths: [ptToTwip(239), ptToTwip(239)],
        borders: noBorders,
        width: { size: ptToTwip(478), type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
      });

      children.push(headerTable);
      children.push(makeParagraph("", { size: 4, spaceAfter: 5 }));
      children.push(makeParagraph("To,", { size: 10, bold: true, spaceAfter: 1 }));
      children.push(makeParagraph(selectedClient?.companyName || "", { size: 10, bold: true, spaceAfter: 1 }));

      if (selectedClient?.contactPerson) {
        children.push(makeParagraph(selectedClient.contactPerson, { size: 9, bold: true, spaceAfter: 1 }));
      }

      addressLines.forEach((line) => {
        children.push(makeParagraph(line, { size: 9, bold: true, spaceAfter: 1 }));
      });

      if (selectedClient?.gstNumber) {
        children.push(makeParagraph(`GST : ${selectedClient.gstNumber}`, { size: 9, bold: true, spaceAfter: 4 }));
      }

      children.push(makeParagraph(`Date: ${getOrdinalDate(form.invoiceDate)}`, { size: 10, bold: true, align: 'right', spaceAfter: 20 }));
      children.push(new DocxParagraph({ children: [], spacing: { after: ptToTwip(15) } }));
      children.push(makeParagraph(`No: ${form.invoiceNumber}`, { size: 10, bold: true, spaceAfter: 2 }));
      children.push(makeParagraph("SUB: Final Invoice", { size: 10, bold: true, spaceAfter: 6 }));

      children.push(new DocxParagraph({
        children: [makeText("TAX INVOICE", { size: 12, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: ptToTwip(6), before: ptToTwip(2) },
      }));

      const colWidthsPt = [28, 105, 80, 75, 70, 50, 70];
      const colWidthsTwip = colWidthsPt.map(w => ptToTwip(w));

      const makeCell = (text, colIdx, opts = {}) => new TableCell({
        children: [new DocxParagraph({
          children: [makeText(text, { size: opts.fontSize || 8, bold: opts.bold || false })],
          alignment: opts.align === 'left'
            ? AlignmentType.LEFT
            : opts.align === 'right'
              ? AlignmentType.RIGHT
              : AlignmentType.CENTER,
        })],
        width: { size: colWidthsTwip[colIdx], type: WidthType.DXA },
        borders: allBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: ptToTwip(3), bottom: ptToTwip(3), left: ptToTwip(2), right: ptToTwip(2) },
        ...(opts.columnSpan ? { columnSpan: opts.columnSpan } : {}),
      });

      const wordHeaders = ["S.No", "Candidate Name", "Role", "Joining Date", "Actual Salary", "Percentage", "Payment"];
      const headerRow = new TableRow({
        children: wordHeaders.map((h, i) => makeCell(h, i, { bold: true, fontSize: 8.5 })),
        tableHeader: true,
      });

      const dataRows = cands.map((c, idx) => new TableRow({
        children: [
          makeCell(String(idx + 1), 0, { fontSize: 8 }),
          makeCell(c.name || "", 1, { fontSize: 8, align: 'center' }),
          makeCell(c.role || "", 2, { fontSize: 8, align: 'center' }),
          makeCell(c.joiningDate ? getOrdinalDate(c.joiningDate) : "", 3, { fontSize: 8, bold: false, align: 'center' }),
          makeCell(Number(c.actualSalary || 0).toLocaleString("en-IN"), 4, { fontSize: 8, align: 'center' }),
          makeCell(`${c.percentage || 0}%`, 5, { fontSize: 8, align: 'center' }),
          makeCell(Number(c.payment || 0).toLocaleString("en-IN"), 6, { fontSize: 8, align: 'center' }),
        ],
      }));

      const makeSummaryRow = (label, amount, isBold = false) => {
        const labelSpanWidth = colWidthsTwip.slice(0, 6).reduce((a, b) => a + b, 0);
        return new TableRow({
          children: [
            new TableCell({
              children: [new DocxParagraph({
                children: [makeText(label, { size: 9, bold: isBold })],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0, before: 0 },
              })],
              width: { size: labelSpanWidth, type: WidthType.DXA },
              columnSpan: 6,
              borders: allBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: ptToTwip(3), bottom: ptToTwip(3), left: ptToTwip(2), right: ptToTwip(6) },
            }),
            makeCell(amount.toLocaleString("en-IN"), 6, { bold: isBold, fontSize: 9, align: 'center' }),
          ],
        });
      };

      const invoiceTable = new Table({
        rows: [
          headerRow,
          ...dataRows,
          makeSummaryRow(`CGST (${form.cgstPercentage || 0}%)`, totalCgstAmt, false),
          makeSummaryRow(`SGST (${form.sgstPercentage || 0}%)`, totalSgstAmt, false),
          makeSummaryRow("Grand Total", grandTotalAmt, true),
        ],
        columnWidths: colWidthsTwip,
        width: { size: ptToTwip(478), type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
      });

      children.push(invoiceTable);

      const wordsString = numberToWords(grandTotalAmt).toUpperCase();
      let wordsFontSize = 9;
      if (wordsString.length > 55) wordsFontSize = 8;
      if (wordsString.length > 75) wordsFontSize = 7.5;
      if (wordsString.length > 85) wordsFontSize = 7.5;

      children.push(new DocxParagraph({
        children: [
          makeText("In Words : ", { size: 9, bold: true }),
          makeText(wordsString, { size: wordsFontSize, bold: false }),
        ],
        spacing: { before: ptToTwip(12), after: ptToTwip(15) },
      }));

      if (form.accountType !== "no") {
        children.push(makeParagraph("Account Details: -", { size: 10, bold: true, spaceAfter: 4 }));
        const accDetails = [
          `Account No. : ${form.accountDetails.accountNumber}`,
          `Name : ${form.accountDetails.name}`,
          `Bank : ${form.accountDetails.bank}`,
          `Branch : ${form.accountDetails.branch}`,
          `IFSC Code : ${form.accountDetails.ifsc}`,
          `PAN No. : ${form.accountDetails.pan}`,
          `GST : ${form.accountDetails.gst}`,
        ];
        accDetails.forEach((line) => {
          children.push(makeParagraph(line, { size: 9, bold: true, spaceAfter: 1 }));
        });
      }

      children.push(new DocxParagraph({ children: [], spacing: { after: ptToTwip(60) } }));
      children.push(makeParagraph("Navya S", { size: 10, bold: true, spaceAfter: 1 }));
      children.push(makeParagraph("Vagarious Solutions Pvt Ltd", { size: 10, bold: true, spaceAfter: 0 }));

      const PAGE_W_TWIP = 11906;
      const PAGE_H_TWIP = 16838;

      const doc = new DocxDocument({
        sections: [
          {
            properties: {
              page: {
                size: { width: PAGE_W_TWIP, height: PAGE_H_TWIP },
                margin: {
                  top: ptToTwip(135),
                  right: ptToTwip(49),
                  bottom: ptToTwip(40),
                  left: ptToTwip(68),
                },
              },
            },
            children,
          },
        ],
      });

      const blob = await DocxPacker.toBlob(doc);
      triggerFileDownload(blob, `Invoice_${form.invoiceNumber}.docx`);
      toast({ title: "Invoice downloaded as editable Word" });

    } catch (error) {
      console.error("Word Generation error:", error);
      toast({ title: `Word Error: ${error?.message || error}`, variant: "destructive", duration: 7000 });
    } finally {
      setIsGenerating(false);
    }
  };

  const previewCands = form.selectedCandidates.length > 0
    ? form.selectedCandidates
    : (form.candidateName
        ? [{
            name: form.candidateName,
            role: form.role,
            joiningDate: form.joiningDate,
            actualSalary: form.actualSalary,
            percentage: form.percentage,
            payment: Math.round((parseFloat(form.actualSalary) || 0) * (parseFloat(form.percentage) || 0) / 100)
          }]
        : []);
  const previewSubtotal = previewCands.reduce((s, c) => s + (parseFloat(c.payment) || 0), 0);
  const previewCgst = Math.round((previewSubtotal * (parseFloat(form.cgstPercentage) || 0)) / 100);
  const previewSgst = Math.round((previewSubtotal * (parseFloat(form.sgstPercentage) || 0)) / 100);
  const previewGrandTotal = previewSubtotal + previewCgst + previewSgst;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/30 flex-shrink-0">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight tracking-tight">Invoice Management</h1>
              <p className="text-[11px] text-gray-400 leading-tight">Vagarious Solutions Pvt Ltd.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showPreview && (
              <>
                <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} className="hidden sm:block px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="word">Word (.docx)</option>
                </select>
                <button onClick={handleDownload} disabled={isGenerating || isSaving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-sm">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
                <button onClick={handlePreview} disabled={isGenerating} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Editor
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {!showPreview ? (
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="flex gap-7 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              {editingInvoiceId && (
                <div className="bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0 animate-pulse">
                      <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-violet-800 dark:text-violet-300">Editing Auto-generated Invoice Mode</h3>
                      <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5 font-semibold">You are adjusting the details of <strong>{form.invoiceNumber}</strong>. Saving will update the existing invoice.</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingInvoiceId(null);
                      setForm({
                        invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
                        invoiceDate: new Date().toISOString().split("T")[0],
                        clientId: "",
                        candidateProfileId: "",
                        candidateName: "",
                        joiningDate: "",
                        role: "",
                        actualSalary: "",
                        percentage: "",
                        payment: 0,
                        cgstPercentage: "9",
                        sgstPercentage: "9",
                        accountType: "default",
                        accountDetails: defaultAccountDetails,
                        selectedCandidates: [],
                      });
                      toast({ title: "Exited edit mode", description: "Form reset to new invoice mode." });
                    }} 
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-750 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                    <BuildingOfficeIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white">Client & Invoice Details</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">Set invoice number, date and select client</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full uppercase tracking-widest">Step 1</span>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Invoice Number</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">#</span>
                      <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} className="w-full pl-7 pr-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Invoice Date</label>
                    <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Client <span className="text-red-400 normal-case font-normal">*</span></label>
                    <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all">
                      <option value="">— Select a Client —</option>
                      {clients.map((c) => (<option key={c.id} value={c.id}>{c.companyName}</option>))}
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Background Template</label>
                      <button 
                        type="button"
                        onClick={() => setIsManageTemplatesOpen(true)}
                        className="text-[10px] text-blue-500 hover:text-blue-600 font-bold uppercase cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                    <select
                      value={selectedInvoiceTemplate}
                      onChange={(e) => setSelectedInvoiceTemplate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all font-semibold"
                    >
                      <option value="/New_Template.pdf">Default Template</option>
                      {invoiceTemplates.map((t) => (
                        <option key={t.id} value={t.url}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedClient && (
                  <div className="mx-6 mb-6 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {selectedClient.companyName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                      {[{ label: 'Company', value: selectedClient.companyName }, { label: 'Contact', value: selectedClient.contactPerson || '—' }, { label: 'Address', value: selectedClient.address || '—' }, { label: 'GST No.', value: selectedClient.gstNumber || '—' }].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">{label}</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                    <CalculatorIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white">Candidate & Financial Details</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">Add candidates with salary and commission</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full uppercase tracking-widest">Step 2</span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Candidate</label>
                        <button type="button" onClick={() => { setIsCustomCandidate(!isCustomCandidate); setForm(p => ({ ...p, candidateName: '', candidateProfileId: '' })); }} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                          {isCustomCandidate ? '← From List' : '✎ Type Manually'}
                        </button>
                      </div>
                      {isCustomCandidate ? (
                        <input type="text" value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value, candidateProfileId: '' })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" placeholder="e.g. Rahul Sharma" />
                      ) : (
                        <div className="relative">
                          <button type="button" onClick={() => setIsCandidateDropdownOpen(!isCandidateDropdownOpen)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 text-left flex justify-between items-center gap-2 min-h-[44px] transition-all">
                            {currentSelectedCand ? (
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{currentSelectedCand.name?.charAt(0).toUpperCase()}</div>
                                <span className="text-sm text-gray-900 dark:text-white truncate">{currentSelectedCand.name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-sm">— Choose Candidate —</span>
                            )}
                            <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {isCandidateDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsCandidateDropdownOpen(false)} />
                              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-hidden">
                                <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                    <input type="text" value={candSearchInput} onChange={(e) => setCandSearchInput(e.target.value)} placeholder="Search candidates..." className="flex-1 bg-transparent text-xs outline-none text-gray-900 dark:text-white placeholder-gray-400" onClick={(e) => e.stopPropagation()} />
                                  </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                                  {!selectedClient ? (
                                    <div className="p-4 text-center text-xs text-gray-400">Please select a Client in Step 1 first</div>
                                  ) : searchedCandidates.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-gray-400">No candidates placed at {selectedClient.companyName} found</div>
                                  ) : (
                                    searchedCandidates.map((c) => {
                                      const isSelected = form.candidateProfileId === (c._id || c.id);
                                      return (
                                        <div key={c._id || c.id} onClick={() => { handleAddCandidate(c); setIsCandidateDropdownOpen(false); setCandSearchInput(''); }} className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${isSelected ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{c.name?.charAt(0)?.toUpperCase() || '?'}</div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{c.position || 'No Role'} · {c.client || 'No Client'}</p>
                                          </div>
                                          {isSelected && <svg className="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Joining Date</label>
                      <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Role / Designation</label>
                      <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" placeholder="e.g. Software Engineer" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actual CTC (₹)</label>
                      <input type="number" min="0" value={form.actualSalary} onChange={(e) => setForm({ ...form, actualSalary: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" placeholder="600000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Commission %</label>
                      <input type="number" min="0" max="100" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" placeholder={selectedClient && selectedClient.percentage ? String(selectedClient.percentage) : "8.33"} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">CGST %</label>
                      <input type="number" min="0" value={form.cgstPercentage} onChange={(e) => setForm({ ...form, cgstPercentage: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">SGST %</label>
                      <input type="number" min="0" value={form.sgstPercentage} onChange={(e) => setForm({ ...form, sgstPercentage: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex gap-2">
                      {form.selectedCandidates.length > 0 && (
                        <button type="button" onClick={() => setShowCandidateList(!showCandidateList)} className="flex items-center gap-1.5 px-3.5 py-2 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all">
                          {showCandidateList ? <EyeSlashIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                          {showCandidateList ? 'Hide List' : `List (${form.selectedCandidates.length})`}
                        </button>
                      )}
                      <button type="button" onClick={() => { setForm(prev => ({ ...prev, candidateProfileId: '', candidateName: '', role: '', joiningDate: '', actualSalary: '', percentage: '', payment: 0 })); setIsCustomCandidate(false); }} className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        Clear Row
                      </button>
                    </div>
                    <button type="button" onClick={addCandidateToList} className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/20">
                      <PlusIcon className="h-4 w-4" />
                      Add to Invoice
                      {form.selectedCandidates.length > 0 && <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">{form.selectedCandidates.length}</span>}
                    </button>
                  </div>

                  {form.selectedCandidates.length > 0 && showCandidateList && (
                    <div className="mt-5 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                      <div className="px-4 py-3 bg-gray-900 dark:bg-gray-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-sm font-semibold text-white">Added Candidates</span>
                          <span className="bg-white/15 text-white text-xs px-2 py-0.5 rounded-full font-bold">{form.selectedCandidates.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setForm(prev => ({ ...prev, selectedCandidates: [] }))} className="text-xs text-gray-400 hover:text-white font-semibold transition-colors">Clear All</button>
                          <button onClick={() => setShowCandidateList(false)} className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                              {['#', 'Candidate', 'Role', 'Joining Date', 'CTC (₹)', '%', 'Payment (₹)', ''].map(h => (
                                <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                            {form.selectedCandidates.map((c, idx) => (
                              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors group">
                                <td className="px-4 py-3 text-gray-400 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{c.name?.charAt(0)?.toUpperCase() || '?'}</div>
                                    <CandidateProfileLink candidateId={c.candidateProfileId} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">{c.name}</CandidateProfileLink>
                                  </div>
                                </td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">{c.role || '—'}</span></td>
                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.joiningDate ? getOrdinalDate(c.joiningDate) : '—'}</td>
                                <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{Number(c.actualSalary || 0).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.percentage || 0}%</td>
                                <td className="px-4 py-3"><span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">₹{c.payment.toLocaleString('en-IN')}</span></td>
                                <td className="px-4 py-3">
                                  <button onClick={() => removeCandidateFromList(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-red-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
                      <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-gray-800 dark:text-white">Account & Payment Details</h2>
                      <p className="text-[11px] text-gray-400 mt-0.5">Banking information included in the invoice</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsManageBanksOpen(true)}
                      className="text-[10px] text-violet-600 hover:text-violet-750 dark:text-violet-400 dark:hover:text-violet-300 font-bold uppercase cursor-pointer"
                    >
                      Manage Banks
                    </button>
                    <span className="text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 rounded-full uppercase tracking-widest">Step 3</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <select
                      value={form.accountType}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'manual') {
                          setForm({ ...form, accountType: val, accountDetails: { accountNumber: '', name: '', bank: '', branch: '', ifsc: '', pan: '', gst: '' } });
                        } else if (val === 'no') {
                          setForm({ ...form, accountType: val, accountDetails: { accountNumber: '', name: '', bank: '', branch: '', ifsc: '', pan: '', gst: '' } });
                        } else {
                          const selectedBank = companyBanks.find(b => b._id === val);
                          if (selectedBank) {
                            setForm({
                              ...form,
                              accountType: val,
                              accountDetails: {
                                accountNumber: selectedBank.accountNumber,
                                name: selectedBank.name,
                                bank: selectedBank.bank,
                                branch: selectedBank.branch,
                                ifsc: selectedBank.ifsc,
                                pan: selectedBank.pan || '',
                                gst: selectedBank.gst || ''
                              }
                            });
                          }
                        }
                      }}
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all font-semibold"
                    >
                      <option value="manual">Enter Manually</option>
                      <option value="no">No Account Details</option>
                      {companyBanks.map((bank) => (
                        <option key={bank._id} value={bank._id}>
                          {bank.label} {bank.isDefault ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => { setForm(p => ({ ...p, accountType: 'no', accountDetails: { accountNumber: '', name: '', bank: '', branch: '', ifsc: '', pan: '', gst: '' } })); toast({ title: 'Account details cleared' }); }} className="text-xs text-red-400 hover:text-red-655 font-semibold whitespace-nowrap transition-colors">Clear</button>
                  </div>
                  {(form.accountType === 'default' || companyBanks.some(b => b._id === form.accountType)) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/50">
                      {[
                        { label: 'Account No.', value: form.accountDetails.accountNumber },
                        { label: 'Bank', value: form.accountDetails.bank },
                        { label: 'Branch', value: form.accountDetails.branch },
                        { label: 'IFSC', value: form.accountDetails.ifsc },
                        { label: 'Name', value: form.accountDetails.name },
                        { label: 'PAN', value: form.accountDetails.pan },
                        { label: 'GST', value: form.accountDetails.gst }
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wider">{label}</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{value || '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.accountType === 'manual' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[{ key: 'accountNumber', placeholder: 'Account Number' }, { key: 'name', placeholder: 'Account Name' }, { key: 'bank', placeholder: 'Bank Name' }, { key: 'branch', placeholder: 'Branch' }, { key: 'ifsc', placeholder: 'IFSC Code' }, { key: 'pan', placeholder: 'PAN Number' }, { key: 'gst', placeholder: 'GST Number' }].map(({ key, placeholder }) => (
                        <input key={key} placeholder={placeholder} value={form.accountDetails[key]} onChange={(e) => setForm(prev => ({ ...prev, accountDetails: { ...prev.accountDetails, [key]: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                      ))}
                    </div>
                  )}
                  {form.accountType === 'no' && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                      <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Account details will not be included in this invoice.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-6">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white">Active Placement Countdown</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">Track locking periods and automatic billing status for placed candidates</p>
                  </div>
                </div>

                <div className="p-6">
                  {activePlacements.length === 0 ? (
                    <p className="text-xs text-gray-500 italic text-center py-4">No active placements with 'Joined' status found.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800/60">
                          <tr>
                            {['Candidate Name', 'Client/Company', 'Joined Date', 'Locking Period', 'Billing Details', 'Billing Countdown', 'Action'].map(h => (
                              <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap border-b border-gray-100 dark:border-gray-800">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                          {activePlacements.map((placement) => {
                            const { candidate, company, joinDate, targetDate, hasInvoice, durationVal, ctcValue, percentage, billingAmount } = placement;
                            return (
                              <tr key={candidate._id} className="hover:bg-blue-50/10 dark:hover:bg-blue-900/5 transition-colors">
                                <td className="px-4 py-3.5 font-semibold text-gray-800 dark:text-gray-200">
                                  {candidate.name || `${candidate.firstName} ${candidate.lastName}`}
                                </td>
                                <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400 font-medium">
                                  {candidate.client || '—'}
                                </td>
                                <td className="px-4 py-3.5 text-gray-500">
                                  {getOrdinalDate(joinDate)}
                                </td>
                                <td className="px-4 py-3.5 text-gray-500 font-mono">
                                  {durationVal || 'N/A'}
                                </td>
                                <td className="px-4 py-3.5 text-gray-700 dark:text-gray-300">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-[11px]">₹{(ctcValue / 100000).toFixed(2)} LPA @ {percentage}%</span>
                                    <span className="text-[10px] text-gray-400 font-mono">Total: ₹{billingAmount.toLocaleString('en-IN')}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <PlacementCountdown 
                                    placement={placement} 
                                    ready={historyFirstLoaded}
                                    onComplete={() => {
                                      const candKey = String(candidate._id || candidate.id);
                                      if (
                                        historyFirstLoaded &&
                                        !hasInvoice &&
                                        company &&
                                        !sessionBilledCandidates.current.has(candKey)
                                      ) {
                                        sessionBilledCandidates.current.add(candKey);
                                        autoGenerateInvoice(candidate, company, placement);
                                      }
                                    }}
                                  />
                                </td>
                                <td className="px-4 py-3.5">
                                  {!hasInvoice && company ? (
                                    <button 
                                      type="button"
                                      onClick={() => autoGenerateInvoice(candidate, company, placement)}
                                      className="px-2.5 py-1 bg-violet-600 hover:bg-violet-750 text-white rounded text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap shadow-sm hover:shadow-violet-500/10 transition-all"
                                    >
                                      Force Bill
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-[10px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white">Invoice History</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">All permanently saved invoices from the server</p>
                  </div>
                  <div className="ml-auto flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 gap-0.5">
                    <button onClick={() => setActiveTab('server')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'server' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}>Saved ({history.length})</button>
                    {legacyHistory.length > 0 && (
                      <button onClick={() => setActiveTab('legacy')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'legacy' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}>Legacy ({legacyHistory.length})</button>
                    )}
                  </div>
                </div>

                {activeTab === 'server' && (
                  <form onSubmit={handleFilterSearch} className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50/50 dark:bg-gray-900/30">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input type="text" placeholder="Search invoices..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all">Filter</button>
                      {(historySearch || historyStartDate || historyEndDate) && (
                        <button type="button" onClick={() => { setHistorySearch(''); setHistoryStartDate(''); setHistoryEndDate(''); setHistoryPage(1); setTimeout(() => fetchHistory(1), 50); }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Reset</button>
                      )}
                    </div>
                  </form>
                )}

                <div className="p-6">
                  {historyLoading ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">
                      <div className="h-7 w-7 border-4 border-blue-100 dark:border-blue-900 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-xs font-medium">Loading records...</p>
                    </div>
                  ) : activeTab === 'server' ? (
                    history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-600">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                          <svg className="h-7 w-7 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </div>
                        <p className="text-sm font-medium">No invoices found</p>
                        <p className="text-xs mt-1 opacity-70">Generate your first invoice to see it here</p>
                      </div>
                    ) : (
                      <div>
                        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-800/60">
                              <tr>
                                {['Invoice ID', 'Client', 'Candidates', 'Date', 'Grand Total', 'Format', 'Actions'].map(h => (
                                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap border-b border-gray-100 dark:border-gray-800">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                              {history.map((item) => (
                                <tr key={item._id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                  <td className="px-4 py-3.5">
                                    <div className="flex flex-col gap-1">
                                      <button onClick={() => handleOpenInvoiceModal(item)} className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline text-xs text-left">{item.invoiceNumber}</button>
                                      {(item.isAutogenerated || String(item.invoiceNumber || '').toUpperCase().includes('AUTO')) && (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit uppercase tracking-wider">Auto-generated</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{item.clientName?.charAt(0)?.toUpperCase() || 'C'}</div>
                                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{item.clientName}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    {item.candidateCount > 0 ? (
                                      <button 
                                        onClick={() => handleOpenCandidatesModal(item)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer transition-all transform hover:scale-105 active:scale-95"
                                        title="View candidate details"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        {item.candidateCount}
                                      </button>
                                    ) : <span className="text-gray-400 italic">—</span>}
                                  </td>
                                  <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{getOrdinalDate(item.invoiceDate)}</td>
                                  <td className="px-4 py-3.5 font-bold font-mono text-gray-900 dark:text-white">₹{Number(item.grandTotal || 0).toLocaleString('en-IN')}</td>
                                  <td className="px-4 py-3.5">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${item.format === 'pdf' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>{item.format || 'pdf'}</span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleOpenInvoiceModal(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all" title="Preview">
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                      </button>
                                      {(item.isAutogenerated || String(item.invoiceNumber || '').toUpperCase().includes('AUTO')) && (
                                        <button onClick={() => handleEditInvoice(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all cursor-pointer" title="Edit">
                                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                      )}
                                      <a href={item.file?.url} download={`Invoice_${item.invoiceNumber}.pdf`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all" title="Download">
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                      </a>
                                      <button onClick={() => handleDeleteInvoice(item._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all" title="Delete">
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {historyTotalPages > 1 && (
                          <div className="flex items-center justify-between pt-4 mt-3 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-xs text-gray-400">Page <strong className="text-gray-700 dark:text-gray-200">{historyPage}</strong> of <strong className="text-gray-700 dark:text-gray-200">{historyTotalPages}</strong></span>
                            <div className="flex gap-2">
                              <button onClick={() => setHistoryPage(p => Math.max(p - 1, 1))} disabled={historyPage === 1} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all">← Prev</button>
                              <button onClick={() => setHistoryPage(p => Math.min(p + 1, historyTotalPages))} disabled={historyPage === historyTotalPages} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all">Next →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    legacyHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400"><p className="text-sm">No legacy items stored locally.</p></div>
                    ) : (
                      <div>
                        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-start gap-2.5">
                          <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <p className="text-xs text-amber-700 dark:text-amber-400"><span className="font-bold">Legacy records:</span> Exist only in browser cache. File preview unavailable.</p>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                              <tr>{['Invoice ID', 'Client', 'Candidates', 'Date', 'Grand Total', ''].map(h => (<th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                              {legacyHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                                  <td className="px-4 py-3.5">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-mono text-gray-500 dark:text-gray-400 font-semibold">{item.invoiceNumber}</span>
                                      {(item.isAutogenerated || String(item.invoiceNumber || '').toUpperCase().includes('AUTO')) && (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit uppercase tracking-wider">Auto-generated</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 font-semibold text-gray-700 dark:text-gray-300">{item.clientName}</td>
                                  <td className="px-4 py-3.5">
                                    <button 
                                      onClick={() => handleOpenCandidatesModal(item)}
                                      className="hover:underline font-semibold text-left text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-1"
                                    >
                                      {item.candidateNames || "Candidates"}
                                      {item.candidateCount > 1 && (
                                        <span className="ml-1 text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                                          +{item.candidateCount - 1}
                                        </span>
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400">{getOrdinalDate(item.invoiceDate)}</td>
                                  <td className="px-4 py-3.5 font-mono font-bold text-gray-900 dark:text-white">₹{Number(item.grandTotal || 0).toLocaleString('en-IN')}</td>
                                  <td className="px-4 py-3.5">
                                    <button onClick={() => { setLegacyHistory(prev => { const updated = prev.filter(i => i.id !== item.id); localStorage.setItem('invoice_history', JSON.stringify(updated.map(u => ({ ...u, isLegacy: undefined })))); return updated; }); toast({ title: 'Removed from local cache' }); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-red-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-900/20">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <aside className="w-[300px] flex-shrink-0 sticky top-24 space-y-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 px-5 py-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Invoice</p>
                      <p className="text-white font-bold text-lg mt-0.5 font-mono">#{form.invoiceNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Date</p>
                      <p className="text-white text-xs font-semibold mt-0.5">{form.invoiceDate ? getOrdinalDate(form.invoiceDate) : '—'}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mb-1">Bill To</p>
                    <p className="text-white font-bold text-sm truncate">{selectedClient?.companyName || '— No Client —'}</p>
                    {selectedClient?.address && <p className="text-blue-200 text-xs mt-0.5 truncate">{selectedClient.address}</p>}
                  </div>
                </div>
                <div className="p-5 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Line Items</p>
                  {previewCands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-gray-600">
                      <svg className="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <p className="text-xs">No candidates yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {previewCands.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">{(c.name || '?').charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{c.name || '—'}</p>
                              <p className="text-[10px] text-gray-400">{c.percentage || 0}% of ₹{Number(c.actualSalary || 0).toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono flex-shrink-0 ml-2">₹{Number(c.payment || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                    {[{ label: 'Subtotal', value: previewSubtotal }, { label: `CGST (${form.cgstPercentage || 0}%)`, value: previewCgst }, { label: `SGST (${form.sgstPercentage || 0}%)`, value: previewSgst }].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{label}</span>
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">₹{value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">Grand Total</span>
                      <span className="text-base font-bold text-blue-700 dark:text-blue-400 font-mono">₹{previewGrandTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handlePreview} disabled={isGenerating || isSaving} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5">
                {(isGenerating || isSaving) ? (
                  <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{isSaving ? 'Saving...' : 'Generating...'}</>
                ) : (
                  <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Generate & Preview Invoice</>
                )}
              </button>
            </aside>
          </div>
        </main>
      ) : (
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
            <div className="bg-gray-900 dark:bg-gray-950 px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <div className="w-px h-4 bg-white/10" />
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-sm text-gray-300 font-mono font-medium">{form.invoiceNumber}</span>
                <span className="text-xs text-gray-500">·</span>
                <span className="text-xs text-gray-400">{selectedClient?.companyName || 'Invoice'}</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} className="px-3 py-1.5 text-xs border border-white/10 rounded-lg bg-white/5 text-gray-300 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="word">Word (.docx)</option>
                </select>
                <button onClick={handleDownload} disabled={isGenerating || isSaving} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all">
                  {isSaving ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                  {isSaving ? 'Saving...' : 'Download'}
                </button>
              </div>
            </div>
            {pdfPreviewUrl ? (
              <iframe src={`${pdfPreviewUrl}#navpanes=0&view=FitH`} title="Invoice PDF Preview" className="flex-1 w-full border-0" />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 gap-3">
                <div className="h-10 w-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Generating PDF preview…</p>
              </div>
            )}
          </div>
        </main>
      )}

      {isEditModalOpen && editForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={() => setIsEditModalOpen(false)} />
          <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col w-[96vw] max-w-4xl max-h-[92vh] z-50 border border-gray-200 dark:border-gray-800 relative animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Auto-Generated Invoice</h3>
                  <p className="text-[11px] text-white/85 mt-0.5">Modify invoice parameters and candidate details dynamically</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSaveEditedInvoice} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">1. Invoice Metadata</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Invoice Number</label>
                    <input type="text" value={editForm.invoiceNumber} onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Invoice Date</label>
                    <input type="date" value={editForm.invoiceDate} onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Client Company</label>
                    <select 
                      value={editForm.clientId} 
                      onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value })} 
                      className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all font-semibold"
                    >
                      <option value="">— Select Client —</option>
                      {editForm.clientId && !clients.some(c => String(c.id || c._id) === String(editForm.clientId)) && (
                        <option value={editForm.clientId}>{editForm.clientName}</option>
                      )}
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">2. Candidate Breakdown</h4>
                {editForm.selectedCandidates.map((cand) => (
                  <div key={cand.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-gray-200/50 dark:border-gray-800/50 pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Candidate Name</label>
                      <input type="text" value={cand.name} onChange={(e) => handleEditCandidateField(cand.id, 'name', e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Designation / Role</label>
                      <input type="text" value={cand.role} onChange={(e) => handleEditCandidateField(cand.id, 'role', e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Joining Date</label>
                      <input type="date" value={cand.joiningDate} onChange={(e) => handleEditCandidateField(cand.id, 'joiningDate', e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actual Salary (CTC)</label>
                      <input type="number" value={cand.actualSalary} onChange={(e) => handleEditCandidateField(cand.id, 'actualSalary', e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all font-mono" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Commission %</label>
                      <input type="number" value={cand.percentage} onChange={(e) => handleEditCandidateField(cand.id, 'percentage', e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Payment (Commission)</label>
                      <div className="w-full px-3.5 py-2.5 border border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold font-mono">
                        ₹{Number(cand.payment || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">3. Tax Rates</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">CGST %</label>
                      <input type="number" value={editForm.cgstPercentage} onChange={(e) => setEditForm({ ...editForm, cgstPercentage: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">SGST %</label>
                      <input type="number" value={editForm.sgstPercentage} onChange={(e) => setEditForm({ ...editForm, sgstPercentage: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">4. Bank & Account Details</h4>
                  <div className="space-y-3">
                    <select value={editForm.accountType} onChange={(e) => handleEditBankSelect(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all font-semibold">
                      <option value="manual">Enter Manually</option>
                      <option value="no">No Account Details</option>
                      {companyBanks.map((bank) => (
                        <option key={bank._id} value={bank._id}>
                          {bank.label} {bank.isDefault ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>

                    {editForm.accountType === 'manual' && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {[{ key: 'accountNumber', placeholder: 'Account Number' }, { key: 'name', placeholder: 'Account Name' }, { key: 'bank', placeholder: 'Bank Name' }, { key: 'branch', placeholder: 'Branch' }, { key: 'ifsc', placeholder: 'IFSC Code' }, { key: 'pan', placeholder: 'PAN Number' }, { key: 'gst', placeholder: 'GST Number' }].map(({ key, placeholder }) => (
                          <input key={key} placeholder={placeholder} value={editForm.accountDetails[key]} onChange={(e) => setEditForm(prev => ({ ...prev, accountDetails: { ...prev.accountDetails, [key]: e.target.value } }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-violet-50/50 dark:bg-violet-950/10 p-5 rounded-2xl border border-violet-100/50 dark:border-violet-900/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block">Calculated Totals</span>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <span className="text-[9px] text-gray-400 block font-semibold">SUBTOTAL</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">₹{getEditFormTotals().subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-px h-6 bg-violet-200/50 dark:bg-violet-850" />
                    <div>
                      <span className="text-[9px] text-gray-400 block font-semibold">CGST ({editForm.cgstPercentage}%)</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">₹{getEditFormTotals().cgst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-px h-6 bg-violet-200/50 dark:bg-violet-850" />
                    <div>
                      <span className="text-[9px] text-gray-400 block font-semibold">SGST ({editForm.sgstPercentage}%)</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">₹{getEditFormTotals().sgst.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest block">Grand Total</span>
                  <span className="text-lg font-extrabold text-violet-700 dark:text-violet-400 font-mono block mt-1">₹{getEditFormTotals().grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex gap-3 justify-end flex-shrink-0">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-bold transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/10 flex items-center gap-2">
                  {isSaving ? (
                    <><div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={handleCloseInvoiceModal} />
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col w-[96vw] max-w-6xl h-[92vh] z-50 border border-gray-200 dark:border-gray-800 relative animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-900 dark:bg-gray-950 px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">#</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Invoice Details</h3>
                    {(selectedInvoice.isAutogenerated || String(selectedInvoice.invoiceNumber || '').toUpperCase().includes('AUTO')) && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded uppercase tracking-wider">Auto-generated</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedInvoice.invoiceNumber} · {getOrdinalDate(selectedInvoice.invoiceDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={selectedInvoice.file?.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg text-xs font-semibold transition-all">
                  Open Original File
                </a>
                <button onClick={handleCloseInvoiceModal} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" aria-label="Close">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {modalLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <div className="h-8 w-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-xs font-semibold">Loading details...</p>
                </div>
              ) : (
                <>
                  <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-gray-200 dark:border-gray-800 space-y-6">
                    {selectedInvoiceDetails ? (
                      <>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Client Information</h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-gray-400">Company Name</p>
                              <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{selectedInvoiceDetails.clientName}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Invoice Number</p>
                              <p className="font-mono font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{selectedInvoiceDetails.invoiceNumber}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Placed Candidates</h4>
                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Candidate</th>
                                  <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Role</th>
                                  <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase text-right">CTC</th>
                                  <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase text-right">Commission</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {selectedInvoiceDetails.candidates?.map((c, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{c.name}</td>
                                    <td className="px-3 py-2 text-gray-500">{c.role}</td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">₹{Number(c.actualSalary || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-600 font-mono">₹{Number(c.payment || 0).toLocaleString('en-IN')}{c.percentage ? ` (${c.percentage}%)` : ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-800/30">
                          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Financial Summary</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Subtotal</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">₹{Number(selectedInvoiceDetails.subtotal || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">CGST ({selectedInvoiceDetails.cgstPercentage || 0}%)</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">₹{Number(selectedInvoiceDetails.cgstAmount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">SGST ({selectedInvoiceDetails.sgstPercentage || 0}%)</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">₹{Number(selectedInvoiceDetails.sgstAmount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between font-bold text-sm">
                              <span className="text-gray-800 dark:text-white">Grand Total</span>
                              <span className="text-blue-600 dark:text-blue-400 font-mono">₹{Number(selectedInvoiceDetails.grandTotal || 0).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>

                        {selectedInvoiceDetails.accountType !== 'no' && selectedInvoiceDetails.accountDetails && (
                          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Bank Account Information</h4>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-gray-400">Account Number</span>
                                <p className="font-semibold mt-0.5 text-gray-800 dark:text-gray-200">{selectedInvoiceDetails.accountDetails.accountNumber}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Bank Name</span>
                                <p className="font-semibold mt-0.5 text-gray-800 dark:text-gray-200">{selectedInvoiceDetails.accountDetails.bank}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">IFSC Code</span>
                                <p className="font-semibold mt-0.5 text-gray-800 dark:text-gray-200">{selectedInvoiceDetails.accountDetails.ifsc}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">PAN</span>
                                <p className="font-semibold mt-0.5 text-gray-800 dark:text-gray-200">{selectedInvoiceDetails.accountDetails.pan}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center text-xs text-gray-400 py-10">No details available.</div>
                    )}
                  </div>

                  <div className="hidden md:block w-1/2 h-full relative bg-gray-100 dark:bg-gray-950">
                    {selectedInvoice.file?.url ? (
                      <iframe src={`${selectedInvoice.file.url}#navpanes=0&view=FitH`} title={`Invoice PDF ${selectedInvoice.invoiceNumber}`} className="w-full h-full border-0" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                        <p className="text-xs font-medium">No PDF preview available.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isCandidateModalOpen && candidateModalInvoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={handleCloseCandidatesModal} />
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full max-w-3xl max-h-[85vh] z-50 border border-gray-200 dark:border-gray-800 relative animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-950 px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Placed Candidate Details</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Invoice: <span className="font-mono">{candidateModalInvoice.invoiceNumber}</span> · Client: {candidateModalInvoice.clientName}
                  </p>
                </div>
              </div>
              <button onClick={handleCloseCandidatesModal} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" aria-label="Close">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50">
              {candidateModalInvoice.isLegacy ? (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                  <div className="border-b border-gray-50 dark:border-gray-700 pb-3">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Legacy Cached Candidates</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This invoice exists in browser cache. Detailed breakdown of commission percentages is unavailable.</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">Candidate Names</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                      {candidateModalInvoice.candidateNames || "Unknown Candidate"}
                    </p>
                  </div>
                </div>
              ) : (!candidateModalInvoice.candidates || candidateModalInvoice.candidates.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
                  <p className="text-sm font-medium">No candidate details stored for this invoice.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {candidateModalInvoice.candidates.map((c, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between border-b border-gray-50 dark:border-gray-700 pb-3">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{c.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.role || "Placed Candidate"}</p>
                        </div>
                        {c.joiningDate && (
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Joining Date</span>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{new Date(c.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                          <span className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider block">Actual Salary (CTC)</span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1 block font-mono">
                            ₹{Number(c.actualSalary || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                          <span className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider block">Percentage (%)</span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1 block font-mono">
                            {c.percentage ? `${c.percentage}%` : '—'}
                          </span>
                        </div>
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100/50 dark:border-blue-800/30">
                          <span className="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-semibold tracking-wider block">Payment / Commission</span>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block font-mono">
                            ₹{Number(c.payment || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/80 px-6 py-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="text-xs text-gray-500">
                Total candidates: <span className="font-bold text-gray-700 dark:text-gray-300">{candidateModalInvoice.candidateCount}</span>
              </div>
              <button onClick={handleCloseCandidatesModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
      
      {isManageTemplatesOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setIsManageTemplatesOpen(false)} />
          
          <div
            style={{ position: 'relative', zIndex: 50, background: 'white', borderRadius: '24px', width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <DocumentTextIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Template Manager</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Upload and manage custom backgrounds</p>
                </div>
              </div>
              <button onClick={() => setIsManageTemplatesOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px' }}><XMarkIcon className="h-5 w-5" /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', position: 'relative', background: '#f8fafc', transition: 'all 0.2s' }}>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={async e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setIsUploadingTemplate(true);
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('name', newTemplateName || file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
                      
                      try {
                        const u = API_URL.replace(/\/api$/, "") + "/upload/templates";
                        const res = await fetch(u, {
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'ag-spin 1s linear infinite' }} />
                      <style>{`@keyframes ag-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Uploading template to Cloudinary...</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', margin: '0 auto 0.75rem', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.1)' }}>
                        <ArrowUpTrayIcon className="h-5 w-5" />
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Click or drag & drop to upload</p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Supported: PDF, DOCX (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXISTING TEMPLATES ({invoiceTemplates.length})</label>
                
                {templatesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                    <div style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'ag-spin 1s linear infinite' }} />
                  </div>
                ) : invoiceTemplates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '12px', background: '#f8fafc', color: '#94a3b8' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>No custom templates yet. Upload one above to get started.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                    {invoiceTemplates.map(tpl => {
                      return (
                        <div
                          key={tpl.id}
                          className="template-card-invoice"
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
                          }}
                        >
                          <div style={{ flex: 1, width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#0284c7' }}>
                              <DocumentTextIcon className="h-8 w-8" />
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', background: '#e0f2fe', borderRadius: '4px' }}>
                                {(tpl.mimeType === 'application/pdf' || tpl.fileName?.endsWith('.pdf')) ? "PDF" : "DOCX"}
                              </span>
                            </div>
                            
                            <div
                              className="template-hover-overlay-invoice"
                              style={{
                                position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                opacity: 0, transition: 'opacity 0.2s', cursor: 'default', zIndex: 5
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setPreviewTemplate(tpl)}
                                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                title="Preview Template"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(tpl.id)}
                                style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                title="Delete Template"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                          
                          <div style={{ padding: '8px 12px', background: 'white', borderTop: '1px solid #cbd5e1', zIndex: 2 }}>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{tpl.name}</h4>
                          </div>

                          <style>{`
                            .template-card-invoice:hover .template-hover-overlay-invoice {
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setIsManageTemplatesOpen(false)}
                style={{ background: '#0284c7', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {previewTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setPreviewTemplate(null)} />
          
          <div
            style={{ position: 'relative', zIndex: 50, background: 'white', borderRadius: '24px', width: '90vw', maxWidth: '850px', height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{previewTemplate.name}</h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Uploaded on {new Date(previewTemplate.createdAt).toLocaleDateString()}</span>
              </div>
              <button onClick={() => setPreviewTemplate(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px' }}><XMarkIcon className="h-5 w-5" /></button>
            </div>

            <div style={{ flex: 1, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1rem' }}>
              <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                {(previewTemplate.mimeType === 'application/pdf' || previewTemplate.fileName?.endsWith('.pdf')) ? (
                  <iframe src={`${previewTemplate.url}#navpanes=0&view=FitH`} title="Template Preview" style={{ width: '100%', height: '100%', border: 'none' }} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '0.5rem', padding: '2rem', boxSizing: 'border-box' }}>
                    <DocumentTextIcon className="h-16 w-16 text-gray-300" />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>No Interactive Preview Available</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', textAlign: 'center', maxWidth: '300px' }}>Word document templates (.docx) cannot be previewed in-browser. You can download the file to view it.</p>
                    <a href={previewTemplate.url} download style={{ marginTop: '0.5rem', textDecoration: 'none', background: '#0284c7', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>Download DOCX</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isManageBanksOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => { setIsManageBanksOpen(false); setEditingBank(null); setBankForm(initialBankForm); }} />
          
          <div
            style={{ position: 'relative', zIndex: 50, background: 'white', borderRadius: '24px', width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Company Bank Accounts</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Create and manage multiple bank details</p>
                </div>
              </div>
              <button onClick={() => { setIsManageBanksOpen(false); setEditingBank(null); setBankForm(initialBankForm); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px' }}><XMarkIcon className="h-5 w-5" /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <form onSubmit={handleSaveBank} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                  {editingBank ? "Edit Bank Account" : "Add New Bank Account"}
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>ACCOUNT NO. *</label>
                    <input type="text" placeholder="Account Number" required value={bankForm.accountNumber} onChange={e => setBankForm(prev => ({ ...prev, accountNumber: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>BANK *</label>
                    <input type="text" placeholder="e.g. ICICI Bank" required value={bankForm.bank} onChange={e => setBankForm(prev => ({ ...prev, bank: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>BRANCH *</label>
                    <input type="text" placeholder="Branch Name" required value={bankForm.branch} onChange={e => setBankForm(prev => ({ ...prev, branch: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>IFSC *</label>
                    <input type="text" placeholder="IFSC Code" required value={bankForm.ifsc} onChange={e => setBankForm(prev => ({ ...prev, ifsc: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>NAME *</label>
                    <input type="text" placeholder="Account Holder Name" required value={bankForm.name} onChange={e => setBankForm(prev => ({ ...prev, name: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>PAN</label>
                    <input type="text" placeholder="PAN Number" value={bankForm.pan} onChange={e => setBankForm(prev => ({ ...prev, pan: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>GST</label>
                    <input type="text" placeholder="GST Number" value={bankForm.gst} onChange={e => setBankForm(prev => ({ ...prev, gst: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} className="outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input type="checkbox" id="isDefaultBank" checked={bankForm.isDefault} onChange={e => setBankForm(prev => ({ ...prev, isDefault: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="isDefaultBank" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Set as default bank details for new invoices</label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end', marginTop: '0.5rem' }}>
                  {editingBank && (
                    <button
                      type="button"
                      onClick={() => { setEditingBank(null); setBankForm(initialBankForm); }}
                      style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', padding: '8px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.2)' }}
                  >
                    {editingBank ? "Update Details" : "Add Bank Account"}
                  </button>
                </div>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SAVED BANK ACCOUNTS ({companyBanks.length})</label>
                
                {banksLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                    <div style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'ag-spin 1s linear infinite' }} />
                  </div>
                ) : companyBanks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '12px', background: '#f8fafc', color: '#94a3b8' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No custom bank accounts configured yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {companyBanks.map(bk => (
                      <div
                        key={bk._id}
                        style={{
                          borderRadius: '16px',
                          border: bk.isDefault ? '2px solid #ddd6fe' : '1px solid #e2e8f0',
                          background: bk.isDefault ? '#fbfaff' : 'white',
                          padding: '1.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{bk.label}</span>
                            {bk.isDefault && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: '6px' }}>Default</span>
                            )}
                          </div>
                          
                          <div style={{
                            background: '#fcfaff',
                            border: '1px solid #eee7ff',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACCOUNT NO.</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.accountNumber}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BANK</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.bank}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BRANCH</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.branch}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IFSC</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.ifsc}</p>
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NAME</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.name}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAN</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.pan || '—'}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GST</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{bk.gst || '—'}</p>
                              </div>
                              <div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBank(bk);
                              setBankForm({
                                label: bk.label,
                                accountNumber: bk.accountNumber,
                                name: bk.name,
                                bank: bk.bank,
                                branch: bk.branch,
                                ifsc: bk.ifsc,
                                pan: bk.pan || '',
                                gst: bk.gst || '',
                                isDefault: bk.isDefault
                              });
                            }}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            Edit
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteBank(bk._id)}
                            style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#ffe4e6', color: '#e11d48', cursor: 'pointer', display: 'flex' }}
                            title="Delete Bank Account"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => { setIsManageBanksOpen(false); setEditingBank(null); setBankForm(initialBankForm); }}
                style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClientInvoice;
