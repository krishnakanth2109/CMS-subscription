import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import CandidateProfileLink from "@/components/CandidateProfileLink";
import { RecruiterDetailsTrigger } from "@/components/RecruiterDetailsModal";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const API_URL = BASE_URL.endsWith("/api") ? BASE_URL : `${BASE_URL}/api`;

const ALL_STATUSES = [
  "Submitted",
  "Shared Profiles",
  "Yet to attend",
  "Turnups",
  "No Show",
  "Selected",
  "Joined",
  "Rejected",
  "Hold",
  "Backout",
  "Pipeline",
];

const STATUS_COLORS = {
  Submitted: "#2563eb",
  "Shared Profiles": "#0f766e",
  "Yet to attend": "#64748b",
  Turnups: "#7c3aed",
  "No Show": "#dc2626",
  Selected: "#16a34a",
  Joined: "#059669",
  Rejected: "#ef4444",
  Hold: "#f59e0b",
  Backout: "#ea580c",
  Pipeline: "#0891b2",
};

const CHART_COLORS = ["#2563eb", "#16a34a", "#7c3aed", "#f59e0b", "#0891b2", "#ef4444", "#0f766e", "#64748b"];
const CANDIDATE_PAGE_SIZE = 15;

const pad = (n) => String(n).padStart(2, "0");

const localDateStr = (date = new Date()) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const firstDayOfMonth = () => {
  const now = new Date();
  return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
};

const safeDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return localDateStr(parsed);
};

const prettyDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${safeDate(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const normalizeArray = (value, fallbackKey) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.candidates)) return value.candidates;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (fallbackKey && Array.isArray(value?.[fallbackKey])) return value[fallbackKey];
  return [];
};

const getCandidateId = (candidate) => (
  candidate.candidateId || candidate._id?.slice(-6).toUpperCase() || candidate.id?.slice(-6).toUpperCase() || "-"
);

const getCandidateName = (candidate) => (
  candidate.name || `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || "-"
);

const getRecruiterName = (recruiter) => {
  if (!recruiter) return "-";
  if (typeof recruiter === "string") return recruiter;
  const first = recruiter.firstName || "";
  const last = recruiter.lastName || "";
  return `${first} ${last}`.trim() || recruiter.name || recruiter.fullName || recruiter.username || recruiter.email || "-";
};

const getRecruiterId = (candidate) => (
  typeof candidate.recruiterId === "object" ? candidate.recruiterId?._id || candidate.recruiterId?.id : candidate.recruiterId
);

const getCandidateRecruiterName = (candidate) => (
  typeof candidate.recruiterId === "object"
    ? getRecruiterName(candidate.recruiterId)
    : candidate.recruiterName || candidate.recruiter || "Unassigned"
);

const getCandidateRecruiterDetails = (candidate) => (
  candidate?.recruiterId && typeof candidate.recruiterId === "object"
    ? candidate.recruiterId
    : { name: getCandidateRecruiterName(candidate) }
);

const getUserId = (user = {}) => (
  user?._id || user?.id || user?.uid || user?.userId || user?.firebaseUid || user?.localId || ""
);

const getUserName = (user = {}) => {
  const first = user?.firstName || "";
  const last = user?.lastName || "";
  return `${first} ${last}`.trim()
    || user?.name
    || user?.fullName
    || user?.username
    || user?.email
    || "";
};

const getLooseCandidateRecruiterValues = (candidate = {}) => {
  const recruiter = candidate.recruiterId || candidate.recruiter || candidate.recruiterDetails || candidate.assignedRecruiter;
  const createdBy = candidate.createdBy || candidate.createdById || candidate.addedBy || candidate.userId;

  const values = [
    getRecruiterId(candidate),
    candidate.recruiterId,
    candidate.recruiterName,
    candidate.recruiterEmail,
    candidate.recruiter,
    candidate.assignedRecruiter,
    candidate.assignedRecruiterId,
    candidate.createdBy,
    candidate.createdById,
    candidate.addedBy,
    candidate.addedById,
    candidate.userId,
    getCandidateRecruiterName(candidate),
  ];

  [recruiter, createdBy].forEach((item) => {
    if (item && typeof item === "object") {
      values.push(item._id, item.id, item.uid, item.userId, item.firebaseUid, item.email, getRecruiterName(item));
    }
  });

  return values.filter((value) => value !== undefined && value !== null && value !== "");
};

const candidateBelongsToRecruiter = (candidate, user) => {
  const userValues = [
    getUserId(user),
    user?.email,
    getUserName(user),
    user?.name,
    user?.fullName,
    user?.username,
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());

  if (!userValues.length) return false;

  return getLooseCandidateRecruiterValues(candidate).some((value) => (
    userValues.includes(String(value).trim().toLowerCase())
  ));
};

const getFirstNameLabel = (name = "") => {
  const cleanName = String(name).trim();
  if (!cleanName || cleanName === "-") return "Unassigned";
  return cleanName.split(/\s+/)[0];
};

const getStatuses = (candidate) => {
  // Prefer statuses from individual submissions (one per client)
  if (Array.isArray(candidate.submissions) && candidate.submissions.length > 0) {
    const submissionStatuses = candidate.submissions
      .map((s) => s?.pipelineStage || s?.status)
      .filter(Boolean);
    if (submissionStatuses.length > 0) return submissionStatuses;
  }
  if (Array.isArray(candidate.status)) return candidate.status.filter(Boolean);
  return candidate.status ? [candidate.status] : ["Submitted"];
};

const getLastStatus = (candidate) => {
  const statuses = getStatuses(candidate);
  return statuses[statuses.length - 1] || "Submitted";
};


const normalizeStatusText = (status = "") => String(status).toLowerCase().replace(/\s+/g, " ").trim();

const normalizeSourceKey = (source) => (
  (String(source || "Portal").replace(/\s+/g, " ").trim() || "Portal").toLowerCase()
);

const formatSourceName = (source) => {
  const key = normalizeSourceKey(source);
  const knownSources = {
    linkedin: "LinkedIn",
    naukri: "Naukri",
    indeed: "Indeed",
    portal: "Portal",
    referral: "Referral",
    website: "Website",
    "walk-in": "Walk-in",
    walkin: "Walk-in",
  };

  if (knownSources[key]) return knownSources[key];
  return key.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const isStatusBucket = (candidate, bucket) => {
  const normalizedBucket = normalizeStatusText(bucket);
  return getStatuses(candidate).some((status) => {
    const value = normalizeStatusText(status);
    if (value === normalizedBucket) return true;
    if (normalizedBucket === "selected") return /\bselect(ed)?\b/.test(value);
    if (normalizedBucket === "rejected") return /\breject(ed)?\b/.test(value);
    if (normalizedBucket === "hold") return /\bhold\b/.test(value);
    if (normalizedBucket === "joined") return /\bjoined\b/.test(value);
    return false;
  });
};

const candidateDate = (candidate) => safeDate(candidate.createdAt || candidate.dateAdded || candidate.updatedAt);

const HIDDEN_DETAIL_FIELDS = new Set([
  "__v",
  "password",
  "token",
  "otp",
  "resetPasswordToken",
  "resetPasswordExpires",
]);

const CANDIDATE_REPRESENTED_FIELDS = new Set([
  "_id",
  "id",
  "candidateId",
  "name",
  "firstName",
  "lastName",
  "email",
  "contact",
  "phone",
  "position",
  "client",
  "recruiterId",
  "recruiterName",
  "recruiter",
  "source",
  "status",
  "submissions",
  "tenantOwnerId",
  "clientId",
  "jobId",
  "clientCandidateId",
  "createdBy",
  "addedBy",
]);

const DETAIL_LABELS = {
  _id: "Record ID",
  candidateId: "Candidate ID",
  dateAdded: "Date Added",
  createdAt: "Created At",
  updatedAt: "Updated At",
  currentCTC: "Current CTC",
  expectedCTC: "Expected CTC",
  noticePeriod: "Notice Period",
  resumeUrl: "Resume",
  jdUrl: "JD Link",
  jobType: "Job Type",
};

const labelFromKey = (key = "") => (
  DETAIL_LABELS[key]
  || key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const formatDetailValue = (value, key = "") => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/date|created|updated/i.test(key)) {
    const date = prettyDate(value);
    if (date !== "-") return date;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "-";
    return value.map((item) => formatDetailValue(item)).join(", ");
  }
  if (typeof value === "object") {
    if (value.firstName || value.lastName || value.name || value.fullName || value.email) return getRecruiterName(value);
    return JSON.stringify(value);
  }
  const text = String(value);
  if (/^https?:\/\//i.test(text)) {
    return (
      <a href={text} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-300">
        Open Link
      </a>
    );
  }
  return text;
};

const chartTooltip = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: "8px",
    color: "#18181b",
    fontSize: "12px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
  },
  labelStyle: { fontWeight: 700, color: "#18181b" },
};

const inputCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500";

const NumberButton = ({ children, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className="font-semibold text-blue-700 underline-offset-4 hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200 cursor-pointer"
  >
    {children}
  </button>
);

const MetricCard = ({ label, value, hint, icon: Icon, tone = "zinc", onClick }) => {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  };
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${onClick ? "transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700 cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
    </Wrapper>
  );
};

const Section = ({ title, subtitle, children, actions, footer, className = "", bodyClassName = "" }) => (
  <section className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
    <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
    <div className={`p-4 ${bodyClassName}`}>{children}</div>
    {footer && (
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
        {footer}
      </div>
    )}
  </section>
);

const TotalFooter = ({ items }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {items.map(({ label, value, onClick }) => (
      <span key={label} className="inline-flex items-center gap-1.5" aria-label={`${label}: ${value}`}>
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        {onClick ? (
          <NumberButton onClick={onClick}>{value}</NumberButton>
        ) : (
          <span className="font-semibold text-zinc-900 dark:text-white">{value}</span>
        )}
      </span>
    ))}
  </div>
);

const getFooterAlignClass = (align = "left") => {
  if (align === "right") return "justify-end text-right";
  if (align === "center") return "justify-center text-center";
  return "justify-start text-left";
};

const ColumnTotalFooter = ({ columns, minWidth = "520px", template }) => (
  <div className="overflow-x-auto">
    <div
      className="grid"
      style={{ minWidth, gridTemplateColumns: template || `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map(({ label, value, align = "left", onClick }) => (
        <div key={label} className={`flex min-h-9 items-center px-3 py-1 ${getFooterAlignClass(align)}`} aria-label={`${label}: ${value}`}>
          {onClick ? (
            <NumberButton onClick={onClick} className="shrink-0 text-sm">{value}</NumberButton>
          ) : (
            <span className="shrink-0 text-sm font-bold text-zinc-900 dark:text-white">{value}</span>
          )}
        </div>
      ))}
    </div>
  </div>
);

