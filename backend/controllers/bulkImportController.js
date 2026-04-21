// --- START OF FILE bulkImportController.js ---
import Candidate from '../models/Candidate.js';
import User      from '../models/User.js';
import xlsx      from 'xlsx';
import fs        from 'fs';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Flexible column finder (3-pass):
 *   Pass 1 – exact normalised match
 *   Pass 2 – key starts-with a name that is ≥ 4 chars
 *   Pass 3 – key contains a name that is ≥ 4 chars
 */
const findColumn = (rowKeys, ...possibleNames) => {
  const normalized = possibleNames.map(n => n.toLowerCase().replace(/[\s_\-\.]+/g, ''));

  for (const key of rowKeys) {
    const k = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    if (normalized.includes(k)) return key;
  }
  for (const key of rowKeys) {
    const k = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    for (const n of normalized) {
      if (n.length >= 4 && k.startsWith(n)) return key;
    }
  }
  for (const key of rowKeys) {
    const k = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    for (const n of normalized) {
      if (n.length >= 4 && k.includes(n)) return key;
    }
  }
  return null;
};

const getValue = (row, columnKey) => {
  if (!columnKey || !(columnKey in row)) return '';
  const val = row[columnKey];
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    const str = val.toString();
    if (str.toLowerCase().includes('e+') || str.toLowerCase().includes('e-')) {
      return Math.round(val).toString();
    }
    return str;
  }
  return val.toString().trim();
};

const VALID_STATUSES = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'No Show', 'Selected', 'Joined', 'Rejected', 'Pipeline', 'Hold', 'Backout',
];

/**
 * Get the next sequence number for bulk import, scoped to this tenant.
 * Looks for existing IDs matching the tenant's prefix pattern.
 */
