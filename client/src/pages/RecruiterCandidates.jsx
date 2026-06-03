import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import {
  Plus, Search, Edit, Download, Phone, Mail,
  Building, Briefcase, Loader2, Ban, List, LayoutGrid,
  Calendar, GraduationCap, Award, UserCircle, Target,
  MessageCircle, Eye, IndianRupee, Upload, FileUp, X,
  Trash2, AlertTriangle, FileSpreadsheet, Linkedin, Check,
  Settings2, CheckCircle2, ChevronDown, ChevronUp, GripVertical, ToggleLeft, ToggleRight, Info, Pencil
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Inline Excel Import Logic ─────────────────────────────────────────────────
const _FIELD_ALIASES = {
  firstName: ['first name','firstname','first_name','given name','givenname','candidate name','name','full name','fullname','candidate_name'],
  lastName:  ['last name','lastname','last_name','surname','family name','familyname'],
  email:     ['email','email address','emailaddress','e-mail','e_mail','mail','email id','emailid'],
  contact:   ['phone','phone number','phonenumber','mobile','mobile number','mobilenumber','contact','contact number','contactnumber','mobileno','phoneno','cellphone','cell','contactno'],
  alternateNumber: ['alternate number','alternatenumber','alternate phone','alternate mobile','alt number','altnumber','alt phone','secondary phone','secondaryphone','other number','othernumber'],
  dateOfBirth: ['date of birth','dateofbirth','dob','birth date','birthdate','birthday','date of birth (dd/mm/yyyy)','dob (dd/mm/yyyy)'],
  gender:     ['gender','sex'],
  linkedin:   ['linkedin','linkedin url','linkedinurl','linkedin profile','linkedinprofile','linkedin id','linkedinid'],
  currentLocation:   ['current location','currentlocation','location','city','present location','presentlocation','place','loc'],
  preferredLocation: ['preferred location','preferredlocation','preferred city','preferredcity','pref location','preflocation','job city','jobcity'],
  position: ['position','position applied','positionapplied','role','job title','jobtitle','designation','jobposition','job position','applied for','appliedfor','applied position','appliedposition'],
  client:   ['client','client name','clientname','company','company name','companyname','organization','organisation','hiring client','hiringclient'],
  currentCompany: ['current company','currentcompany','present company','presentcompany','employer','current employer','currentemployer','working at','workingat','current organization','currentorganization'],
  industry:  ['industry','sector','domain','industry type','industrytype'],
  skills:    ['skills','skill set','skillset','technologies','techstack','tech stack','technical skills','technicalskills','key skills','keyskills'],
  education: ['education','qualification','degree','highest qualification','highestqualification','academic qualification','academicqualification','educational qualification','educationalqualification'],
  totalExperience:    ['total experience','totalexperience','experience','exp','years of experience','yearsofexperience','total exp','totalexp','total years','totalyears','yoe'],
  relevantExperience: ['relevant experience','relevantexperience','relevant exp','relevantexp','related experience','relatedexperience','rel exp','relexp'],
  ctc:  ['ctc','current ctc','currentctc','current salary','currentsalary','current package','currentpackage','current cost','currentcost'],
  ectc: ['ectc','expected ctc','expectedctc','expected salary','expectedsalary','expected package','expectedpackage','ctc expected','exp ctc','expctc','salary','expected cost','expectedcost'],
  currentTakeHome:  ['current take home','currenttakehome','take home','takehome','take home salary','takehomesalary','in hand','inhand','net salary','netsalary','in hands','inhands'],
  expectedTakeHome: ['expected take home','expectedtakehome','expected in hand','expectedinhand','expected net salary','expectednetsalary'],
  noticePeriod:        ['notice period','noticeperiod','notice','availability','np','notice time','noticetime','notice duration','noticeduration'],
  servingNoticePeriod: ['serving notice','servingnotice','serving notice period','servingnoticeperiod','currently serving','currentlyserving','on notice','onnotice'],
  noticePeriodDays:    ['notice period days','noticeperioddays','days remaining','daysremaining','notice days','noticedays'],
  lwd: ['lwd','last working day','lastworkingday','last day','lastday','last date','lastdate'],
  offersInHand:    ['offers in hand','offersinhand','offer in hand','offerinhand','has offer','hasoffer','competing offer','competingoffer'],
  offerPackage:    ['offer package','offerpackage','offer amount','offeramount','competing package','competingpackage','offer ctc','offerctc'],
  reasonForChange: ['reason for change','reasonforchange','reason for leaving','reasonforleaving','reason','motivation'],
  source:  ['source','candidate source','candidatesource','reference','referral','source of candidate','sourceofcandidate','sourced from','sourcedfrom'],
  status:  ['status','candidate status','candidatestatus','current status','currentstatus','stage','pipeline stage','pipelinestage'],
  rating:  ['rating','candidate rating','candidaterating','score','stars'],
  dateAdded: ['date added','dateadded','submission date','submissiondate','added on','addedon','entry date','entrydate'],
  notes:   ['notes','note','internal notes','internalnotes','comment','comments'],
  remarks: ['remarks','remark','feedback','observation','interviewer remarks','hr remarks','additional comments','additionalcomments'],
  resumeUrl: ['resume url','resumeurl','resume link','resumelink','cv link','cvlink','cv url','cvurl','portfolio','resume','profile link','profilelink'],
};
const _VALID_IMPORT_STATUSES = ['Submitted','Shared Profiles','Yet to attend','Turnups','No Show','Selected','Joined','Rejected','Pipeline','Hold','Backout'];
const _norm = (s) => (s||'').toLowerCase().replace(/[\s_\-.]+/g,'');
const _findCol = (headers, field) => {
  const aliases = (_FIELD_ALIASES[field]||[]).map(_norm);
  for (const h of headers) if (aliases.includes(_norm(h))) return h;
  for (const h of headers) { const nh=_norm(h); for (const a of aliases) if (a.length>=4&&nh.startsWith(a)) return h; }
  for (const h of headers) { const nh=_norm(h); for (const a of aliases) if (a.length>=5&&nh.includes(a)) return h; }
  return null;
};
const _getVal = (row, key) => {
  if (!key || !(key in row)) return '';
  const v = row[key];
  if (v===null||v===undefined) return '';
  if (typeof v==='number') { const s=v.toString(); if (/e[+-]/i.test(s)) return Math.round(v).toString(); return s; }
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).trim();
};
const _splitName = (full) => { const p=(full||'').trim().split(/\s+/); if(!p[0]) return {firstName:'',lastName:''}; if(p.length===1) return {firstName:p[0],lastName:p[0]}; return {firstName:p[0],lastName:p.slice(1).join(' ')}; };
const _san = (s) => String(s||'').replace(/<[^>]*>/g,'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'').trim();
const _ALLOWED_EXTS = new Set(['.xlsx','.xls','.csv']);
const _ALLOWED_TYPES = new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv','text/plain','application/csv']);
const isValidFileType = (file) => { const ext=file.name.substring(file.name.lastIndexOf('.')).toLowerCase(); return _ALLOWED_TYPES.has(file.type)||_ALLOWED_EXTS.has(ext); };
const parseExcelToCandidates = (file, onProgress) => new Promise((resolve, reject) => {
  if (!isValidFileType(file)) return reject(new Error('Invalid file type. Only .xlsx, .xls, and .csv are supported.'));
  const reader = new FileReader();
  reader.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*40)); };
  reader.onload = (e) => {
    try {
      if (onProgress) onProgress(50);
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array',cellDates:true,raw:false});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:'',raw:false});
      if (!rows||rows.length===0) return reject(new Error('File is empty or has no data rows.'));
      const headers = Object.keys(rows[0]||{});
      if (!headers.length) return reject(new Error('No recognisable column headers found.'));
      if (onProgress) onProgress(60);
      const cols = {}; Object.keys(_FIELD_ALIASES).forEach(f => { cols[f]=_findCol(headers,f); });
      const hasFirst=!!cols.firstName, hasLast=!!cols.lastName, hasFullOnly=!hasFirst&&!hasLast;
      const fullNameKey = hasFullOnly ? headers.find(h=>['name','fullname','candidatename'].includes(_norm(h))) : null;
      if (onProgress) onProgress(70);
      const validRows=[], invalidRows=[], allRows=[];
      rows.forEach((row, idx) => {
        const rowErrors=[];
        let firstName='', lastName='';
        if (hasFirst||hasLast) {
          firstName=_san(_getVal(row,cols.firstName)); lastName=_san(_getVal(row,cols.lastName));
          if (firstName&&!lastName&&firstName.includes(' ')) { const s=_splitName(firstName); firstName=s.firstName; lastName=s.lastName; }
        } else if (hasFullOnly&&fullNameKey) { const s=_splitName(_san(_getVal(row,fullNameKey))); firstName=s.firstName; lastName=s.lastName; }
        if (!firstName||firstName.length<2) rowErrors.push('First Name is required (min 2 chars)');
        const email=_san(_getVal(row,cols.email)).toLowerCase();
        if (!email) rowErrors.push('Email is required');
        else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) rowErrors.push('Invalid Email format');
        const contact=_getVal(row,cols.contact).replace(/\D/g,'').slice(-10);
        if (!contact) rowErrors.push('Phone is required');
        else if (contact.length!==10) rowErrors.push(`Phone must be 10 digits (got: ${contact})`);
        const position=_san(_getVal(row,cols.position));
        if (!position) rowErrors.push('Position (Role) is required');
        const client=_san(_getVal(row,cols.client));
        const skillsRaw=_san(_getVal(row,cols.skills));
        const skills=skillsRaw ? skillsRaw.split(/[,;|]+/).map(s=>s.trim()).filter(Boolean) : [];
        let statusArr=[];
        const statusRaw=_san(_getVal(row,cols.status));
        if (statusRaw) statusArr=statusRaw.split(/[,;|]+/).map(s=>s.trim()).filter(s=>_VALID_IMPORT_STATUSES.includes(s));
        if (!statusArr.length) statusArr=['Submitted'];
        const servingRaw=_san(_getVal(row,cols.servingNoticePeriod)).toLowerCase();
        const offersRaw=_san(_getVal(row,cols.offersInHand)).toLowerCase();
        const isTruthy=(v)=>['yes','true','1','y'].includes(v);
        const ratingRaw=_san(_getVal(row,cols.rating));
        const parsed = {
          _rowNum: idx+1, firstName, lastName, email, contact, position, client, skills, status: statusArr,
          alternateNumber: _san(_getVal(row,cols.alternateNumber)).replace(/\D/g,'').slice(-10)||'',
          dateOfBirth: _san(_getVal(row,cols.dateOfBirth))||'', gender: _san(_getVal(row,cols.gender))||'',
          linkedin: _san(_getVal(row,cols.linkedin))||'',
          currentLocation: _san(_getVal(row,cols.currentLocation))||'', preferredLocation: _san(_getVal(row,cols.preferredLocation))||'',
          currentCompany: _san(_getVal(row,cols.currentCompany))||'', industry: _san(_getVal(row,cols.industry))||'',
          education: _san(_getVal(row,cols.education))||'',
          totalExperience: _san(_getVal(row,cols.totalExperience))||'', relevantExperience: _san(_getVal(row,cols.relevantExperience))||'',
          ctc: _san(_getVal(row,cols.ctc))||'', ectc: _san(_getVal(row,cols.ectc))||'',
          currentTakeHome: _san(_getVal(row,cols.currentTakeHome))||'', expectedTakeHome: _san(_getVal(row,cols.expectedTakeHome))||'',
          noticePeriod: _san(_getVal(row,cols.noticePeriod))||'',
          servingNoticePeriod: isTruthy(servingRaw)?'true':'false',
          noticePeriodDays: _san(_getVal(row,cols.noticePeriodDays))||'', lwd: _san(_getVal(row,cols.lwd))||'',
          reasonForChange: _san(_getVal(row,cols.reasonForChange))||'',
          offersInHand: isTruthy(offersRaw)?'true':'false', offerPackage: _san(_getVal(row,cols.offerPackage))||'',
          source: _san(_getVal(row,cols.source))||'Excel Import',
          rating: ratingRaw ? Math.min(5,Math.max(0,parseInt(ratingRaw)||0)) : 0,
          dateAdded: _san(_getVal(row,cols.dateAdded))||new Date().toISOString().split('T')[0],
          notes: _san(_getVal(row,cols.notes))||'', remarks: _san(_getVal(row,cols.remarks))||'',
          resumeUrl: _san(_getVal(row,cols.resumeUrl))||'',
        };
        const entry={...parsed,valid:rowErrors.length===0,errors:rowErrors};
        allRows.push(entry);
        if (rowErrors.length===0) validRows.push(entry); else invalidRows.push(entry);
      });
      if (onProgress) onProgress(100);
      resolve({validRows,invalidRows,allRows,totalCount:rows.length});
    } catch(err) { reject(new Error(`Failed to parse file: ${err.message}`)); }
  };
  reader.onerror = () => reject(new Error('Failed to read file.'));
  reader.readAsArrayBuffer(file);
});
const downloadCandidateTemplate = () => {
  const headers = ['First Name *','Last Name *','Email *','Phone *','Position *','Client *','Skills *','Alternate Number','Date of Birth','Gender','LinkedIn URL','Current Location','Preferred Location','Current Company','Industry','Education','Total Experience','Relevant Experience','Current CTC','Expected CTC','Current Take Home','Expected Take Home','Notice Period','Serving Notice','LWD','Reason For Change','Offers In Hand','Offer Package','Source','Status','Rating','Date Added','Remarks','Notes'];
  const today = new Date().toISOString().split('T')[0];
  const sampleRows = [
    {'First Name *':'Rahul','Last Name *':'Sharma','Email *':'rahul.sharma@example.com','Phone *':'9876543210','Position *':'Frontend Developer','Client *':'Acme Corp','Skills *':'React, TypeScript, Node.js','Alternate Number':'8765432109','Date of Birth':'1995-06-15','Gender':'Male','LinkedIn URL':'https://linkedin.com/in/rahul-sharma','Current Location':'Bangalore','Preferred Location':'Hyderabad','Current Company':'Infosys','Industry':'IT Services','Education':'B.Tech Computer Science - VIT 2017','Total Experience':'5 yrs 6 months','Relevant Experience':'4 yrs 0 months','Current CTC':'8 LPA','Expected CTC':'12 LPA','Current Take Home':'55000','Expected Take Home':'80000','Notice Period':'30 Days','Serving Notice':'No','LWD':'','Reason For Change':'Better growth','Offers In Hand':'No','Offer Package':'','Source':'LinkedIn','Status':'Submitted','Rating':'4','Date Added':today,'Remarks':'Strong React skills','Notes':'Follow up next week'},
    {'First Name *':'Priya','Last Name *':'Nair','Email *':'priya.nair@example.com','Phone *':'9123456780','Position *':'Java Developer','Client *':'TechStart Inc','Skills *':'Java, Spring Boot, Microservices','Alternate Number':'','Date of Birth':'1993-03-22','Gender':'Female','LinkedIn URL':'https://linkedin.com/in/priya-nair','Current Location':'Chennai','Preferred Location':'Chennai','Current Company':'Wipro','Industry':'IT & Software','Education':'M.Tech - Anna University 2015','Total Experience':'7 yrs 2 months','Relevant Experience':'5 yrs 0 months','Current CTC':'12 LPA','Expected CTC':'17 LPA','Current Take Home':'80000','Expected Take Home':'110000','Notice Period':'60 Days','Serving Notice':'Yes','LWD':'2026-07-15','Reason For Change':'Seeking senior role','Offers In Hand':'Yes','Offer Package':'16 LPA','Source':'Portal','Status':'Submitted','Rating':'5','Date Added':today,'Remarks':'Excellent candidate','Notes':'Prefers hybrid work'},
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, {header: headers});
  ws['!cols'] = headers.map(h=>({wch:Math.max(h.length+4,20)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
  const infoRows = [
    {Column:'First Name *',Required:'YES',Notes:'Min 2 chars. Or use "Full Name" column — auto-split.'},
    {Column:'Last Name *',Required:'YES',Notes:'Not needed if "Full Name" is used.'},
    {Column:'Email *',Required:'YES',Notes:'Valid email. Duplicates are skipped.'},
    {Column:'Phone *',Required:'YES',Notes:'Exactly 10 digits.'},
    {Column:'Position *',Required:'YES',Notes:'Job title / role applied for.'},
    {Column:'Client *',Required:'YES',Notes:'Client / company name.'},
    {Column:'Skills *',Required:'YES',Notes:'Comma-separated skills.'},
    {Column:'Status',Required:'No',Notes:'Defaults to Submitted. Options: Submitted, Pipeline, Shared Profiles, Yet to attend, Turnups, Selected, Hold, Rejected, No Show, Backout, Joined.'},
    {Column:'Serving Notice',Required:'No',Notes:'Yes / No.'},
    {Column:'Offers In Hand',Required:'No',Notes:'Yes / No.'},
    {Column:'Rating',Required:'No',Notes:'1 to 5.'},
    {Column:'Date Added',Required:'No',Notes:'Defaults to today. YYYY-MM-DD.'},
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoRows, {header:['Column','Required','Notes']});
  wsInfo['!cols'] = [{wch:28},{wch:10},{wch:70}];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Field Reference');
  XLSX.writeFile(wb, 'candidate_import_template.xlsx');
};
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;


const STATUS_FLOW_ORDER = [
  'Pipeline', 'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'Selected', 'Hold', 'Rejected', 'No Show', 'Backout', 'Joined'
];
const allStatuses = [...STATUS_FLOW_ORDER];

const OPTIONAL_STANDARD_FIELDS = [
  { id: 'alternateNumber',    label: 'Alternate Number' },
  { id: 'currentLocation',    label: 'Current Location' },
  { id: 'preferredLocation',  label: 'Preferred Location' },
  { id: 'dateOfBirth',        label: 'Date of Birth' },
  { id: 'gender',             label: 'Gender' },
  { id: 'linkedin',           label: 'LinkedIn' },
  { id: 'currentCompany',     label: 'Current Company' },
  { id: 'industry',           label: 'Industry' },
  { id: 'education',          label: 'Educational Qualification' },
  { id: 'reasonForChange',    label: 'Reason for Change' },
  { id: 'totalExperience',    label: 'Total Experience' },
  { id: 'relevantExperience', label: 'Relevant Experience' },
  { id: 'ctc',                label: 'Current CTC' },
  { id: 'currentTakeHome',    label: 'Current Take Home' },
  { id: 'ectc',               label: 'Expected CTC' },
  { id: 'expectedTakeHome',   label: 'Expected Take Home' },
  { id: 'noticePeriod',       label: 'Notice Period' },
  { id: 'servingNoticePeriod',label: 'Serving Notice Period?' },
  { id: 'lwd',                label: 'Last Working Day (LWD)' },
  { id: 'offersInHand',       label: 'Offers In Hand' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const getRecruiterName = (r) => {
  if (!r) return '-';
  if (r.name) return r.name;
  const first = r.firstName || '';
  const last = r.lastName || '';
  if (first || last) return `${first} ${last}`.trim();
  if (r.username) return r.username;
  return r.email || '-';
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getStatusStyles = (s) => {
  if (['Joined', 'Selected'].includes(s)) {
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500'
    };
  }
  if (['Rejected', 'Backout', 'No Show'].includes(s)) {
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500'
    };
  }
  if (['Turnups'].includes(s)) {
    return {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      dot: 'bg-purple-500'
    };
  }
  if (['Shared Profiles'].includes(s)) {
    return {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500'
    };
  }
  if (['Pipeline'].includes(s)) {
    return {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500'
    };
  }
  if (['Hold'].includes(s)) {
    return {
      bg: 'bg-orange-50 text-orange-700 border-orange-200',
      dot: 'bg-orange-500'
    };
  }
  return {
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400'
  };
};

// ── UI Components ─────────────────────────────────────────────────────────────
const ApplicationStatusBar = ({ currentStatus }) => {
  const statusStr = (() => {
    if (Array.isArray(currentStatus)) return currentStatus[currentStatus.length - 1] || 'Submitted';
    return currentStatus || 'Submitted';
  })();

  const baseStages = ['Pipeline', 'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups'];
  const terminalStatuses = ['Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'No Show'];

  const isTerminal = terminalStatuses.includes(statusStr);
  const steps = isTerminal ? [...baseStages, statusStr] : baseStages;
  const currentIndex = steps.indexOf(statusStr);

  const getStatusColor = (s) => {
    if (['Joined', 'Selected'].includes(s)) return 'bg-emerald-600';
    if (['Rejected', 'Backout', 'No Show'].includes(s)) return 'bg-red-600';
    if (['Turnups'].includes(s)) return 'bg-purple-600';
    if (['Shared Profiles'].includes(s)) return 'bg-blue-500';
    if (['Pipeline'].includes(s)) return 'bg-amber-600';
    if (['Hold'].includes(s)) return 'bg-orange-600';
    return 'bg-blue-600'; // Default Submitted
  };

  return (
    <div className="mt-8 mb-6 w-full max-w-4xl mx-auto">
      <div className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-[0.2em] text-center">Application Timeline</div>
      <div className="relative flex justify-between items-start px-2">
        {/* Connection Line Container */}
        <div className="absolute top-[11px] left-0 w-full h-[2px] bg-slate-100 z-0" />

        {/* Progress Fill Line */}
        <div 
          className="absolute top-[11px] left-0 h-[2px] bg-blue-600 transition-all duration-300 z-0"
          style={{ width: `${currentIndex >= 0 ? (currentIndex / (steps.length - 1)) * 100 : 0}%` }}
        />

        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = idx <= currentIndex;
          const statusColor = getStatusColor(step);

          let circleBg = 'bg-white border-slate-200';
          if (isCompleted && !isActive) {
            circleBg = `${statusColor} border-transparent scale-110`;
          } else if (isActive) {
            circleBg = 'bg-white border-slate-400';
          }

          return (
            <div key={step} className="relative z-10 flex flex-col items-center flex-1 group/step">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-500 ${circleBg}`}>
                {isCompleted && !isActive && (
                  <Check className="h-3.5 w-3.5 text-white" />
                )}
                {isActive && (
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
                )}
              </div>

              <div className={`mt-3 text-center px-1 transition-all duration-500 ${isCompleted ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'
                }`} style={{ fontSize: '9px', lineHeight: '1.2' }}>
                <div className="max-w-[80px] break-words whitespace-normal mx-auto uppercase tracking-tighter">
                  {step}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


const SubmissionPipeline = ({ status, onStepClick }) => {
  const baseStages = ['Pipeline', 'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups'];
  const terminalStages = ['Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'No Show'];
  
  const isTerminal = terminalStages.includes(status);
  const steps = isTerminal ? [...baseStages, status] : baseStages;
  const currentIndex = steps.indexOf(status);

  const getStepColor = (step, idx) => {
    if (idx < currentIndex) {
      return 'bg-blue-600 text-white border-blue-600';
    } else if (idx === currentIndex) {
      if (['Selected', 'Joined'].includes(step)) return 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-100';
      if (['Rejected', 'Backout', 'No Show'].includes(step)) return 'bg-red-600 text-white border-red-600 ring-4 ring-red-100';
      if (['Hold'].includes(step)) return 'bg-orange-500 text-white border-orange-500 ring-4 ring-orange-100';
      return 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100';
    } else {
      return 'bg-white text-slate-400 border-slate-200 hover:border-slate-400';
    }
  };

  return (
    <div className="w-full py-4 relative">
      <div className="relative flex items-center justify-between">
        {/* Background Line */}
        <div className="absolute left-0 right-0 top-[14px] -translate-y-1/2 h-[2px] bg-slate-200 z-0" />
        
        {/* Progress Fill Line */}
        <div 
          className="absolute left-0 top-[14px] -translate-y-1/2 h-[2px] bg-blue-600 transition-all duration-300 z-0"
          style={{ width: `${currentIndex >= 0 ? (currentIndex / (steps.length - 1)) * 100 : 0}%` }}
        />

        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = idx <= currentIndex;
          const stepStyles = getStepColor(step, idx);

          return (
            <div key={step} className="flex flex-col items-center flex-1 relative z-10">
              <button
                type="button"
                onClick={() => onStepClick(step)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-all duration-200 bg-white ${stepStyles}`}
                title={`Change status to ${step}`}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  idx + 1
                )}
              </button>
              <span className={`mt-2 text-[9px] font-semibold text-center max-w-[85px] leading-tight transition-colors duration-200 select-none uppercase tracking-tighter ${
                isActive ? 'text-slate-900 font-bold' : isCompleted ? 'text-slate-700 font-medium' : 'text-slate-400'
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Button = ({ children, onClick, disabled, className = '', variant = 'default', size = 'md', type = 'button' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none';
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base', icon: 'p-2' };
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    link: 'text-blue-600 underline bg-transparent hover:text-blue-700 p-0',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${className}`} {...props} />
);

const Label = ({ children, className = '', htmlFor }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 dark:text-slate-300 ${className}`}>{children}</label>
);

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-slate-100 text-slate-700',
    destructive: 'bg-red-100 text-red-700',
    outline: 'border border-slate-300 text-slate-700 bg-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </span>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, children, maxWidth = 'max-w-2xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
};
const ModalHeader = ({ children }) => <div className="px-6 pt-6 pb-2">{children}</div>;
const ModalTitle = ({ children, className = '' }) => <h2 className={`text-xl font-bold text-slate-900 dark:text-white ${className}`}>{children}</h2>;
const ModalDesc = ({ children }) => <p className="text-sm text-slate-500 mt-1">{children}</p>;
const ModalFooter = ({ children }) => <div className="px-6 pb-6 pt-4 flex justify-end gap-3">{children}</div>;
const ModalBody = ({ children }) => <div className="px-6 py-4">{children}</div>;

const NativeSelect = ({ value, onChange, children, className = '', disabled }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${className}`}
  >
    {children}
  </select>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function RecruiterCandidates() {
  const { currentUser, userRole, authHeaders } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [candidateSettings, setCandidateSettings] = useState(() => {
    return currentUser?.candidateSettings || { hiddenFields: [], customFields: [] };
  });

  useEffect(() => {
    if (currentUser?.candidateSettings) {
      setCandidateSettings(currentUser.candidateSettings);
    }
  }, [currentUser]);

  const hiddenFields = candidateSettings.hiddenFields || [];
  const tenantCustomFields = candidateSettings.customFields || [];
  const isHidden = (fieldName) => hiddenFields.includes(fieldName);

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [selectedDeliverClientId, setSelectedDeliverClientId] = useState('');

  const filteredJobs = useMemo(() => {
    if (!selectedDeliverClientId) return [];
    const client = clients.find(c => c._id === selectedDeliverClientId);
    if (!client) return [];
    return jobs.filter(j => j.clientName === client.companyName);
  }, [selectedDeliverClientId, clients, jobs]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState(null);

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleSearchTerm, statusFilter, activeStatFilter]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Bulk Import State ──────────────────────────────────────────────────────
  const importFileInputRef = useRef(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importParsedData, setImportParsedData] = useState(null); // { validRows, invalidRows, allRows, totalCount }
  const [importParseProgress, setImportParseProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // response from API
  const [importDragOver, setImportDragOver] = useState(false);
  const [importFileName, setImportFileName] = useState('');

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempHiddenFields, setTempHiddenFields] = useState([]);
  const [tempCustomFields, setTempCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [errors, setErrors] = useState({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  const standardSources = ['Portal', 'LinkedIn', 'Referral', 'Direct', 'Agency', 'Naukri', 'Indeed'];
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [activeClientPopoverId, setActiveClientPopoverId] = useState(null);
  const [activeStatusPopoverId, setActiveStatusPopoverId] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormState = {
    firstName: '', lastName: '', email: '', contact: '', alternateNumber: '', dateOfBirth: '', gender: '', linkedin: '',
    currentLocation: '', preferredLocation: '',
    position: '', client: '', clientCandidateId: '', industry: '', currentCompany: '', skills: '',
    totalExperienceYears: '0', totalExperienceMonths: '0',
    relevantExperienceYears: '0', relevantExperienceMonths: '0',
    totalExperience: '', relevantExperience: '',
    education: '',
    ctc: '', ectc: '',
    currentTakeHome: '',
    expectedTakeHome: '',
    noticePeriod: '',
    servingNoticePeriod: 'false',
    noticePeriodDays: '',
    lwd: '',
    reasonForChange: '',
    offersInHand: 'false',
    offerPackage: '',
    source: 'Portal',
    status: ['Submitted'],
    rating: '0', assignedJobId: '',
    dateAdded: todayStr,
    notes: '', remarks: '',
    active: true,
    customFields: {}
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleOpenSettings = () => {
    setTempHiddenFields([...hiddenFields]);
    setTempCustomFields([...tenantCustomFields]);
    setEditingFieldIndex(null);
    setNewFieldName('');
    setNewFieldType('text');
    setIsSettingsOpen(true);
  };

  const handleToggleHiddenField = (fieldId) => {
    setTempHiddenFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleAddOrUpdateCustomField = () => {
    if (!newFieldName.trim()) return;
    const name = newFieldName.trim();
    if (editingFieldIndex !== null) {
      setTempCustomFields((prev) =>
        prev.map((cf, idx) => (idx === editingFieldIndex ? { fieldName: name, fieldType: newFieldType } : cf))
      );
      setEditingFieldIndex(null);
    } else {
      if (tempCustomFields.some((cf) => cf.fieldName.toLowerCase() === name.toLowerCase())) {
        toast({ title: 'Duplicate Field', description: 'A field with this name already exists.', variant: 'destructive' });
        return;
      }
      setTempCustomFields((prev) => [...prev, { fieldName: name, fieldType: newFieldType }]);
    }
    setNewFieldName('');
    setNewFieldType('text');
  };

  const handleEditCustomField = (index) => {
    const cf = tempCustomFields[index];
    setNewFieldName(cf.fieldName);
    setNewFieldType(cf.fieldType);
    setEditingFieldIndex(index);
  };

  const handleRemoveCustomField = (idx) => {
    setTempCustomFields((prev) => prev.filter((_, i) => i !== idx));
    if (editingFieldIndex === idx) {
      setEditingFieldIndex(null);
      setNewFieldName('');
      setNewFieldType('text');
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = { candidateSettings: { hiddenFields: tempHiddenFields, customFields: tempCustomFields } };
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const updatedUser = await res.json();
      const stored = sessionStorage.getItem('currentUser');
      if (stored) {
        const obj = JSON.parse(stored);
        obj.candidateSettings = updatedUser.candidateSettings;
        sessionStorage.setItem('currentUser', JSON.stringify(obj));
      }
      setCandidateSettings(updatedUser.candidateSettings || payload.candidateSettings);
      setIsSettingsOpen(false);
      toast({ title: 'Saved!', description: 'Candidate form settings updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const checkEmailDuplicate = async (email) => {
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return;
    setIsCheckingEmail(true);
    try {
      const authH = await authHeaders();
      const excludeParam = selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(email.trim())}${excludeParam}`, {
        headers: { ...authH },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          email: `A candidate with this email already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) { } finally { setIsCheckingEmail(false); }
  };

  const checkPhoneDuplicate = async (phone) => {
    const digits = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    if (!digits || digits.length !== 10) return;
    setIsCheckingPhone(true);
    try {
      const authH = await authHeaders();
      const excludeParam = selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, {
        headers: { ...authH },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          contact: `A candidate with this phone already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) { } finally { setIsCheckingPhone(false); }
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
      return;
    }

    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      toast({ title: 'Error', description: 'Invalid file type. Only PDF, DOC, and DOCX are supported.', variant: 'destructive' });
      return;
    }

    setIsParsingResume(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('resume', file);

      const authH = await authHeaders();
      const response = await fetch(`${API_URL}/candidates/parse-resume`, {
        method: 'POST',
        headers: { ...authH },
        body: uploadFormData
      });

      const result = await response.json();

      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to parse resume');

      if (result.success && result.data) {
        const cleanContact = result.data.contact ? result.data.contact.replace(/\D/g, '').slice(0, 10) : '';
        const cleanTotalExp = result.data.totalExperience ? String(result.data.totalExperience).replace(/[^0-9.]/g, '') : '';
        const parsedName = result.data.name || '';
        const nameParts = parsedName.trim().split(/\s+/);
        const parsedFirst = nameParts[0] || '';
        const parsedLast = nameParts.slice(1).join(' ') || '';
        setFormData(prev => ({
          ...prev,
          firstName: prev.firstName || parsedFirst, lastName: prev.lastName || parsedLast,
          email: prev.email || result.data.email || '', contact: prev.contact || cleanContact || '',
          linkedin: prev.linkedin || result.data.linkedin || '', gender: prev.gender || result.data.gender || 'Not Specified',
          skills: prev.skills || result.data.skills || '', totalExperience: prev.totalExperience || cleanTotalExp || '',
          education: prev.education || result.data.education || '', currentLocation: prev.currentLocation || result.data.currentLocation || '',
          currentCompany: prev.currentCompany || result.data.currentCompany || '',
        }));
        toast({ title: 'Success', description: 'Resume parsed successfully. Fields auto-filled.' });
      }
    } catch (error) {
      toast({ title: 'Warning', description: 'Could not parse some details. Please fill manually.', variant: 'default' });
    } finally {
      setIsParsingResume(false); event.target.value = '';
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const authH = await authHeaders();
      const headers = { ...authH };

      const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
      const candidateUrl = isAdminOrManager && currentUser?._id
        ? `${API_URL}/candidates?recruiterId=${currentUser._id}`
        : `${API_URL}/candidates`;

      const [candRes, jobRes, clientRes] = await Promise.all([
        fetch(candidateUrl, { headers }),
        fetch(`${API_URL}/jobs`, { headers }),
        fetch(`${API_URL}/clients`, { headers })
      ]);

      if (candRes.ok) {
        const allCandidates = await candRes.json();
        const fixedCandidates = allCandidates.map((c) => ({
          ...c, status: (() => {
            if (Array.isArray(c.status)) return c.status;
            if (typeof c.status === 'string') return c.status.split(',').map(s => s.trim()).filter(Boolean);
            return [c.status || 'Submitted'];
          })()
        }));
        setCandidates(fixedCandidates);
      }
      if (jobRes.ok) setJobs(await jobRes.json());
      if (clientRes.ok) setClients(await clientRes.json());
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load data" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) { setActiveStatFilter(status); setStatusFilter('all'); }
  }, [searchParams]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveClientPopoverId(null);
      setActiveStatusPopoverId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleInputChange = (key, value) => {
    let newValue = value;

    if (key === 'contact' || key === 'alternateNumber') newValue = value.replace(/\D/g, '').slice(0, 10);
    else if (key === 'firstName' || key === 'lastName') newValue = value.replace(/[^a-zA-Z\s'\-]/g, '');
    else if (key === 'ctc' || key === 'ectc') {
      newValue = value.replace(/[^0-9.]/g, '');
      const parts = newValue.split('.');
      if (parts.length > 2) newValue = parts[0] + '.' + parts.slice(1).join('');
      if (newValue !== '' && !isNaN(newValue) && parseFloat(newValue) > 50) newValue = '50';
    }

    setFormData(prev => {
      const next = { ...prev, [key]: newValue };
      if (key.startsWith('totalExperience')) {
        next.totalExperience = `${next.totalExperienceYears} yrs ${next.totalExperienceMonths} months`;
      }
      if (key.startsWith('relevantExperience')) {
        next.relevantExperience = `${next.relevantExperienceYears} yrs ${next.relevantExperienceMonths} months`;
      }
      return next;
    });

    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldName]: value }
    }));
  };

  const addStatus = (newStatus) => {
    if (newStatus === 'SELECT_ALL') setFormData(prev => ({ ...prev, status: [...allStatuses] }));
    else if (!formData.status.includes(newStatus)) setFormData(prev => ({ ...prev, status: [...prev.status, newStatus] }));
    if (errors.status) setErrors(prev => { const n = { ...prev }; delete n.status; return n; });
  };

  const removeStatus = (statusToRemove) => {
    setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== statusToRemove) }));
  };

  const validateForm = () => {
    const newErrors = {};
    const trimStr = (val) => (typeof val === 'string' ? val.trim() : val);
    const data = formData;

    const firstName = trimStr(data.firstName);
    if (!firstName) newErrors.firstName = "First Name is required";
    else if (!/^[a-zA-Z\s'\-]{2,50}$/.test(firstName)) newErrors.firstName = "Must be 2–50 letters only";

    const lastName = trimStr(data.lastName);
    if (!lastName) newErrors.lastName = "Last Name is required";
    else if (!/^[a-zA-Z\s'\-]{1,50}$/.test(lastName)) newErrors.lastName = "Must be letters only";

    if (!isHidden('dateOfBirth') && data.dateOfBirth) {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (data.dateOfBirth >= todayDateStr) newErrors.dateOfBirth = 'Date of Birth must be in the past (not today or future)';
      else {
        const dob = new Date(data.dateOfBirth);
        const ageYears = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears < 18) newErrors.dateOfBirth = 'Candidate must be at least 18 years old';
        else if (ageYears > 80) newErrors.dateOfBirth = 'Please enter a valid Date of Birth';
      }
    }

    const email = trimStr(data.email);
    if (!email) newErrors.email = "Email is required";
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) newErrors.email = "Enter a valid email ending with .com, .in, etc.";
    else if (errors.email && errors.email.includes('already exists')) newErrors.email = errors.email;

    const contact = trimStr(data.contact);
    if (!contact) newErrors.contact = "Phone is required";
    else if (contact.length !== 10) newErrors.contact = "Must be exactly 10 digits";
    else if (errors.contact && errors.contact.includes('already exists')) newErrors.contact = errors.contact;

    if (!isHidden('linkedin') && data.linkedin && !/^(https?:\/\/)?([\w\d\-]+\.)+\w{2,}(\/.*)?$/i.test(trimStr(data.linkedin))) newErrors.linkedin = "Invalid LinkedIn URL format";
    if (!isHidden('currentLocation') && data.currentLocation && trimStr(data.currentLocation).length > 100) newErrors.currentLocation = "Max 100 characters";
    if (!isHidden('preferredLocation') && data.preferredLocation && trimStr(data.preferredLocation).length > 100) newErrors.preferredLocation = "Max 100 characters";

    const pos = trimStr(data.position);
    if (!pos) newErrors.position = "Position is required";
    else if (pos.length > 100) newErrors.position = "Max 100 characters allowed";



    if (!isHidden('currentCompany') && data.currentCompany && trimStr(data.currentCompany).length > 100) newErrors.currentCompany = "Max 100 characters";
    if (!isHidden('industry') && data.industry && trimStr(data.industry).length > 100) newErrors.industry = "Max 100 characters";

    const skills = trimStr(data.skills);
    if (!skills) newErrors.skills = "At least one skill is required";
    else if (skills.length > 500) newErrors.skills = "Max 500 characters allowed";

    if (!isHidden('education') && data.education && trimStr(data.education).length > 200) newErrors.education = "Max 200 characters";

    if (!isHidden('totalExperience') && !isHidden('relevantExperience')) {
      const totalMonths = parseInt(data.totalExperienceYears || 0) * 12 + parseInt(data.totalExperienceMonths || 0);
      const relevantMonths = parseInt(data.relevantExperienceYears || 0) * 12 + parseInt(data.relevantExperienceMonths || 0);
      if (relevantMonths > totalMonths) {
        newErrors.relevantExperience = "Relevant experience cannot exceed total experience";
      }
    }

    if (!isHidden('ctc') && data.ctc && trimStr(data.ctc).length > 50) newErrors.ctc = "Max 50 characters";
    if (!isHidden('ectc') && data.ectc && trimStr(data.ectc).length > 50) newErrors.ectc = "Max 50 characters";
    if (!isHidden('currentTakeHome') && data.currentTakeHome && trimStr(data.currentTakeHome).length > 50) newErrors.currentTakeHome = "Max 50 characters";
    if (!isHidden('expectedTakeHome') && data.expectedTakeHome && trimStr(data.expectedTakeHome).length > 50) newErrors.expectedTakeHome = "Max 50 characters";
    if (!isHidden('noticePeriod') && data.noticePeriod && trimStr(data.noticePeriod).length > 50) newErrors.noticePeriod = "Max 50 characters";

    if (!isHidden('servingNoticePeriod') && data.servingNoticePeriod === 'true') {
      if (!isHidden('lwd') && !data.lwd) newErrors.lwd = "LWD is required if currently serving notice";
    }

    if (!isHidden('reasonForChange') && data.reasonForChange && trimStr(data.reasonForChange).length > 500) newErrors.reasonForChange = "Max 500 characters allowed";

    if (!isHidden('offersInHand') && data.offersInHand === 'true') {
      if (!trimStr(data.offerPackage)) newErrors.offerPackage = "Package amount is required";
      else if (trimStr(data.offerPackage).length > 50) newErrors.offerPackage = "Max 50 characters";
    }

    if (isCustomSource && !trimStr(data.source)) newErrors.source = "Source is required";
    if (!data.status || data.status.length === 0) newErrors.status = "At least one status is required";
    if (!data.dateAdded) newErrors.dateAdded = "Date Added is required";
    else {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (data.dateAdded > todayDateStr) newErrors.dateAdded = "Date Added cannot be a future date — only today or earlier";
    }
    if (data.remarks && trimStr(data.remarks).length > 1000) newErrors.remarks = "Max 1000 characters allowed";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const stats = useMemo(() => {
    const countStatus = (s) => candidates.filter(c => Array.isArray(c.status) ? c.status.includes(s) : c.status === s).length;
    const todayStr2 = new Date().toLocaleDateString('en-CA');
    const todayCount = candidates.filter(c => {
      const d = c.dateAdded || c.createdAt;
      return d ? new Date(d).toLocaleDateString('en-CA') === todayStr2 : false;
    }).length;

    return {
      total: candidates.length, turnups: countStatus('Turnups'), noShow: countStatus('No Show'), yetToAttend: countStatus('Yet to attend'),
      selected: countStatus('Selected'), rejected: countStatus('Rejected'), hold: countStatus('Hold'), joined: countStatus('Joined'),
      pipeline: countStatus('Pipeline'), backout: countStatus('Backout'), sharedProfiles: countStatus('Shared Profiles'), todaySubmissions: todayCount,
    };
  }, [candidates]);

  const getFilteredCandidates = useMemo(() => {
    const todayLocal = new Date().toLocaleDateString('en-CA');
    return candidates.filter(c => {
      const searchMatch =
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.candidateId?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const roleMatch = !roleSearchTerm || 
        (c.position && c.position.toLowerCase().includes(roleSearchTerm.toLowerCase())) ||
        (Array.isArray(c.skills) && c.skills.some(skill => skill.toLowerCase().includes(roleSearchTerm.toLowerCase())));
        
      const currentStatusArr = Array.isArray(c.status) ? c.status : [c.status || ''];

      let statCardMatch = true;
      if (activeStatFilter === 'Today') {
        const d = c.dateAdded || c.createdAt;
        statCardMatch = d ? new Date(d).toLocaleDateString('en-CA') === todayLocal : false;
      } else if (activeStatFilter) {
        statCardMatch = currentStatusArr.includes(activeStatFilter);
      }

      const statusDropdownMatch = statusFilter === 'all' || currentStatusArr.includes(statusFilter);
      return searchMatch && roleMatch && statusDropdownMatch && statCardMatch;
    });
  }, [candidates, searchTerm, roleSearchTerm, statusFilter, activeStatFilter]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(getFilteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = getFilteredCandidates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExport = () => {
    if (getFilteredCandidates.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    try {
      const rows = getFilteredCandidates.map(c => {
        const row = {
          'Candidate ID': c.candidateId || c._id?.slice(-6).toUpperCase() || '',
          'Name': c.name || '',
          'Email': c.email || '',
          'Phone': c.contact || '',
          'Client': c.client || '',
          'Position': c.position || '',
          'Status': Array.isArray(c.status) ? c.status.join(' | ') : (c.status || ''),
          'Date Added': (c.dateAdded || c.createdAt) ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB') : '',
        };
        if (!isHidden('totalExperience')) row['Total Exp'] = c.totalExperience || '';
        if (!isHidden('ctc')) row['Current CTC'] = c.ctc || '';
        if (!isHidden('ectc')) row['Expected CTC'] = c.ectc || '';
        if (!isHidden('noticePeriod')) row['Notice Period'] = c.noticePeriod || '';
        if (!isHidden('currentCompany')) row['Current Company'] = c.currentCompany || '';
        if (!isHidden('currentLocation')) row['Location'] = c.currentLocation || '';
        
        tenantCustomFields.forEach(cf => {
          row[cf.fieldName] = c.customFields?.[cf.fieldName] || '';
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length), 10) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
      XLSX.writeFile(wb, `Candidates_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Exported!', description: `${rows.length} candidate(s) exported to Excel.` });
    } catch (err) { toast({ title: 'Export failed', variant: 'destructive' }); }
  };

  const getStatusBadgeVariant = (status) => {
    if (status === 'Joined' || status === 'Selected') return 'default';
    if (status === 'Rejected' || status === 'Backout' || status === 'No Show') return 'destructive';
    return 'secondary';
  };

  const getCandidateId = (c) => c.candidateId || c._id.substring(c._id.length - 6).toUpperCase();
  const formatSkills = (skills) => !skills ? 'N/A' : Array.isArray(skills) ? skills.slice(0, 3).join(', ') + (skills.length > 3 ? '...' : '') : skills.length > 50 ? skills.substring(0, 50) + '...' : skills;
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  const toggleSelectCandidate = (id) => setSelectedCandidates(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  const selectAllCandidates = () => setSelectedCandidates(selectedCandidates.length === getFilteredCandidates.length ? [] : getFilteredCandidates.map(c => c._id));
  const openViewDialog = async (c) => {
    setViewingCandidate(c);
    setIsViewDialogOpen(true);
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/candidates/${c._id}`, { headers: { ...authH } });
      if (res.ok) {
        setViewingCandidate(await res.json());
      }
    } catch (err) {
      console.error("Error fetching candidate details:", err);
    }
  };

  const refreshViewingCandidate = async (candidateId) => {
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/candidates/${candidateId}`, { headers: { ...authH } });
      if (res.ok) {
        const data = await res.json();
        setViewingCandidate(data);
        // Also update the main list
        setCandidates(prev => prev.map(c => c._id === candidateId ? { ...c, submissions: data.submissions } : c));
      }
    } catch (err) {
      console.error("Error refreshing candidate details", err);
    }
  };

  const handleDeliverToClient = async (clientId, jobId, specificCandidateId = null) => {
    const cid = specificCandidateId || (viewingCandidate && viewingCandidate._id);
    if (!clientId || !cid) return;
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/submissions`, {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: cid,
          clientId,
          jobId: jobId || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (!specificCandidateId) {
          toast({ title: 'Success', description: 'Candidate delivered to client successfully.' });
          await refreshViewingCandidate(cid);
        }
        fetchData();
      } else {
        toast({ title: 'Error', description: data.message || 'Failed to deliver candidate', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to deliver candidate', variant: 'destructive' });
    }
  };

  const handleUpdateSubmission = async (submissionId, status, remarks) => {
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
        method: 'PUT',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: 'Submission updated successfully.' });
        await refreshViewingCandidate(viewingCandidate._id);
        fetchData();
      } else {
        toast({ title: 'Error', description: data.message || 'Failed to update submission', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update submission', variant: 'destructive' });
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!window.confirm('Are you sure you want to retract/delete this delivery?')) return;
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
        method: 'DELETE',
        headers: { ...authH }
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: 'Submission deleted successfully.' });
        await refreshViewingCandidate(viewingCandidate._id);
        fetchData();
      } else {
        toast({ title: 'Error', description: data.message || 'Failed to delete submission', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete submission', variant: 'destructive' });
    }
  };

  const openEditDialog = async (c) => {
    setErrors({}); setSelectedCandidateId(c._id);
    setSelectedDeliverClientId('');
    setViewingCandidate(c);
    const isStandard = standardSources.includes(c.source || 'Portal');
    setIsCustomSource(!isStandard);
    setFormData({
      firstName: c.firstName || '', lastName: c.lastName || '', email: c.email || '', contact: c.contact || '', alternateNumber: c.alternateNumber || '',
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
      gender: c.gender || '', linkedin: c.linkedin || '',
      currentLocation: c.currentLocation || '', preferredLocation: c.preferredLocation || '',
      position: c.position || '', client: c.client || '', industry: c.industry || '',
      currentCompany: c.currentCompany || '', skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '',
      totalExperience: c.totalExperience ? String(c.totalExperience) : '',
      clientCandidateId: c.clientCandidateId || '',
      totalExperienceYears: (c.totalExperience || '').split('yrs')[0]?.trim() || '0',
      totalExperienceMonths: (c.totalExperience || '').split('yrs')[1]?.replace('months', '')?.trim() || '0',
      relevantExperience: c.relevantExperience ? String(c.relevantExperience) : '',
      relevantExperienceYears: (c.relevantExperience || '').split('yrs')[0]?.trim() || '0',
      relevantExperienceMonths: (c.relevantExperience || '').split('yrs')[1]?.replace('months', '')?.trim() || '0',
      education: c.education || '', ctc: c.ctc ? String(c.ctc) : '', ectc: c.ectc ? String(c.ectc) : '',
      currentTakeHome: c.currentTakeHome || '', expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod ? String(c.noticePeriod) : '', servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? new Date(c.lwd).toISOString().split('T')[0] : '', reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false', offerPackage: c.offerPackage || '',
      source: c.source || 'Portal', status: (() => {
        if (Array.isArray(c.status)) return c.status;
        if (typeof c.status === 'string') return c.status.split(',').map(s => s.trim()).filter(Boolean);
        return [c.status || 'Submitted'];
      })(),
      rating: c.rating?.toString() || '0', assignedJobId: typeof c.assignedJobId === 'object' ? c.assignedJobId._id : c.assignedJobId || '',
      dateAdded: c.dateAdded ? new Date(c.dateAdded).toISOString().split('T')[0] : '',
      notes: c.notes || '', remarks: c.remarks || '', active: c.active !== false,
      customFields: c.customFields || {}
    });
    setIsEditDialogOpen(true);

    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/candidates/${c._id}`, { headers: { ...authH } });
      if (res.ok) {
        setViewingCandidate(await res.json());
      }
    } catch (err) {
      console.error("Error loading details for edit modal:", err);
    }
  };

  const handleSave = async (isEdit) => {
    if (formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      try {
        const dupH = await authHeaders();
        const excludeParam = isEdit && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
        const dupRes = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(formData.email.trim())}${excludeParam}`, { headers: { ...dupH } });
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          if (dupData.exists) {
            setErrors(prev => ({ ...prev, email: `A candidate with this email already exists` }));
            toast({ title: "Duplicate Email", description: "Email already registered", variant: "destructive" });
            return;
          }
        }
      } catch (_) { }
    }

    if (formData.contact) {
      const digits = formData.contact.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        try {
          const phH = await authHeaders();
          const excludeParam = isEdit && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
          const phRes = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: { ...phH } });
          if (phRes.ok) {
            const phData = await phRes.json();
            if (phData.exists) {
              setErrors(prev => ({ ...prev, contact: `A candidate with this phone already exists` }));
              toast({ title: "Duplicate Phone", description: "Phone already registered", variant: "destructive" });
              return;
            }
          }
        } catch (_) { }
      }
    }

    if (!validateForm()) { toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const authH = await authHeaders();
      const headers = { ...authH, 'Content-Type': 'application/json' };

      const builtName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
      const payload = {
        ...formData, firstName: formData.firstName.trim(), lastName: formData.lastName.trim(), name: builtName,
        email: formData.email.trim(), contact: formData.contact.trim(), alternateNumber: (formData.alternateNumber || '').trim(), linkedin: formData.linkedin.trim(),
        currentLocation: formData.currentLocation.trim(), preferredLocation: formData.preferredLocation.trim(),
        position: formData.position.trim(), industry: formData.industry.trim(), currentCompany: formData.currentCompany.trim(),
        education: formData.education.trim(), ctc: formData.ctc.trim(), ectc: formData.ectc.trim(),
        currentTakeHome: formData.currentTakeHome.trim(), expectedTakeHome: formData.expectedTakeHome.trim(),
        noticePeriod: formData.noticePeriod.trim(), reasonForChange: formData.reasonForChange.trim(),
        offerPackage: formData.offerPackage.trim(), source: formData.source.trim(), remarks: formData.remarks.trim(),
        assignedJobId: typeof formData.assignedJobId === 'object' ? formData.assignedJobId._id : formData.assignedJobId,
        skills: typeof formData.skills === 'string' ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean) : formData.skills,
        rating: parseInt(formData.rating) || 0, servingNoticePeriod: formData.servingNoticePeriod === 'true', offersInHand: formData.offersInHand === 'true',
        status: formData.status,
        customFields: formData.customFields || {}
      };
      const url = isEdit ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: `Candidate ${isEdit ? 'updated' : 'added'} successfully` });
        setIsAddDialogOpen(false); setIsEditDialogOpen(false);
        const fixedData = { ...data, status: Array.isArray(data.status) ? data.status : [data.status || 'Submitted'] };
        
        if (!isEdit && selectedDeliverClientId) {
            const jobIdSelect = document.getElementById('deliver-job-select');
            await handleDeliverToClient(selectedDeliverClientId, jobIdSelect ? jobIdSelect.value : '', fixedData._id);
        } else {
            if (isEdit) setCandidates(prev => prev.map(c => c._id === selectedCandidateId ? { ...c, ...fixedData } : c));
            else setCandidates(prev => [fixedData, ...prev]);
        }
        setFormData(initialFormState);
        setSelectedDeliverClientId('');
      } else throw new Error(data.message || 'Operation failed');
    } catch (error) { toast({ variant: "destructive", title: "Error", description: error.message || "Operation failed" }); }
    finally { setIsSubmitting(false); }
  };

  const toggleActiveStatus = async (id, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'}?`)) return;
    try {
      const authH = await authHeaders();
      const headers = { ...authH, 'Content-Type': 'application/json' };
      await fetch(`${API_URL}/candidates/${id}`, { method: 'PUT', headers, body: JSON.stringify({ active: !currentStatus }) });
      toast({ title: "Status Updated" }); fetchData();
    } catch (error) { toast({ variant: "destructive", title: "Error" }); }
  };

  const handleBulkDelete = async () => {
    if (selectedCandidates.length === 0) return;
    setIsDeleting(true);
    try {
      const authH = await authHeaders();
      const headers = { ...authH };
      const deletePromises = selectedCandidates.map(id => fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers }));
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: `${selectedCandidates.length} candidate(s) deleted successfully` });
      setSelectedCandidates([]); fetchData(); setIsDeleteConfirmOpen(false);
    } catch (error) { toast({ variant: "destructive", title: "Error" }); }
    finally { setIsDeleting(false); }
  };



  const handleWhatsApp = (c) => {
    if (!c.contact) return;
    let phone = c.contact.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const firstName = c.name.split(' ')[0];
    const message = `Hi ${firstName}, this is regarding your job application for the ${c.position} position at ${c.client}. Are you available?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // ── Bulk Import Handlers ───────────────────────────────────────────────────
  const resetImportState = () => {
    setImportParsedData(null);
    setImportParseProgress(0);
    setIsParsing(false);
    setIsImporting(false);
    setImportResult(null);
    setImportDragOver(false);
    setImportFileName('');
    if (importFileInputRef.current) importFileInputRef.current.value = '';
  };

  const openImportModal = () => {
    resetImportState();
    setIsImportModalOpen(true);
  };

  const processImportFile = async (file) => {
    if (!file) return;
    if (!isValidFileType(file)) {
      toast({ title: 'Invalid file type', description: 'Only .xlsx, .xls, and .csv files are supported.', variant: 'destructive' });
      return;
    }
    if (file.size === 0) {
      toast({ title: 'Empty file', description: 'The selected file is empty.', variant: 'destructive' });
      return;
    }
    setImportFileName(file.name);
    setIsParsing(true);
    setImportParseProgress(0);
    setImportParsedData(null);
    setImportResult(null);
    try {
      const result = await parseExcelToCandidates(file, setImportParseProgress);
      setImportParsedData(result);
      if (result.totalCount === 0) {
        toast({ title: 'No data found', description: 'The file has no data rows.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Parse error', description: err.message, variant: 'destructive' });
      setImportFileName('');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processImportFile(file);
  };

  const handleImportDrop = (e) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImportFile(file);
  };

  const handleConfirmImport = async () => {
    if (!importParsedData || importParsedData.validRows.length === 0) return;
    setIsImporting(true);
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/candidates/bulk-import`, {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: importParsedData.validRows,
          fileName: importFileName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      setImportResult(data);
      toast({
        title: 'Import Complete',
        description: `${data.importedSuccessfully} imported, ${data.failedRecords} failed, ${data.duplicatesSkipped} duplicates skipped.`,
      });
      if (data.importedSuccessfully > 0) fetchData();
    } catch (err) {
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importResult?.errors?.length) return;
    const rows = importResult.errors.map(e => ({
      'Row':             e.row,
      'Candidate Name':  e.candidateName || '',
      'Email':           e.email || '',
      'Failure Reason':  e.reason || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 32 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Errors');
    XLSX.writeFile(wb, `import_error_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;


  const renderCandidateForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
      <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 flex items-center gap-2"><UserCircle className="h-4 w-4" /> Personal Information</div>

      <div className="space-y-1">
        <Label className={errors.firstName ? "text-red-500" : ""}>First Name *</Label>
        <Input value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} className={errors.firstName ? "border-red-500" : ""} placeholder="e.g. Rahul" />
        {errors.firstName && <span className="text-xs text-red-500">{errors.firstName}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.lastName ? "text-red-500" : ""}>Last Name *</Label>
        <Input value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} className={errors.lastName ? "border-red-500" : ""} placeholder="e.g. Sharma" />
        {errors.lastName && <span className="text-xs text-red-500">{errors.lastName}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.email ? "text-red-500" : ""}>Email *</Label>
        <Input value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className={errors.email ? "border-red-500" : ""} placeholder="user@domain.com" />
        {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.contact ? "text-red-500" : ""}>Phone *</Label>
        <div className="relative">
          <Input type="text" value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} onBlur={e => checkPhoneDuplicate(e.target.value)} className={errors.contact ? "border-red-500" : ""} placeholder="10 Digits Only" maxLength={10} />
          {isCheckingPhone && <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking...</span>}
        </div>
        {errors.contact && <span className="text-xs text-red-500">{errors.contact}</span>}
      </div>
      {!isHidden('alternateNumber') && (
        <div className="space-y-1">
          <Label className={errors.alternateNumber ? "text-red-500" : ""}>Alternate Number</Label>
          <Input value={formData.alternateNumber || ''} onChange={e => handleInputChange('alternateNumber', e.target.value)} className={errors.alternateNumber ? "border-red-500" : ""} placeholder="Alternate Contact" />
          {errors.alternateNumber && <span className="text-xs text-red-500">{errors.alternateNumber}</span>}
        </div>
      )}
      {!isHidden('dateOfBirth') && (
        <div className="space-y-1">
          <Label className={errors.dateOfBirth ? "text-red-500" : ""}>Date of Birth</Label>
          <Input type="date" value={formData.dateOfBirth} onChange={e => handleInputChange('dateOfBirth', e.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]} className={errors.dateOfBirth ? "border-red-500" : ""} />
          {errors.dateOfBirth && <span className="text-xs text-red-500">{errors.dateOfBirth}</span>}
        </div>
      )}
      {!isHidden('gender') && (
        <div className="space-y-1">
          <Label className={errors.gender ? "text-red-500" : ""}>Gender</Label>
          <NativeSelect value={formData.gender} onChange={val => handleInputChange('gender', val)} className={errors.gender ? "border-red-500" : ""}>
            <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Not Specified">Not Specified</option>
          </NativeSelect>
          {errors.gender && <span className="text-xs text-red-500">{errors.gender}</span>}
        </div>
      )}
      {!isHidden('linkedin') && (
        <div className="space-y-1">
          <Label className={errors.linkedin ? "text-red-500" : ""}>LinkedIn URL</Label>
          <div className="relative">
            <Linkedin className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input className={`pl-8 ${errors.linkedin ? "border-red-500" : ""}`} value={formData.linkedin} onChange={e => handleInputChange('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          {errors.linkedin && <span className="text-xs text-red-500">{errors.linkedin}</span>}
        </div>
      )}
      {!isHidden('currentLocation') && (
        <div className="space-y-1">
          <Label className={errors.currentLocation ? "text-red-500" : ""}>Current Location</Label>
          <Input value={formData.currentLocation} onChange={e => handleInputChange('currentLocation', e.target.value)} className={errors.currentLocation ? "border-red-500" : ""} />
          {errors.currentLocation && <span className="text-xs text-red-500">{errors.currentLocation}</span>}
        </div>
      )}
      {!isHidden('preferredLocation') && (
        <div className="space-y-1">
          <Label className={errors.preferredLocation ? "text-red-500" : ""}>Preferred Location</Label>
          <Input value={formData.preferredLocation} onChange={e => handleInputChange('preferredLocation', e.target.value)} className={errors.preferredLocation ? "border-red-500" : ""} />
          {errors.preferredLocation && <span className="text-xs text-red-500">{errors.preferredLocation}</span>}
        </div>
      )}

      <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 mt-4 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Professional Information</div>

      <div className="space-y-1">
        <Label className={errors.position ? "text-red-500" : ""}>Role (Position) *</Label>
        <Input value={formData.position} onChange={e => handleInputChange('position', e.target.value)} className={errors.position ? "border-red-500" : ""} placeholder="e.g. Frontend Developer" />
        {errors.position && <span className="text-xs text-red-500">{errors.position}</span>}
      </div>

      {!isHidden('currentCompany') && (
        <div className="space-y-1">
          <Label className={errors.currentCompany ? "text-red-500" : ""}>Current Company</Label>
          <Input value={formData.currentCompany} onChange={e => handleInputChange('currentCompany', e.target.value)} className={errors.currentCompany ? "border-red-500" : ""} />
          {errors.currentCompany && <span className="text-xs text-red-500">{errors.currentCompany}</span>}
        </div>
      )}
      {!isHidden('industry') && (
        <div className="space-y-1">
          <Label className={errors.industry ? "text-red-500" : ""}>Industry</Label>
          <Input value={formData.industry} onChange={e => handleInputChange('industry', e.target.value)} className={errors.industry ? "border-red-500" : ""} />
          {errors.industry && <span className="text-xs text-red-500">{errors.industry}</span>}
        </div>
      )}
      <div className="md:col-span-2 space-y-1">
        <Label className={errors.skills ? "text-red-500" : ""}>Skills *</Label>
        <div className={`flex flex-wrap gap-2 p-2 border rounded-md ${errors.skills ? 'border-red-500' : 'border-slate-200'} bg-white focus-within:ring-2 focus-within:ring-blue-500`}>
          {formData.skills && formData.skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {skill}
              <button type="button" onClick={() => {
                const newSkills = formData.skills.split(',').map(s => s.trim()).filter(Boolean).filter((_, i) => i !== idx);
                handleInputChange('skills', newSkills.join(', '));
              }} className="hover:text-blue-900 rounded-full p-0.5 hover:bg-blue-100 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input 
            type="text" 
            className="flex-1 outline-none min-w-[120px] text-sm bg-transparent"
            placeholder={formData.skills ? "Add more..." : "e.g. React, Node.js (Press Enter)"}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = e.target.value.trim().replace(/,/g, '');
                if (val) {
                  const currentSkills = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
                  if (!currentSkills.includes(val)) {
                    currentSkills.push(val);
                    handleInputChange('skills', currentSkills.join(', '));
                  }
                }
                e.target.value = '';
              } else if (e.key === 'Backspace' && !e.target.value && formData.skills) {
                const currentSkills = formData.skills.split(',').map(s => s.trim()).filter(Boolean);
                currentSkills.pop();
                handleInputChange('skills', currentSkills.join(', '));
              }
            }}
            onBlur={(e) => {
              const val = e.target.value.trim().replace(/,/g, '');
              if (val) {
                const currentSkills = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
                if (!currentSkills.includes(val)) {
                  currentSkills.push(val);
                  handleInputChange('skills', currentSkills.join(', '));
                }
                e.target.value = '';
              }
            }}
          />
        </div>
        {errors.skills && <span className="text-xs text-red-500">{errors.skills}</span>}
      </div>

      <div className="md:col-span-3 mt-2 bg-blue-50/40 p-4 rounded-lg border border-blue-100">
        <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <Building className="h-4 w-4 text-blue-500" /> Deliver Candidate to Client
        </h4>
        {isEditDialogOpen && viewingCandidate ? (
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Client *</Label>
              <select 
                id="deliver-client-select" 
                required 
                value={selectedDeliverClientId}
                onChange={(e) => setSelectedDeliverClientId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Client</option>
                {clients.map(cl => (
                  <option key={cl._id} value={cl._id}>{cl.companyName}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Associated Job *</Label>
              <select 
                id="deliver-job-select" 
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{selectedDeliverClientId ? 'Select a Job' : 'Select a client first'}</option>
                {filteredJobs.map(j => (
                  <option key={j._id} value={j._id}>{j.position} ({j.jobCode}) - {j.clientName}</option>
                ))}
              </select>
            </div>
            <Button 
              type="button" 
              onClick={() => {
                const clientIdSelect = document.getElementById('deliver-client-select');
                const jobIdSelect = document.getElementById('deliver-job-select');
                if (clientIdSelect && clientIdSelect.value && jobIdSelect && jobIdSelect.value) {
                  handleDeliverToClient(clientIdSelect.value, jobIdSelect.value);
                  setSelectedDeliverClientId('');
                  jobIdSelect.value = '';
                } else {
                  toast({ title: 'Error', description: 'Please select both client and associated job', variant: 'destructive' });
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              Deliver Profile
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-500 mb-3">Select an initial client and role to deliver this candidate to upon creation.</p>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs">Client (Optional)</Label>
                <select 
                  id="deliver-client-select" 
                  value={selectedDeliverClientId}
                  onChange={(e) => setSelectedDeliverClientId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Client</option>
                  {clients.map(cl => (
                    <option key={cl._id} value={cl._id}>{cl.companyName}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs">Associated Job {selectedDeliverClientId ? '*' : '(Optional)'}</Label>
                <select 
                  id="deliver-job-select" 
                  required={!!selectedDeliverClientId}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{selectedDeliverClientId ? 'Select a Job' : 'Select a client first'}</option>
                  {filteredJobs.map(j => (
                    <option key={j._id} value={j._id}>{j.position} ({j.jobCode}) - {j.clientName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isHidden('education') && (
        <>
          <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Education</div>
          <div className="md:col-span-3 space-y-1">
            <Label className={errors.education ? "text-red-500" : ""}>Qualification</Label>
            <Input value={formData.education} onChange={e => handleInputChange('education', e.target.value)} className={errors.education ? "border-red-500" : ""} placeholder="e.g. B.Tech from IIT Delhi" />
            {errors.education && <span className="text-xs text-red-500">{errors.education}</span>}
          </div>
        </>
      )}

      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Experience & Availability</div>

      {!isHidden('totalExperience') && (
        <div className="space-y-1">
          <Label className={errors.totalExperience ? "text-red-500" : ""}>Total Exp *</Label>
          <div className="flex gap-2">
            <NativeSelect value={formData.totalExperienceYears} onChange={val => handleInputChange('totalExperienceYears', val)} className={errors.totalExperience ? "border-red-500" : ""}>
              {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i} Years</option>)}
            </NativeSelect>
            <NativeSelect value={formData.totalExperienceMonths} onChange={val => handleInputChange('totalExperienceMonths', val)} className={errors.totalExperience ? "border-red-500" : ""}>
              {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i} Months</option>)}
            </NativeSelect>
          </div>
          {errors.totalExperience && <span className="text-xs text-red-500">{errors.totalExperience}</span>}
        </div>
      )}
      {!isHidden('relevantExperience') && (
        <div className="space-y-1">
          <Label className={errors.relevantExperience ? "text-red-500" : ""}>Relevant Exp</Label>
          <div className="flex gap-2">
            <NativeSelect value={formData.relevantExperienceYears} onChange={val => handleInputChange('relevantExperienceYears', val)} className={errors.relevantExperience ? "border-red-500" : ""}>
              {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i} Years</option>)}
            </NativeSelect>
            <NativeSelect value={formData.relevantExperienceMonths} onChange={val => handleInputChange('relevantExperienceMonths', val)} className={errors.relevantExperience ? "border-red-500" : ""}>
              {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i} Months</option>)}
            </NativeSelect>
          </div>
          {errors.relevantExperience && <span className="text-xs text-red-500">{errors.relevantExperience}</span>}
        </div>
      )}

      {!isHidden('ctc') && (
        <div className="space-y-1">
          <Label className={errors.ctc ? "text-red-500" : ""}>Current CTC (LPA)</Label>
          <Input value={formData.ctc} onChange={e => handleInputChange('ctc', e.target.value)} className={errors.ctc ? "border-red-500" : ""} />
          {errors.ctc && <span className="text-xs text-red-500">{errors.ctc}</span>}
        </div>
      )}
      {!isHidden('ectc') && (
        <div className="space-y-1">
          <Label className={errors.ectc ? "text-red-500" : ""}>Expected CTC (LPA)</Label>
          <Input value={formData.ectc} onChange={e => handleInputChange('ectc', e.target.value)} className={errors.ectc ? "border-red-500" : ""} />
          {errors.ectc && <span className="text-xs text-red-500">{errors.ectc}</span>}
        </div>
      )}

      {!isHidden('currentTakeHome') && (
        <div className="space-y-1">
          <Label className={errors.currentTakeHome ? "text-red-500" : ""}>Current Take Home</Label>
          <Input value={formData.currentTakeHome} onChange={e => handleInputChange('currentTakeHome', e.target.value)} className={errors.currentTakeHome ? "border-red-500" : ""} />
          {errors.currentTakeHome && <span className="text-xs text-red-500">{errors.currentTakeHome}</span>}
        </div>
      )}
      {!isHidden('expectedTakeHome') && (
        <div className="space-y-1">
          <Label className={errors.expectedTakeHome ? "text-red-500" : ""}>Expected Take Home</Label>
          <Input value={formData.expectedTakeHome} onChange={e => handleInputChange('expectedTakeHome', e.target.value)} className={errors.expectedTakeHome ? "border-red-500" : ""} />
          {errors.expectedTakeHome && <span className="text-xs text-red-500">{errors.expectedTakeHome}</span>}
        </div>
      )}

      {!isHidden('noticePeriod') && (
        <div className="space-y-1">
          <Label className={errors.noticePeriod ? "text-red-500" : ""}>Notice Period</Label>
          <Input value={formData.noticePeriod} onChange={e => handleInputChange('noticePeriod', e.target.value)} className={errors.noticePeriod ? "border-red-500" : ""} placeholder="e.g. 30 Days" />
          {errors.noticePeriod && <span className="text-xs text-red-500">{errors.noticePeriod}</span>}
        </div>
      )}

      {!isHidden('servingNoticePeriod') && (
        <>
          <div className="space-y-1">
            <Label className={errors.servingNoticePeriod ? "text-red-500" : ""}>Serving Notice?</Label>
            <NativeSelect value={formData.servingNoticePeriod} onChange={val => handleInputChange('servingNoticePeriod', val)} className={errors.servingNoticePeriod ? "border-red-500" : ""}>
              <option value="false">No</option><option value="true">Yes</option>
            </NativeSelect>
            {errors.servingNoticePeriod && <span className="text-xs text-red-500">{errors.servingNoticePeriod}</span>}
          </div>

          {!isHidden('lwd') && formData.servingNoticePeriod === 'true' && (
            <div className="space-y-1">
              <Label className={errors.lwd ? "text-red-500" : ""}>LWD (Last Working Day) *</Label>
              <Input type="date" value={formData.lwd} onChange={e => handleInputChange('lwd', e.target.value)} className={errors.lwd ? "border-red-500" : ""} />
              {errors.lwd && <span className="text-xs text-red-500">{errors.lwd}</span>}
            </div>
          )}
        </>
      )}

      {!isHidden('reasonForChange') && (
        <div className="space-y-1 md:col-span-2">
          <Label className={errors.reasonForChange ? "text-red-500" : ""}>Reason For Change</Label>
          <textarea value={formData.reasonForChange} onChange={e => handleInputChange('reasonForChange', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm h-10 ${errors.reasonForChange ? "border-red-500" : "border-slate-300"}`} />
          {errors.reasonForChange && <span className="text-xs text-red-500">{errors.reasonForChange}</span>}
        </div>
      )}

      {!isHidden('offersInHand') && (
        <>
          <div className="space-y-1">
            <Label className={errors.offersInHand ? "text-red-500" : ""}>Offers in Hand?</Label>
            <NativeSelect value={formData.offersInHand} onChange={val => handleInputChange('offersInHand', val)} className={errors.offersInHand ? "border-red-500" : ""}>
              <option value="false">No</option><option value="true">Yes</option>
            </NativeSelect>
            {errors.offersInHand && <span className="text-xs text-red-500">{errors.offersInHand}</span>}
          </div>

          {formData.offersInHand === 'true' && (
            <div className="space-y-1">
              <Label className={errors.offerPackage ? "text-red-500" : ""}>Package Amount *</Label>
              <Input value={formData.offerPackage} onChange={e => handleInputChange('offerPackage', e.target.value)} className={errors.offerPackage ? "border-red-500" : ""} placeholder="e.g. 15 LPA" />
              {errors.offerPackage && <span className="text-xs text-red-500">{errors.offerPackage}</span>}
            </div>
          )}
        </>
      )}

      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><Target className="h-4 w-4" /> Recruitment Details</div>

      <div className="space-y-1">
        <Label className={errors.source ? "text-red-500" : ""}>Source *</Label>
        <NativeSelect value={isCustomSource ? 'Other' : formData.source} onChange={v => { if (v === 'Other') { setIsCustomSource(true); handleInputChange('source', '') } else { setIsCustomSource(false); handleInputChange('source', v) } }} className={errors.source ? "border-red-500" : ""}>
          {standardSources.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="Other">Other</option>
        </NativeSelect>
        {isCustomSource && <Input className={`mt-1 ${errors.source ? "border-red-500" : ""}`} value={formData.source} onChange={e => handleInputChange('source', e.target.value)} placeholder="Enter Source" />}
        {errors.source && <span className="text-xs text-red-500">{errors.source}</span>}
      </div>


      <div className="space-y-1">
        <Label className={errors.rating ? "text-red-500" : ""}>Rating</Label>
        <NativeSelect value={formData.rating} onChange={v => handleInputChange('rating', v)} className={errors.rating ? "border-red-500" : ""}>
          {[1, 2, 3, 4, 5].map(r => <option key={r} value={r.toString()}>{r} Stars</option>)}
        </NativeSelect>
        {errors.rating && <span className="text-xs text-red-500">{errors.rating}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.dateAdded ? "text-red-500" : ""}>Date Added *</Label>
        <Input type="date" value={formData.dateAdded} onChange={e => handleInputChange('dateAdded', e.target.value)} max={todayStr} className={errors.dateAdded ? "border-red-500" : ""} />
        <p className="text-xs text-slate-400 mt-0.5">Cannot be a future date. Defaults to today.</p>
        {errors.dateAdded && <span className="text-xs text-red-500">{errors.dateAdded}</span>}
      </div>
      <div className="md:col-span-3 space-y-1 mt-2">
        <Label className={errors.remarks ? "text-red-500" : ""}>Remarks</Label>
        <textarea value={formData.remarks} onChange={e => handleInputChange('remarks', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] ${errors.remarks ? "border-red-500" : "border-slate-300"}`} />
        {errors.remarks && <span className="text-xs text-red-500">{errors.remarks}</span>}
      </div>

      {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).length > 0 && (
        <>
          <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 mt-4 flex items-center gap-2"><Settings2 className="h-4 w-4" /> Additional Details</div>
          {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map((cf) => (
            <div key={cf.fieldName} className="space-y-1">
              <Label>{cf.fieldName} <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wide">({cf.fieldType})</span></Label>
              {cf.fieldType === 'boolean' ? (
                <NativeSelect value={formData.customFields?.[cf.fieldName] || 'false'} onChange={val => handleCustomFieldChange(cf.fieldName, val)}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </NativeSelect>
              ) : (
                <Input
                  type={cf.fieldType === 'date' ? 'date' : cf.fieldType === 'number' ? 'number' : 'text'}
                  value={formData.customFields?.[cf.fieldName] || ''}
                  onChange={e => handleCustomFieldChange(cf.fieldName, e.target.value)}
                  placeholder={`Enter ${cf.fieldName}...`}
                />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .sleek-scrollbar::-webkit-scrollbar { height: 10px; }
        .sleek-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 6px; }
        .sleek-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .sleek-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <main className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 overflow-y-auto overflow-x-hidden pb-48">

        <div className="w-full max-w-full mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">My Candidates</h1>
              <p className="text-slate-500">Manage pipeline</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              {selectedCandidates.length > 0 && (
                <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedCandidates.length})
                </Button>
              )}
              <Button variant="outline" onClick={handleOpenSettings}><Settings2 className="mr-2 h-4 w-4" /> Form Settings</Button>
              <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>

              {/* Import Candidates */}
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <Button
                variant="outline"
                className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                onClick={openImportModal}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Candidates
              </Button>

              <Button onClick={() => { setFormData(initialFormState); setErrors({}); setIsAddDialogOpen(true); setIsCustomSource(false); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Candidate
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Overall Submissions" value={stats.total} color="blue" active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} />
            <StatCard title="Today Submissions" value={stats.todaySubmissions} color="purple" active={activeStatFilter === 'Today'} onClick={() => { setActiveStatFilter('Today'); setStatusFilter('all'); }} />
            <StatCard title="Turnups" value={stats.turnups} color="cyan" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} />
            <StatCard title="No Show" value={stats.noShow} color="indigo" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} />
            <StatCard title="Yet to attend" value={stats.yetToAttend} color="purple" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} />
            <StatCard title="Selected" value={stats.selected} color="green" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} />
            <StatCard title="Rejected" value={stats.rejected} color="red" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} />
            <StatCard title="Hold" value={stats.hold} color="amber" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
            <StatCard title="Pipeline" value={stats.pipeline} color="orange" active={activeStatFilter === 'Pipeline'} onClick={() => setActiveStatFilter('Pipeline')} />
            <StatCard title="Joined" value={stats.joined} color="emerald" active={activeStatFilter === 'Joined'} onClick={() => setActiveStatFilter('Joined')} />
            <StatCard title="Backout" value={stats.backout} color="red" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
            <StatCard title="Shared Profiles" value={stats.sharedProfiles} color="cyan" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search name, email, ID..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative w-full sm:max-w-sm">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search job role or skills..." className="pl-10" value={roleSearchTerm} onChange={e => setRoleSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3">
                <NativeSelect value={statusFilter} onChange={setStatusFilter} className="w-44">
                  <option value="all">All Status</option>
                  {allStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                </NativeSelect>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button className={`p-2 rounded text-sm ${viewMode === 'table' ? 'bg-white shadow' : ''}`} onClick={() => setViewMode('table')}><List className="h-4 w-4" /></button>
                  <button className={`p-2 rounded text-sm ${viewMode === 'grid' ? 'bg-white shadow' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'table' ? (
            <>
              <div className="w-full overflow-x-auto sleek-scrollbar rounded-b-xl">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="p-4 w-12 whitespace-nowrap"><input type="checkbox" checked={getFilteredCandidates.length > 0 && selectedCandidates.length === getFilteredCandidates.length} onChange={selectAllCandidates} className="h-4 w-4 rounded border-slate-300" /></th>
                      <th className="p-3 whitespace-nowrap">ID</th>
                      <th className="p-3 whitespace-nowrap">Name</th>
                      <th className="p-3 whitespace-nowrap">Phone</th>
                      <th className="p-3 whitespace-nowrap">Email</th>
                      <th className="p-3 whitespace-nowrap">Client</th>
                      <th className="p-3 whitespace-nowrap">Date Added</th>
                      {!isHidden('totalExperience') && <th className="p-3 whitespace-nowrap">Experience</th>}
                      {(!isHidden('ctc') || !isHidden('ectc')) && <th className="p-3 whitespace-nowrap">CTC / ECTC</th>}
                      <th className="p-3 whitespace-nowrap">Status</th>
                      {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map(cf => (
                        <th key={cf.fieldName} className="p-3 whitespace-nowrap">{cf.fieldName}</th>
                      ))}
                      <th className="p-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  {paginatedCandidates.map((c, index) => {
                    return (
                      <tbody key={c._id} className="group border-b border-slate-100 last:border-0">
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 pl-4 whitespace-nowrap" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedCandidates.includes(c._id)} onChange={() => toggleSelectCandidate(c._id)} className="h-4 w-4 rounded" /></td>
                          <td className="p-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}>{getCandidateId(c)}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-900">{c.name}</span>
                          </td>
                          <td className="p-3 text-sm text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-2">{c.contact}
                              <button className="text-green-600 hover:text-green-700" onClick={(e) => { e.stopPropagation(); handleWhatsApp(c); }}><MessageCircle className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-slate-600 whitespace-nowrap"><span className="truncate max-w-[150px] block" title={c.email}>{c.email}</span></td>
                          <td className="p-3 text-slate-600 relative">
                             {c.submissions && c.submissions.length > 0 ? (
                               <div className="flex items-center gap-1.5 flex-wrap">
                                 <Badge variant="outline" className="text-[10px] bg-slate-50 font-medium">
                                   {c.submissions[c.submissions.length - 1].clientName}
                                 </Badge>
                                 {c.submissions.length > 1 && (
                                   <span className="relative">
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setActiveClientPopoverId(activeClientPopoverId === c._id ? null : c._id);
                                       }}
                                       className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md border border-blue-200 transition whitespace-nowrap cursor-pointer select-none"
                                     >
                                       +{c.submissions.length - 1} more
                                     </button>
                                     {activeClientPopoverId === c._id && (
                                       <div
                                         className="absolute left-0 mt-1 z-[99] min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 flex flex-col gap-1.5"
                                         onClick={(e) => e.stopPropagation()}
                                       >
                                         <div className="text-[9px] font-black text-slate-400 border-b pb-1 uppercase tracking-wider">
                                           Associated Clients ({c.submissions.length})
                                         </div>
                                         <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto sleek-scrollbar">
                                           {c.submissions.map((sub, idx) => (
                                             <div
                                               key={sub._id}
                                               className={`text-xs font-semibold py-1 px-1.5 rounded flex items-center justify-between gap-3 ${
                                                 idx === c.submissions.length - 1
                                                   ? 'bg-blue-50/50 text-blue-700'
                                                   : 'text-slate-700 hover:bg-slate-50'
                                               }`}
                                             >
                                               <span className="truncate max-w-[110px]" title={sub.clientName}>
                                                 {sub.clientName}
                                               </span>
                                               <Badge variant={getStatusBadgeVariant(sub.status)} className="text-[9px] px-1 py-0 scale-90 whitespace-nowrap">
                                                 {sub.status}
                                               </Badge>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     )}
                                   </span>
                                 )}
                               </div>
                             ) : (
                               '-'
                             )}
                          </td>
                          <td className="p-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(c.dateAdded || c.createdAt)}</td>
                          {!isHidden('totalExperience') && <td className="p-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} ` : '-'}</td>}
                          {(!isHidden('ctc') || !isHidden('ectc')) && (
                            <td className="p-3 text-xs whitespace-nowrap">
                              <div>{!isHidden('ctc') && c.ctc ? `${c.ctc} LPA` : '-'}</div>
                              <div className="text-green-600">{!isHidden('ectc') && c.ectc ? `${c.ectc} LPA` : '-'}</div>
                            </td>
                          )}
                          <td className="p-3 whitespace-nowrap">
                             {c.submissions && c.submissions.length > 0 ? (
                               <Badge variant={getStatusBadgeVariant(c.submissions[c.submissions.length - 1].status)} className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                                 {c.submissions[c.submissions.length - 1].status}
                               </Badge>
                             ) : (
                               '-'
                             )}
                          </td>
                          {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map(cf => (
                            <td key={cf.fieldName} className="p-3 text-xs text-slate-500 truncate max-w-[150px] whitespace-nowrap" title={c.customFields?.[cf.fieldName]}>
                              {c.customFields?.[cf.fieldName] || '-'}
                            </td>
                          ))}
                          <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 hover:border-blue-200 rounded-lg shadow-sm transition-all" title="View Candidate" onClick={(e) => { e.stopPropagation(); openViewDialog(c); }}><Eye className="h-4 w-4" /></button>
                              <button className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 hover:border-indigo-200 rounded-lg shadow-sm transition-all" title="Edit Candidate" onClick={(e) => { e.stopPropagation(); openEditDialog(c); }}><Edit className="h-4 w-4" /></button>
                              <button
                                className={`p-2 border rounded-lg shadow-sm transition-all ${
                                  c.active !== false
                                    ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-100 hover:border-red-200"
                                    : "bg-teal-50 hover:bg-teal-100 text-teal-600 border-teal-100 hover:border-teal-200"
                                }`}
                                title={c.active !== false ? "Deactivate Candidate" : "Activate Candidate"}
                                onClick={(e) => { e.stopPropagation(); toggleActiveStatus(c._id, c.active !== false); }}
                              >
                                {c.active !== false ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    );
                  })}
                </table>
              </div>

              {/* PAGINATION CONTROLS (TABLE) */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-white gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCandidates.length)} of {getFilteredCandidates.length} entries
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedCandidates.map(c => (
                  <div key={c._id} className={`bg-white border rounded-xl hover:shadow-lg transition-all p-6 ${c.active !== false ? "border-slate-200" : "border-red-100 bg-slate-50/50 opacity-90"
                    }`}>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm select-none shrink-0 ${c.active !== false ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 leading-snug">{c.name}</h3>
                          <p className="text-xs text-blue-600 font-mono font-bold tracking-wider">{getCandidateId(c)}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {c.active === false && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider select-none">
                            Inactive
                          </span>
                        )}
                        {c.submissions && c.submissions.length > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            {c.submissions.map(sub => {
                              const styles = getStatusStyles(sub.status);
                              return (
                                <span key={sub._id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border select-none ${styles.bg} ${styles.text} ${styles.border}`} title={`${sub.clientName}: ${sub.status}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                                  <span className="opacity-70">{sub.clientName.slice(0, 4)}:</span> {sub.status}
                                </span>
                              );
                            })}
                          </div>
                        ) : (() => {
                          const currentStatus = c.status[c.status.length - 1] || 'Submitted';
                          const styles = getStatusStyles(currentStatus);
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border select-none ${styles.bg} ${styles.text} ${styles.border}`} title={`${c.client || ''}: ${currentStatus}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                              {c.client && <span className="opacity-70">{c.client.slice(0, 4)}:</span>} {currentStatus}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2"><Building className="h-4 w-4" /> {c.client}</div>
                      <div className="flex items-center gap-2"><Award className="h-4 w-4" /> {formatSkills(c.skills)}</div>
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {c.email}</div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {c.contact}</div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 shadow-sm transition-colors" onClick={() => openViewDialog(c)}>
                        <Eye className="h-4 w-4 mr-1.5" /> View
                      </Button>
                      <Button variant="outline" className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-sm transition-colors" onClick={() => openEditDialog(c)}>
                        <Edit className="h-4 w-4 mr-1.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        className={c.active !== false
                          ? "flex-1 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 shadow-sm transition-colors font-medium"
                          : "flex-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200 hover:border-teal-300 shadow-sm transition-colors font-medium"
                        }
                        onClick={() => toggleActiveStatus(c._id, c.active !== false)}
                      >
                        {c.active !== false ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Ban className="h-4 w-4" />
                            Deactivate
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            Activate
                          </span>
                        )}
                      </Button>
                      <Button variant="outline" className="px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300 shadow-sm transition-colors" onClick={() => handleWhatsApp(c)}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* PAGINATION CONTROLS (GRID) */}
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center p-4 border border-slate-200 rounded-xl bg-white gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCandidates.length)} of {getFilteredCandidates.length} entries
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Delete Confirm Modal */}
      <Modal open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)}>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> Confirm Deletion</ModalTitle>
          <ModalDesc>Are you sure you want to delete <strong>{selectedCandidates.length}</strong> selected candidate(s)? This action cannot be undone.</ModalDesc>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal open={isAddDialogOpen || isEditDialogOpen} onClose={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }} maxWidth="max-w-6xl">
        <ModalHeader>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <div>
              <ModalTitle className="text-2xl font-bold text-slate-900">{isEditDialogOpen ? 'Edit Candidate' : 'Add New Candidate'}</ModalTitle>
              <p className="text-sm text-slate-500 mt-1">{isEditDialogOpen ? 'Update candidate information and details below.' : 'Fill in the information below to add a new candidate to the system.'}</p>
            </div>
            <button onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </ModalHeader>
        <ModalBody>
          {!isEditDialogOpen && (
            <div 
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50/50 mb-6 hover:bg-slate-50 hover:border-blue-300 transition-all cursor-pointer group"
              onClick={() => !isParsingResume && document.getElementById('resume-upload-recruiter')?.click()}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-full text-blue-600 shadow-sm group-hover:scale-105 group-hover:text-blue-700 group-hover:border-blue-200 group-hover:shadow-md transition-all duration-300">
                  <FileUp className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-blue-700 transition-colors">Upload Resume to Auto-Fill</h3>
                  <p className="text-sm text-slate-500 font-medium mb-4">Upload PDF or DOC/DOCX file (max 5MB)</p>
                </div>
                <label htmlFor="resume-upload-recruiter" onClick={(e) => e.stopPropagation()}>
                  <input id="resume-upload-recruiter" type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" disabled={isParsingResume} />
                  <Button type="button" variant="outline" disabled={isParsingResume} onClick={() => document.getElementById('resume-upload-recruiter')?.click()} className="bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 shadow-sm transition-colors border-slate-200 font-semibold px-6">
                    {isParsingResume ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Parsing Data...</> : <><Upload className="mr-2 h-4 w-4" />Browse File</>}
                  </Button>
                </label>
              </div>
            </div>
          )}
          {renderCandidateForm()}

          {isEditDialogOpen && viewingCandidate && (
            <div className="mt-8 border-t pt-6">
              {/* Deliveries & Submissions Section */}
              <div className="bg-slate-50 p-4 rounded-lg space-y-3 col-span-2">
                <h3 className="font-semibold text-slate-800 border-b pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" /> Client Deliveries & Pipeline
                  </div>
                </h3>
                
                {/* List of current deliveries */}
                <div className="space-y-4">
                  {!viewingCandidate.submissions || viewingCandidate.submissions.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No client deliveries recorded for this candidate.</p>
                  ) : (
                    <div className="space-y-4">
                      {viewingCandidate.submissions.map((sub) => (
                        <div key={sub._id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                              <div className="font-bold text-slate-900 text-base">
                                {sub.clientName}
                                {sub.jobId && sub.jobId.position && (
                                  <span className="text-sm font-normal text-slate-500 ml-2">({sub.jobId.position})</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                                  {sub.clientCandidateId || '-'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Delivered: {formatDate(sub.dateAdded || sub.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                              <NativeSelect
                                value={sub.status}
                                onChange={(val) => handleUpdateSubmission(sub._id, val, sub.remarks)}
                                className="w-[160px] h-9 text-xs py-1"
                              >
                                {STATUS_FLOW_ORDER.map(st => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </NativeSelect>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubmission(sub._id)}
                                className="p-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg border border-slate-200 hover:border-red-100 transition shrink-0"
                                title="Retract/Delete Delivery"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Remarks/Notes for this delivery */}
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500">Remarks / Updates</Label>
                            <Input
                              type="text"
                              placeholder="Add feedback/remarks for this client submission..."
                              defaultValue={sub.remarks || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (sub.remarks || '')) {
                                  handleUpdateSubmission(sub._id, sub.status, e.target.value);
                                }
                              }}
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }}>Cancel</Button>
          <Button onClick={() => handleSave(isEditDialogOpen)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isEditDialogOpen ? "Update" : "Save"}
          </Button>
        </ModalFooter>
      </Modal>


      {/* View Modal */}
      {viewingCandidate && (
        <Modal open={isViewDialogOpen} onClose={() => setIsViewDialogOpen(false)} maxWidth="max-w-4xl">
          <ModalHeader>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xl border border-blue-100">
                  {getInitials(viewingCandidate.name)}
                </div>
                <div>
                  <ModalTitle className="text-2xl font-black text-slate-900 tracking-tight">{viewingCandidate.name}</ModalTitle>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">ID: {getCandidateId(viewingCandidate)}</p>
                    <div className="flex gap-1.5">
                      {Array.isArray(viewingCandidate.status) ? viewingCandidate.status.map(s => <Badge key={s} variant={getStatusBadgeVariant(s)} className="text-[10px] uppercase tracking-wider">{s}</Badge>) : <Badge variant={getStatusBadgeVariant(viewingCandidate.status)} className="text-[10px] uppercase tracking-wider">{viewingCandidate.status}</Badge>}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsViewDialogOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-2 rounded-xl">
              <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl space-y-5 hover:shadow-md transition-shadow duration-200">
                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 text-base"><UserCircle className="h-5 w-5 text-blue-600" /> Personal Information</h3>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                  <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email</Label><div className="font-medium text-slate-800 break-all">{viewingCandidate.email}</div></div>
                  <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone</Label>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <div>{viewingCandidate.contact}</div>
                      <button className="text-green-600 hover:text-green-700 bg-green-50 p-1 rounded-full transition-colors" onClick={() => handleWhatsApp(viewingCandidate)}><MessageCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {!isHidden('alternateNumber') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alternate Number</Label><div className="font-medium text-slate-800">{viewingCandidate.alternateNumber || '-'}</div></div>}
                  {!isHidden('dateOfBirth') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date of Birth</Label><div className="font-medium text-slate-800">{formatDate(viewingCandidate.dateOfBirth)}</div></div>}
                  {!isHidden('gender') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gender</Label><div className="font-medium text-slate-800">{viewingCandidate.gender || '-'}</div></div>}
                  {!isHidden('linkedin') && <div className="col-span-2"><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">LinkedIn</Label><div className="font-medium">{viewingCandidate.linkedin ? <a href={viewingCandidate.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"><Linkedin className="h-3.5 w-3.5"/> Profile Link</a> : '-'}</div></div>}
                  {!isHidden('currentLocation') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Location</Label><div className="font-medium text-slate-800">{viewingCandidate.currentLocation || '-'}</div></div>}
                  {!isHidden('preferredLocation') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Preferred Location</Label><div className="font-medium text-slate-800">{viewingCandidate.preferredLocation || '-'}</div></div>}
                </div>
              </div>
              <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl space-y-5 hover:shadow-md transition-shadow duration-200">
                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 text-base"><Briefcase className="h-5 w-5 text-blue-600" /> Professional Details</h3>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                  <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Position</Label><div className="font-bold text-slate-900">{viewingCandidate.position}</div></div>
                  <div className="col-span-2"><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Skills</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Array.isArray(viewingCandidate.skills) ? viewingCandidate.skills.map(s => <Badge key={s} variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 font-semibold">{s}</Badge>) : <span className="font-medium text-slate-800">{viewingCandidate.skills}</span>}
                    </div>
                  </div>


                  {!isHidden('industry') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Industry</Label><div className="font-medium text-slate-800">{viewingCandidate.industry || '-'}</div></div>}
                  {!isHidden('currentCompany') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Company</Label><div className="font-medium text-slate-800">{viewingCandidate.currentCompany || '-'}</div></div>}
                  {!isHidden('totalExperience') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Experience</Label><div className="font-medium text-slate-800 bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100">{viewingCandidate.totalExperience || '-'}</div></div>}
                  {!isHidden('relevantExperience') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Relevant Experience</Label><div className="font-medium text-slate-800">{viewingCandidate.relevantExperience || '-'}</div></div>}
                  {!isHidden('ctc') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current CTC</Label><div className="font-bold text-slate-700">{viewingCandidate.ctc ? `${viewingCandidate.ctc} LPA` : '-'}</div></div>}
                  {!isHidden('ectc') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expected CTC</Label><div className="font-bold text-green-600">{viewingCandidate.ectc ? `${viewingCandidate.ectc} LPA` : '-'}</div></div>}
                  {!isHidden('currentTakeHome') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Take Home</Label><div className="font-medium text-slate-800">{viewingCandidate.currentTakeHome || '-'}</div></div>}
                  {!isHidden('expectedTakeHome') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expected Take Home</Label><div className="font-medium text-slate-800">{viewingCandidate.expectedTakeHome || '-'}</div></div>}
                  {!isHidden('noticePeriod') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Notice Period</Label><div className="font-medium text-slate-800">{viewingCandidate.noticePeriod || '-'}</div></div>}
                  {!isHidden('servingNoticePeriod') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Serving Notice</Label><div>{viewingCandidate.servingNoticePeriod ? <Badge className="bg-amber-100 text-amber-800">Yes</Badge> : <span className="font-medium text-slate-800">No</span>}</div></div>}
                  {!isHidden('lwd') && viewingCandidate.servingNoticePeriod && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">LWD</Label><div className="font-medium text-slate-800">{formatDate(viewingCandidate.lwd)}</div></div>}
                  {!isHidden('offersInHand') && <div><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Offers In Hand</Label><div>{viewingCandidate.offersInHand ? <Badge className="bg-green-100 text-green-800 border border-green-200">Yes ({viewingCandidate.offerPackage || '-'})</Badge> : <span className="font-medium text-slate-800">No</span>}</div></div>}
                  {!isHidden('reasonForChange') && <div className="col-span-2"><Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason For Change</Label><div className="font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">{viewingCandidate.reasonForChange || '-'}</div></div>}

                </div>
              </div>
              {!isHidden('education') && viewingCandidate.education && (
                <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl space-y-4 col-span-2 hover:shadow-md transition-shadow duration-200">
                  <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 text-base"><GraduationCap className="h-5 w-5 text-blue-600" /> Education</h3>
                  <div className="text-sm">
                    <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Qualification</Label>
                    <div className="font-medium text-slate-800">{viewingCandidate.education}</div>
                  </div>
                </div>
              )}
              {viewingCandidate.submissions && viewingCandidate.submissions.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl space-y-4 col-span-2 hover:shadow-md transition-shadow duration-200">
                  <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 text-base">
                    <Building className="h-5 w-5 text-blue-600" /> Client Deliveries & Pipeline
                  </h3>
                  <div className="flex flex-col gap-4 mt-2">
                    {viewingCandidate.submissions.map(sub => {
                      const pipelineSteps = ['Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups', 'Selected', 'Joined'];
                      const isFailure = ['Rejected', 'No Show', 'Backout', 'Hold'].includes(sub.status);
                      const currentIndex = pipelineSteps.indexOf(sub.status);

                      return (
                        <div key={sub._id} className="border border-slate-200 bg-white p-4 rounded-xl shadow-sm">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                            <div>
                              <div className="font-bold text-slate-900">
                                {sub.clientName}
                                {sub.jobId && sub.jobId.position && (
                                  <span className="text-xs font-normal text-slate-500 ml-2">({sub.jobId.position})</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                ID: <span className="font-semibold text-blue-600">{sub.clientCandidateId || '-'}</span> • Date: {formatDate(sub.dateAdded || sub.createdAt)}
                              </div>
                            </div>
                            <Badge variant={getStatusBadgeVariant(sub.status)}>{sub.status}</Badge>
                          </div>

                          <div className="relative pt-4 pb-2 px-2 hidden sm:block">
                            <div className="absolute top-7 left-4 right-4 h-1 bg-slate-100 rounded-full z-0"></div>
                            
                            <div className="relative flex justify-between z-10">
                              {pipelineSteps.map((step, idx) => {
                                let isActive = false;
                                let isPast = false;
                                
                                if (currentIndex !== -1) {
                                  isActive = idx === currentIndex;
                                  isPast = idx < currentIndex;
                                } else {
                                  if (idx === 0) isPast = true;
                                }
                                
                                const isCompleted = isPast || isActive;
                                
                                return (
                                  <div key={step} className="flex flex-col items-center gap-2 w-16 relative">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold bg-white transition-colors duration-300 z-10 ${
                                      isCompleted ? 'border-blue-500 text-blue-600' : 'border-slate-200 text-slate-300'
                                    }`}>
                                      {isPast ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : idx + 1}
                                    </div>
                                    <span className={`text-[10px] text-center font-medium leading-tight ${
                                      isCompleted ? 'text-slate-800' : 'text-slate-400'
                                    }`}>
                                      {step}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {isFailure && (
                            <div className="mt-4 px-3 py-2 bg-red-50/50 border border-red-100 rounded-lg text-xs flex items-center justify-center gap-2 text-red-600 font-medium">
                              <Ban className="w-3.5 h-3.5" /> Pipeline stopped: {sub.status}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl space-y-4 col-span-2 hover:shadow-md transition-shadow duration-200">
                  <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 text-base"><Settings2 className="h-5 w-5 text-blue-600" /> Additional Details</h3>
                  <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                    {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map(cf => (
                      <div key={cf.fieldName}>
                        <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{cf.fieldName}</Label>
                        <div className="font-medium text-slate-800">{viewingCandidate.customFields?.[cf.fieldName] || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewingCandidate); }}>Edit Candidate</Button>
          </ModalFooter>
        </Modal>
      )}

      {/* ─── Form Settings Modal ────────────────────────────────────────────── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">

            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-zinc-500" />
                  Candidate Form Settings
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Customize visible fields and add custom fields for candidate profiles.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white font-bold text-2xl leading-none px-2"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-zinc-800 dark:text-zinc-300">

              {/* Section 1: Toggle Visibility of Standard Optional Fields */}
              <section>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-wider">
                  Standard Fields Visibility
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  Uncheck fields you don't need. Required fields (First Name, Last Name, Email, Phone, Role/Position, Client, Skills, Status, Date Added) cannot be hidden.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {OPTIONAL_STANDARD_FIELDS.map((field) => {
                    const isHiddenField = tempHiddenFields.includes(field.id);
                    return (
                      <label
                        key={field.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
                          !isHiddenField
                            ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!isHiddenField}
                          onChange={() => handleToggleHiddenField(field.id)}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-500 cursor-pointer"
                        />
                        <span className={`text-sm font-medium ${!isHiddenField ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 line-through'}`}>
                          {field.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <hr className="border-zinc-200 dark:border-zinc-800" />

              {/* Section 2: Custom Fields */}
              <section>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-wider">
                  Custom Fields
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  Add new fields specific to your candidate tracking process.
                </p>

                {/* Add / Edit Input Row */}
                <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 rounded-xl border mb-4 transition-colors ${
                  editingFieldIndex !== null
                    ? 'bg-zinc-100 dark:bg-zinc-800/30 border-zinc-400'
                    : 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800'
                }`}>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Field Name</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddOrUpdateCustomField(); }}
                      placeholder="e.g. Passport Number, PAN Card"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100 ${
                        editingFieldIndex !== null ? 'border-zinc-400' : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Field Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100 ${
                        editingFieldIndex !== null ? 'border-zinc-400' : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      <option value="text">Text (Short Answer)</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes / No</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-auto sm:self-end flex flex-col gap-1.5">
                    <button
                      onClick={handleAddOrUpdateCustomField}
                      className="w-full flex items-center justify-center gap-2 text-white bg-zinc-900 dark:bg-white dark:text-zinc-950 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
                    >
                      {editingFieldIndex !== null ? <><Check className="w-4 h-4" /> Update</> : <><Plus className="w-4 h-4" /> Add</>}
                    </button>
                    {editingFieldIndex !== null && (
                      <button
                        onClick={() => { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }}
                        className="text-xs text-center text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Fields List */}
                {tempCustomFields.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10 text-sm">
                    No custom fields added yet. Use the form above to add your first one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {tempCustomFields.map((field, index) => {
                      const isHiddenField = tempHiddenFields.includes(field.fieldName);
                      const isEditing = editingFieldIndex === index;
                      return (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors select-none ${
                            isEditing
                              ? 'border-zinc-500 bg-zinc-100 dark:bg-zinc-800'
                              : !isHiddenField
                                ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
                                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-60'
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!isHiddenField}
                              onChange={() => handleToggleHiddenField(field.fieldName)}
                              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className={`text-sm font-medium block truncate ${!isHiddenField ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 line-through'}`}>
                                {field.fieldName}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                                {field.fieldType}
                              </span>
                            </div>
                          </label>
                          <div className="flex gap-0.5 ml-2 shrink-0">
                            <button
                              onClick={() => handleEditCustomField(index)}
                              className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded transition"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveCustomField(index)}
                              className="p-1 text-zinc-400 hover:text-red-500 rounded transition"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50"
              >
                {isSavingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Import Preview Modal ───────────────────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">

            {/* Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Import Candidates Preview
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Supported formats: <span className="font-semibold">.xlsx, .xls, .csv</span>
                </p>
              </div>
              <button onClick={() => { resetImportState(); setIsImportModalOpen(false); }} className="text-zinc-400 hover:text-zinc-700 font-bold text-2xl leading-none px-2">×</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Top action bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={downloadCandidateTemplate}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition"
                >
                  <Download className="w-4 h-4" /> Download Sample Template
                </button>
                {importParsedData && !isImporting && !importResult && (
                  <button
                    onClick={() => { setImportParsedData(null); setImportFileName(''); setImportParseProgress(0); if (importFileInputRef.current) importFileInputRef.current.value = ''; }}
                    className="text-xs text-zinc-500 hover:text-zinc-700 underline transition"
                  >
                    Upload a different file
                  </button>
                )}
              </div>

              {/* Required fields info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wider">Required Columns (★) — all other Add Candidate fields are accepted in any order</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'First Name ★', hint: 'or "Full Name"' },
                    { label: 'Email ★',      hint: '"Email Address", "E-Mail"' },
                    { label: 'Phone ★',      hint: '"Mobile", "Contact" (10 digits)' },
                    { label: 'Position ★',   hint: '"Role", "Job Title", "Designation"' },
                  ].map(({ label, hint }) => (
                    <div key={label} className="flex flex-col bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-xs min-w-fit">
                      <span className="font-semibold text-blue-800">{label}</span>
                      <span className="text-blue-500">{hint}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-blue-500 mt-2">
                  Columns can be in <span className="font-semibold">any order</span>. Column names are matched automatically (fuzzy). Missing required fields will mark the row as invalid.
                </p>
              </div>

              {/* Drag & drop zone — shown when no file parsed yet */}
              {!importParsedData && !isParsing && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                  onDragLeave={() => setImportDragOver(false)}
                  onDrop={handleImportDrop}
                  onClick={() => importFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    importDragOver
                      ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                      : 'border-zinc-300 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                >
                  <FileSpreadsheet className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                  <p className="font-semibold text-zinc-600">
                    {importDragOver ? 'Drop your file here!' : 'Drag & drop your Excel/CSV file here'}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">or click to browse — .xlsx, .xls, .csv (max 10 MB)</p>
                </div>
              )}

              {/* Parsing progress */}
              {isParsing && (
                <div className="space-y-3 py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                  <p className="text-sm font-medium text-zinc-600">Parsing <span className="font-bold">{importFileName}</span>...</p>
                  <div className="w-full bg-zinc-100 rounded-full h-2 max-w-sm mx-auto overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${importParseProgress}%` }} />
                  </div>
                  <p className="text-xs text-zinc-400">{importParseProgress}%</p>
                </div>
              )}

              {/* After parsing: summary bar + preview table */}
              {importParsedData && !isParsing && (
                <>
                  <div className="flex flex-wrap gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-sm">
                    <span className="text-zinc-700">
                      Total: <span className="font-bold text-zinc-900">{importParsedData.totalCount}</span>
                    </span>
                    <span className="text-emerald-700">
                      Valid: <span className="font-bold">{importParsedData.validRows.length}</span>
                    </span>
                    <span className="text-red-600">
                      Invalid: <span className="font-bold">{importParsedData.invalidRows.length}</span>
                    </span>
                    {importParsedData.invalidRows.length > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium self-center">
                        Only valid rows will be imported
                      </span>
                    )}
                    <span className="text-zinc-400 text-xs self-center ml-auto">File: {importFileName}</span>
                  </div>

                  <div className="w-full overflow-x-auto rounded-xl border border-zinc-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200">
                        <tr>
                          <th className="px-3 py-2 w-12">#Row</th>
                          <th className="px-3 py-2">Candidate Name</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Position</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importParsedData.allRows.slice(0, 200).map((row, idx) => (
                          <tr
                            key={idx}
                            className={row.valid
                              ? 'bg-emerald-50/40 border-b border-emerald-100 hover:bg-emerald-50'
                              : 'bg-red-50/50 border-b border-red-100 hover:bg-red-50'
                            }
                          >
                            <td className="px-3 py-2 text-zinc-400">{row._rowNum}</td>
                            <td className="px-3 py-2 font-medium text-zinc-800">
                              {`${row.firstName || ''} ${row.lastName || ''}`.trim() || '—'}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{row.email || '—'}</td>
                            <td className="px-3 py-2 text-zinc-600">{row.contact || '—'}</td>
                            <td className="px-3 py-2 text-zinc-600">{row.position || '—'}</td>
                            <td className="px-3 py-2">
                              {row.valid
                                ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Valid</span>
                                : <span className="text-red-600 font-medium">{row.errors.join('; ')}</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importParsedData.totalCount > 200 && (
                      <div className="text-center py-2 text-xs text-zinc-400 bg-zinc-50 border-t border-zinc-200">
                        Showing first 200 of {importParsedData.totalCount} rows — all will be processed on import.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Post-import result */}
              {importResult && (
                <div className={`rounded-xl p-4 border text-sm space-y-2 ${
                  importResult.failedRecords === 0 && importResult.duplicatesSkipped === 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <p className="font-bold text-zinc-800 text-base">Import Complete</p>
                  <div className="flex flex-wrap gap-5">
                    <span className="text-emerald-700">
                      <span className="font-bold text-xl">{importResult.importedSuccessfully}</span> imported
                    </span>
                    {importResult.duplicatesSkipped > 0 && (
                      <span className="text-amber-700">
                        <span className="font-bold text-xl">{importResult.duplicatesSkipped}</span> duplicates skipped
                      </span>
                    )}
                    {importResult.failedRecords > 0 && (
                      <span className="text-red-600">
                        <span className="font-bold text-xl">{importResult.failedRecords}</span> failed
                      </span>
                    )}
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition mt-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Error Report (.xlsx)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center gap-3 shrink-0">
              <button
                onClick={() => { resetImportState(); setIsImportModalOpen(false); }}
                className="px-5 py-2.5 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition"
              >
                {importResult ? 'Close' : 'Cancel'}
              </button>
              {!importResult && importParsedData && (
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting || importParsedData.validRows.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                    : <><FileSpreadsheet className="h-4 w-4" /> Confirm Import ({importParsedData.validRows.length} valid rows)</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
const StatCard = ({ title, value, color, active, onClick }) => {
  const styles = {
    blue: "border-l-blue-500 text-blue-600 bg-blue-50/50",
    cyan: "border-l-cyan-500 text-cyan-600 bg-cyan-50/50",
    purple: "border-l-purple-500 text-purple-600 bg-purple-50/50",
    indigo: "border-l-indigo-500 text-indigo-600 bg-indigo-50/50",
    rose: "border-l-rose-500 text-rose-600 bg-rose-50/50",
    green: "border-l-green-500 text-green-600 bg-green-50/50",
    emerald: "border-l-emerald-500 text-emerald-600 bg-emerald-50/50",
    red: "border-l-red-500 text-red-600 bg-red-50/50",
    orange: "border-l-orange-500 text-orange-600 bg-orange-50/50",
    amber: "border-l-amber-500 text-amber-600 bg-amber-50/50",
  };
  const currentStyle = styles[color] || styles.blue;
  return (
    <div onClick={onClick} className={`p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 cursor-pointer relative overflow-hidden bg-white ${currentStyle} ${active ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h3 className="text-2xl font-bold">{value}</h3>
          <p className="text-sm font-medium opacity-80">{title}</p>
        </div>
      </div>
      {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />}
    </div>
  );
};