const DetailsModal = ({ detail, onClose, onCellDrilldown }) => {
  const [modalSearch, setModalSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setModalSearch("");
  }, [detail?.title, detail?.subtitle]);

  if (!detail) return null;
  const rows = detail.rows || [];
  const columns = detail.columns || [];
  const query = modalSearch.trim().toLowerCase();
  const visibleRows = query
    ? rows.filter((row) => (
      columns.some((column) => {
        const rawValue = column.searchValue
          ? column.searchValue(row)
          : column.key
            ? row[column.key]
            : column.render
              ? column.render(row)
              : "";
        if (rawValue === null || rawValue === undefined) return false;
        if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
          if (rawValue.props?.children) return String(rawValue.props.children).toLowerCase().includes(query);
          return JSON.stringify(rawValue).toLowerCase().includes(query);
        }
        return String(Array.isArray(rawValue) ? rawValue.join(" ") : rawValue).toLowerCase().includes(query);
      })
    ))
    : rows;

  const getCellTextValue = (row, column) => {
    if (column.exportValue) return column.exportValue(row);
    if (column.searchValue) {
      const v = column.searchValue(row);
      return v !== null && v !== undefined ? String(v) : "";
    }
    if (column.key) {
      const v = row[column.key];
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return v.join(", ");
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (typeof v === "object") {
        if (v.firstName || v.lastName || v.name || v.fullName || v.email) {
          const first = v.firstName || "";
          const last = v.lastName || "";
          return `${first} ${last}`.trim() || v.name || v.fullName || v.username || v.email || "";
        }
        return JSON.stringify(v);
      }
      return String(v);
    }
    if (column.render) {
      const rendered = column.render(row);
      if (rendered === null || rendered === undefined) return "";
      if (typeof rendered === "string" || typeof rendered === "number") return String(rendered);
      if (rendered?.props?.children !== undefined) {
        const c = rendered.props.children;
        return Array.isArray(c) ? c.filter(Boolean).join(" ") : String(c ?? "");
      }
      return "";
    }
    return "";
  };

  const handleExportExcel = () => {
    if (visibleRows.length === 0) {
      toast({ title: "No data", description: "Nothing to export.", variant: "destructive" });
      return;
    }
    try {
      const exportData = visibleRows.map((row, idx) => {
        const obj = { "S.No": String(idx + 1) };
        columns.forEach((col) => { obj[col.label] = getCellTextValue(row, col); });
        return obj;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      const headers = Object.keys(exportData[0] || {});
      worksheet["!cols"] = headers.map((header) => {
        const maxLen = Math.max(
          String(header).length,
          ...exportData.map((r) => String(r[header] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
      });

      worksheet["!rows"] = [{ hpt: 28 }, ...exportData.map(() => ({ hpt: 20 }))];

      Object.keys(worksheet).forEach((cellAddr) => {
        if (cellAddr.startsWith("!")) return;
        const cell = worksheet[cellAddr];
        if (!cell) return;
        const rowNum = parseInt(cellAddr.replace(/^[A-Z]+/, ""), 10);
        const colLetter = cellAddr.replace(/[0-9]+$/, "");
        cell.s = cell.s || {};
        cell.s.font = cell.s.font || {};
        cell.s.alignment = cell.s.alignment || {};

        if (rowNum === 1) {
          cell.s.font.bold = true;
          cell.s.font.name = "Segoe UI";
          cell.s.font.sz = 11;
          cell.s.fill = { fgColor: { rgb: "EFF6FF" } };
          cell.s.alignment.horizontal = "center";
          cell.s.alignment.vertical = "center";
        } else {
          cell.s.font.name = "Segoe UI";
          cell.s.font.sz = 10;
          cell.s.alignment.vertical = "center";
          if (colLetter === "A") {
            cell.t = "s";
            cell.z = "@";
            cell.s.alignment.horizontal = "left";
          } else {
            const numVal = Number(cell.v);
            if (!Number.isNaN(numVal) && String(cell.v).trim() !== "" && !/^0\d/.test(String(cell.v))) {
              cell.t = "n";
              cell.s.alignment.horizontal = "right";
            } else {
              cell.t = "s";
              cell.z = "@";
              cell.s.alignment.horizontal = "left";
            }
          }
        }
      });

      const workbook = XLSX.utils.book_new();
      const sheetName = (detail.title || "Report Details").replace(/[:\\/?*[\]]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const safeTitle = (detail.title || "Report_Details").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `${safeTitle}_${dateStr}.xlsx`);

      toast({ title: "Exported!", description: `${visibleRows.length} records exported to Excel.` });
    } catch (err) {
      console.error("Excel export failed:", err);
      toast({ title: "Export failed", description: "Could not export file.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-zinc-950 dark:text-white">{detail.title}</h2>
              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
                {visibleRows.length} Records
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{detail.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {visibleRows.length > 0 && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-650 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
              aria-label="Close details modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={modalSearch}
              onChange={(event) => setModalSearch(event.target.value)}
              placeholder="Search details..."
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
          {visibleRows.length ? (
            <div className="h-full overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm" style={{ minWidth: detail.tableMinWidth || 980 }}>
                <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.label} className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visibleRows.map((row, index) => (
                    <tr key={row._id || row.id || row.name || row.client || row.status || row.position || row.source || index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      {columns.map((column) => {
                        const cellContent = column.render ? column.render(row) : formatDetailValue(row[column.key], column.key);
                        const drilldown = onCellDrilldown?.(row, column);

                        return (
                          <td key={column.label} className={`max-w-[280px] whitespace-normal break-words px-4 py-3 align-top text-zinc-700 dark:text-zinc-300 ${column.align === "right" ? "text-right" : ""}`}>
                            {drilldown ? (
                              <NumberButton onClick={() => drilldown.onClick()} className="text-sm">
                                {cellContent}
                              </NumberButton>
                            ) : (
                              cellContent
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-full min-h-72 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40">
              {rows.length ? "No details match your search" : "No details found for this number"}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400 sm:px-6">
          <span>Showing <span className="font-semibold text-zinc-900 dark:text-white">{visibleRows.length}</span> of <span className="font-semibold text-zinc-900 dark:text-white">{rows.length}</span></span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export function ReportsDashboard({ recruiterOnly = false }) {
  const { toast } = useToast();
  const { authHeaders, currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [detailModal, setDetailModal] = useState(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    recruiterId: "all",
    status: "all",
    client: "all",
    source: "all",
    search: "",
  });
  const [candidatePage, setCandidatePage] = useState(1);
  const reportStartDate = filters.startDate;
  const reportEndDate = filters.endDate;
  const currentRecruiterId = getUserId(currentUser);
  const currentRecruiterName = getUserName(currentUser) || "My Recruiter";

  const getHeaders = useCallback(async () => {
    const headers = await authHeaders();
    return { "Content-Type": "application/json", ...headers };
  }, [authHeaders]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams();
      params.set("view", "reports");
      if (reportStartDate && reportEndDate) {
        params.set("startDate", reportStartDate);
        params.set("endDate", reportEndDate);
      }
      if (recruiterOnly && currentRecruiterId) {
        params.set("recruiterId", currentRecruiterId);
      }
      const candidateUrl = `${API_URL}/candidates${params.toString() ? `?${params.toString()}` : ""}`;
      const recruiterRequest = recruiterOnly
        ? Promise.resolve({ ok: true, json: async () => [currentUser].filter(Boolean) })
        : fetch(`${API_URL}/recruiters?view=lookup`, { headers });
      const [candidateRes, recruiterRes] = await Promise.all([
        fetch(candidateUrl, { headers }),
        recruiterRequest,
      ]);

      if (!candidateRes.ok || !recruiterRes.ok) throw new Error("Unable to load reports.");

      const candidateJson = await candidateRes.json();
      const recruiterJson = await recruiterRes.json();
      const loadedCandidates = normalizeArray(candidateJson);
      setCandidates(loadedCandidates);
      setRecruiters(recruiterOnly ? [currentUser].filter(Boolean) : normalizeArray(recruiterJson, "recruiters"));
    } catch (error) {
      setFetchError(true);
      toast({ title: "Report Error", description: error.message || "Failed to load reports.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getHeaders, toast, reportStartDate, reportEndDate, recruiterOnly, currentRecruiterId, currentUser]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const clientOptions = useMemo(() => (
    [...new Set(candidates.map((item) => item.client).filter(Boolean))].sort()
  ), [candidates]);

  const sourceOptions = useMemo(() => (
    [...new Map(candidates.map((item) => {
      const label = formatSourceName(item.source);
      return [normalizeSourceKey(label), label];
    })).values()].sort()
  ), [candidates]);

  const statusOptions = useMemo(() => (
    [...new Set([...ALL_STATUSES, ...candidates.flatMap(getStatuses)])].filter(Boolean).sort()
  ), [candidates]);

  const filteredCandidates = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const start = filters.startDate || "0000-01-01";
    const end = filters.endDate || "9999-12-31";

    return candidates.filter((candidate) => {
      const date = candidateDate(candidate);
      if (!date || date < start || date > end) return false;

      if (!recruiterOnly && filters.recruiterId !== "all" && String(getRecruiterId(candidate)) !== String(filters.recruiterId)) return false;
      if (filters.status !== "all" && !getStatuses(candidate).includes(filters.status)) return false;
      if (filters.client !== "all" && (candidate.client || "") !== filters.client) return false;
      if (filters.source !== "all" && normalizeSourceKey(candidate.source) !== normalizeSourceKey(filters.source)) return false;

      if (!query) return true;
      const haystack = [
        getCandidateId(candidate),
        getCandidateName(candidate),
        candidate.email,
        candidate.contact,
        candidate.phone,
        candidate.position,
        candidate.client,
        getCandidateRecruiterName(candidate),
        getStatuses(candidate).join(" "),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [candidates, filters, recruiterOnly]);

  const summary = useMemo(() => {
    const total = filteredCandidates.length;
    const selected = filteredCandidates.filter((item) => isStatusBucket(item, "Selected")).length;
    const joined = filteredCandidates.filter((item) => isStatusBucket(item, "Joined")).length;
    const turnups = filteredCandidates.filter((item) => getStatuses(item).includes("Turnups")).length;
    const rejected = filteredCandidates.filter((item) => isStatusBucket(item, "Rejected")).length;
    const uniqueRecruiters = new Set(filteredCandidates.map(getCandidateRecruiterName).filter((item) => item && item !== "Unassigned")).size;
    const conversion = selected ? Math.round((joined / selected) * 100) : 0;
    const selectionRate = total ? Math.round((selected / total) * 100) : 0;

    return { total, selected, joined, turnups, rejected, uniqueRecruiters, conversion, selectionRate };
  }, [filteredCandidates]);

  const statusSummary = useMemo(() => (
    statusOptions.map((status) => ({
      status,
      count: filteredCandidates.filter((candidate) => getStatuses(candidate).includes(status)).length,
      fill: STATUS_COLORS[status] || "#64748b",
    })).filter((item) => item.count > 0)
  ), [filteredCandidates, statusOptions]);

  const statusTotal = useMemo(() => (
    statusSummary.reduce((total, item) => total + item.count, 0)
  ), [statusSummary]);

  const recruiterSummary = useMemo(() => {
    const map = new Map();
    filteredCandidates.forEach((candidate) => {
      const name = getCandidateRecruiterName(candidate);
      if (!map.has(name)) {
        map.set(name, { name, recruiter: getCandidateRecruiterDetails(candidate), Submissions: 0, Turnups: 0, Selected: 0, Joined: 0, Rejected: 0 });
      }
      const row = map.get(name);
      row.Submissions += 1;
      if (getStatuses(candidate).includes("Turnups")) row.Turnups += 1;
      if (isStatusBucket(candidate, "Selected")) row.Selected += 1;
      if (isStatusBucket(candidate, "Joined")) row.Joined += 1;
      if (isStatusBucket(candidate, "Rejected")) row.Rejected += 1;
    });
    return [...map.values()].sort((a, b) => b.Submissions - a.Submissions);
  }, [filteredCandidates]);

  const recruiterTotals = useMemo(() => (
    recruiterSummary.reduce((total, row) => ({
      Submissions: total.Submissions + row.Submissions,
      Turnups: total.Turnups + row.Turnups,
      Selected: total.Selected + row.Selected,
      Joined: total.Joined + row.Joined,
      Rejected: total.Rejected + row.Rejected,
    }), { Submissions: 0, Turnups: 0, Selected: 0, Joined: 0, Rejected: 0 })
  ), [recruiterSummary]);

  const recruiterChartData = useMemo(() => (
    recruiterSummary.slice(0, 10).map((row) => ({
      ...row,
      firstName: getFirstNameLabel(row.name),
    }))
  ), [recruiterSummary]);

  const clientSummary = useMemo(() => {
    const map = new Map();
    filteredCandidates.forEach((candidate) => {
      const name = candidate.client || "Unassigned";
      if (!map.has(name)) map.set(name, { client: name, Submissions: 0, Selected: 0, Joined: 0 });
      const row = map.get(name);
      row.Submissions += 1;
      if (isStatusBucket(candidate, "Selected")) row.Selected += 1;
      if (isStatusBucket(candidate, "Joined")) row.Joined += 1;
    });
    return [...map.values()].sort((a, b) => b.Submissions - a.Submissions);
  }, [filteredCandidates]);

  const clientTotals = useMemo(() => (
    clientSummary.reduce((total, row) => ({
      Submissions: total.Submissions + row.Submissions,
      Selected: total.Selected + row.Selected,
      Joined: total.Joined + row.Joined,
    }), { Submissions: 0, Selected: 0, Joined: 0 })
  ), [clientSummary]);

  const sourceSummary = useMemo(() => {
    const map = new Map();
    filteredCandidates.forEach((candidate) => {
      const key = normalizeSourceKey(candidate.source);
      const current = map.get(key) || { name: formatSourceName(candidate.source), value: 0 };
      current.value += 1;
      map.set(key, current);
    });
    return [...map.values()]
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .map((item, index) => ({ ...item, fill: CHART_COLORS[index % CHART_COLORS.length] }));
  }, [filteredCandidates]);

  const sourceTotal = useMemo(() => (
    sourceSummary.reduce((total, item) => total + item.value, 0)
  ), [sourceSummary]);

  const positionSummary = useMemo(() => {
    const map = new Map();
    filteredCandidates.forEach((candidate) => {
      const position = candidate.position || "Unassigned";
      map.set(position, (map.get(position) || 0) + 1);
    });
    return [...map.entries()]
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredCandidates]);

  const trendData = useMemo(() => {
    let startStr = filters.startDate;
    let endStr = filters.endDate;

    if (!startStr || !endStr) {
      const candidateDates = filteredCandidates.map(candidateDate).filter(Boolean);
      if (candidateDates.length > 0) {
        candidateDates.sort();
        if (!startStr) startStr = candidateDates[0];
        if (!endStr) endStr = candidateDates[candidateDates.length - 1];
      }
    }

    const start = new Date(`${startStr || firstDayOfMonth()}T00:00:00`);
    const end = new Date(`${endStr || localDateStr()}T00:00:00`);
    const dayCount = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
    const groupByMonth = dayCount > 45;
    const map = new Map();

    filteredCandidates.forEach((candidate) => {
      const date = new Date(`${candidateDate(candidate)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const key = groupByMonth
        ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
        : localDateStr(date);
      const label = groupByMonth
        ? date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
        : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

      if (!map.has(key)) map.set(key, { key, label, Submissions: 0, Selected: 0, Joined: 0 });
      const row = map.get(key);
      row.Submissions += 1;
      if (isStatusBucket(candidate, "Selected")) row.Selected += 1;
      if (isStatusBucket(candidate, "Joined")) row.Joined += 1;
    });

    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredCandidates, filters.startDate, filters.endDate]);

  const funnelData = useMemo(() => ([
    { stage: "Submitted", count: summary.total },
    { stage: "Turnups", count: summary.turnups },
    { stage: "Selected", count: summary.selected },
    { stage: "Rejected", count: summary.rejected },
    { stage: "Joined", count: summary.joined },
  ]), [summary]);

  const filteredCandidateRows = useMemo(() => (
    [...filteredCandidates]
      .sort((a, b) => candidateDate(b).localeCompare(candidateDate(a)))
  ), [filteredCandidates]);

  useEffect(() => {
    setCandidatePage(1);
  }, [filters.startDate, filters.endDate, filters.recruiterId, filters.status, filters.client, filters.source, filters.search]);

  const candidatePageCount = Math.max(1, Math.ceil(filteredCandidateRows.length / CANDIDATE_PAGE_SIZE));
  const currentCandidatePage = Math.min(candidatePage, candidatePageCount);
  const candidatePageStart = filteredCandidateRows.length ? ((currentCandidatePage - 1) * CANDIDATE_PAGE_SIZE) + 1 : 0;
  const candidatePageEnd = Math.min(currentCandidatePage * CANDIDATE_PAGE_SIZE, filteredCandidateRows.length);
  const paginatedCandidateRows = useMemo(() => (
    filteredCandidateRows.slice(candidatePageStart - 1, candidatePageEnd)
  ), [filteredCandidateRows, candidatePageStart, candidatePageEnd]);

  const filterLabel =
    (!filters.startDate && !filters.endDate)
      ? "All Time"
      : (!filters.startDate)
        ? `Up to ${prettyDate(filters.endDate)}`
        : (!filters.endDate)
          ? `From ${prettyDate(filters.startDate)}`
          : `${prettyDate(filters.startDate)} to ${prettyDate(filters.endDate)}`;

  const candidateDetailColumns = useMemo(() => {
    const baseKeys = [...new Set(filteredCandidateRows.flatMap((candidate) => Object.keys(candidate || {})))]
      .filter((key) => key !== "customFields" && !HIDDEN_DETAIL_FIELDS.has(key) && !CANDIDATE_REPRESENTED_FIELDS.has(key))
      .sort((a, b) => labelFromKey(a).localeCompare(labelFromKey(b)));

    const customFieldKeys = [...new Set(filteredCandidateRows.flatMap((candidate) => {
      const customs = candidate?.customFields;
      return customs && typeof customs === "object" ? Object.keys(customs) : [];
    }))].sort((a, b) => labelFromKey(a).localeCompare(labelFromKey(b)));

    return [
      {
        label: "Candidate",
        searchValue: (candidate) => `${getCandidateName(candidate)} ${getCandidateId(candidate)}`,
        render: (candidate) => (
          <div>
            <CandidateProfileLink candidate={candidate} className="text-zinc-900 dark:text-white">
              {getCandidateName(candidate)}
            </CandidateProfileLink>
            <p className="font-mono text-xs text-zinc-500">{getCandidateId(candidate)}</p>
          </div>
        ),
      },
      { label: "Email", searchValue: (candidate) => candidate.email || "", render: (candidate) => candidate.email || "-" },
      { label: "Phone", searchValue: (candidate) => candidate.contact || candidate.phone || "", render: (candidate) => candidate.contact || candidate.phone || "-" },
      { label: "Position", searchValue: (candidate) => candidate.position || "", render: (candidate) => candidate.position || "-" },
      { label: "Client", searchValue: (candidate) => candidate.client || "", render: (candidate) => candidate.client || "-" },
      {
        label: "Recruiter",
        searchValue: (candidate) => getCandidateRecruiterName(candidate),
        render: (candidate) => (
          <RecruiterDetailsTrigger recruiter={getCandidateRecruiterDetails(candidate)} className="font-medium text-zinc-700 dark:text-zinc-200">
            {getCandidateRecruiterName(candidate)}
          </RecruiterDetailsTrigger>
        ),
      },
      { label: "Source", searchValue: (candidate) => formatSourceName(candidate.source), render: (candidate) => formatSourceName(candidate.source) },
      { label: "Status", searchValue: (candidate) => getLastStatus(candidate), render: (candidate) => getLastStatus(candidate) },
      { label: "Report Date", searchValue: (candidate) => prettyDate(candidateDate(candidate)), render: (candidate) => prettyDate(candidateDate(candidate)) },
      ...baseKeys.map((key) => ({
        label: labelFromKey(key),
        key,
        searchValue: (candidate) => {
          const raw = candidate[key];
          if (raw === null || raw === undefined) return "";
          if (Array.isArray(raw)) {
            return raw.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(" ");
          }
          if (typeof raw === "object") return JSON.stringify(raw);
          return String(raw);
        },
        render: (candidate) => formatDetailValue(candidate[key], key),
      })),
      ...customFieldKeys.map((customKey) => ({
        label: labelFromKey(customKey),
        searchValue: (candidate) => {
          const val = candidate?.customFields?.[customKey];
          return val === null || val === undefined ? "" : String(val);
        },
        render: (candidate) => {
          const val = candidate?.customFields?.[customKey];
          return val === null || val === undefined || val === "" ? "-" : String(val);
        },
      })),
    ];
  }, [filteredCandidateRows]);

  const recruiterDetailColumns = useMemo(() => ([
    {
      label: "Recruiter",
      searchValue: (row) => row.name,
      render: (row) => (
        <RecruiterDetailsTrigger recruiter={row.recruiter || { name: row.name }} className="font-medium text-zinc-700 dark:text-zinc-200">
          {row.name}
        </RecruiterDetailsTrigger>
      ),
    },
    { label: "Submissions", key: "Submissions", align: "right" },
    { label: "Turnups", key: "Turnups", align: "right" },
    { label: "Selected", key: "Selected", align: "right" },
    { label: "Joined", key: "Joined", align: "right" },
    { label: "Rejected", key: "Rejected", align: "right" },
  ]), []);

  const clientDetailColumns = useMemo(() => ([
    { label: "Client", key: "client" },
    { label: "Submissions", key: "Submissions", align: "right" },
    { label: "Selected", key: "Selected", align: "right" },
    { label: "Joined", key: "Joined", align: "right" },
  ]), []);

  const compactSummaryColumns = useMemo(() => ([
    { label: "Name", render: (row) => row.name || row.client || row.position || row.status || row.source || "-" },
    { label: "Count", render: (row) => row.count ?? row.value ?? row.Submissions ?? "-", align: "right" },
  ]), []);

  const openDetails = (title, rows, columns, subtitle = filterLabel) => {
    setDetailModal({
      title,
      subtitle: `${rows.length} details | ${subtitle}`,
      rows,
      columns,
      tableMinWidth: Math.max(1100, columns.length * 170),
    });
  };

  const statusRows = (status) => (
    filteredCandidateRows.filter((candidate) => getStatuses(candidate).includes(status))
  );

  const bucketRows = (bucket) => (
    filteredCandidateRows.filter((candidate) => (
      bucket === "Turnups" ? getStatuses(candidate).includes("Turnups") : isStatusBucket(candidate, bucket)
    ))
  );

  const recruiterRows = (name, bucket) => (
    filteredCandidateRows.filter((candidate) => (
      getCandidateRecruiterName(candidate) === name
      && (!bucket || (bucket === "Turnups" ? getStatuses(candidate).includes("Turnups") : isStatusBucket(candidate, bucket)))
    ))
  );

  const clientRows = (client, bucket) => (
    filteredCandidateRows.filter((candidate) => (
      (candidate.client || "Unassigned") === client
      && (!bucket || isStatusBucket(candidate, bucket))
    ))
  );

  const sourceRows = (source) => (
    filteredCandidateRows.filter((candidate) => normalizeSourceKey(candidate.source) === normalizeSourceKey(source))
  );

  const positionRows = (position) => (
    filteredCandidateRows.filter((candidate) => (candidate.position || "Unassigned") === position)
  );

  const getDetailCellDrilldown = (row, column) => {
    const rawValue = column.key ? row[column.key] : row.count ?? row.value ?? row.Submissions;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

    if (row.name && ["Submissions", "Turnups", "Selected", "Joined", "Rejected"].includes(column.key)) {
      const bucket = column.key === "Submissions" ? undefined : column.key;
      return {
        onClick: () => openDetails(`${row.name} ${column.label}`, recruiterRows(row.name, bucket), candidateDetailColumns),
      };
    }

    if (row.client && ["Submissions", "Selected", "Joined"].includes(column.key)) {
      const bucket = column.key === "Submissions" ? undefined : column.key;
      return {
        onClick: () => openDetails(`${row.client} ${column.label}`, clientRows(row.client, bucket), candidateDetailColumns),
      };
    }

    if (column.label === "Count") {
      if (row.status) {
        return {
          onClick: () => openDetails(`${row.status} Candidates`, statusRows(row.status), candidateDetailColumns),
        };
      }
      if (row.source) {
        return {
          onClick: () => openDetails(`${row.source} Candidates`, sourceRows(row.source), candidateDetailColumns),
        };
      }
      if (row.position) {
        return {
          onClick: () => openDetails(`${row.position} Candidates`, positionRows(row.position), candidateDetailColumns),
        };
      }
    }

    return null;
  };

  const setQuickRange = (days) => {
    const end = new Date();
    const start = addDays(end, -(days - 1));
    setFilters((prev) => ({ ...prev, startDate: localDateStr(start), endDate: localDateStr(end) }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      recruiterId: "all",
      status: "all",
      client: "all",
      source: "all",
      search: "",
    });
  };

  const exportRows = useMemo(() => (
    filteredCandidates.map((candidate) => ({
      "Candidate ID": getCandidateId(candidate),
      Name: getCandidateName(candidate),
      Email: candidate.email || "",
      Phone: candidate.contact || candidate.phone || "",
      Position: candidate.position || "",
      Client: candidate.client || "",
      Recruiter: getCandidateRecruiterName(candidate),
      Source: candidate.source || "Portal",
      Status: getStatuses(candidate).join(" | "),
      "Date Added": candidateDate(candidate),
      "Created At": safeDate(candidate.createdAt),
      "Original Date Added": safeDate(candidate.dateAdded),
      Remarks: candidate.remarks || "",
      Notes: candidate.notes || "",
    }))
  ), [filteredCandidates]);

  const appendExcelSheet = (workbook, sheetName, rows, options = {}) => {
    const safeRows = rows.length ? rows : [options.emptyRow || { Message: "No data for selected filters" }];
    const worksheet = XLSX.utils.json_to_sheet(safeRows);
    const headers = Object.keys(safeRows[0] || {});

    worksheet["!cols"] = headers.map((header) => {
      const maxLength = Math.max(
        String(header).length,
        ...safeRows.map((row) => String(row[header] ?? "").length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 12), 36) };
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  };

  const handleExport = async (format) => {
    if (!filteredCandidates.length) {
      toast({ title: "No Data", description: "No report data available for the selected filters." });
      return;
    }

    setIsExporting(true);
    const suffix = `${filters.startDate || "start"}_${filters.endDate || "end"}`;

    try {
      if (format === "excel") {
        const workbook = XLSX.utils.book_new();
        workbook.Props = {
          Title: "Filtered Recruitment Report",
          Subject: filterLabel,
          Author: "CMS Reports",
          CreatedDate: new Date(),
        };

        appendExcelSheet(workbook, "Filtered Candidate Information", exportRows);
        appendExcelSheet(workbook, "Summary", [
          { Metric: "Date Range", Value: filterLabel },
          { Metric: "Recruiter Filter", Value: recruiterOnly ? currentRecruiterName : (filters.recruiterId === "all" ? "All" : filters.recruiterId) },
          { Metric: "Status Filter", Value: filters.status === "all" ? "All" : filters.status },
          { Metric: "Client Filter", Value: filters.client === "all" ? "All" : filters.client },
          { Metric: "Source Filter", Value: filters.source === "all" ? "All" : filters.source },
          { Metric: "Search", Value: filters.search || "All" },
          { Metric: "Candidates", Value: summary.total },
          { Metric: "Turnups", Value: summary.turnups },
          { Metric: "Selected", Value: summary.selected },
          { Metric: "Rejected", Value: summary.rejected },
          { Metric: "Joined", Value: summary.joined },
          { Metric: "Conversion", Value: `${summary.conversion}%` },
        ]);
        appendExcelSheet(workbook, "Recruiters", [
          ...recruiterSummary,
          { name: "Total", ...recruiterTotals },
        ]);
        appendExcelSheet(workbook, "Clients", [
          ...clientSummary,
          { client: "Total", ...clientTotals },
        ]);
        appendExcelSheet(workbook, "Source Split", sourceSummary.map((item) => ({
          Source: item.name,
          Candidates: item.value,
        })));
        appendExcelSheet(workbook, "Status Funnel", funnelData.map((item) => ({
          Stage: item.stage,
          Candidates: item.count,
        })));
        appendExcelSheet(workbook, "Status Summary", statusSummary.map(({ fill, ...row }) => row));
        appendExcelSheet(workbook, "Submission Trend", trendData);
        appendExcelSheet(workbook, "Top Positions", positionSummary.map((item) => ({
          Position: item.position,
          Candidates: item.count,
        })));

        if (XLSX.writeFileXLSX) {
          XLSX.writeFileXLSX(workbook, `Filtered_Report_${suffix}.xlsx`, { compression: true });
        } else {
          XLSX.writeFile(workbook, `Filtered_Report_${suffix}.xlsx`, { bookType: "xlsx", compression: true });
        }
      } else {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(16);
        doc.text("Filtered Recruitment Report", 14, 16);
        doc.setFontSize(9);
        doc.text(`Date range: ${filterLabel}`, 14, 23);
        doc.text(`Filters: Recruiter ${recruiterOnly ? currentRecruiterName : (filters.recruiterId === "all" ? "All" : "Selected")} | Status ${filters.status} | Client ${filters.client} | Source ${filters.source}`, 14, 29);

        autoTable(doc, {
          startY: 36,
          head: [["Candidates", "Turnups", "Selected", "Joined", "Rejected", "Conversion"]],
          body: [[summary.total, summary.turnups, summary.selected, summary.joined, summary.rejected, `${summary.conversion}%`]],
          theme: "grid",
        });

        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 8,
          head: [["Recruiter", "Submissions", "Turnups", "Selected", "Joined", "Rejected"]],
          body: recruiterSummary.map((item) => [item.name, item.Submissions, item.Turnups, item.Selected, item.Joined, item.Rejected]),
          theme: "striped",
        });

        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 8,
          head: [["Candidate ID", "Name", "Position", "Client", "Recruiter", "Status", "Date"]],
          body: exportRows.map((row) => [row["Candidate ID"], row.Name, row.Position, row.Client, row.Recruiter, row.Status, row["Date Added"]]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [24, 24, 27] },
        });

        doc.save(`Filtered_Report_${suffix}.pdf`);
      }
      toast({ title: "Exported", description: `${format.toUpperCase()} report downloaded.` });
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not create the report file.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-700 dark:text-zinc-200" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Loading reports...</span>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center shadow-sm">
          <p className="font-semibold text-zinc-900 dark:text-white">Failed to load reports</p>
          <button onClick={fetchReports} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer">
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex-1 overflow-y-auto bg-slate-50 p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:p-5">
        <div className="mx-auto max-w-[1500px] space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Overview</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Reports</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Filtered recruitment performance, trends, and export-ready tables.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleExport("excel")} disabled={isExporting} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                Excel
              </button>
              <button onClick={() => handleExport("pdf")} disabled={isExporting} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                PDF
              </button>
            </div>
          </div>

          <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <Filter className="h-4 w-4" />
              Report Filters
            </div>
            {/* Mobile Filter Trigger */}
            <div className="flex md:hidden items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
              >
                <Filter className="h-4 w-4" />
                Filter
                {(filters.startDate || filters.recruiterId !== "all" || filters.status !== "all" || filters.client !== "all" || filters.source !== "all" || filters.search) && (
                  <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white leading-none">
                    {[
                      filters.startDate ? 1 : 0,
                      filters.recruiterId !== "all" ? 1 : 0,
                      filters.status !== "all" ? 1 : 0,
                      filters.client !== "all" ? 1 : 0,
                      filters.source !== "all" ? 1 : 0,
                      filters.search ? 1 : 0,
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={fetchReports}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
                title="Reset"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <div className="hidden md:grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Start Date</label>
                <input type="date" value={filters.startDate} max={filters.endDate || localDateStr()} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">End Date</label>
                <input type="date" value={filters.endDate} min={filters.startDate || undefined} max={localDateStr()} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Recruiter</label>
                <select
                  value={recruiterOnly ? (currentRecruiterId || "current") : filters.recruiterId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, recruiterId: e.target.value }))}
                  disabled={recruiterOnly}
                  className={`${inputCls} cursor-pointer`}
                >
                  {recruiterOnly ? (
                    <option value={currentRecruiterId || "current"}>{currentRecruiterName}</option>
                  ) : (
                    <>
                      <option value="all">All Recruiters</option>
                      {recruiters.map((recruiter) => (
                        <option key={recruiter._id || recruiter.id} value={recruiter._id || recruiter.id}>{getRecruiterName(recruiter)}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Status</label>
                <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className={`${inputCls} cursor-pointer`}>
                  <option value="all">All Status</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Client</label>
                <select value={filters.client} onChange={(e) => setFilters((prev) => ({ ...prev, client: e.target.value }))} className={`${inputCls} cursor-pointer`}>
                  <option value="all">All Clients</option>
                  {clientOptions.map((client) => <option key={client} value={client}>{client}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Source</label>
                <select value={filters.source} onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))} className={`${inputCls} cursor-pointer`}>
                  <option value="all">All Sources</option>
                  {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Name, role, ID..." className={`${inputCls} pl-9`} />
                </div>
              </div>
            </div>
            <div className="mt-3 hidden md:flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setQuickRange(7)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Last 7 Days</button>
                <button onClick={() => setQuickRange(30)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Last 30 Days</button>
                <button onClick={() => setFilters((prev) => ({ ...prev, startDate: firstDayOfMonth(), endDate: localDateStr() }))} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">This Month</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={fetchReports} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                <button onClick={resetFilters} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Candidates" value={summary.total} hint={filterLabel} icon={Users} tone="zinc" onClick={() => openDetails("Candidates", filteredCandidateRows, candidateDetailColumns)} />
            <MetricCard label="Recruiters" value={summary.uniqueRecruiters} hint="Recruiters with submissions" icon={UserCheck} tone="blue" onClick={() => openDetails("Recruiters With Submissions", recruiterSummary, recruiterDetailColumns)} />
            <MetricCard label="Turnups" value={summary.turnups} hint="Candidates attended" icon={CalendarDays} tone="amber" onClick={() => openDetails("Turnup Candidates", bucketRows("Turnups"), candidateDetailColumns)} />
            <MetricCard label="Selected" value={summary.selected} hint={`${summary.selectionRate}% selection rate`} icon={CheckCircle2} tone="green" onClick={() => openDetails("Selected Candidates", bucketRows("Selected"), candidateDetailColumns)} />
            <MetricCard label="Joined" value={summary.joined} hint="Final joined count" icon={BriefcaseBusiness} tone="green" onClick={() => openDetails("Joined Candidates", bucketRows("Joined"), candidateDetailColumns)} />
            <MetricCard label="Conversion" value={`${summary.conversion}%`} hint="Selected to joined" icon={TrendingUp} tone="blue" onClick={() => openDetails("Joined Candidates For Conversion", bucketRows("Joined"), candidateDetailColumns)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
            <Section
              title="Submission Trend"
              subtitle="Date range aware trend for submissions, selected, and joined candidates."
              footer={<TotalFooter items={[
                { label: "Total Submissions", value: summary.total, onClick: () => openDetails("Submitted Candidates", filteredCandidateRows, candidateDetailColumns) },
                { label: "Selected", value: summary.selected, onClick: () => openDetails("Selected Candidates", bucketRows("Selected"), candidateDetailColumns) },
                { label: "Joined", value: summary.joined, onClick: () => openDetails("Joined Candidates", bucketRows("Joined"), candidateDetailColumns) },
              ]} />}
            >
              <div className="h-60 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="submissionsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Legend />
                    <Area type="monotone" dataKey="Submissions" stroke="#2563eb" strokeWidth={2.5} fill="url(#submissionsFill)" />
                    <Line type="monotone" dataKey="Selected" stroke="#16a34a" strokeWidth={2.2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Joined" stroke="#7c3aed" strokeWidth={2.2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section
              title="Source Split"
              subtitle="Candidate source distribution for the active filters."
              footer={<TotalFooter items={[
                { label: "Total Candidates", value: sourceTotal, onClick: () => openDetails("Candidates By Source", filteredCandidateRows, candidateDetailColumns) },
                { label: "Unique Sources", value: sourceSummary.length, onClick: () => openDetails("Unique Sources", sourceSummary.map((source) => ({ source: source.name, count: source.value })), compactSummaryColumns) },
              ]} />}
            >
              <div className="h-60 sm:h-64">
                {sourceSummary.length ? (
                  <div className="grid h-full gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={sourceSummary} dataKey="value" nameKey="name" innerRadius={42} outerRadius={78} paddingAngle={3}>
                            {sourceSummary.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip {...chartTooltip} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="min-h-0 overflow-y-auto rounded-lg border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="space-y-2.5">
                        {sourceSummary.map((source) => {
                          const percent = sourceTotal ? Math.round((source.value / sourceTotal) * 100) : 0;
                          return (
                            <div key={source.name}>
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                <span className="flex min-w-0 items-center gap-2 font-medium text-zinc-800 dark:text-zinc-100">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.fill }} />
                                  <span className="truncate">{source.name}</span>
                                </span>
                                <span className="shrink-0">
                                  <NumberButton onClick={() => openDetails(`${source.name} Candidates`, sourceRows(source.name), candidateDetailColumns)}>
                                    {source.value} ({percent}%)
                                  </NumberButton>
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: source.fill }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">No source data</div>
                )}
              </div>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section
              title="Recruiter Performance"
              subtitle="Submissions compared with selection and joining outcomes."
              footer={<TotalFooter items={[
                { label: "Submissions", value: summary.total, onClick: () => openDetails("Recruiter Submissions", filteredCandidateRows, candidateDetailColumns) },
                { label: "Selected", value: summary.selected, onClick: () => openDetails("Selected Candidates", bucketRows("Selected"), candidateDetailColumns) },
                { label: "Rejected", value: summary.rejected, onClick: () => openDetails("Rejected Candidates", bucketRows("Rejected"), candidateDetailColumns) },
                { label: "Joined", value: summary.joined, onClick: () => openDetails("Joined Candidates", bucketRows("Joined"), candidateDetailColumns) },
              ]} />}
            >
              <div className="h-60 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recruiterChartData} barCategoryGap="22%" margin={{ top: 8, right: 10, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis
                      dataKey="firstName"
                      interval={0}
                      height={34}
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="Submissions" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Selected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Joined" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section
              title="Status Funnel"
              subtitle="Candidate movement across key hiring stages."
              footer={<TotalFooter items={[
                { label: "Total Candidates", value: summary.total, onClick: () => openDetails("Candidates", filteredCandidateRows, candidateDetailColumns) },
                { label: "Turnups", value: summary.turnups, onClick: () => openDetails("Turnup Candidates", bucketRows("Turnups"), candidateDetailColumns) },
                { label: "Rejected", value: summary.rejected, onClick: () => openDetails("Rejected Candidates", bucketRows("Rejected"), candidateDetailColumns) },
              ]} />}
            >
              <div className="h-60 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="stage" type="category" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="count" fill="#18181b" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Section
              title="Top Positions"
              subtitle="Most submitted roles in the selected date range."
              footer={<TotalFooter items={[
                { label: "Total Candidates", value: summary.total, onClick: () => openDetails("Candidates", filteredCandidateRows, candidateDetailColumns) },
                { label: "Positions Shown", value: positionSummary.length, onClick: () => openDetails("Top Positions", positionSummary, compactSummaryColumns) },
              ]} />}
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={positionSummary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="position" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section
              title="Status Summary"
              subtitle="Counts are based on the active filters."
              footer={<ColumnTotalFooter
                minWidth="520px"
                template="1.4fr 0.8fr 0.8fr"
                columns={[
                  { label: "Status", value: "Total" },
                  { label: "Count", value: statusTotal, align: "right", onClick: () => openDetails("Status Summary Candidates", filteredCandidateRows, candidateDetailColumns) },
                  { label: "Share", value: summary.total ? "100%" : "0%" },
                ]}
              />}
            >
              <div className="max-h-64 overflow-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
                <table className="w-full min-w-[520px] table-fixed text-left text-sm">
                  <colgroup>
                    <col style={{ width: "46.66%" }} />
                    <col style={{ width: "26.67%" }} />
                    <col style={{ width: "26.67%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Count</th>
                      <th className="px-3 py-2">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {statusSummary.map((item) => (
                      <tr key={item.status}>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-100">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${item.status} Candidates`, statusRows(item.status), candidateDetailColumns)}>
                            {item.count}
                          </NumberButton>
                        </td>
                        <td className="px-3 py-3 text-zinc-500">{summary.total ? Math.round((item.count / summary.total) * 100) : 0}%</td>
                      </tr>
                    ))}
                    {!statusSummary.length && (
                      <tr><td colSpan={3} className="px-3 py-10 text-center text-zinc-400">No status data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section
              title="Recruiter Table"
              subtitle="Detailed recruiter level performance."
              footer={<ColumnTotalFooter
                minWidth="500px"
                template="1.4fr repeat(5, 0.85fr)"
                columns={[
                  { label: "Recruiter", value: "Total" },
                  { label: "Submissions", value: recruiterTotals.Submissions, align: "right", onClick: () => openDetails("All Recruiter Submissions", filteredCandidateRows, candidateDetailColumns) },
                  { label: "Turnups", value: recruiterTotals.Turnups, align: "right", onClick: () => openDetails("All Recruiter Turnups", bucketRows("Turnups"), candidateDetailColumns) },
                  { label: "Selected", value: recruiterTotals.Selected, align: "right", onClick: () => openDetails("All Recruiter Selected Candidates", bucketRows("Selected"), candidateDetailColumns) },
                  { label: "Joined", value: recruiterTotals.Joined, align: "right", onClick: () => openDetails("All Recruiter Joined Candidates", bucketRows("Joined"), candidateDetailColumns) },
                  { label: "Rejected", value: recruiterTotals.Rejected, align: "right", onClick: () => openDetails("All Recruiter Rejected Candidates", bucketRows("Rejected"), candidateDetailColumns) },
                ]}
              />}
            >
              <div className="max-h-72 overflow-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
                <table className="w-full min-w-[500px] table-fixed text-left text-sm">
                  <colgroup>
                    <col style={{ width: "24.78%" }} />
                    <col style={{ width: "15.04%" }} />
                    <col style={{ width: "15.04%" }} />
                    <col style={{ width: "15.04%" }} />
                    <col style={{ width: "15.04%" }} />
                    <col style={{ width: "15.06%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2">Recruiter</th>
                      <th className="px-3 py-2 text-right">Submissions</th>
                      <th className="px-3 py-2 text-right">Turnups</th>
                      <th className="px-3 py-2 text-right">Selected</th>
                      <th className="px-3 py-2 text-right">Joined</th>
                      <th className="px-3 py-2 text-right">Rejected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recruiterSummary.map((row) => (
                      <tr key={row.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="px-3 py-3">
                          <RecruiterDetailsTrigger recruiter={row.recruiter || { name: row.name }} className="font-medium text-zinc-900 dark:text-white">
                            {row.name}
                          </RecruiterDetailsTrigger>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.name} Submissions`, recruiterRows(row.name), candidateDetailColumns)}>{row.Submissions}</NumberButton>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.name} Turnups`, recruiterRows(row.name, "Turnups"), candidateDetailColumns)}>{row.Turnups}</NumberButton>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.name} Selected Candidates`, recruiterRows(row.name, "Selected"), candidateDetailColumns)}>{row.Selected}</NumberButton>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.name} Joined Candidates`, recruiterRows(row.name, "Joined"), candidateDetailColumns)}>{row.Joined}</NumberButton>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.name} Rejected Candidates`, recruiterRows(row.name, "Rejected"), candidateDetailColumns)}>{row.Rejected}</NumberButton>
                        </td>
                      </tr>
                    ))}
                    {!recruiterSummary.length && (
                      <tr><td colSpan={6} className="px-3 py-10 text-center text-zinc-400">No recruiter data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Client Table"
              subtitle="Client-wise submissions and hiring outcomes."
              footer={<ColumnTotalFooter
                minWidth="480px"
                template="1.4fr repeat(3, 0.85fr)"
                columns={[
                  { label: "Client", value: "Total" },
                  { label: "Submissions", value: clientTotals.Submissions, align: "right", onClick: () => openDetails("All Client Submissions", filteredCandidateRows, candidateDetailColumns) },
                  { label: "Selected", value: clientTotals.Selected, align: "right", onClick: () => openDetails("All Client Selected Candidates", bucketRows("Selected"), candidateDetailColumns) },
                  { label: "Joined", value: clientTotals.Joined, align: "right", onClick: () => openDetails("All Client Joined Candidates", bucketRows("Joined"), candidateDetailColumns) },
                ]}
              />}
            >
              <div className="max-h-72 overflow-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
                <table className="w-full min-w-[480px] table-fixed text-left text-sm">
                  <colgroup>
                    <col style={{ width: "35.44%" }} />
                    <col style={{ width: "21.52%" }} />
                    <col style={{ width: "21.52%" }} />
                    <col style={{ width: "21.52%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2 text-right">Submissions</th>
                      <th className="px-3 py-2 text-right">Selected</th>
                      <th className="px-3 py-2 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {clientSummary.map((row) => (
                      <tr key={row.client} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="px-3 py-3 font-medium text-zinc-900 dark:text-white">{row.client}</td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.client} Submissions`, clientRows(row.client), candidateDetailColumns)}>{row.Submissions}</NumberButton>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.client} Selected Candidates`, clientRows(row.client, "Selected"), candidateDetailColumns)}>{row.Selected}</NumberButton>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <NumberButton onClick={() => openDetails(`${row.client} Joined Candidates`, clientRows(row.client, "Joined"), candidateDetailColumns)}>{row.Joined}</NumberButton>
                        </td>
                      </tr>
                    ))}
                    {!clientSummary.length && (
                      <tr><td colSpan={4} className="px-3 py-10 text-center text-zinc-400">No client data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <Section
            title="Filtered Candidate Information"
            subtitle={`${filteredCandidates.length} candidates match the selected filters.`}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <BarChart3 className="h-4 w-4" />
                  Export uses all filtered data
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  {candidatePageStart}-{candidatePageEnd} of {filteredCandidateRows.length}
                </span>
                <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setCandidatePage((prev) => Math.max(1, prev - 1))}
                    disabled={currentCandidatePage === 1}
                    className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                    aria-label="Previous candidate page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="inline-flex h-8 min-w-16 items-center justify-center border-x border-zinc-200 px-3 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                    {currentCandidatePage}/{candidatePageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCandidatePage((prev) => Math.min(candidatePageCount, prev + 1))}
                    disabled={currentCandidatePage === candidatePageCount}
                    className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                    aria-label="Next candidate page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            footer={<ColumnTotalFooter
              minWidth="1000px"
              template="1.3fr repeat(6, 1fr)"
              columns={[
                { label: "Candidate", value: filteredCandidateRows.length, onClick: () => openDetails("Filtered Candidates", filteredCandidateRows, candidateDetailColumns) },
                { label: "Position", value: positionSummary.length, onClick: () => openDetails("Top Positions", positionSummary, compactSummaryColumns) },
                { label: "Client", value: clientSummary.length, onClick: () => openDetails("Clients", clientSummary, clientDetailColumns) },
                { label: "Recruiter", value: recruiterSummary.length, onClick: () => openDetails("Recruiters", recruiterSummary, recruiterDetailColumns) },
                { label: "Source", value: sourceSummary.length, onClick: () => openDetails("Sources", sourceSummary.map((source) => ({ source: source.name, count: source.value })), compactSummaryColumns) },
                { label: "Status", value: statusSummary.length, onClick: () => openDetails("Statuses", statusSummary.map((status) => ({ status: status.status, count: status.count })), compactSummaryColumns) },
                { label: "Date", value: filterLabel },
              ]}
            />}
          >
            <div className="max-h-[420px] overflow-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
              <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
                <colgroup>
                  <col style={{ width: "17.81%" }} />
                  <col style={{ width: "13.69%" }} />
                  <col style={{ width: "13.69%" }} />
                  <col style={{ width: "13.69%" }} />
                  <col style={{ width: "13.69%" }} />
                  <col style={{ width: "13.69%" }} />
                  <col style={{ width: "13.74%" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Recruiter</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {paginatedCandidateRows.map((candidate) => (
                    <tr key={candidate._id || candidate.id || getCandidateId(candidate)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-3 py-3">
                        <CandidateProfileLink candidate={candidate} className="font-semibold text-zinc-900 dark:text-white">
                          {getCandidateName(candidate)}
                        </CandidateProfileLink>
                        <p className="text-xs font-mono text-zinc-500">{getCandidateId(candidate)}</p>
                      </td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{candidate.position || "-"}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{candidate.client || "-"}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                        <RecruiterDetailsTrigger recruiter={getCandidateRecruiterDetails(candidate)} className="font-medium text-zinc-700 dark:text-zinc-200">
                          {getCandidateRecruiterName(candidate)}
                        </RecruiterDetailsTrigger>
                      </td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{candidate.source || "Portal"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {getStatuses(candidate).slice(0, 3).map((status) => (
                            <span key={status} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{status}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-zinc-500">{prettyDate(candidateDate(candidate))}</td>
                    </tr>
                  ))}
                  {!filteredCandidateRows.length && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-400">No candidate information for the selected filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
      <DetailsModal detail={detailModal} onClose={() => setDetailModal(null)} onCellDrilldown={getDetailCellDrilldown} />

      {/* Mobile Filter Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileFilterOpen(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-950/70">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                <h3 className="font-semibold text-zinc-900 dark:text-white">Filters</h3>
                {(filters.startDate || filters.recruiterId !== "all" || filters.status !== "all" || filters.client !== "all" || filters.source !== "all" || filters.search) && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white leading-none">
                    {[
                      filters.startDate ? 1 : 0,
                      filters.recruiterId !== "all" ? 1 : 0,
                      filters.status !== "all" ? 1 : 0,
                      filters.client !== "all" ? 1 : 0,
                      filters.source !== "all" ? 1 : 0,
                      filters.search ? 1 : 0,
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder="Name, role, ID..."
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    max={filters.endDate || localDateStr()}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    min={filters.startDate || undefined}
                    max={localDateStr()}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Quick ranges */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Quick Date Ranges</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickRange(7)}
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 text-center text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange(30)}
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 text-center text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, startDate: firstDayOfMonth(), endDate: localDateStr() }))}
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 text-center text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    This Month
                  </button>
                </div>
              </div>

              {/* Recruiter */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recruiter</label>
                <select
                  value={recruiterOnly ? (currentRecruiterId || "current") : filters.recruiterId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, recruiterId: e.target.value }))}
                  disabled={recruiterOnly}
                  className={`${inputCls} cursor-pointer`}
                >
                  {recruiterOnly ? (
                    <option value={currentRecruiterId || "current"}>{currentRecruiterName}</option>
                  ) : (
                    <>
                      <option value="all">All Recruiters</option>
                      {recruiters.map((recruiter) => (
                        <option key={recruiter._id || recruiter.id} value={recruiter._id || recruiter.id}>{getRecruiterName(recruiter)}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="all">All Status</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>

              {/* Client */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Client</label>
                <select
                  value={filters.client}
                  onChange={(e) => setFilters((prev) => ({ ...prev, client: e.target.value }))}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="all">All Clients</option>
                  {clientOptions.map((client) => <option key={client} value={client}>{client}</option>)}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="all">All Sources</option>
                  {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="flex-1 rounded-lg border border-zinc-300 bg-white py-2 text-center text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 rounded-lg bg-zinc-900 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
              >
                Show {filteredCandidates.length} Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminReports() {
  return <ReportsDashboard />;
}