const getNextSequence = async (tenantOwnerId, prefix) => {
  const pattern = new RegExp(`^${prefix}-\\d+$`, 'i');
  const last = await Candidate.findOne(
    { tenantOwnerId, candidateId: { $regex: pattern } },
    { candidateId: 1 }
  ).sort({ createdAt: -1 }).lean();

  if (!last?.candidateId) return 1;
  const num = parseInt(last.candidateId.replace(new RegExp(`^${prefix}-`, 'i'), ''), 10);
  return isNaN(num) ? 1 : num + 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// @route  POST /api/candidates/bulk-import
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
export const bulkImportCandidates = async (req, res) => {
  const tempFilePath = req.file?.path;

  console.log('=== BULK IMPORT START ===');
  console.log('User:', req.user ? `${req.user._id} / ${req.user.firstName} ${req.user.lastName}` : 'NONE');
  console.log('File:', tempFilePath);

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // ── Resolve tenant context ────────────────────────────────────────────
    const tenantOwnerId = getTenantOwnerId(req.user);
    if (!tenantOwnerId) {
      return res.status(403).json({ success: false, message: 'No tenant context for this user.' });
    }

    // Fetch the manager's configured candidatePrefix (e.g. "ACME")
    const manager = await User.findById(tenantOwnerId).select('candidatePrefix').lean();
    const prefix  = (manager?.candidatePrefix || 'CAND').toUpperCase();

    // ── 1. Read workbook ──────────────────────────────────────────────────
    const fileBuffer = fs.readFileSync(tempFilePath);
    const workbook   = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName  = workbook.SheetNames[0];
    const worksheet  = workbook.Sheets[sheetName];
    const data       = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    if (!data || data.length === 0) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ success: false, message: 'Excel file is empty or has no data rows.' });
    }

    const rowKeys = Object.keys(data[0] || {});
    console.log('Columns detected:', rowKeys);
    console.log('Total data rows:', data.length);

    // ── 2. Map columns ────────────────────────────────────────────────────
    const cols = {
      name        : findColumn(rowKeys, 'name', 'candidatename', 'fullname', 'candidate', 'applicant', 'applicantname'),
      email       : findColumn(rowKeys, 'email', 'emailid', 'emailaddress', 'mail'),
      contact     : findColumn(rowKeys, 'contact', 'phone', 'mobile', 'mobileno', 'phoneno', 'contactno', 'phonenumber', 'mobilenumber', 'contactnumber', 'cellphone'),
      position    : findColumn(rowKeys, 'position', 'jobtitle', 'designation', 'role', 'jobposition', 'appliedfor', 'appliedposition'),
      client      : findColumn(rowKeys, 'client', 'clientname', 'clientcompany', 'hiringclient', 'company', 'companyname', 'organization'),
      skills      : findColumn(rowKeys, 'skills', 'skill', 'technologies', 'techstack', 'keyskills', 'technicalskills'),
      location    : findColumn(rowKeys, 'currentlocation', 'location', 'city', 'loc', 'presentlocation', 'place'),
      prefLocation: findColumn(rowKeys, 'preferredlocation', 'preflocation', 'preferredcity', 'jobcity'),
      exp         : findColumn(rowKeys, 'totalexperience', 'totalexp', 'experience', 'yoe', 'yearsofexperience', 'totalyears', 'exp'),
      relExp      : findColumn(rowKeys, 'relevantexperience', 'relevantexp', 'relexp', 'relatedexperience'),
      ectc        : findColumn(rowKeys, 'ectc', 'expectedctc', 'expectedsalary', 'expctc', 'expectedpackage', 'expectedcost'),
      ctc         : findColumn(rowKeys, 'ctc', 'currentctc', 'currentsalary', 'currentpackage', 'currentcost'),
      takeHome    : findColumn(rowKeys, 'takehome', 'takehomesalary', 'inhands', 'inhandsalary', 'netsalary'),
      notice      : findColumn(rowKeys, 'noticeperiod', 'notice', 'np', 'noticetime', 'noticeduration'),
      remarks     : findColumn(rowKeys, 'remarks', 'feedback', 'comments', 'notes', 'comment'),
      source      : findColumn(rowKeys, 'source', 'reference', 'referral', 'sourceofcandidate', 'candidatesource'),
      status      : findColumn(rowKeys, 'status', 'candidatestatus', 'currentstatus', 'stage'),
      company     : findColumn(rowKeys, 'currentcompany', 'presentcompany', 'employer', 'currentorganization', 'workingat'),
      education   : findColumn(rowKeys, 'education', 'qualification', 'degree', 'highestqualification', 'academicqualification'),
      gender      : findColumn(rowKeys, 'gender', 'sex'),
      linkedin    : findColumn(rowKeys, 'linkedin', 'linkedinurl', 'linkedinprofile', 'linkedinid'),
      industry    : findColumn(rowKeys, 'industry', 'sector', 'domain', 'industrytype'),
      dob         : findColumn(rowKeys, 'dob', 'dateofbirth', 'birthdate', 'birthday'),
    };

    console.log('Column map:', cols);

    // ── 3. Parse rows ─────────────────────────────────────────────────────
    const validRows     = [];
    const mappingErrors = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;
      try {
        const name     = getValue(row, cols.name).trim();
        const email    = getValue(row, cols.email).toLowerCase().trim();
        const contact  = getValue(row, cols.contact).replace(/[^\d\+\-\s]/g, '').trim();
        const position = getValue(row, cols.position).trim();
        const client   = getValue(row, cols.client).trim();
        const skills   = getValue(row, cols.skills).trim();

        if (!name && !email && !contact && !position && !client && !skills) {
          console.log(`Row ${rowNum}: Skipping empty row`);
          return;
        }

        const cleanContact = contact.replace(/\D/g, '').slice(-10) || '';
        const skillsArray  = skills
          ? skills.split(/[,;|\n]+/).map(s => s.trim()).filter(Boolean)
          : [];

        const statusRaw    = getValue(row, cols.status).trim();
        const parsedStatus = statusRaw
          ? statusRaw.split(/[,;|]+/).map(s => s.trim()).filter(s => VALID_STATUSES.includes(s))
          : [];
        const finalStatus  = parsedStatus.length > 0 ? parsedStatus : ['Submitted'];

        const finalEmail = email && email.includes('@')
          ? email
          : `imported_${Date.now()}_${rowNum}@placeholder.com`;

        validRows.push({
          rowNum,
          candidateData: {
            tenantOwnerId,
            name:              name || 'Unknown',
            email:             finalEmail,
            contact:           cleanContact,
            position,
            client,
            skills:            skillsArray,
            status:            finalStatus,
            currentLocation:   getValue(row, cols.location)     || '',
            preferredLocation: getValue(row, cols.prefLocation)  || '',
            totalExperience:   getValue(row, cols.exp)           || '',
            relevantExperience:getValue(row, cols.relExp)        || '',
            ctc:               getValue(row, cols.ctc)           || '',
            ectc:              getValue(row, cols.ectc)          || '',
            currentTakeHome:   getValue(row, cols.takeHome)      || '',
            noticePeriod:      getValue(row, cols.notice)        || '',
            remarks:           getValue(row, cols.remarks)       || '',
            source:            getValue(row, cols.source)        || 'Excel Import',
            currentCompany:    getValue(row, cols.company)       || '',
            education:         getValue(row, cols.education)     || '',
            gender:            getValue(row, cols.gender)        || '',
            linkedin:          getValue(row, cols.linkedin)      || '',
            industry:          getValue(row, cols.industry)      || '',
            dateOfBirth:       getValue(row, cols.dob)           || '',
            recruiterId:       req.user._id,
            recruiterName:     `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
            candidatePrefix:   prefix,
            active:            true,
            dateAdded:         new Date(),
          },
        });
      } catch (err) {
        console.error(`Row ${rowNum} parse error:`, err.message);
        mappingErrors.push({ row: rowNum, candidate: 'Unknown', error: `Parse error: ${err.message}` });
      }
    });

    console.log(`Validated: ${validRows.length} valid, ${mappingErrors.length} errors`);

    if (validRows.length === 0) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        message: 'No data rows found. Please check the file has data below the header row.',
        errors:  mappingErrors.slice(0, 20),
      });
    }

    // ── 4. Split NEW vs EXISTING (by email, within this tenant only) ──────
    const realEmails = validRows
      .map(r => r.candidateData.email)
      .filter(e => !e.includes('@placeholder.com'));

    const existingDocs = realEmails.length > 0
      ? await Candidate.find(
          { tenantOwnerId, email: { $in: realEmails } },
          { email: 1 }
        ).lean()
      : [];
    const existingSet = new Set(existingDocs.map(d => d.email.toLowerCase()));

    const newRows    = validRows.filter(r =>
      !existingSet.has(r.candidateData.email) || r.candidateData.email.includes('@placeholder.com')
    );
    const updateRows = validRows.filter(r =>
      existingSet.has(r.candidateData.email) && !r.candidateData.email.includes('@placeholder.com')
    );

    console.log(`New: ${newRows.length}, To update: ${updateRows.length}`);

    // ── 5a. CREATE new candidates — sequentially for unique IDs ──────────
    let createdCount = 0;

    if (newRows.length > 0) {
      let nextNum = await getNextSequence(tenantOwnerId, prefix);
      console.log(`Starting candidateId from: ${prefix}-${nextNum.toString().padStart(7, '0')}`);

      for (const row of newRows) {
        try {
          row.candidateData.candidateId = `${prefix}-${nextNum.toString().padStart(7, '0')}`;
          nextNum++;

          const doc = new Candidate(row.candidateData);
          await doc.save();
          createdCount++;
          console.log(`✓ Created ${row.candidateData.candidateId} — ${row.candidateData.name}`);
        } catch (err) {
          const msg = err.message || String(err);
          console.error(`✗ CREATE failed Row ${row.rowNum} (${row.candidateData.name}):`, msg);
          mappingErrors.push({ row: row.rowNum, candidate: row.candidateData.name, error: `Create failed: ${msg}` });
        }
      }
    }

    // ── 5b. UPDATE existing candidates ───────────────────────────────────
    let updatedCount = 0;

    if (updateRows.length > 0) {
      const updateResults = await Promise.allSettled(
        updateRows.map(r => {
          // Strip protected fields from updates
          const { recruiterId, recruiterName, dateAdded, candidateId, active, tenantOwnerId: _t, ...updateFields } = r.candidateData;

          const cleanFields = Object.fromEntries(
            Object.entries(updateFields).filter(([, v]) =>
              v !== '' && !(Array.isArray(v) && v.length === 0)
            )
          );

          return Candidate.findOneAndUpdate(
            { email: r.candidateData.email, tenantOwnerId },  // scoped to tenant
            { $set: cleanFields },
            { new: true, runValidators: false }
          );
        })
      );

      updateResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          updatedCount++;
          console.log(`✓ Updated — ${updateRows[idx].candidateData.name}`);
        } else {
          const msg  = result.reason?.message || 'Update failed';
          const name = updateRows[idx].candidateData.name;
          const rowN = updateRows[idx].rowNum;
          console.error(`✗ UPDATE failed Row ${rowN} (${name}):`, msg);
          mappingErrors.push({ row: rowN, candidate: name, error: `Update failed: ${msg}` });
        }
      });
    }

    // ── 6. Cleanup & respond ──────────────────────────────────────────────
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    console.log(`=== DONE: ${createdCount} created, ${updatedCount} updated, ${mappingErrors.length} errors ===`);

    return res.status(200).json({
      success:    true,
      message:    `Import complete: ${createdCount} new candidate(s) added, ${updatedCount} existing updated.`,
      imported:   createdCount + updatedCount,
      created:    createdCount,
      updated:    updatedCount,
      duplicates: updatedCount,
      total:      data.length,
      errors:     mappingErrors.length > 0 ? mappingErrors.slice(0, 50) : undefined,
    });

  } catch (error) {
    console.error('BULK IMPORT CRITICAL ERROR:', error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    return res.status(500).json({
      success: false,
      message: 'Critical server error during import.',
      error:   error.message,
    });
  }
};