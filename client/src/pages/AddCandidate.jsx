import { useState, useEffect, useMemo, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import {
  Search, Plus, Eye, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Users, Download,
  X, Edit, Trash2, Calendar, ChevronDown,
  CheckCircle2, FileText, Sparkles, Settings2, Check, GripVertical,
  Clock, Ban, FileSpreadsheet, Building, Award, Briefcase
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


// ── ENV Config ────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

const getAuthHeader = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const token = stored ? JSON.parse(stored)?.idToken : null;
    return {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

const getCurrentUser = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getTenantSettings = () => {
  const user = getCurrentUser();
  return user?.candidateSettings || { hiddenFields: [], customFields: [] };
};

const inputCls = (err) =>
  `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
  } bg-white dark:bg-slate-800`;

// ── Optional Fields that can be hidden ────────────────────────────────────────
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

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, colorTheme, active, onClick, icon: Icon }) => {
  const themes = {
    overall: 'from-blue-600 to-blue-700 text-white shadow-blue-200',
    shared: 'from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200 shadow-indigo-100',
    turnups: 'from-purple-50 to-purple-100 text-purple-700 border-purple-200 shadow-purple-100',
    noshow: 'from-slate-100 to-slate-200 text-slate-700 border-slate-300 shadow-slate-100',
    yetToAttend: 'from-violet-50 to-violet-100 text-violet-700 border-violet-200 shadow-violet-100',
    selected: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 shadow-emerald-100',
    joined: 'from-teal-50 to-teal-100 text-teal-800 border-teal-200 shadow-teal-100',
    rejected: 'from-red-50 to-red-100 text-red-700 border-red-200 shadow-red-100',
    backout: 'from-rose-50 to-rose-100 text-rose-700 border-rose-200 shadow-rose-100',
    hold: 'from-amber-50 to-amber-100 text-amber-700 border-amber-200 shadow-amber-100',
    pipeline: 'from-orange-50 to-orange-100 text-orange-700 border-orange-200 shadow-orange-100',
    today: 'from-cyan-50 to-cyan-100 text-cyan-700 border-cyan-200 shadow-cyan-100',
  };
  const themeClass = themes[colorTheme] || themes.overall;
  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-2xl border overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-gradient-to-br ${themeClass} ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-offset-2 ring-blue-400 scale-[1.03] shadow-lg' : 'shadow-sm'}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-black tracking-tight">{value}</h3>
          <p className="text-xs mt-1 font-bold uppercase tracking-wider opacity-80">{title}</p>
        </div>
        {Icon && (
          <div className={`p-2 rounded-xl ${colorTheme === 'overall' ? 'bg-white/20' : 'bg-white/50 shadow-sm'}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {/* Decorative background element */}
      <div className="absolute -bottom-2 -right-2 opacity-10">
        {Icon && <Icon className="h-12 w-12" />}
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCandidateId = (c) => c.candidateId || c._id?.substring(c._id.length - 6).toUpperCase();
const getStatusBadgeColor = (s) => {
  const low = (s || '').toLowerCase();
  if (low.includes('joined') || low.includes('selected')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (low.includes('rejected') || low.includes('backout') || low.includes('no show')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (low.includes('hold')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (low.includes('pipeline')) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (low.includes('shared')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (low.includes('attend') || low.includes('turnup')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};
const getSafeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && d.length >= 10) return d.substring(0, 10);
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
};

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
                  <Check className="h-3.5 w-3.5 text-white" />
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

const getStatusDotColor = (s) => {
  if (['Joined', 'Selected'].includes(s)) return 'bg-emerald-500';
  if (['Rejected', 'Backout', 'No Show'].includes(s)) return 'bg-red-500';
  if (['Turnups'].includes(s)) return 'bg-purple-500';
  if (['Shared Profiles'].includes(s)) return 'bg-blue-500';
  if (['Pipeline'].includes(s)) return 'bg-amber-500';
  if (['Hold'].includes(s)) return 'bg-orange-500';
  return 'bg-slate-400';
};

const getRecruiterName = (r) => {
  if (!r) return 'Unassigned';
  if (r.firstName && r.lastName) return r.firstName + " " + r.lastName;
  if (r.username) return r.username;
  if (r.name) return r.name.split(' ')[0];
  return r.email || 'Unknown';
};
const getRecruiterLabel = (r) => {
  const name = getRecruiterName(r);
  const roleTag = r.role === 'admin' ? ' (Admin)' : r.role === 'manager' ? ' (Manager)' : '';
  return `${name}${roleTag}`;
};

const STATUS_FLOW_ORDER = [
  'Pipeline', 'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'Selected', 'Hold', 'Rejected', 'No Show', 'Backout', 'Joined'
];

const ALL_STATUSES = [...STATUS_FLOW_ORDER];
const SOURCES = ['LinkedIn', 'Naukri', 'Indeed', 'Portal', 'Referral', 'Other'];
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

// ── CustomFieldInput — renders the right input for a custom field type ────────
const CustomFieldInput = ({ cf, value, onChange }) => {
  if (cf.fieldType === 'boolean') {
    return (
      <select value={value || 'false'} onChange={(e) => onChange(cf.fieldName, e.target.value)} className={inputCls(false)}>
        <option value="false">No</option>
        <option value="true">Yes</option>
      </select>
    );
  }
  return (
    <input
      type={cf.fieldType === 'date' ? 'date' : cf.fieldType === 'number' ? 'number' : 'text'}
      value={value || ''}
      onChange={(e) => onChange(cf.fieldName, e.target.value)}
      className={inputCls(false)}
      placeholder={`Enter ${cf.fieldName}…`}
    />
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminCandidates() {
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const isManagerOrAdmin = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  // ── Data State ────────────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState({ show: false, fileName: '', fieldsCount: 0 });
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [selectedDeliverClientId, setSelectedDeliverClientId] = useState('');

  const filteredJobs = useMemo(() => {
    if (!selectedDeliverClientId) return [];
    const client = clients.find(c => c._id === selectedDeliverClientId);
    if (!client) return [];
    return jobs.filter(j => j.clientName === client.companyName);
  }, [selectedDeliverClientId, clients, jobs]);

  // ── Filter / Sort / Pagination State ─────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── Tenant Settings (live, so changes reflect immediately) ────────────────
  const [tenantSettings, setTenantSettings] = useState(getTenantSettings);
  const hiddenFields = tenantSettings.hiddenFields || [];
  const tenantCustomFields = tenantSettings.customFields || [];
  const isHidden = (fieldName) => hiddenFields.includes(fieldName);

  // ── Settings Modal State ──────────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempHiddenFields, setTempHiddenFields] = useState([]);
  const [tempCustomFields, setTempCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ── Dialog State ──────────────────────────────────────────────────────────
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [viewCandidate, setViewCandidate] = useState(null);
  const [errors, setErrors] = useState({});
  const [isTodaySubOpen, setIsTodaySubOpen] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [bulkRecruiterId, setBulkRecruiterId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [activeClientPopoverId, setActiveClientPopoverId] = useState(null);
  const [activeStatusPopoverId, setActiveStatusPopoverId] = useState(null);

  // ── Bulk Import State ────────────────────────────────────────────────────
  const importFileInputRef = useRef(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importParsedData, setImportParsedData] = useState(null);
  const [importParseProgress, setImportParseProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importFileName, setImportFileName] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const initialFormData = {
    firstName: '', lastName: '', contact: '', alternateNumber: '', email: '',
    dateOfBirth: '', dateAdded: todayStr, gender: '', linkedin: '',
    currentLocation: '', preferredLocation: '', position: '', positionOther: '', client: '', clientCandidateId: '',
    currentCompany: '', industry: '', totalExperienceYears: '0', totalExperienceMonths: '0',
    relevantExperienceYears: '0', relevantExperienceMonths: '0',
    totalExperience: '', relevantExperience: '', education: '',
    ctc: '', currentTakeHome: '', ectc: '', expectedTakeHome: '',
    noticePeriod: '', servingNoticePeriod: 'false', lwd: '',
    reasonForChange: '', offersInHand: 'false', offerPackage: '', source: 'Portal',
    recruiterId: '', status: ['Submitted'],
    skills: '', remarks: '',
    customFields: {},
  };
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, roleSearchTerm, statusFilter, recruiterFilter, clientFilter, activeStatFilter]);

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const [resCand, resRec, resCli, resJobs] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
        fetch(`${API_URL}/jobs`, { headers }),
      ]);
      if (resCand.ok) setCandidates(await resCand.json());
      if (resRec.ok) {
        const data = await resRec.json();
        setRecruiters(data.sort((a, b) => {
          const order = { admin: 0, manager: 1, recruiter: 2 };
          return (order[a.role] ?? 3) - (order[b.role] ?? 3);
        }));
      }
      if (resCli.ok) setClients(await resCli.json());
      if (resJobs.ok) {
        const data = await resJobs.json();
        setJobs(Array.isArray(data) ? data : data.jobs || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveClientPopoverId(null);
      setActiveStatusPopoverId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // ── Form Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (field, value) => {
    let newValue = value;
    if (field === 'contact' || field === 'alternateNumber') {
      newValue = value.replace(/\D/g, '').slice(0, 10);
    } else if (field === 'firstName' || field === 'lastName') {
      newValue = value.replace(/[0-9]/g, '');
    } else if (field === 'ctc' || field === 'ectc') {
      newValue = value.replace(/[^0-9.]/g, '');
      const parts = newValue.split('.');
      if (parts.length > 2) newValue = parts[0] + '.' + parts.slice(1).join('');
      if (newValue !== '' && !isNaN(newValue) && parseFloat(newValue) > 50) newValue = '50';
    }

    // For years/months, we update the composite fields too
    setFormData((prev) => {
      const next = { ...prev, [field]: newValue };
      if (field.startsWith('totalExperience')) {
        next.totalExperience = `${next.totalExperienceYears} yrs ${next.totalExperienceMonths} months`;
      }
      if (field.startsWith('relevantExperience')) {
        next.relevantExperience = `${next.relevantExperienceYears} yrs ${next.relevantExperienceMonths} months`;
      }
      return next;
    });

    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldName]: value },
    }));
  };

  const addStatus = (newStatus) => {
    if (!newStatus) return;
    if (newStatus === 'SELECT_ALL') {
      setFormData((prev) => ({ ...prev, status: [...ALL_STATUSES] }));
    } else if (!formData.status.includes(newStatus)) {
      setFormData((prev) => ({ ...prev, status: [...prev.status, newStatus] }));
    }
    if (errors.status) setErrors((prev) => { const n = { ...prev }; delete n.status; return n; });
  };
  const removeStatus = (s) => setFormData((prev) => ({ ...prev, status: prev.status.filter(x => x !== s) }));

  // ── Duplicate Checks ──────────────────────────────────────────────────────
  const checkEmailDuplicate = async (email) => {
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return;
    setIsCheckingEmail(true);
    try {
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(email.trim())}${excludeParam}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (data.exists) setErrors((prev) => ({ ...prev, email: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
    } catch { /* ignore */ } finally { setIsCheckingEmail(false); }
  };

  const checkPhoneDuplicate = async (phone) => {
    const digits = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    if (!digits || digits.length !== 10) return;
    setIsCheckingPhone(true);
    try {
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (data.exists) setErrors((prev) => ({ ...prev, contact: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
    } catch { /* ignore */ } finally { setIsCheckingPhone(false); }
  };

  // ── Resume Upload ─────────────────────────────────────────────────────────
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
      return;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExt = ['.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(file.type) && !validExt.includes(fileExt)) {
      toast({ title: 'Error', description: 'Only PDF, DOC, DOCX supported.', variant: 'destructive' });
      return;
    }
    setIsParsingResume(true);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const headers = getAuthHeader();
      delete headers['Content-Type'];
      const res = await fetch(`${API_URL}/candidates/parse-resume`, { method: 'POST', headers, body: fd });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || 'Failed to parse resume');

      const { data } = result;
      let fName = '', lName = '';
      if (data.name) {
        const parts = data.name.trim().split(' ');
        fName = parts[0] || '';
        lName = parts.slice(1).join(' ') || '';
      }

      let filledCount = 0;
      const updates = {};
      if (fName) { updates.firstName = fName; filledCount++; }
      if (lName) { updates.lastName = lName; filledCount++; }
      if (data.email) { updates.email = data.email; filledCount++; }
      if (data.contact) { updates.contact = data.contact; filledCount++; }
      if (data.skills) { updates.skills = data.skills; filledCount++; }
      if (data.totalExperience) { updates.totalExperience = data.totalExperience; filledCount++; }
      if (data.position) { updates.position = data.position; filledCount++; }

      setFormData((prev) => ({ ...prev, ...updates, resume: file }));
      setResumeSuccess({ show: true, fileName: file.name, fieldsCount: filledCount });
      setTimeout(() => setResumeSuccess((s) => ({ ...s, show: false })), 5000);
    } catch (err) {
      toast({ title: 'Parse failed', description: err.message || 'Could not parse resume', variant: 'destructive' });
    } finally {
      setIsParsingResume(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    const d = formData;
    const e = {};
    if (!d.firstName?.trim()) e.firstName = 'First name is required';
    if (!d.lastName?.trim()) e.lastName = 'Last name is required';
    if (!d.contact?.trim()) e.contact = 'Contact number is required';
    else if (!/^\d{10}$/.test(d.contact.replace(/\D/g, '').slice(-10))) e.contact = 'Enter a valid 10-digit phone number';
    if (!d.email?.trim()) e.email = 'Email is required';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d.email.trim())) e.email = 'Enter a valid email address';
    if (!d.position?.trim()) e.position = 'Position is required';
    // client is no longer required as a flat field
    if (!d.skills?.trim()) e.skills = 'At least one skill is required';
    if (!d.status || d.status.length === 0) e.status = 'At least one status is required';
    if (!d.dateAdded) { e.dateAdded = 'Date Added is required'; }
    else if (d.dateAdded > new Date().toLocaleDateString('en-CA')) e.dateAdded = 'Cannot be a future date';
    if (!isHidden('servingNoticePeriod') && d.servingNoticePeriod === 'true' && !d.lwd) e.lwd = 'LWD is required when serving notice period';
    if (!isHidden('offersInHand') && d.offersInHand === 'true' && !d.offerPackage?.trim()) e.offerPackage = 'Package in hand is required';

    if (d.dateOfBirth) {
      const dob = new Date(d.dateOfBirth);
      const age = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) e.dateOfBirth = 'Candidate must be atleast 18 years old';
      else if (age > 100) e.dateOfBirth = 'Please enter a valid date of birth';
    }

    // Experience Comparison
    const totalMonths = parseInt(d.totalExperienceYears || 0) * 12 + parseInt(d.totalExperienceMonths || 0);
    const relevantMonths = parseInt(d.relevantExperienceYears || 0) * 12 + parseInt(d.relevantExperienceMonths || 0);
    if (relevantMonths > totalMonths) {
      e.relevantExperience = 'Relevant experience cannot exceed total experience';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Final duplicate re-check before submit
    if (formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      try {
        const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(formData.email.trim())}${excludeParam}`, { headers: getAuthHeader() });
        const data = await res.json();
        if (data.exists) {
          setErrors((prev) => ({ ...prev, email: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
          toast({ title: 'Duplicate Email', description: 'Email already registered.', variant: 'destructive' });
          return;
        }
      } catch { /* ignore */ }
    }
    if (formData.contact) {
      const digits = formData.contact.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
        try {
          const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: getAuthHeader() });
          const data = await res.json();
          if (data.exists) {
            setErrors((prev) => ({ ...prev, contact: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
            toast({ title: 'Duplicate Phone', description: 'Phone already registered.', variant: 'destructive' });
            return;
          }
        } catch { /* ignore */ }
      }
    }

    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const url = isEditMode ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEditMode ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        offersInHand: formData.offersInHand === 'true',
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
        customFields: JSON.stringify(formData.customFields || {}),
      };

      const fd = new FormData();
      // Append resume file if present
      if (formData.resume instanceof File) fd.append('resume', formData.resume);
      Object.entries(payload).forEach(([key, val]) => {
        if (key === 'resume') return; // already appended above
        if (key === 'status' && Array.isArray(val)) {
          val.forEach(s => fd.append('status', s));
        } else if (val !== undefined && val !== null && val !== '')
          fd.append(key, String(val));
      });

      const headers = getAuthHeader();
      delete headers['Content-Type'];
      const res = await fetch(url, { method, headers, body: fd });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();

      if (isEditMode) {
        setCandidates((prev) => prev.map((c) => c._id === selectedCandidateId ? { ...c, ...saved } : c));
      } else {
        if (selectedDeliverClientId) {
          const jobIdSelect = document.getElementById('deliver-job-select');
          await handleDeliverToClient(selectedDeliverClientId, jobIdSelect ? jobIdSelect.value : '', saved._id);
        } else {
          setCandidates((prev) => [saved, ...prev]);
        }
      }
      toast({ title: 'Success', description: `Candidate ${isEditMode ? 'updated' : 'added'} successfully.` });
      setIsDialogOpen(false);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('e11000')) {
        setErrors((prev) => ({ ...prev, email: 'Email already exists in the database.' }));
        toast({ title: 'Duplicate Email', description: 'Email already registered.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to save candidate.', variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
      setSelectedDeliverClientId('');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this candidate? This cannot be undone.')) return;
    try {
      await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      toast({ title: 'Deleted', description: 'Candidate removed.' });
      setCandidates((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast({ title: 'Error', description: 'Delete failed.', variant: 'destructive' });
    }
  };

  const refreshViewingCandidate = async (candidateId) => {
    try {
      const headers = getAuthHeader();
      const res = await fetch(`${API_URL}/candidates/${candidateId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setViewingCandidate(data);
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
      const headers = getAuthHeader();
      const res = await fetch(`${API_URL}/submissions`, {
        method: 'POST',
        headers,
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
      const headers = getAuthHeader();
      const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
        method: 'PUT',
        headers,
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
      const headers = getAuthHeader();
      const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
        method: 'DELETE',
        headers
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

  // ── Open Dialogs ──────────────────────────────────────────────────────────
  const openAddDialog = () => {
    setIsEditMode(false);
    setSelectedCandidateId(null);
    setSelectedDeliverClientId('');
    setViewingCandidate(null);
    setFormData(initialFormData);
    setErrors({});
    setResumeSuccess({ show: false, fileName: '', fieldsCount: 0 });
    setIsDialogOpen(true);
  };

  const openEditDialog = async (c) => {
    setIsEditMode(true);
    setSelectedCandidateId(c._id);
    setSelectedDeliverClientId('');
    setViewingCandidate(c);
    const jobTitles = jobs.map((j) => j.title || j.jobTitle || j.position || '').filter(Boolean);
    const savedPos = c.position || '';
    const isKnownJob = jobTitles.includes(savedPos);
    setFormData({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      contact: c.contact || '',
      alternateNumber: c.alternateNumber || '',
      email: c.email || '',
      dateOfBirth: c.dateOfBirth ? getSafeDate(c.dateOfBirth) : '',
      dateAdded: c.dateAdded ? getSafeDate(c.dateAdded) : '',
      gender: c.gender || '',
      linkedin: c.linkedin || '',
      currentLocation: c.currentLocation || '',
      preferredLocation: c.preferredLocation || '',
      position: isKnownJob || !savedPos ? savedPos : 'Other',
      positionOther: !isKnownJob && savedPos ? savedPos : '',
      client: c.client || '',
      clientCandidateId: c.clientCandidateId || '',
      currentCompany: c.currentCompany || '',
      industry: c.industry || '',
      totalExperience: c.totalExperience || '',
      totalExperienceYears: (c.totalExperience || '').split('yrs')[0]?.trim() || '0',
      totalExperienceMonths: (c.totalExperience || '').split('yrs')[1]?.replace('months', '')?.trim() || '0',
      relevantExperience: c.relevantExperience || '',
      relevantExperienceYears: (c.relevantExperience || '').split('yrs')[0]?.trim() || '0',
      relevantExperienceMonths: (c.relevantExperience || '').split('yrs')[1]?.replace('months', '')?.trim() || '0',
      education: c.education || '',
      ctc: c.ctc || '',
      currentTakeHome: c.currentTakeHome || '',
      ectc: c.ectc || '',
      expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod || '',
      servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? getSafeDate(c.lwd) : '',
      reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false',
      offerPackage: c.offerPackage || '',
      source: c.source || 'Portal',
      status: (() => {
        if (Array.isArray(c.status)) return c.status;
        if (typeof c.status === 'string') return c.status.split(',').map(s => s.trim()).filter(Boolean);
        return ['Submitted'];
      })(),
      recruiterId: typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId || '',
      skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '',
      remarks: c.remarks || '',
      customFields: c.customFields || {},
    });
    setErrors({});
    setIsDialogOpen(true);

    try {
      const headers = getAuthHeader();
      const res = await fetch(`${API_URL}/candidates/${c._id}`, { headers });
      if (res.ok) {
        setViewingCandidate(await res.json());
      }
    } catch (err) {
      console.error("Error loading details for edit modal:", err);
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const SortIcon = ({ field }) => {
    if (!sortConfig || sortConfig.key !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500" /> : <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
  };

  // ── Filtered / Sorted / Paginated Candidates ──────────────────────────────
  const filteredCandidates = useMemo(() => {
    let result = candidates.filter((c) => {
      const matchSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.candidateId || '').toLowerCase().includes(searchTerm.toLowerCase());
        
      const roleMatch = !roleSearchTerm || 
        (c.position && c.position.toLowerCase().includes(roleSearchTerm.toLowerCase())) ||
        (Array.isArray(c.skills) && c.skills.some(skill => skill.toLowerCase().includes(roleSearchTerm.toLowerCase())));
        
      const statusArr = Array.isArray(c.status) ? c.status : [c.status || ''];
      const matchStatus = statusFilter === 'all' || statusArr.includes(statusFilter);
      const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      const matchRec = recruiterFilter === 'all' || recId === recruiterFilter;
      const matchClient = clientFilter === 'all' || c.client === clientFilter;
      const statMatch = activeStatFilter ? statusArr.includes(activeStatFilter) : true;
      return matchSearch && roleMatch && matchStatus && matchRec && matchClient && statMatch;
    });
    if (sortConfig) {
      result.sort((a, b) => {
        const av = a[sortConfig.key] || '';
        const bv = b[sortConfig.key] || '';
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [candidates, searchTerm, roleSearchTerm, statusFilter, recruiterFilter, clientFilter, activeStatFilter, sortConfig]);

  const stats = useMemo(() => {
    const count = (s) => candidates.filter((c) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s)).length;
    const todayD = getSafeDate(new Date());
    const todayCount = candidates.filter((c) => getSafeDate(c.dateAdded || c.createdAt) === todayD).length;
    return {
      total: candidates.length, turnups: count('Turnups'), noShow: count('No Show'),
      yetToAttend: count('Yet to attend'), selected: count('Selected'), rejected: count('Rejected'),
      hold: count('Hold'), pipeline: count('Pipeline'), joined: count('Joined'), backout: count('Backout'),
      sharedProfiles: count('Shared Profiles'), todaySubmissions: todayCount,
    };
  }, [candidates]);

  const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = filteredCandidates.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (filteredCandidates.length === 0) {
      toast({ title: 'No Data', description: 'Nothing to export.', variant: 'destructive' });
      return;
    }
    try {
      const rows = filteredCandidates.map((c) => {
        const flatCustom = {};
        if (c.customFields) Object.keys(c.customFields).forEach((k) => { flatCustom[`Custom: ${k}`] = c.customFields[k]; });
        return {
          'Candidate ID': c.candidateId || c._id?.slice(-6).toUpperCase() || '',
          'First Name': c.firstName || '',
          'Last Name': c.lastName || '',
          'Full Name': c.name || '',
          'Recruiter': typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '',
          'Email': c.email || '',
          'Contact': c.contact || '',
          'Status': Array.isArray(c.status) ? (c.status[c.status.length - 1] || '') : (c.status || ''),
          'Current Location': c.currentLocation || '',
          'Preferred Location': c.preferredLocation || '',
          'Total Experience': c.totalExperience || '',
          'Relevant Experience': c.relevantExperience || '',
          'Current Company': c.currentCompany || '',
          'Reason For Change': c.reasonForChange || '',
          'Current CTC': c.ctc || '',
          'Current Take Home': c.currentTakeHome || '',
          'Expected CTC': c.ectc || '',
          'Expected Take Home': c.expectedTakeHome || '',
          'Notice Period': c.noticePeriod || '',
          'Serving Notice': c.servingNoticePeriod ? 'Yes' : 'No',
          'LWD': c.lwd ? new Date(c.lwd).toLocaleDateString('en-GB') : '',
          'Offers In Hand': c.offersInHand ? 'Yes' : 'No',
          'Offer Package': c.offerPackage || '',
          'Source': c.source || '',
          'Skills': Array.isArray(c.skills) ? c.skills.join(' | ') : (c.skills || ''),
          'Date Added': (c.dateAdded || c.createdAt) ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB') : '',
          ...flatCustom,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0] || {}).map((key) => ({ wch: Math.max(key.length, ...rows.map((r) => String(r[key] || '').length), 10) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
      XLSX.writeFile(wb, `Candidates_Export_${todayStr}.xlsx`);
      toast({ title: 'Exported!', description: `${rows.length} candidate(s) exported.` });
    } catch {
      toast({ title: 'Export failed', description: 'Could not export file.', variant: 'destructive' });
    }
  };

  // ── Bulk Select ───────────────────────────────────────────────────────────
  const handleSelectAll = (e) => setSelectedIds(e.target.checked ? filteredCandidates.map((c) => c._id) : []);
  const handleSelectOne = (e, id) => setSelectedIds((prev) => e.target.checked ? [...prev, id] : prev.filter((x) => x !== id));

  const handleBulkAssign = async () => {
    if (!bulkRecruiterId) {
      toast({ title: 'Error', description: 'Please select a recruiter first.', variant: 'destructive' });
      return;
    }
    setIsBulkAssigning(true);
    try {
      const res = await fetch(`${API_URL}/candidates/bulk-assign`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({ candidateIds: selectedIds, recruiterId: bulkRecruiterId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast({ title: 'Success', description: data.message });
      setCandidates((prev) => prev.map((c) => selectedIds.includes(c._id) ? { ...c, recruiterId: bulkRecruiterId } : c));
      setSelectedIds([]);
      setBulkRecruiterId('');
    } catch {
      toast({ title: 'Error', description: 'Failed to assign.', variant: 'destructive' });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // ── Settings Modal Functions ──────────────────────────────────────────────
  // ── Bulk Import Handlers ────────────────────────────────────────────────
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

  const openImportModal = () => { resetImportState(); setIsImportModalOpen(true); };

  const processImportFile = async (file) => {
    if (!file) return;
    if (!isValidFileType(file)) {
      toast({ title: 'Invalid file type', description: 'Only .xlsx, .xls, and .csv are supported.', variant: 'destructive' });
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
      const res = await fetch(`${API_URL}/candidates/bulk-import`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ candidates: importParsedData.validRows, fileName: importFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      setImportResult(data);
      toast({ title: 'Import Complete', description: `${data.importedSuccessfully} imported, ${data.failedRecords} failed, ${data.duplicatesSkipped} duplicates skipped.` });
      if (data.importedSuccessfully > 0) fetchData();
    } catch (err) {
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importResult?.errors?.length) return;
    const rows = importResult.errors.map(e => ({ 'Row': e.row, 'Candidate Name': e.candidateName || '', 'Email': e.email || '', 'Reason': e.reason || '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 32 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Errors');
    XLSX.writeFile(wb, `import_errors_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleOpenSettings = () => {
    setTempHiddenFields(tenantSettings.hiddenFields || []);
    setTempCustomFields(tenantSettings.customFields || []);
    setNewFieldName('');
    setNewFieldType('text');
    setEditingFieldIndex(null);
    setIsSettingsOpen(true);
  };

  const handleToggleHiddenField = (fieldId) =>
    setTempHiddenFields((prev) => prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]);

  const handleEditCustomField = (index) => {
    const f = tempCustomFields[index];
    setNewFieldName(f.fieldName);
    setNewFieldType(f.fieldType);
    setEditingFieldIndex(index);
  };

  const handleAddOrUpdateCustomField = () => {
    if (!newFieldName.trim()) {
      toast({ title: 'Error', description: 'Field name is required.', variant: 'destructive' });
      return;
    }
    const isDuplicate = tempCustomFields.some((f, idx) =>
      idx !== editingFieldIndex && f.fieldName.toLowerCase() === newFieldName.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast({ title: 'Error', description: 'A field with this name already exists.', variant: 'destructive' });
      return;
    }
    if (editingFieldIndex !== null) {
      const updated = [...tempCustomFields];
      updated[editingFieldIndex] = { fieldName: newFieldName.trim(), fieldType: newFieldType };
      setTempCustomFields(updated);
      setEditingFieldIndex(null);
    } else {
      setTempCustomFields((prev) => [...prev, { fieldName: newFieldName.trim(), fieldType: newFieldType }]);
    }
    setNewFieldName('');
    setNewFieldType('text');
  };

  const handleRemoveCustomField = (idx) => {
    setTempCustomFields((prev) => prev.filter((_, i) => i !== idx));
    if (editingFieldIndex === idx) { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = { candidateSettings: { hiddenFields: tempHiddenFields, customFields: tempCustomFields } };
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: getAuthHeader(),
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
      setTenantSettings(updatedUser.candidateSettings || payload.candidateSettings);
      setIsSettingsOpen(false);
      toast({ title: 'Saved!', description: 'Candidate form settings updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 pb-48 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="w-full max-w-full mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Candidate Database</h1>
            <p className="text-slate-500 mt-1">Manage and track pipeline across all sources</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isManagerOrAdmin && (
              <button onClick={handleOpenSettings} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-blue-700 transition shadow-sm">
                <Settings2 className="h-4 w-4" /> Form Settings
              </button>
            )}
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
              <Download className="h-4 w-4" /> Export Excel
            </button>
            {/* Import Excel button */}
            <input ref={importFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFileChange} />
            <button onClick={openImportModal} className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-400 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 transition shadow-sm">
              <FileSpreadsheet className="h-4 w-4" /> Import Excel
            </button>
            <button onClick={openAddDialog} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
              <Plus className="h-4 w-4" /> Add Candidate
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Overall" value={stats.total} colorTheme="overall" active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} icon={Users} />
          <StatCard title="Pipeline" value={stats.pipeline} colorTheme="pipeline" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} icon={GripVertical} />
          <StatCard title="Selected" value={stats.selected} colorTheme="selected" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} icon={CheckCircle2} />
          <StatCard title="Joined" value={stats.joined} colorTheme="joined" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} icon={Check} />
          <StatCard title="Turnups" value={stats.turnups} colorTheme="turnups" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} icon={Calendar} />
          <StatCard title="Shared" value={stats.sharedProfiles} colorTheme="shared" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} icon={FileText} />
          <StatCard title="Yet to Attend" value={stats.yetToAttend} colorTheme="yetToAttend" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} icon={Clock} />
          <StatCard title="Hold" value={stats.hold} colorTheme="hold" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} icon={Ban} />
          <StatCard title="Rejected" value={stats.rejected} colorTheme="rejected" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} icon={Trash2} />
          <StatCard title="No Show" value={stats.noShow} colorTheme="noshow" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} icon={X} />
          <StatCard title="Backout" value={stats.backout} colorTheme="backout" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} icon={ArrowDown} />
          <StatCard title="Today" value={stats.todaySubmissions} colorTheme="today" active={false} onClick={() => setIsTodaySubOpen(true)} icon={Sparkles} />
        </div>

        {/* ── Filters ── */}
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white shadow-sm flex flex-col xl:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto flex-1">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, email, ID…" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={roleSearchTerm} onChange={(e) => setRoleSearchTerm(e.target.value)} placeholder="Search job role or skills…" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Clients</option>
              {clients.map((c) => <option key={c._id || c.id} value={c.companyName || c.name}>{c.companyName || c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Status</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Users</option>
              {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
            </select>
          </div>
        </div>

        {/* ── Bulk Action Bar ── */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">{selectedIds.length} Selected</span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <select value={bulkRecruiterId} onChange={(e) => setBulkRecruiterId(e.target.value)} className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]">
                <option value="">Assign to User…</option>
                {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={!bulkRecruiterId || isBulkAssigning} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {isBulkAssigning && <Loader2 className="h-3 w-3 animate-spin" />} Assign Candidates
              </button>
            </div>
            <button onClick={() => setSelectedIds([])} className="ml-auto text-sm text-slate-500 hover:text-slate-800 font-medium px-2 py-1">Clear Selection</button>
          </div>
        )}

        {/* ── Table ── */}
        <style>{`.tbl-scroll::-webkit-scrollbar{height:10px}.tbl-scroll::-webkit-scrollbar-track{background:#e2e8f0;border-radius:10px}.tbl-scroll::-webkit-scrollbar-thumb{background:#475569;border-radius:10px;border:2px solid #e2e8f0}.tbl-scroll::-webkit-scrollbar-thumb:hover{background:#1e293b}.tbl-scroll{scrollbar-width:thin;scrollbar-color:#475569 #e2e8f0}`}</style>
        <div className="w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">
                        <input type="checkbox" checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0} onChange={handleSelectAll} className="rounded border-slate-300 text-blue-600 h-4 w-4 cursor-pointer" />
                      </th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('name')}>Candidate Name <SortIcon field="name" /></th>
                      <th className="px-4 py-3 whitespace-nowrap text-blue-600 font-bold">Recruiter</th>
                      <th className="px-4 py-3 whitespace-nowrap">Client</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date Added</th>
                      {!isHidden('totalExperience') && <th className="px-4 py-3 whitespace-nowrap">Experience</th>}
                      {!isHidden('ctc') && <th className="px-4 py-3 whitespace-nowrap">CTC / ECTC</th>}
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  {paginatedCandidates.map((c) => {
                    const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                    const isSelected = selectedIds.includes(c._id);
                    return (
                      <tbody
                        key={c._id}
                        className="group border-b border-slate-100 last:border-0"
                      >
                        <tr
                          className={`transition-colors ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => handleSelectOne(e, c._id)} className="rounded border-slate-300 text-blue-600 h-4 w-4 cursor-pointer" />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(getCandidateId(c)); toast({ title: 'Copied ID' }); }}>
                            {getCandidateId(c)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-sm border-2 border-white">
                                {c.name ? c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{c.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{c.position || 'No Role'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#283086] font-bold italic">{typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '-'}</td>
                          <td className="px-4 py-3 relative">
                            {c.submissions && c.submissions.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]" title={c.submissions[c.submissions.length - 1].clientName}>
                                  <Building className="h-3 w-3 shrink-0" />
                                  {c.submissions[c.submissions.length - 1].clientName}
                                </span>
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
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border scale-90 whitespace-nowrap ${getStatusBadgeColor(sub.status)}`}>
                                                {sub.status}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-GB') : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '-')}</td>
                          {!isHidden('totalExperience') && <td className="px-4 py-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} ` : '-'}</td>}
                          {!isHidden('ctc') && <td className="px-4 py-3 text-xs whitespace-nowrap"><div>{c.ctc ? `${c.ctc} LPA` : '-'}</div><div className="text-green-600">{c.ectc ? `${c.ectc} LPA` : '-'}</div></td>}
                          <td className="px-4 py-3">
                            {c.submissions && c.submissions.length > 0 ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap overflow-hidden text-ellipsis ${getStatusBadgeColor(c.submissions[c.submissions.length - 1].status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(c.submissions[c.submissions.length - 1].status)} shrink-0`} />
                                {c.submissions[c.submissions.length - 1].status}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center gap-1.5">
                              <button className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 hover:border-blue-200 rounded-lg shadow-sm transition-all" title="View Candidate" onClick={(e) => { e.stopPropagation(); setViewCandidate(c); setIsViewDialogOpen(true); refreshViewingCandidate(c._id); }}><Eye className="h-4 w-4" /></button>
                              <button className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 hover:border-indigo-200 rounded-lg shadow-sm transition-all" title="Edit Candidate" onClick={(e) => { e.stopPropagation(); openEditDialog(c); }}><Edit className="h-4 w-4" /></button>
                              <button className="p-2 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 hover:border-red-200 rounded-lg shadow-sm transition-all" title="Delete Candidate" onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    );
                  })}
                </table>
                {filteredCandidates.length === 0 && !loading && (
                  <div className="text-center py-12 text-slate-500">No candidates match your filters.</div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-slate-100 bg-white gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-500">
                      Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCandidates.length)}</span> of <span className="text-slate-900 font-bold">{filteredCandidates.length}</span> candidates
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage((p) => p - 1)} 
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                      Previous
                    </button>
                    
                    <div className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-sm font-bold shadow-sm">
                      Page {currentPage} <span className="mx-1.5 opacity-50 text-blue-300">/</span> {totalPages}
                    </div>

                    <button 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage((p) => p + 1)} 
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Next
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">

            {/* Dialog Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Candidate' : 'Add New Candidate'}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Fill out all the details for the candidate profile.</p>
              </div>
              <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none px-2">×</button>
            </div>

            {/* Dialog Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-8">

              {/* Resume Success Banner */}
              {resumeSuccess.show && (
                <div style={{ background: 'linear-gradient(to right,#f0fdf4,#ecfdf5,#f0fdf4)', border: '1.5px solid #86efac', borderRadius: '12px', boxShadow: '0 4px 24px rgba(34,197,94,.13)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px' }}>
                    <div style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <Sparkles style={{ width: '14px', height: '14px', color: '#22c55e' }} />
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#14532d', margin: 0 }}>Resume Extracted Successfully!</p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#15803d', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText style={{ width: '12px', height: '12px' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{resumeSuccess.fileName}</span>
                      </p>
                      {resumeSuccess.fieldsCount > 0 && <p style={{ fontSize: '12px', color: '#16a34a', margin: '5px 0 0 0' }}>✓ {resumeSuccess.fieldsCount} field{resumeSuccess.fieldsCount !== 1 ? 's' : ''} auto-filled — review and complete missing details.</p>}
                    </div>
                    <button onClick={() => setResumeSuccess((s) => ({ ...s, show: false }))} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#4ade80', lineHeight: 1 }}>
                      <X style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Upload Resume ── */}
              {!isEditMode && (
                <section>
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Upload Resume (Auto Fill)</h3>
                  <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    {isParsingResume ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                        <p className="text-sm text-blue-800 font-medium">Parsing resume details…</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-3 rounded-full mb-3 shadow-sm border border-blue-100"><Plus className="h-6 w-6 text-blue-600" /></div>
                        <p className="text-sm text-slate-600 mb-4 text-center">Upload a CV to automatically fill candidate details.<br /><span className="text-xs text-slate-400">Supported: PDF, DOC, DOCX (Max 5MB)</span></p>
                        <input type="file" id="resume-upload" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} />
                        <label htmlFor="resume-upload" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer transition shadow-sm">Browse Files</label>
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* ── Personal Information ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">First Name *</label>
                    <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} className={inputCls(errors.firstName)} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Last Name *</label>
                    <input type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} className={inputCls(errors.lastName)} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Contact Number *</label>
                    <div className="relative">
                      <input type="text" value={formData.contact} onChange={(e) => handleInputChange('contact', e.target.value)} onBlur={(e) => checkPhoneDuplicate(e.target.value)} className={inputCls(errors.contact)} maxLength={10} placeholder="10-digit number" />
                      {isCheckingPhone && <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>}
                    </div>
                    {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
                  </div>
                  {!isHidden('alternateNumber') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Alternate Number</label>
                      <input type="text" value={formData.alternateNumber} onChange={(e) => handleInputChange('alternateNumber', e.target.value)} className={inputCls(false)} placeholder="e.g. 9876543210" maxLength={10} />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
                    <div className="relative">
                      <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} onBlur={(e) => checkEmailDuplicate(e.target.value)} className={inputCls(errors.email)} />
                      {isCheckingEmail && <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>}
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  {!isHidden('currentLocation') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Current Location</label>
                      <input type="text" value={formData.currentLocation} onChange={(e) => handleInputChange('currentLocation', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('preferredLocation') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Preferred Location</label>
                      <input type="text" value={formData.preferredLocation} onChange={(e) => handleInputChange('preferredLocation', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('dateOfBirth') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Date of Birth</label>
                      <input type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]} className={inputCls(errors.dateOfBirth)} />
                      {errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Date Added</label>
                    <input type="date" value={formData.dateAdded} onChange={(e) => handleInputChange('dateAdded', e.target.value)} max={todayStr} className={inputCls(errors.dateAdded)} />
                    <p className="text-xs text-slate-400 mt-1">Cannot be a future date. Defaults to today.</p>
                    {errors.dateAdded && <p className="text-xs text-red-500 mt-1">{errors.dateAdded}</p>}
                  </div>
                  {!isHidden('gender') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Gender</label>
                      <select value={formData.gender} onChange={(e) => handleInputChange('gender', e.target.value)} className={inputCls(false)}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Not Specified">Not Specified</option>
                      </select>
                    </div>
                  )}
                  {!isHidden('linkedin') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">LinkedIn URL</label>
                      <input type="text" value={formData.linkedin} onChange={(e) => handleInputChange('linkedin', e.target.value)} className={inputCls(errors.linkedin)} placeholder="https://linkedin.com/in/..." />
                      {errors.linkedin && <p className="text-xs text-red-500 mt-1">{errors.linkedin}</p>}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Professional Details ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Professional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Role (Position) *</label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      className={inputCls(errors.position)}
                      placeholder="e.g. Frontend Developer"
                    />
                    {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                  </div>

                  {!isHidden('currentCompany') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Current Company</label>
                      <input type="text" value={formData.currentCompany} onChange={(e) => handleInputChange('currentCompany', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('industry') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Industry</label>
                      <input type="text" value={formData.industry} onChange={(e) => handleInputChange('industry', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('reasonForChange') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Reason for Change</label>
                      <input type="text" value={formData.reasonForChange} onChange={(e) => handleInputChange('reasonForChange', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('totalExperience') && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Total Experience *</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select value={formData.totalExperienceYears} onChange={(e) => handleInputChange('totalExperienceYears', e.target.value)} className={inputCls(errors.totalExperience)}>
                            {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i} Years</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select value={formData.totalExperienceMonths} onChange={(e) => handleInputChange('totalExperienceMonths', e.target.value)} className={inputCls(errors.totalExperience)}>
                            {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i} Months</option>)}
                          </select>
                        </div>
                      </div>
                      {errors.totalExperience && <p className="text-xs text-red-500 mt-1">{errors.totalExperience}</p>}
                    </div>
                  )}
                  {!isHidden('relevantExperience') && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Relevant Experience</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select value={formData.relevantExperienceYears} onChange={(e) => handleInputChange('relevantExperienceYears', e.target.value)} className={inputCls(false)}>
                            {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i} Years</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select value={formData.relevantExperienceMonths} onChange={(e) => handleInputChange('relevantExperienceMonths', e.target.value)} className={inputCls(errors.relevantExperience)}>
                            {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i} Months</option>)}
                          </select>
                        </div>
                      </div>
                      {errors.relevantExperience && <p className="text-xs text-red-500 mt-1">{errors.relevantExperience}</p>}
                    </div>
                  )}
                  {!isHidden('education') && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Educational Qualification</label>
                      <input type="text" value={formData.education} onChange={(e) => handleInputChange('education', e.target.value)} className={inputCls(false)} placeholder="e.g. B.Tech, MBA..." />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Skills *</label>
                    <div className={`flex flex-wrap gap-2 p-2 border rounded-lg ${errors.skills ? 'border-red-500' : 'border-slate-200'} bg-white focus-within:ring-2 focus-within:ring-blue-500`}>
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
                        placeholder={formData.skills ? "Add more..." : "e.g. React, Node (Press Enter)"}
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
                    {errors.skills && <p className="text-xs text-red-500 mt-1">{errors.skills}</p>}
                  </div>

                  <div className="md:col-span-2 mt-2 bg-blue-50/40 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
                      <Building className="h-4 w-4 text-blue-500" /> Deliver Candidate to Client
                    </h4>
                    {isEditMode && viewingCandidate ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-xs">Client *</label>
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
                          <label className="text-xs">Associated Job *</label>
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
                        <button 
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
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm transition shrink-0"
                        >
                          Deliver Profile
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-500 mb-3">Select an initial client and role to deliver this candidate to upon creation.</p>
                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                          <div className="flex-1 min-w-[200px] space-y-1">
                            <label className="text-xs">Client (Optional)</label>
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
                            <label className="text-xs">Associated Job (Optional)</label>
                            <select 
                              id="deliver-job-select" 
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">{selectedDeliverClientId ? 'No Associated Job' : 'Select a client first'}</option>
                              {filteredJobs.map(j => (
                                <option key={j._id} value={j._id}>{j.position} ({j.jobCode}) - {j.clientName}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Financial & Availability ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Financial & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!isHidden('ctc') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Current CTC</label>
                        <input type="text" value={formData.ctc} onChange={(e) => handleInputChange('ctc', e.target.value)} className={inputCls(false)} placeholder="e.g. 10 LPA" />
                      </div>
                    )}
                    {!isHidden('currentTakeHome') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Current Take Home</label>
                        <input type="text" value={formData.currentTakeHome} onChange={(e) => handleInputChange('currentTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 60k/mo" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!isHidden('ectc') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Expected CTC</label>
                        <input type="text" value={formData.ectc} onChange={(e) => handleInputChange('ectc', e.target.value)} className={inputCls(false)} placeholder="e.g. 15 LPA" />
                      </div>
                    )}
                    {!isHidden('expectedTakeHome') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Expected Take Home</label>
                        <input type="text" value={formData.expectedTakeHome} onChange={(e) => handleInputChange('expectedTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 90k/mo" />
                      </div>
                    )}
                  </div>
                  {!isHidden('noticePeriod') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Notice Period</label>
                      <input type="text" value={formData.noticePeriod} onChange={(e) => handleInputChange('noticePeriod', e.target.value)} className={inputCls(false)} placeholder="e.g. 30 Days" />
                    </div>
                  )}
                  {!isHidden('servingNoticePeriod') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Serving Notice Period?</label>
                      <select value={formData.servingNoticePeriod} onChange={(e) => handleInputChange('servingNoticePeriod', e.target.value)} className={inputCls(false)}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  )}
                  {!isHidden('servingNoticePeriod') && formData.servingNoticePeriod === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">LWD (Last Working Day) *</label>
                      <input type="date" value={formData.lwd} onChange={(e) => handleInputChange('lwd', e.target.value)} className={inputCls(errors.lwd)} />
                      {errors.lwd && <p className="text-xs text-red-500 mt-1">{errors.lwd}</p>}
                    </div>
                  )}
                  {!isHidden('offersInHand') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Offer in Hand?</label>
                      <select value={formData.offersInHand} onChange={(e) => handleInputChange('offersInHand', e.target.value)} className={inputCls(false)}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  )}
                  {!isHidden('offersInHand') && formData.offersInHand === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Package in Hand *</label>
                      <input type="text" value={formData.offerPackage} onChange={(e) => handleInputChange('offerPackage', e.target.value)} className={inputCls(errors.offerPackage)} placeholder="e.g. 15 LPA" />
                      {errors.offerPackage && <p className="text-xs text-red-500 mt-1">{errors.offerPackage}</p>}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Custom Fields (Tenant-defined dynamic fields) ── */}
              {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Additional Details
                    <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).length} custom field{tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).length !== 1 ? 's' : ''}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map((cf, idx) => (
                      <div key={idx}>
                        <label className="block text-sm font-medium mb-1 text-slate-700 flex items-center gap-1.5">
                          {cf.fieldName}
                          <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{cf.fieldType}</span>
                        </label>
                        <CustomFieldInput
                          cf={cf}
                          value={formData.customFields?.[cf.fieldName]}
                          onChange={handleCustomFieldChange}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Tracking & Assignment ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Tracking & Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Source</label>
                    <select value={formData.source} onChange={(e) => handleInputChange('source', e.target.value)} className={inputCls(false)}>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {isManagerOrAdmin && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Assign to User</label>
                      <select value={formData.recruiterId} onChange={(e) => handleInputChange('recruiterId', e.target.value)} className={inputCls(false)}>
                        <option value="">Select User</option>
                        {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Remarks</label>
                    <Textarea value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} className={inputCls(false)} placeholder="Add any comments or remarks here…" rows={3} />
                  </div>
                </div>
              </section>

              {isEditMode && viewingCandidate && (
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
                                  <select
                                    value={sub.status}
                                    onChange={(e) => handleUpdateSubmission(sub._id, e.target.value, sub.remarks)}
                                    className="w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    {STATUS_FLOW_ORDER.map(st => (
                                      <option key={st} value={st}>{st}</option>
                                    ))}
                                  </select>
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
                                <label className="text-xs text-slate-500">Remarks / Updates</label>
                                <input
                                  type="text"
                                  placeholder="Add feedback/remarks for this client submission..."
                                  defaultValue={sub.remarks || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (sub.remarks || '')) {
                                      handleUpdateSubmission(sub._id, sub.status, e.target.value);
                                    }
                                  }}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            </div>

            {/* Dialog Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsDialogOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving…' : isEditMode ? 'Update Profile' : 'Save Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      {isViewDialogOpen && viewCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{viewCandidate.name}</h2>
                <p className="text-sm font-mono text-blue-600 mt-1">{getCandidateId(viewCandidate)}</p>
              </div>
              <button onClick={() => setIsViewDialogOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none px-2">×</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['First Name', viewCandidate.firstName],
                  ['Last Name', viewCandidate.lastName],
                  ['Email', viewCandidate.email],
                  ['Contact', viewCandidate.contact],
                  !isHidden('alternateNumber') && ['Alt Contact', viewCandidate.alternateNumber],
                  !isHidden('gender') && ['Gender', viewCandidate.gender],
                  !isHidden('linkedin') && ['LinkedIn', viewCandidate.linkedin],
                  ['Role', viewCandidate.position],
                  ['Skills', (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Array.isArray(viewCandidate.skills) ? (
                        viewCandidate.skills.map(s => (
                          <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50/50 text-blue-700 border border-blue-200">
                            {s}
                          </span>
                        ))
                      ) : (
                        viewCandidate.skills ? (
                          viewCandidate.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                            <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50/50 text-blue-700 border border-blue-200">
                              {s}
                            </span>
                          ))
                        ) : '-'
                      )}
                    </div>
                  )],
                  ['Client Deliveries', viewCandidate.submissions && viewCandidate.submissions.length > 0 ? (
                    <div className="flex flex-col gap-4 mt-2">
                      {viewCandidate.submissions.map(sub => {
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
                                  ID: <span className="font-semibold text-blue-600">{sub.clientCandidateId || '-'}</span> • Date: {new Date(sub.dateAdded || sub.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadgeColor(sub.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(sub.status)}`} />
                                {sub.status}
                              </span>
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
                                        {isPast ? <Check className="w-4 h-4 text-blue-500" /> : idx + 1}
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
                  ) : 'No client deliveries'],
                  !isHidden('currentCompany') && ['Current Company', viewCandidate.currentCompany],
                  !isHidden('industry') && ['Industry', viewCandidate.industry],
                  !isHidden('currentLocation') && ['Current Location', viewCandidate.currentLocation],
                  !isHidden('preferredLocation') && ['Preferred Location', viewCandidate.preferredLocation],
                  !isHidden('totalExperience') && ['Total Exp', viewCandidate.totalExperience ? `${viewCandidate.totalExperience} Yrs` : null],
                  !isHidden('relevantExperience') && ['Relevant Exp', viewCandidate.relevantExperience ? `${viewCandidate.relevantExperience} Yrs` : null],
                  !isHidden('education') && ['Educational Qualification', viewCandidate.education],
                  !isHidden('ctc') && ['Current CTC', viewCandidate.ctc ? `${viewCandidate.ctc} LPA` : null],
                  !isHidden('currentTakeHome') && ['Current Take Home', viewCandidate.currentTakeHome],
                  !isHidden('ectc') && ['Expected CTC', viewCandidate.ectc ? `${viewCandidate.ectc} LPA` : null],
                  !isHidden('expectedTakeHome') && ['Expected Take Home', viewCandidate.expectedTakeHome],
                  !isHidden('noticePeriod') && ['Notice Period', viewCandidate.noticePeriod],
                  !isHidden('servingNoticePeriod') && ['Serving Notice?', viewCandidate.servingNoticePeriod ? 'Yes' : 'No'],
                  !isHidden('lwd') && ['LWD', viewCandidate.lwd ? new Date(viewCandidate.lwd).toLocaleDateString() : null],
                  !isHidden('reasonForChange') && ['Reason for Change', viewCandidate.reasonForChange],
                  !isHidden('offersInHand') && ['Offers in Hand', viewCandidate.offersInHand ? `Yes${viewCandidate.offerPackage ? ` (${viewCandidate.offerPackage})` : ''}` : 'No'],
                  ['Source', viewCandidate.source],
                  ['Recruiter', typeof viewCandidate.recruiterId === 'object' ? getRecruiterName(viewCandidate.recruiterId) : viewCandidate.recruiterName],
                  ['Remarks', viewCandidate.remarks],
                  // Custom fields
                  ...(viewCandidate.customFields ? Object.entries(viewCandidate.customFields).map(([k, v]) => [k, v]) : []),
                ].filter(Boolean).map(([label, val]) => val ? (
                  <div key={label} className={`border-b border-slate-100 pb-2 ${label === 'Client Deliveries' ? 'col-span-2' : 'col-span-2 md:col-span-1'}`}>
                    <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">{label}</span>
                    <div className="text-slate-900 font-medium">{val}</div>
                  </div>
                ) : null)}
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewCandidate); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Edit Details</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FORM SETTINGS MODAL (Manager/Admin only)
      ══════════════════════════════════════════════════════════════════════ */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-blue-600" />
                  Candidate Form Settings
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Customize visible fields and add custom fields for your company.</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none px-2">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8">

              {/* ── Section 1: Toggle standard fields visibility ── */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wider">Standard Fields Visibility</h3>
                <p className="text-sm text-slate-500 mb-4">Uncheck fields you don't need. Mandatory fields (Name, Email, Phone) cannot be hidden.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {OPTIONAL_STANDARD_FIELDS.map((field) => {
                    const isHiddenField = tempHiddenFields.includes(field.id);
                    return (
                      <label key={field.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${!isHiddenField ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                        <input type="checkbox" checked={!isHiddenField} onChange={() => handleToggleHiddenField(field.id)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" />
                        <span className={`text-sm font-medium ${!isHiddenField ? 'text-blue-900' : 'text-slate-500 line-through'}`}>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* ── Section 2: Custom Fields (Add / Edit / Delete) ── */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wider">Custom Fields</h3>
                <p className="text-sm text-slate-500 mb-4">Add new fields specific to your hiring needs. These appear in every candidate form and view.</p>

                {/* Input Row */}
                <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 rounded-xl border mb-4 transition-colors ${editingFieldIndex !== null ? 'bg-blue-50/60 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Field Name</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddOrUpdateCustomField(); }}
                      placeholder="e.g. Passport Number, Aadhar, Willing to Relocate?"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white ${editingFieldIndex !== null ? 'border-blue-400' : 'border-slate-300'}`}
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Field Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white ${editingFieldIndex !== null ? 'border-blue-400' : 'border-slate-300'}`}
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
                      className={`w-full flex items-center justify-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition ${editingFieldIndex !== null ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                    >
                      {editingFieldIndex !== null ? <><Check className="w-4 h-4" /> Update Field</> : <><Plus className="w-4 h-4" /> Add Field</>}
                    </button>
                    {editingFieldIndex !== null && (
                      <button onClick={() => { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }} className="text-xs text-center text-slate-500 hover:text-slate-800 font-medium transition">
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Fields List */}
                {tempCustomFields.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-sm">
                    No custom fields added yet. Use the form above to add your first one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tempCustomFields.map((field, index) => (
                      <div key={index} className={`flex justify-between items-center p-3 border rounded-xl shadow-sm transition-colors ${editingFieldIndex === index ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                          <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${editingFieldIndex === index ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                            {field.fieldType}
                          </span>
                          <span className="font-medium text-slate-800 text-sm">{field.fieldName}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEditCustomField(index)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveCustomField(index)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>

            {/* Settings Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <p className="text-xs text-slate-400">{tempCustomFields.length} custom field{tempCustomFields.length !== 1 ? 's' : ''} · {OPTIONAL_STANDARD_FIELDS.length - tempHiddenFields.length} of {OPTIONAL_STANDARD_FIELDS.length} standard fields visible</p>
              <div className="flex gap-3">
                <button onClick={() => setIsSettingsOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
                <button onClick={handleSaveSettings} disabled={isSavingSettings} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSavingSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Today Submissions Modal ── */}
      {isTodaySubOpen && (
        <AdminTodaySubmissionsModal
          candidates={candidates}
          recruiters={recruiters}
          onClose={() => setIsTodaySubOpen(false)}
          getCandidateId={getCandidateId}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BULK IMPORT PREVIEW MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">

            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Import Candidates — Bulk Upload
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supported: <span className="font-semibold">.xlsx, .xls, .csv</span>
                </p>
              </div>
              <button
                onClick={() => { resetImportState(); setIsImportModalOpen(false); }}
                className="text-slate-400 hover:text-slate-700 font-bold text-2xl leading-none px-2"
              >×</button>
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
                    className="text-xs text-slate-500 hover:text-slate-700 underline transition"
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
                      : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                >
                  <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-600">
                    {importDragOver ? 'Drop your file here!' : 'Drag & drop your Excel/CSV file here'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">or <span className="text-emerald-600 font-medium underline">click to browse</span></p>
                  <p className="text-xs text-slate-400 mt-3">.xlsx · .xls · .csv</p>
                </div>
              )}

              {/* Parse progress */}
              {isParsing && (
                <div className="space-y-2 py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-600">Parsing {importFileName}…</p>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mx-auto max-w-sm">
                    <div className="h-2 bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${importParseProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{importParseProgress}%</p>
                </div>
              )}

              {/* Post-import result */}
              {importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Rows',    value: importResult.totalRecords,          color: 'bg-slate-50 border-slate-200 text-slate-700' },
                      { label: 'Imported',       value: importResult.importedSuccessfully,  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                      { label: 'Failed',         value: importResult.failedRecords,         color: 'bg-red-50 border-red-200 text-red-600' },
                      { label: 'Duplicates',     value: importResult.duplicatesSkipped,     color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`border rounded-xl p-4 text-center ${color}`}>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs font-semibold uppercase tracking-wider mt-1 opacity-75">{label}</p>
                      </div>
                    ))}
                  </div>
                  {importResult.errors?.length > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition"
                    >
                      <Download className="w-4 h-4" /> Download Error Report ({importResult.errors.length} rows)
                    </button>
                  )}
                </div>
              )}

              {/* Preview table */}
              {importParsedData && !importResult && (
                <div className="space-y-3">
                  {/* Summary bar */}
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="px-3 py-1 bg-slate-100 rounded-full font-medium text-slate-700">Total: {importParsedData.totalCount}</span>
                    <span className="px-3 py-1 bg-emerald-100 rounded-full font-medium text-emerald-700">✓ Valid: {importParsedData.validRows.length}</span>
                    <span className="px-3 py-1 bg-red-100 rounded-full font-medium text-red-600">✗ Invalid: {importParsedData.invalidRows.length}</span>
                    {importFileName && <span className="px-3 py-1 bg-blue-50 rounded-full text-blue-600 text-xs">{importFileName}</span>}
                  </div>

                  <div className="overflow-auto rounded-xl border border-slate-200 max-h-80">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-semibold text-slate-600 w-10">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Phone</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Position</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Client</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importParsedData.allRows.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b last:border-0 ${row.valid ? 'bg-white hover:bg-emerald-50/30' : 'bg-red-50 hover:bg-red-100/40'}`}
                          >
                            <td className="px-3 py-2 text-slate-400">{row._rowNum || i + 1}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{row.firstName} {row.lastName}</td>
                            <td className="px-3 py-2 text-slate-600">{row.email}</td>
                            <td className="px-3 py-2 text-slate-600">{row.contact}</td>
                            <td className="px-3 py-2 text-slate-600">{row.position}</td>
                            <td className="px-3 py-2 text-slate-600">{row.client}</td>
                            <td className="px-3 py-2">
                              {row.valid ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">Valid</span>
                              ) : (
                                <span className="text-red-600 font-medium" title={row.errors?.join('; ')}>
                                  ✗ {row.errors?.[0]}
                                  {row.errors?.length > 1 && <span className="text-red-400"> +{row.errors.length - 1} more</span>}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0 gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                {importParsedData && !importResult
                  ? `${importParsedData.validRows.length} valid row(s) will be imported`
                  : importResult
                  ? `Import completed — ${importResult.importedSuccessfully} added to database`
                  : 'Upload an Excel or CSV file to preview candidates before importing'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { resetImportState(); setIsImportModalOpen(false); }}
                  className="px-5 py-2 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                {importParsedData && !importResult && (
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting || importParsedData.validRows.length === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    {isImporting ? 'Importing…' : `Import ${importParsedData.validRows.length} Candidate(s)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TODAY SUBMISSIONS MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AdminTodaySubmissionsModal({ candidates, recruiters, onClose, getCandidateId }) {
  const todayStr = getSafeDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [recruiterFilter, setRecruiterFilter] = useState('all');

  const filtered = useMemo(() => candidates.filter((c) => {
    const d = c.dateAdded || c.createdAt;
    if (getSafeDate(d) !== selectedDate) return false;
    if (recruiterFilter === 'all') return true;
    const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
    return String(recId) === String(recruiterFilter);
  }), [candidates, selectedDate, recruiterFilter]);

  const displayDate = selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const getRecruiterDisplayName = (rec) => {
    if (!rec) return '-';
    if (typeof rec === 'object') return getRecruiterLabel(rec);
    const found = recruiters.find((r) => r._id === rec || r.id === rec);
    return found ? getRecruiterLabel(found) : '-';
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Day Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Viewing candidates submitted on {displayDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 min-w-[150px]">
              <option value="all">All Recruiters</option>
              {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
            </select>
            <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input type="date" value={selectedDate} max={todayStr} onChange={(e) => setSelectedDate(e.target.value)} className="border-none outline-none bg-transparent text-sm text-slate-700 cursor-pointer" />
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No submissions for {displayDate}</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">CANDIDATE ID</th>
                  <th className="px-4 py-3 whitespace-nowrap">CANDIDATE NAME</th>
                  <th className="px-4 py-3 whitespace-nowrap">RECRUITER</th>
                  <th className="px-4 py-3 whitespace-nowrap">POSITION</th>
                  <th className="px-4 py-3 whitespace-nowrap">CLIENT</th>
                  <th className="px-4 py-3 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                  return (
                    <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold whitespace-nowrap">{getCandidateId(c)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{getRecruiterDisplayName(c.recruiterId)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.position || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.client || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {statusArr.map((s) => (
                            <span key={s} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s === 'Selected' || s === 'Joined' ? 'bg-green-100 text-green-800' : s === 'Rejected' || s === 'No Show' || s === 'Backout' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>{s}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing <span className="font-semibold text-slate-700">{filtered.length}</span> submission{filtered.length !== 1 ? 's' : ''} for {displayDate}</p>
          <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition-colors">Close Window</button>
        </div>
      </div>
    </div>
  );
}