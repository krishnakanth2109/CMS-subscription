/**
 * clearDB.js — Wipe all operational data from the database.
 *
 * Preserves: Users (admins, managers, recruiters)
 * Clears:    Candidates, Clients, Jobs, Interviews, Counters
 *
 * Usage:
 *   node scripts/clearDB.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ── Models ────────────────────────────────────────────────────────────────────
import Candidate from '../models/Candidate.js';
import Client    from '../models/Client.js';
import Job       from '../models/Job.js';
import Interview from '../models/Interview.js';

const counterSchema = new mongoose.Schema({ _id: String, seq: Number });
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// ── Connect ───────────────────────────────────────────────────────────────────
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log('✅  Connected to MongoDB:', mongoose.connection.db.databaseName);
};

// ── Clear ─────────────────────────────────────────────────────────────────────
const clearAll = async () => {
  const collections = [
    { name: 'Candidates', model: Candidate },
    { name: 'Clients',    model: Client    },
    { name: 'Jobs',       model: Job       },
    { name: 'Interviews', model: Interview  },
    { name: 'Counters',   model: Counter   },
  ];

  for (const { name, model } of collections) {
    const result = await model.deleteMany({});
    console.log(`🗑️   ${name}: deleted ${result.deletedCount} document(s)`);
  }

  console.log('\n✅  Database cleared. User accounts are preserved.');
};

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    await clearAll();
  } catch (err) {
    console.error('❌  Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected.');
    process.exit(0);
  }
})();
