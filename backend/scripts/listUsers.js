import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

async function list() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    const users = await User.find({}, 'email role firstName lastName active');
    console.log('--- REGISTERED USERS ---');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
list();
