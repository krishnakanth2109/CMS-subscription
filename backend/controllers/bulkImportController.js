// --- START OF FILE bulkImportController.js ---
import Candidate from '../models/Candidate.js';
import User from '../models/User.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'No Show', 'Selected', 'Joined', 'Rejected', 'Pipeline', 'Hold', 'Backout',
];

/** Strip HTML and control characters from a string. */
const sanitizeStr = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

/** Get the next CAND-xxx sequence number scoped to this tenant. */
const getNextSequence = async (tenantOwnerId, prefix) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-\\d+$`, 'i');
  const last = await Candidate.findOne(
    { tenantOwnerId, candidateId: { $regex: pattern } },
    { candidateId: 1 }
  ).sort({ createdAt: -1 }).lean();

  if (!last?.candidateId) return 1;
  const num = parseInt(last.candidateId.replace(new RegExp(`^${escapedPrefix}-`, 'i'), ''), 10);
  return isNaN(num) ? 1 : num + 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// @route  POST /api/candidates/bulk-import
// @access Private (all roles)
// Expects: req.body.candidates — array of pre-parsed candidate objects (from parseExcelToCandidates.js)
//          req.body.fileName   — original file name (for audit log)
// ─────────────────────────────────────────────────────────────────────────────
export const bulkImportCandidates = async (req, res) => {
  console.log('=== BULK IMPORT START ===');
  console.log('User:', req.user ? `${req.user._id} / ${req.user.firstName} ${req.user.lastName}` : 'NONE');

  try {
    const { candidates: rawCandidates, fileName = 'Unknown File' } = req.body;

    if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidates array provided in request body.',
      });
    }

    // ── Resolve tenant context ────────────────────────────────────────────
    const tenantOwnerId = getTenantOwnerId(req.user);
    if (!tenantOwnerId) {
      return res.status(403).json({ success: false, message: 'No tenant context for this user.' });
    }

    // Fetch manager's candidate prefix (e.g. "ACME")
    const manager = await User.findById(tenantOwnerId).select('candidatePrefix').lean();
    const prefix  = (manager?.candidatePrefix || 'CAND').toUpperCase();

    const totalRecords = rawCandidates.length;
    const errors       = [];
    let duplicatesSkipped = 0;

    // ── 1. Server-side validation ─────────────────────────────────────────
    // Required fields mirror the Add Candidate form:
    //   firstName, lastName, email, contact (10 digits), position, client, skills
    // ─────────────────────────────────────────────────────────────────────
    const validatedRows = [];

    rawCandidates.forEach((row, index) => {
      const rowNum    = row._rowNum || (index + 1);
      const rowErrors = [];

      // ── Required ──────────────────────────────────────────────────────
      const firstName = sanitizeStr(row.firstName);
      const lastName  = sanitizeStr(row.lastName);
      const email     = sanitizeStr(row.email).toLowerCase();
      const contact   = String(row.contact || '').replace(/\D/g, '').slice(-10);

      if (!firstName || firstName.length < 2) rowErrors.push('First Name is required (min 2 chars)');

      if (!email) {
        rowErrors.push('Email is required');
      } else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
        rowErrors.push('Invalid Email format');
      }

      if (!contact) {
        rowErrors.push('Phone is required');
      } else if (contact.length !== 10) {
        rowErrors.push(`Phone must be exactly 10 digits (found: ${contact})`);
      }

      const position = sanitizeStr(row.position);
      if (!position) rowErrors.push('Position (Role) is required');

      const client = sanitizeStr(row.client);

      // Skills — optional, can be array or comma-separated string
      let skillsArr = [];
      if (Array.isArray(row.skills)) {
        skillsArr = row.skills.map(s => sanitizeStr(s)).filter(Boolean);
      } else if (row.skills && String(row.skills).trim()) {
        skillsArr = String(row.skills).split(/[,;|]+/).map(s => sanitizeStr(s)).filter(Boolean);
      }


      // ── Record invalid row and skip ───────────────────────────────────
      if (rowErrors.length > 0) {
        errors.push({
          row:           rowNum,
          email:         email || '',
          candidateName: `${firstName} ${lastName}`.trim() || 'Unknown',
          reason:        rowErrors.join('; '),
        });
        return;
      }

      // ── Optional fields ───────────────────────────────────────────────
      // Status
      let statusArr = [];
      if (Array.isArray(row.status)) {
        statusArr = row.status.filter(s => VALID_STATUSES.includes(s));
      } else if (row.status && String(row.status).trim()) {
        statusArr = String(row.status)
          .split(/[,;|]+/)
          .map(s => s.trim())
          .filter(s => VALID_STATUSES.includes(s));
      }
      if (statusArr.length === 0) statusArr = ['Submitted'];

      // Boolean helpers
      const servingRaw = String(row.servingNoticePeriod || '').toLowerCase();
      const offersRaw  = String(row.offersInHand || '').toLowerCase();
      const isTruthy   = (v) => ['yes', 'true', '1', 'y'].includes(v);

      validatedRows.push({
        rowNum,
        candidateData: {
          tenantOwnerId,
          // Required
          firstName,
          lastName,
          name:     `${firstName} ${lastName}`.trim(),
          email,
          contact,
          position,
          client,
          skills:   skillsArr,
          status:   statusArr,
          // Optional — Personal
          alternateNumber:    sanitizeStr(row.alternateNumber || '').replace(/\D/g, '').slice(-10) || undefined,
          gender:             sanitizeStr(row.gender) || undefined,
          linkedin:           sanitizeStr(row.linkedin || row.resumeUrl) || undefined,
          // Optional — Location
          currentLocation:    sanitizeStr(row.currentLocation || row.location) || '',
          preferredLocation:  sanitizeStr(row.preferredLocation) || '',
          // Optional — Professional
          currentCompany:     sanitizeStr(row.currentCompany) || '',
          industry:           sanitizeStr(row.industry) || '',
          education:          sanitizeStr(row.education) || '',
          // Optional — Experience
          totalExperience:    sanitizeStr(row.totalExperience || row.experience) || '',
          relevantExperience: sanitizeStr(row.relevantExperience) || '',
          // Optional — Compensation
          ctc:                sanitizeStr(row.ctc) || '',
          ectc:               sanitizeStr(row.ectc || row.expectedSalary) || '',
          currentTakeHome:    sanitizeStr(row.currentTakeHome) || '',
          expectedTakeHome:   sanitizeStr(row.expectedTakeHome) || '',
          // Optional — Notice
          noticePeriod:        sanitizeStr(row.noticePeriod) || '',
          servingNoticePeriod: isTruthy(servingRaw),
          lwd:                 sanitizeStr(row.lwd) || undefined,
          reasonForChange:     sanitizeStr(row.reasonForChange) || '',
          // Optional — Offers
          offersInHand: isTruthy(offersRaw),
          offerPackage: sanitizeStr(row.offerPackage) || '',
          // Optional — Recruitment
          source:   sanitizeStr(row.source) || 'Excel Import',
          rating:   Math.min(5, Math.max(0, parseInt(row.rating) || 0)),
          remarks:  sanitizeStr(row.remarks) || '',
          notes:    sanitizeStr(row.notes) || '',
          // Meta
          recruiterId:   req.user._id,
          recruiterName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
          active:    true,
          dateAdded: row.dateAdded ? new Date(row.dateAdded) : new Date(),
        },
      });
    });

    console.log(`Validation: ${validatedRows.length} valid, ${errors.length} invalid`);

    // ── 2. Duplicate email check within this tenant ───────────────────────
    const emailsToCheck = validatedRows.map(r => r.candidateData.email).filter(Boolean);

    let existingSet = new Set();
    if (emailsToCheck.length > 0) {
      const existingDocs = await Candidate.find(
        { tenantOwnerId, email: { $in: emailsToCheck } },
        { email: 1 }
      ).lean();
      existingSet = new Set(existingDocs.map(d => d.email.toLowerCase()));
    }

    const newRows = [];
    validatedRows.forEach(row => {
      if (existingSet.has(row.candidateData.email)) {
        duplicatesSkipped++;
        errors.push({
          row:           row.rowNum,
          email:         row.candidateData.email,
          candidateName: row.candidateData.name,
          reason:        'Duplicate email — candidate already exists',
        });
      } else {
        newRows.push(row);
      }
    });

    console.log(`Duplicate check: ${newRows.length} new, ${duplicatesSkipped} duplicates`);

    // ── 3. Sequential insert with unique candidate IDs ───────────────────
    let importedSuccessfully = 0;
    let dbFailures           = 0;

    if (newRows.length > 0) {
      let nextNum = await getNextSequence(tenantOwnerId, prefix);
      console.log(`Starting candidateId: ${prefix}-${nextNum.toString().padStart(3, '0')}`);

      const CHUNK_SIZE = 50;
      for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
        const chunk = newRows.slice(i, i + CHUNK_SIZE);
        for (const row of chunk) {
          try {
            row.candidateData.candidateId = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
            nextNum++;
            const doc = new Candidate(row.candidateData);
            await doc.save();
            importedSuccessfully++;
            console.log(`✓ ${row.candidateData.candidateId} — ${row.candidateData.name}`);
          } catch (err) {
            const msg = err.message || String(err);
            console.error(`✗ Row ${row.rowNum} (${row.candidateData.name}):`, msg);
            dbFailures++;
            errors.push({
              row:           row.rowNum,
              email:         row.candidateData.email,
              candidateName: row.candidateData.name,
              reason:        `Database error: ${msg}`,
            });
          }
        }
      }
    }

    const failedRecords = totalRecords - importedSuccessfully - duplicatesSkipped;

    console.log(`=== DONE: ${importedSuccessfully} imported, ${duplicatesSkipped} dup, ${dbFailures} db failures ===`);

    return res.status(200).json({
      success:              true,
      message:              `Import complete: ${importedSuccessfully} imported, ${duplicatesSkipped} duplicates skipped, ${failedRecords} failed.`,
      totalRecords,
      importedSuccessfully,
      failedRecords,
      duplicatesSkipped,
      errors:               errors.slice(0, 100),
    });

  } catch (error) {
    console.error('BULK IMPORT CRITICAL ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Critical server error during import.',
      error:   error.message,
    });
  }
};