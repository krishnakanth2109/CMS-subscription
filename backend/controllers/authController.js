
import User from '../models/User.js';
import { admin } from '../middleware/authMiddleware.js';
import { sendBrevoEmail } from '../services/email.js';

const fullName = (user) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email;

export const loginUser = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: 'Firebase ID token is required.' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    let user = await User.findOne({ $or: [{ firebaseUid: uid }, { email }] });
    if (!user) return res.status(401).json({ message: 'User not registered. Contact admin.' });
    if (user.active === false) return res.status(401).json({ message: 'Account deactivated.' });

    if (!user.firebaseUid) {
      user.firebaseUid = uid;
      await user.save();
    }

    let subscriptionDaysLeft = null;
    if (user.subscriptionExpiresAt) {
      subscriptionDaysLeft = Math.max(0, Math.ceil((new Date(user.subscriptionExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
    } else if (user.subscriptionPlan === 'Basic' && user.trialStartedAt) {
      const trialEnd = new Date(user.trialStartedAt);
      trialEnd.setDate(trialEnd.getDate() + 7);
      subscriptionDaysLeft = Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24)));
    }

    let candidateSettings = user.candidateSettings || { hiddenFields: [], customFields: [] };
    let clientSettings = user.clientSettings || { hiddenFields: [], customFields: [] };
    let requirementSettings = user.requirementSettings || { hiddenFields: [], customFields: [] };
    if (user.role !== 'manager' && user.tenantOwnerId) {
      const manager = await User.findById(user.tenantOwnerId).select('candidateSettings clientSettings requirementSettings');
      if (manager) {
        if (manager.candidateSettings) candidateSettings = manager.candidateSettings;
        if (manager.clientSettings) clientSettings = manager.clientSettings;
        if (manager.requirementSettings) requirementSettings = manager.requirementSettings;
      }
    }

    res.json({
      _id: user._id,
      name: fullName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      role: user.role,
      profilePicture: user.profilePicture || "",
      firebaseUid: user.firebaseUid,
      recruiterId: user.recruiterId,
      tenantOwnerId: user.tenantOwnerId,
      companyName: user.companyName,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionBilling: user.subscriptionBilling,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      subscriptionDaysLeft,
      phone: user.phone,
      candidateSettings, // Send fields payload
      clientSettings,
      requirementSettings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.' });
  }
};

export const registerUser = async (req, res) => {
  const { 
    email, password, firstName, lastName, name, username, role, profilePicture,
    companyName, subscriptionPlan, phone, tenantOwnerId 
  } = req.body;
  
  let fName = firstName;
  let lName = lastName;
  if (!fName && name) {
    const parts = name.trim().split(/\s+/);
    fName = parts[0];
    lName = parts.slice(1).join(' ') || parts[0];
  }

  try {
    const firebaseUser = await admin.auth().createUser({
      email, password, displayName: [fName, lName].filter(Boolean).join(' ')
    });

    const resolvedPlan = subscriptionPlan || 'None';
    const trialStartedAt = resolvedPlan === 'Basic' ? new Date() : null;

    const subscriptionExpiresAt = resolvedPlan === 'Basic'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : null;

    const user = await User.create({
      firebaseUid: firebaseUser.uid,
      email, firstName: fName, lastName: lName || '',
      username: username || email.split('@')[0],
      role: role || 'recruiter',
      profilePicture: profilePicture || "",
      active: true,
      companyName: companyName || "",
      subscriptionPlan: resolvedPlan,
      phone: phone || "",
      tenantOwnerId: tenantOwnerId || null,
      trialStartedAt,
      subscriptionExpiresAt,
    });

    res.status(201).json({ 
      _id: user._id, 
      name: fullName(user), 
      email: user.email, 
      profilePicture: user.profilePicture,
      companyName: user.companyName,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      candidateSettings: user.candidateSettings,
      clientSettings: user.clientSettings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    if (req.user) {
      let subscriptionDaysLeft = null;
      if (req.user.subscriptionExpiresAt) {
        subscriptionDaysLeft = Math.max(0, Math.ceil((new Date(req.user.subscriptionExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
      }

      let candidateSettings = req.user.candidateSettings || { hiddenFields: [], customFields: [] };
      let clientSettings = req.user.clientSettings || { hiddenFields: [], customFields: [] };
      let requirementSettings = req.user.requirementSettings || { hiddenFields: [], customFields: [] };
      if (req.user.role !== 'manager' && req.user.tenantOwnerId) {
        const manager = await User.findById(req.user.tenantOwnerId).select('candidateSettings clientSettings requirementSettings');
        if (manager) {
          if (manager.candidateSettings && (!req.user.candidateSettings || !req.user.candidateSettings.hiddenFields || req.user.candidateSettings.hiddenFields.length === 0)) candidateSettings = manager.candidateSettings;
          if (manager.clientSettings && (!req.user.clientSettings || !req.user.clientSettings.hiddenFields || req.user.clientSettings.hiddenFields.length === 0)) clientSettings = manager.clientSettings;
          if (manager.requirementSettings && (!req.user.requirementSettings || !req.user.requirementSettings.hiddenFields || req.user.requirementSettings.hiddenFields.length === 0)) requirementSettings = manager.requirementSettings;
        }
      }

      res.json({
        _id: req.user._id,
        username: req.user.username,
        name: fullName(req.user),
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        profilePicture: req.user.profilePicture || "",
        firebaseUid: req.user.firebaseUid,
        tenantOwnerId: req.user.tenantOwnerId,
        companyName: req.user.companyName,
        subscriptionPlan: req.user.subscriptionPlan,
        subscriptionBilling: req.user.subscriptionBilling,
        subscriptionExpiresAt: req.user.subscriptionExpiresAt,
        subscriptionDaysLeft,
        phone: req.user.phone,
        candidateSettings,
        clientSettings,
        requirementSettings,
        candidatePrefix: req.user.candidatePrefix || 'CAND',
      });
    } else {
      res.status(404).json({ message: 'User not found.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (req.body.name) {
      const nameParts = req.body.name.trim().split(/\s+/);
      user.firstName = nameParts[0];
      user.lastName = nameParts.slice(1).join(' ') || "";
    }

    if (req.body.email) user.email = req.body.email;
    if (req.body.profilePicture !== undefined) user.profilePicture = req.body.profilePicture;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    
    if (req.body.companyName !== undefined && (user.role === 'admin' || user.role === 'manager')) {
      user.companyName = req.body.companyName;
    }
    
    if (req.body.candidateSettings !== undefined) {
      user.candidateSettings = req.body.candidateSettings;
    }
    if (req.body.clientSettings !== undefined) {
      user.clientSettings = req.body.clientSettings;
    }
    if (req.body.requirementSettings !== undefined) {
      user.requirementSettings = req.body.requirementSettings;
    }

    if (user.role === 'manager' || user.role === 'admin') {
      // Allow managers to update the candidate ID prefix
      if (req.body.candidatePrefix !== undefined) {
        const p = req.body.candidatePrefix.toString().toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
        if (p.length === 4) user.candidatePrefix = p;
      }
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      name: [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' '),
      email: updatedUser.email,
      username: updatedUser.username,
      profilePicture: updatedUser.profilePicture || "",
      role: updatedUser.role,
      phone: updatedUser.phone,
      companyName: updatedUser.companyName,
      candidateSettings: updatedUser.candidateSettings,
      clientSettings: updatedUser.clientSettings,
      requirementSettings: updatedUser.requirementSettings,
      candidatePrefix: updatedUser.candidatePrefix || 'CAND',
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: error.message || 'Server Error updating profile.' });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'Reset link sent if registered.' });
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    
    await sendBrevoEmail({
      toEmail: email,
      toName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || "User",
      subject: "Password Reset Request - Arah Info Tech",
      htmlContent: `
        <html>
        <body>
          <h3>Password Reset Request</h3>
          <p>Hello,</p>
          <p>We received a request to reset your password for your Arah Info Tech account. You can do this by clicking the link below:</p>
          <div style="margin: 20px 0;">
            <a href="${resetLink}" style="background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best Regards,<br/><b>Arah Team</b></p>
        </body>
        </html>
      `
    });

    res.json({ message: 'Reset link sent if registered.' });
  } catch (error) { 
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Error' }); 
  }
};

export const deleteUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.firebaseUid) {
      await admin.auth().deleteUser(user.firebaseUid);
    }

    await User.findByIdAndDelete(req.user._id);

    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete Account Error:', error);
    res.status(500).json({ message: 'Server error deleting account.' });
  }
};
