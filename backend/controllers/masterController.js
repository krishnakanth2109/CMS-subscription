import User from '../models/User.js';
import { admin } from '../middleware/authMiddleware.js';

// @desc    Seed Master Admin Account (Run once securely)
// @route   POST /api/master/seed
// @access  Public (But blocks if master already exists)
export const seedMaster = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // 1. Check if ANY master exists in DB to prevent duplicate seeding
    const existingMaster = await User.findOne({ role: 'master' });
    if (existingMaster) {
      return res.status(403).json({ message: 'Master account already exists. Seeding blocked.' });
    }

    // 2. Safely create or fetch Firebase User
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
      // If user exists in Firebase but not Mongo, update password
      await admin.auth().updateUser(firebaseUser.uid, { password, displayName: name });
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await admin.auth().createUser({ email, password, displayName: name });
      } else {
        throw err;
      }
    }

    // 3. Create Master in MongoDB
    const master = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      firstName: name.split(' ')[0],
      lastName: name.split(' ')[1] || '',
      role: 'master',
      active: true,
    });

    res.status(201).json({
      message: 'Master Admin seeded successfully.',
      master: { _id: master._id, email: master.email }
    });

  } catch (error) {
    console.error('Master Seeding Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Managers for the Master Dashboard
// @route   GET /api/master/managers
// @access  Private (Master only)
export const getAllManagers = async (req, res) => {
  try {
    // Find all users who own a company
    const managers = await User.find({ role: 'manager' })
      .select('-password -firebaseUid')
      .sort({ createdAt: -1 });

    res.json(managers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching managers.' });
  }
};

// @desc    Update a Manager's Subscription Plan or Status
// @route   PUT /api/master/managers/:id
// @access  Private (Master only)
export const updateManager = async (req, res) => {
  try {
    const { subscriptionPlan, active } = req.body;
    
    const manager = await User.findById(req.params.id);
    if (!manager) return res.status(404).json({ message: 'Manager not found.' });
    if (manager.role !== 'manager') return res.status(400).json({ message: 'User is not a manager.' });

    if (subscriptionPlan !== undefined) manager.subscriptionPlan = subscriptionPlan;
    if (active !== undefined) manager.active = active;

    const updated = await manager.save();

    res.json({
      message: 'Manager updated successfully',
      manager: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating manager.' });
  }
};