import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js'; // Adjust path if your User model is elsewhere
import { admin } from './middleware/authMiddleware.js'; // Adjust path to your authMiddleware

const seedMasterAccount = async () => {
  const MASTER_EMAIL = 'sanjaykumar@gmail.com';
  const MASTER_PASSWORD = 'Admin@2026';
  const MASTER_NAME = 'Sanjay Kumar';

  try {
    console.log('🔄 Connecting to Database...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB.');

    // 1. Check if a Master already exists in MongoDB
    const existingMaster = await User.findOne({ role: 'master' });
    if (existingMaster) {
      console.log('⚠️ A Master account already exists in MongoDB.');
      console.log(`Current Master Email: ${existingMaster.email}`);
      process.exit(0);
    }

    // 2. Create or Update Firebase User
    let firebaseUser;
    try {
      console.log('🔄 Checking Firebase for existing user...');
      firebaseUser = await admin.auth().getUserByEmail(MASTER_EMAIL);
      console.log('⚠️ User found in Firebase. Updating password to ensure access...');
      await admin.auth().updateUser(firebaseUser.uid, { 
        password: MASTER_PASSWORD,
        displayName: MASTER_NAME 
      });
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log('🔄 Creating new user in Firebase...');
        firebaseUser = await admin.auth().createUser({ 
          email: MASTER_EMAIL, 
          password: MASTER_PASSWORD, 
          displayName: MASTER_NAME 
        });
      } else {
        throw err;
      }
    }
    console.log('✅ Firebase User Ready. UID:', firebaseUser.uid);

    // 3. Check if user exists in MongoDB as a regular user
    let mongoUser = await User.findOne({ email: MASTER_EMAIL });
    
    if (mongoUser) {
      console.log('⚠️ User found in MongoDB. Upgrading role to Master...');
      mongoUser.role = 'master';
      mongoUser.firebaseUid = firebaseUser.uid;
      await mongoUser.save();
    } else {
      console.log('🔄 Creating new Master record in MongoDB...');
      mongoUser = await User.create({
        firebaseUid: firebaseUser.uid,
        email: MASTER_EMAIL,
        firstName: 'Sanjay',
        lastName: 'Kumar',
        username: 'sanjaykumar_master',
        role: 'master',
        active: true,
      });
    }

    console.log('🎉 SUCCESS! Master Seeding Complete.');
    console.log('-------------------------------------------');
    console.log(`Email:    ${MASTER_EMAIL}`);
    console.log(`Password: ${MASTER_PASSWORD}`);
    console.log('-------------------------------------------');
    console.log('You can now log into the /master page.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ SEEDING FAILED:', error);
    process.exit(1);
  }
};

seedMasterAccount();