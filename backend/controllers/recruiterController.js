// --- START OF FILE recruiterController.js ---
import User from '../models/User.js';
import { admin, getTenantOwnerId } from '../middleware/authMiddleware.js';
import { v2 as cloudinary } from 'cloudinary';
import { sendBrevoEmail } from '../services/email.js';

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key:    process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Get current user's full profile
// @route  GET /api/recruiters/profile
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id:              user._id,
      firstName:        user.firstName,
      lastName:         user.lastName,
      email:            user.email,
      username:         user.username,
      phone:            user.phone            || '',
      location:         user.location         || '',
      specialization:   user.specialization   || '',
      experience:       user.experience       || '',
      bio:              user.bio              || '',
      profilePicture:   user.profilePicture   || '',
      role:             user.role,
      active:           user.active,
      recruiterId:      user.recruiterId      || '',
      tenantOwnerId:    user.tenantOwnerId    || null,
      companyName:      user.companyName      || '',
      candidatePrefix:  user.candidatePrefix  || 'CAND',
      socials: {
        linkedin: user.socials?.linkedin || '',
        github:   user.socials?.github   || '',
        twitter:  user.socials?.twitter  || '',
        website:  user.socials?.website  || '',
      },
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Update current user's profile
// @route  PUT /api/recruiters/profile
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.body.firstName   !== undefined) user.firstName      = req.body.firstName.trim()   || user.firstName;
    if (req.body.lastName    !== undefined) user.lastName       = req.body.lastName.trim()    || user.lastName;
    if (req.body.email       !== undefined) user.email          = req.body.email.trim()       || user.email;
    if (req.body.phone       !== undefined) user.phone          = req.body.phone;
    if (req.body.location    !== undefined) user.location       = req.body.location;
    if (req.body.specialization !== undefined) user.specialization = req.body.specialization;
    if (req.body.experience  !== undefined) user.experience     = req.body.experience;
    if (req.body.bio         !== undefined) user.bio            = req.body.bio;

    // Only managers may update company config and candidatePrefix
    if (user.role === 'manager') {
      if (req.body.companyName !== undefined) user.companyName = req.body.companyName;
      if (req.body.candidatePrefix !== undefined) {
        const prefix = req.body.candidatePrefix.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
        if (prefix.length === 4) user.candidatePrefix = prefix;
      }
    }

    // Socials
    if (req.body.socials && typeof req.body.socials === 'object') {
      user.socials = {
        linkedin: req.body.socials.linkedin ?? user.socials?.linkedin ?? '',
        github:   req.body.socials.github   ?? user.socials?.github   ?? '',
        twitter:  req.body.socials.twitter  ?? user.socials?.twitter  ?? '',
        website:  req.body.socials.website  ?? user.socials?.website  ?? '',
      };
    }

    // Profile picture: deletion, base64 upload, or keep existing URL
    if (req.body.profilePicture !== undefined) {
      if (req.body.profilePicture === '') {
        if (user.profilePicture?.includes('cloudinary')) {
          try { await cloudinary.uploader.destroy(`recruiters/recruiter_${user._id}`); } catch {}
        }
        user.profilePicture = '';
      } else if (req.body.profilePicture.startsWith('data:image')) {
        try {
          if (user.profilePicture?.includes('cloudinary')) {
            try { await cloudinary.uploader.destroy(`recruiters/recruiter_${user._id}`); } catch {}
          }
          const result = await cloudinary.uploader.upload(req.body.profilePicture, {
            folder:         'recruiters',
            public_id:      `recruiter_${user._id}`,
            overwrite:      true,
            resource_type:  'image',
            transformation: [
              { width: 500, height: 500, crop: 'limit' },
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
          });
          user.profilePicture = result.secure_url;
        } catch (uploadError) {
          return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
        }
      } else {
        user.profilePicture = req.body.profilePicture;
      }
    }

    // Sync display name / email to Firebase Auth
    if (user.firebaseUid) {
      const fbUpdates = {};
      const newFirst = req.body.firstName?.trim();
      const newLast  = req.body.lastName?.trim();
      if (newFirst || newLast) {
        fbUpdates.displayName = `${newFirst || user.firstName} ${newLast || user.lastName}`.trim();
      }
      if (req.body.email && req.body.email.trim() !== user.email) {
        fbUpdates.email = req.body.email.trim();
      }
      if (Object.keys(fbUpdates).length > 0) {
        try { await admin.auth().updateUser(user.firebaseUid, fbUpdates); }
        catch (fbErr) { console.error('[Profile] Firebase sync error (non-fatal):', fbErr.message); }
      }
    }

    const updated = await user.save();

    res.json({
      _id:             updated._id,
      firstName:       updated.firstName,
      lastName:        updated.lastName,
      email:           updated.email,
      username:        updated.username,
      phone:           updated.phone          || '',
      location:        updated.location       || '',
      specialization:  updated.specialization || '',
      experience:      updated.experience     || '',
      bio:             updated.bio            || '',
      profilePicture:  updated.profilePicture || '',
      role:            updated.role,
      active:          updated.active,
      tenantOwnerId:   updated.tenantOwnerId  || null,
      companyName:     updated.companyName    || '',
      candidatePrefix: updated.candidatePrefix || 'CAND',
      socials: {
        linkedin: updated.socials?.linkedin || '',
        github:   updated.socials?.github   || '',
        twitter:  updated.socials?.twitter  || '',
        website:  updated.socials?.website  || '',
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already in use by another account.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Get all recruiters/admins for this tenant
// @route  GET /api/recruiters
// @access Private — admin / manager
// ─────────────────────────────────────────────────────────────────────────────
export const getRecruiters = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    // master sees everyone; everyone else sees only their company's users
    const query =
      req.user.role === 'master'
        ? { role: { $in: ['recruiter', 'admin', 'manager'] } }
        : {
            role: { $in: ['recruiter', 'admin', 'manager'] },
            $or: [
              { tenantOwnerId },            // admins & recruiters under this manager
              { _id: tenantOwnerId },       // the manager themselves
            ],
          };

    const recruiters = await User.find(query)
      .select('-password')
      .sort({ role: 1, firstName: 1 })
      .lean();

    console.log(`[getRecruiters] tenant:${tenantOwnerId} → ${recruiters.length} users`);
    res.json(recruiters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Create a new recruiter/admin under this tenant
// @route  POST /api/recruiters
// @access Private — admin / manager
// ─────────────────────────────────────────────────────────────────────────────
export const createRecruiter = async (req, res) => {
  const { firstName, lastName, email, password, recruiterId, phone, role, username, profilePicture } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ message: 'First name, last name, email, and password are required.' });
  }

  // Only admins and managers may create users
  if (req.user.role === 'recruiter') {
    return res.status(403).json({ message: 'Not authorized to create users.' });
  }

  const tenantOwnerId = getTenantOwnerId(req.user);
  let firebaseUid = null;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User with this email already exists.' });

    if (recruiterId) {
      const idExists = await User.findOne({ recruiterId });
      if (idExists) return res.status(400).json({ message: 'Recruiter ID already exists.' });
    }

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
      });
    } catch (fbError) {
      if (fbError.code === 'auth/email-already-exists') {
        firebaseUser = await admin.auth().getUserByEmail(email);
      } else {
        throw fbError;
      }
    }
    firebaseUid = firebaseUser.uid;

    const user = await User.create({
      firebaseUid,
      firstName,
      lastName,
      email,
      recruiterId,
      phone,
      role:           role || 'recruiter',
      username:       username || email.split('@')[0],
      profilePicture: profilePicture || '',
      active:         true,
      // ── Crucial: stamp this user with the manager's tenantOwnerId ─────────
      tenantOwnerId,
    });

    res.status(201).json({
      _id:          user._id,
      firstName:    user.firstName,
      lastName:     user.lastName,
      email:        user.email,
      recruiterId:  user.recruiterId,
      role:         user.role,
      firebaseUid:  user.firebaseUid,
      tenantOwnerId: user.tenantOwnerId,
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/$/, '');

    // Send welcome email in background
    sendBrevoEmail({
      toEmail:     email,
      toName:      `${firstName} ${lastName}`,
      subject:     'Welcome to VTS Tracker - Your Account is Ready',
      htmlContent: `
        <html><body style="font-family:sans-serif;line-height:1.6;color:#333;">
          <h2 style="color:#6366f1;">Welcome ${firstName}!</h2>
          <p>Your account has been created in the <b>VTS Tracker</b> portal.</p>
          <p><b>Your Credentials:</b></p>
          <ul>
            <li><b>Email:</b> ${email}</li>
            <li><b>Password:</b> ${password}</li>
          </ul>
          <p>Login here: <a href="${frontendUrl}/login">VTS Login</a></p>
          <p>Please change your password after first login.</p>
          <p>Best Regards,<br/><b>Admin Team - Arah Info Tech</b></p>
        </body></html>
      `,
    }).then(sent => {
      if (sent) console.log(`[Email] Welcome email sent to: ${email}`);
      else      console.error(`[Email] Welcome email FAILED for: ${email}`);
    }).catch(err => {
      console.error(`[Email Error] Welcome email for ${email}:`, err.message);
    });

  } catch (error) {
    console.error('Create Recruiter Error:', error);
    if (firebaseUid) {
      try { await admin.auth().deleteUser(firebaseUid); } catch {}
    }
    if (error.code === 'auth/weak-password') return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (error.code === 'auth/invalid-email')  return res.status(400).json({ message: 'Invalid email address.' });
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Update a specific user (admin / manager only, same tenant)
// @route  PUT /api/recruiters/:id
// @access Private — admin / manager
// ─────────────────────────────────────────────────────────────────────────────
export const updateRecruiter = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    // Ensure target user belongs to this tenant
    const user = await User.findOne({
      _id: req.params.id,
      $or: [{ tenantOwnerId }, { _id: tenantOwnerId }],
    });
    if (!user) return res.status(404).json({ message: 'Recruiter not found in your company' });

    if (req.body.recruiterId && req.body.recruiterId !== user.recruiterId) {
      const idExists = await User.findOne({ recruiterId: req.body.recruiterId });
      if (idExists) return res.status(400).json({ message: 'Recruiter ID already exists' });
    }
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) return res.status(400).json({ message: 'Email already exists' });
    }

    // Sync changes to Firebase Auth
    if (user.firebaseUid) {
      const fbUpdates = {};
      if (req.body.password) fbUpdates.password = req.body.password;
      if (req.body.email && req.body.email !== user.email) fbUpdates.email = req.body.email;
      if (req.body.firstName || req.body.lastName) {
        fbUpdates.displayName = `${req.body.firstName || user.firstName} ${req.body.lastName || user.lastName}`.trim();
      }
      if (Object.keys(fbUpdates).length > 0) {
        try { await admin.auth().updateUser(user.firebaseUid, fbUpdates); }
        catch (e) { console.error('Firebase admin update error (non-fatal):', e.message); }
      }
    }

    user.firstName   = req.body.firstName   || user.firstName;
    user.lastName    = req.body.lastName    || user.lastName;
    user.email       = req.body.email       || user.email;
    user.phone       = req.body.phone       || user.phone;
    user.role        = req.body.role        || user.role;
    user.username    = req.body.username    || user.username;
    user.recruiterId = req.body.recruiterId || user.recruiterId;
    if (req.body.profilePicture !== undefined) user.profilePicture = req.body.profilePicture;

    const updated = await user.save();
    res.json({
      _id:           updated._id,
      firstName:     updated.firstName,
      lastName:      updated.lastName,
      email:         updated.email,
      role:          updated.role,
      recruiterId:   updated.recruiterId,
      profilePicture: updated.profilePicture,
      tenantOwnerId:  updated.tenantOwnerId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Delete a user (admin / manager, same tenant)
// @route  DELETE /api/recruiters/:id
// @access Private — admin / manager
// ─────────────────────────────────────────────────────────────────────────────
export const deleteRecruiter = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const user = await User.findOne({
      _id: req.params.id,
      $or: [{ tenantOwnerId }, { _id: tenantOwnerId }],
    });
    if (!user) return res.status(404).json({ message: 'Recruiter not found in your company' });

    if (user.firebaseUid) {
      try { await admin.auth().deleteUser(user.firebaseUid); }
      catch (e) { console.error('Firebase delete (non-fatal):', e.message); }
    }

    if (user.profilePicture?.includes('cloudinary')) {
      try { await cloudinary.uploader.destroy(`recruiters/recruiter_${user._id}`); } catch {}
    }

    await user.deleteOne();
    res.json({ message: 'Recruiter removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Toggle active / inactive (admin / manager, same tenant)
// @route  PATCH /api/recruiters/:id/status
// @access Private — admin / manager
// ─────────────────────────────────────────────────────────────────────────────
export const toggleRecruiterStatus = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const user = await User.findOne({
      _id: req.params.id,
      $or: [{ tenantOwnerId }, { _id: tenantOwnerId }],
    });
    if (!user) return res.status(404).json({ message: 'Recruiter not found in your company' });

    const currentlyActive = user.active !== false && user.active !== 'false';
    user.active = !currentlyActive;
    await user.save();

    if (user.firebaseUid) {
      try { await admin.auth().updateUser(user.firebaseUid, { disabled: !user.active }); }
      catch (fbErr) { console.error('[toggleStatus] Firebase sync error (non-fatal):', fbErr.message); }
    }

    res.json({
      message: `${user.firstName} has been ${user.active ? 'activated' : 'deactivated'}`,
      active:  user.active,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Get users by role — for messaging recipient dropdowns (same tenant only)
// @route  GET /api/recruiters/by-role?role=recruiter
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
export const getUsersByRole = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { role } = req.query;

    const roleFilter = role
      ? { role }
      : { role: { $in: ['manager', 'recruiter', 'admin'] } };

    // Always scope to same tenant; master sees all
    const tenantFilter =
      req.user.role === 'master'
        ? {}
        : {
            $or: [
              { tenantOwnerId },
              { _id: tenantOwnerId },
            ],
          };

    const users = await User.find({ ...roleFilter, ...tenantFilter, active: true })
      .select('_id firstName lastName username email role')
      .sort({ firstName: 1 })
      .lean();

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};