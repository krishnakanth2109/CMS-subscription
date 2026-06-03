const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'AdminRequirements.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. OPTIONAL_STANDARD_FIELDS
content = content.replace("{ id: 'jdLink', label: 'JD Link' }", "{ id: 'jobDescription', label: 'Job Description' }");

// 2. JobDetailCard
const oldLoc = '<p className="flex justify-between"><span className="text-zinc-500">Location:</span> <span className="font-medium">{job.location || "-"}</span></p>';
const newLoc = `<p className="flex justify-between"><span className="text-zinc-500">Location:</span> <span className="font-medium">{job.location || "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Job Type:</span> <span className="font-medium">{job.jobType || "Permanent"}</span></p>`;
content = content.replace(oldLoc, newLoc);

const jdLinkBlock = `             {!isHidden('jdLink') && job.jdLink && (
               <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                 <h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100 text-sm">Job Description Link</h4>
                 <a href={job.jdLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all text-sm">
                   {job.jdLink}
                 </a>
               </div>
             )}`;
const newJdBlock = `             {!isHidden('jobDescription') && job.jobDescription && (
               <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 mt-4">
                 <h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100 text-sm">Job Description</h4>
                 <div className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap text-sm">
                   {job.jobDescription}
                 </div>
               </div>
             )}`;
content = content.replace(jdLinkBlock, newJdBlock);

// 3. initialFormState
content = content.replace('jobCode: "", clientName: "", position: "", location: "",',
'jobCode: "", clientName: "", position: "", location: "", jobType: "Permanent",');
content = content.replace('primaryRecruiter: "", secondaryRecruiter: "", skills: "", jdLink: "",',
'primaryRecruiter: "", secondaryRecruiter: "", skills: "", jobDescription: "",');

// 4. validation
const jdlinkValBlock = `    if (!isHidden('jdLink')) {
      const link = trimStr(form.jdLink);
      if (link) {
        const urlPattern = /^(https?:\\/\\/)?([\\w\\d\\-]+\\.)+\\w{2,}(\\/.*)?$/i;
        if (!urlPattern.test(link)) {
          newErrors.jdLink = "Please enter a valid URL (e.g., https://example.com)";
        }
      }
    }`;
const newJdValBlock = `    if (!isHidden('jobDescription')) {
      const jd = trimStr(form.jobDescription);
      if (jd && jd.length < 10) {
        newErrors.jobDescription = "Job Description should be at least 10 characters";
      }
    }`;
content = content.replace(jdlinkValBlock, newJdValBlock);

// 5. sanitized payload
content = content.replace("jdLink: isHidden('jdLink') ? \"\" : (form.jdLink?.trim() || \"\"),",
"jobDescription: isHidden('jobDescription') ? \"\" : (form.jobDescription?.trim() || \"\"),\n      jobType: form.jobType || \"Permanent\",");

// 6. Remove numbers from labels
content = content.replace(/<label className="block text-xs font-medium text-zinc-500 mb-1">\d+\.\s+/g, '<label className="block text-xs font-medium text-zinc-500 mb-1">');

// 7. Add jobType and change jdLink field in form
const oldFormFields = `                {/* 4. Location */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Location *</label>
                  <input name="location" placeholder="City / Remote" value={form.location} onChange={handleChange} className={\`\${inputCls} \${errors.location ? "border-red-500 focus:ring-red-500" : ""}\`} />
                  {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                </div>

                {/* 5. Experience */}`;

const newFormFields = `                {/* Location */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Location *</label>
                  <input name="location" placeholder="City / Remote" value={form.location} onChange={handleChange} className={\`\${inputCls} \${errors.location ? "border-red-500 focus:ring-red-500" : ""}\`} />
                  {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                </div>

                {/* Job Type */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Job Type *</label>
                  <select name="jobType" value={form.jobType} onChange={handleChange} className={inputCls}>
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                {/* Experience */}`;
content = content.replace(oldFormFields, newFormFields);

const oldJdlinkField = `                {/* 16. JD Link (Optional) */}
                {!isHidden('jdLink') && (
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">JD Link (Optional)</label>
                    <input name="jdLink" placeholder="https://..." value={form.jdLink} onChange={handleChange} className={\`\${inputCls} \${errors.jdLink ? "border-red-500 focus:ring-red-500" : ""}\`} />
                    {errors.jdLink && <p className="text-xs text-red-500 mt-1">{errors.jdLink}</p>}
                  </div>
                )}`;
const newJdlinkField = `                {/* Job Description (Optional) */}
                {!isHidden('jobDescription') && (
                  <div className="md:col-span-4 mt-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-2">Job Description</label>
                    <button type="button" onClick={() => setIsJDModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
                      {form.jobDescription ? "Edit Job Description" : "+ Add Job Description"}
                    </button>
                    {errors.jobDescription && <p className="text-xs text-red-500 mt-1">{errors.jobDescription}</p>}
                  </div>
                )}`;
content = content.replace(oldJdlinkField, newJdlinkField);

// Add jd modal state
const stateBlock = `  const [showForm, setShowForm] = useState(false);`;
const newStateBlock = `  const [showForm, setShowForm] = useState(false);
  const [isJDModalOpen, setIsJDModalOpen] = useState(false);`;
content = content.replace(stateBlock, newStateBlock);

const jdModalJsx = `      {/* ─── JD Modal ────────────────────────────────────────────── */}
      {isJDModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Job Description</h2>
              <button onClick={() => setIsJDModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-2xl leading-none px-2">&times;</button>
            </div>
            <div className="p-6">
              <textarea
                name="jobDescription"
                value={form.jobDescription}
                onChange={handleChange}
                placeholder="Enter the full job description here..."
                className="w-full h-64 p-4 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 resize-none"
              />
            </div>
            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
              <button onClick={() => setIsJDModalOpen(false)} className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 shadow-sm">Done</button>
            </div>
          </div>
        </div>
      )}`;

// Insert the modal just before the last \`</div>\`
const parts = content.split('</div>\n  );\n}');
if(parts.length === 2) {
    content = parts[0] + '\\n' + jdModalJsx + '\\n    </div>\\n  );\\n}';
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('done');
