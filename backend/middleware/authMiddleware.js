// --- START OF FILE authMiddleware.js ---
import admin from 'firebase-admin';
import User from '../models/User.js';

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:    process.env.FIREBASE_PROJECT_ID,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
      clientId:     process.env.FIREBASE_CLIENT_ID,
    }),
  });
}

export { admin };

/**
 * getTenantOwnerId — canonical helper used across ALL controllers.
 *
 * Rules:
 *   master   → null  (global, bypasses all tenant filters)
 *   manager  → user._id  (they ARE the tenant root)
 *   admin    → user.tenantOwnerId  (points to their manager)
 *   recruiter→ user.tenantOwnerId  (points to their manager)
 *
 * Export it here so every controller imports from ONE place.
 */
export const getTenantOwnerId = (user) => {
  if (user.role === 'master')  return null;
  if (user.role === 'manager') return user._id;
  return user.tenantOwnerId;
};

/**
 * protect — verifies Firebase ID token and injects req.user + req.tenantId.
 */
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ message: 'Not authorized, invalid token.' });
    }

    // 1. Verify Firebase Token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email } = decodedToken;
    req.firebaseUser = decodedToken;

    // 2. Find User in MongoDB
    let user = await User.findOne({ firebaseUid: uid }).select('-password');

    if (!user && email) {
      user = await User.findOne({ email }).select('-password');
      if (user) {
        user.firebaseUid = uid;
        await user.save();
      }
    }

    if (!user)                  return res.status(401).json({ message: 'User not found. Contact Admin.' });
    if (user.active === false)  return res.status(401).json({ message: 'Account deactivated. Contact Admin.' });

    // 3. Resolve tenantId via shared helper
    const tenantId = getTenantOwnerId(user);

    // Security check: non-master users must have a tenant context
    if (user.role !== 'master' && !tenantId) {
      return res.status(403).json({
        message: 'Account error: No company/tenant associated with this user.',
      });
    }

    req.user     = user;
    req.tenantId = tenantId;  // convenience alias — same as getTenantOwnerId(req.user)

    next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Session expired. Login again.' });
    }
    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token failed.' });
  }
};

/**
 * authorize — restricts access by role. Must come AFTER protect.
 * Usage: router.get('/path', protect, authorize('admin', 'manager'), handler)
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user?.role}' is not authorized for this action.`,
      });
    }
    next();
  };
};