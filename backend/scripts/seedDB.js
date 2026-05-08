/**
 * seedDB.js — Populate the database with realistic dummy data.
 *
 * What it creates (all scoped to the first Manager user found):
 *   • 5 Clients
 *   • 8 Job Requirements
 *   • 30 Candidates  (spread across recruiters, various statuses)
 *
 * Prerequisites:
 *   • At least one user with role='manager' must already exist in the DB.
 *   • At least one user with role='recruiter' (or admin/manager) must exist.
 *
 * Usage:
 *   node scripts/seedDB.js
 *
 * Re-running is safe — it clears existing Candidates/Clients/Jobs first.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Client from '../models/Client.js';
import Job from '../models/Job.js';
import Candidate from '../models/Candidate.js';

// ── Connect ───────────────────────────────────────────────────────────────────
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log('✅  Connected to MongoDB:', mongoose.connection.db.databaseName);
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const range = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad = (n, len = 3) => n.toString().padStart(len, '0');

// ── Raw Data ──────────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aarav', 'Priya', 'Rohan', 'Sneha', 'Vikram', 'Anjali', 'Karthik', 'Divya',
  'Arjun', 'Meera', 'Suresh', 'Nisha', 'Rajesh', 'Pooja', 'Aditya', 'Kavya',
  'Nikhil', 'Swathi', 'Rahul', 'Lakshmi', 'Amit', 'Sunita', 'Vishal', 'Rekha',
  'Deepak', 'Ananya', 'Sanjay', 'Pallavi', 'Ravi', 'Sruthi',
  'Manoj', 'Ishani', 'Varun', 'Tanvi', 'Harish', 'Riya', 'Ganesh', 'Nehal',
  'Abhay', 'Zoya', 'Yash', 'Kiran', 'Pranav', 'Amrita', 'Rahul', 'Sanjana',
  'Omkar', 'Tara', 'Naveen', 'Isha', 'Madhav', 'Leela', 'Sahil', 'Diya',
  'Prateek', 'Kiara', 'Tushar', 'Myra', 'Kabir', 'Vanya'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Iyer', 'Nair', 'Rao',
  'Verma', 'Gupta', 'Joshi', 'Mehta', 'Shah', 'Das', 'Pillai', 'Menon',
];

const POSITIONS = [
  'Software Engineer', 'Senior Developer', 'React Developer', 'Node.js Developer',
  'Full Stack Engineer', 'DevOps Engineer', 'QA Analyst', 'Data Analyst',
  'Business Analyst', 'Project Manager', 'UI/UX Designer', 'Python Developer',
];

const SKILLS_POOL = [
  ['React', 'JavaScript', 'HTML', 'CSS', 'Git'],
  ['Node.js', 'Express', 'MongoDB', 'REST API'],
  ['Python', 'Django', 'FastAPI', 'PostgreSQL'],
  ['Java', 'Spring Boot', 'Microservices', 'Kafka'],
  ['DevOps', 'AWS', 'Docker', 'Kubernetes', 'CI/CD'],
  ['React', 'TypeScript', 'Redux', 'Material UI'],
  ['QA', 'Selenium', 'JIRA', 'Postman', 'Manual Testing'],
  ['Data Analysis', 'SQL', 'Power BI', 'Excel', 'Python'],
];

const LOCATIONS = [
  'Bangalore', 'Hyderabad', 'Chennai', 'Mumbai', 'Pune',
  'Delhi', 'Noida', 'Gurgaon', 'Kolkata', 'Ahmedabad',
];

const COMPANIES = [
  'Infosys', 'TCS', 'Wipro', 'HCL', 'Cognizant',
  'Accenture', 'Tech Mahindra', 'Capgemini', 'IBM', 'Mindtree',
];

const NOTICE_PERIODS = ['Immediate', '15 Days', '30 Days', '60 Days', '90 Days'];

const STATUSES_POOL = [
  ['Submitted'],
  ['Submitted', 'Shared Profiles'],
  ['Submitted', 'Shared Profiles', 'Yet to attend'],
  ['Submitted', 'Shared Profiles', 'Turnups'],
  ['Submitted', 'Shared Profiles', 'Turnups', 'Selected'],
  ['Submitted', 'Shared Profiles', 'Turnups', 'Rejected'],
  ['Submitted', 'Shared Profiles', 'Turnups', 'Selected', 'Joined'],
  ['Submitted', 'Hold'],
  ['Submitted', 'Pipeline'],
  ['Submitted', 'Backout'],
  ['Submitted', 'No Show'],
];

const CLIENT_DATA = [
  { companyName: 'Infosys Ltd', companyCode: 'INF', contactPerson: 'Ramesh Iyer', email: 'hr@infosys.com', phone: '9876543210', industry: 'Information Technology', clientLocation: 'Bangalore', percentage: '8.33' },
  { companyName: 'TCS Global', companyCode: 'TCS', contactPerson: 'Priya Sharma', email: 'hr@tcs.com', phone: '9876543211', industry: 'Information Technology', clientLocation: 'Mumbai', percentage: '8.33' },
  { companyName: 'Wipro Technologies', companyCode: 'WIP', contactPerson: 'Anil Menon', email: 'hr@wipro.com', phone: '9876543212', industry: 'Software Services', clientLocation: 'Hyderabad', percentage: '10' },
  { companyName: 'HCL Technologies', companyCode: 'HCL', contactPerson: 'Sunita Rao', email: 'hr@hcl.com', phone: '9876543213', industry: 'IT Consulting', clientLocation: 'Noida', percentage: '8.33' },
  { companyName: 'Cognizant CTS', companyCode: 'COG', contactPerson: 'Vijay Pillai', email: 'hr@cognizant.com', phone: '9876543214', industry: 'Information Technology', clientLocation: 'Chennai', percentage: '8.33' },
];

const JOB_POSITIONS = [
  { position: 'Senior React Developer', location: 'Bangalore', experience: '4-7 Years', salaryBudget: '20-30 LPA' },
  { position: 'Node.js Backend Engineer', location: 'Hyderabad', experience: '3-6 Years', salaryBudget: '15-25 LPA' },
  { position: 'DevOps Engineer', location: 'Pune', experience: '3-5 Years', salaryBudget: '18-28 LPA' },
  { position: 'Python Developer', location: 'Chennai', experience: '2-5 Years', salaryBudget: '12-20 LPA' },
  { position: 'QA Automation Engineer', location: 'Mumbai', experience: '2-4 Years', salaryBudget: '10-18 LPA' },
  { position: 'Full Stack Engineer', location: 'Noida', experience: '3-6 Years', salaryBudget: '15-22 LPA' },
  { position: 'Java Spring Boot Dev', location: 'Gurgaon', experience: '4-8 Years', salaryBudget: '20-35 LPA' },
  { position: 'Data Analyst', location: 'Bangalore', experience: '2-4 Years', salaryBudget: '10-16 LPA' },
  { position: 'Product Manager', location: 'Remote', experience: '5-8 Years', salaryBudget: '25-40 LPA' },
  { position: 'UI Designer', location: 'Mumbai', experience: '2-5 Years', salaryBudget: '12-18 LPA' },
];

// ── Seed ──────────────────────────────────────────────────────────────────────
const seed = async () => {
  // ── 1. Find manager ────────────────────────────────────────────────────────
  const manager = await User.findOne({ 
    role: 'manager', 
    email: { $in: ['vipul2@gmail.com'] } 
  }).lean() || await User.findOne({ role: 'manager' }).sort({ createdAt: -1 }).lean();

  if (!manager) {
    console.error('❌  No manager user found. Please register a manager account first.');
    process.exit(1);
  }
  const tenantOwnerId = manager._id;
  console.log(`\n👤  Manager: ${manager.firstName} ${manager.lastName} (${manager.email})`);

  // ── 2. Find recruiters for this tenant ─────────────────────────────────────
  const recruiters = await User.find({
    role: { $in: ['recruiter', 'admin', 'manager'] },
    $or: [{ tenantOwnerId }, { _id: tenantOwnerId }],
  }).lean();

  if (recruiters.length === 0) {
    console.error('❌  No recruiters found under this manager. Please create at least one recruiter.');
    process.exit(1);
  }
  console.log(`👥  Found ${recruiters.length} recruiter(s)`);

  // ── 3. Clear existing data ─────────────────────────────────────────────────
  console.log('\n🗑️   Clearing existing Clients, Jobs, Candidates...');
  await Client.deleteMany({ tenantOwnerId });
  await Job.deleteMany({ tenantOwnerId });
  await Candidate.deleteMany({ tenantOwnerId });
  // Reset counter so IDs restart from 001
  try {
    const Counter = mongoose.models.Counter || mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: Number }));
    await Counter.deleteMany({ _id: 'candidate' });
  } catch (_) { }
  console.log('   Done.');

  // ── 4. Create Clients ──────────────────────────────────────────────────────
  console.log('\n🏢  Creating clients...');
  const createdClients = [];
  for (let i = 0; i < CLIENT_DATA.length; i++) {
    const c = await Client.create({
      ...CLIENT_DATA[i],
      tenantOwnerId,
      clientId: `CLT-${pad(i + 1)}`,
      address: `${range(1, 200)} Tech Park, ${CLIENT_DATA[i].clientLocation}`,
      terms: `Net ${pick(['30', '45', '60'])} days`,
      paymentMode: pick(['Bank Transfer', 'Cheque', 'NEFT']),
      candidatePeriod: `${range(3, 6)} months`,
      replacementPeriod: `${range(1, 3)} months`,
      lockingPeriod: `${range(6, 12)} months`,
      active: true,
    });
    createdClients.push(c);
    console.log(`   ✓ ${c.companyName} (${c.clientId})`);
  }

  // ── 5. Create Jobs ─────────────────────────────────────────────────────────
  console.log('\n📋  Creating job requirements...');
  const createdJobs = [];
  for (let i = 0; i < JOB_POSITIONS.length; i++) {
    const client = createdClients[i % createdClients.length];
    const tatDate = new Date();
    tatDate.setDate(tatDate.getDate() + range(7, 30));

    const j = await Job.create({
      jobCode: `REQ${pad(i + 1, 4)}`,
      tenantOwnerId,
      clientName: client.companyName,
      position: JOB_POSITIONS[i].position,
      location: JOB_POSITIONS[i].location,
      experience: JOB_POSITIONS[i].experience,
      salaryBudget: JOB_POSITIONS[i].salaryBudget,
      noticePeriod: pick(['Immediate', '15 Days', '30 Days']),
      tatTime: tatDate,
      primaryRecruiter: recruiters[0] ? `${recruiters[0].firstName} ${recruiters[0].lastName}` : '',
      secondaryRecruiter: recruiters[1] ? `${recruiters[1].firstName} ${recruiters[1].lastName}` : '',
      skills: pick(SKILLS_POOL).join(', '),
      active: true,
      createdBy: manager._id,
    });
    createdJobs.push(j);
    console.log(`   ✓ ${j.jobCode} — ${j.position} @ ${j.clientName}`);
  }

  // ── 6. Create Candidates ───────────────────────────────────────────────────
  console.log('\n👤  Creating candidates...');
  const prefix = manager.candidatePrefix || 'CAND';
  let candSeq = 1;

  for (let i = 0; i < 60; i++) {
    const firstName = FIRST_NAMES[i] || pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const recruiter = recruiters[i % recruiters.length];
    const client = createdClients[i % createdClients.length];
    const status = pick(STATUSES_POOL);
    const skills = pick(SKILLS_POOL);
    const ctcVal = range(8, 40);
    const ectcVal = ctcVal + range(2, 8);
    const expYrs = range(1, 12);
    const relExpYrs = Math.min(expYrs, range(1, expYrs));
    const dateAdded = new Date();
    dateAdded.setDate(dateAdded.getDate() - range(0, 90)); // spread over last 3 months

    await Candidate.create({
      candidateId: `${prefix}-${pad(candSeq++)}`,
      tenantOwnerId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${range(10, 99)}@gmail.com`,
      contact: `9${range(100000000, 999999999)}`,
      alternateNumber: `9${range(100000000, 999999999)}`,
      position: pick(POSITIONS),
      client: client.companyName,
      currentCompany: pick(COMPANIES),
      currentLocation: pick(LOCATIONS),
      preferredLocation: pick(LOCATIONS),
      totalExperience: `${expYrs} Years`,
      relevantExperience: `${relExpYrs} Years`,
      education: pick(['B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Sc', 'MBA']),
      gender: pick(['Male', 'Female', 'Male', 'Male', 'Female']),
      skills,
      ctc: `${ctcVal} `,
      ectc: `${ectcVal} `,
      currentTakeHome: `${Math.round(ctcVal * 0.7)} `,
      noticePeriod: pick(NOTICE_PERIODS),
      servingNoticePeriod: Math.random() > 0.7,
      offersInHand: Math.random() > 0.8,
      source: pick(['Portal', 'LinkedIn', 'Referral', 'Job Fair', 'Walk-in', 'Naukri']),
      status,
      recruiterId: recruiter._id,
      recruiterName: `${recruiter.firstName} ${recruiter.lastName}`,
      remarks: pick([
        'Good communication skills',
        'Strong technical background',
        'Immediate joiner',
        'Currently serving notice period',
        'Excellent problem solver',
        'Team player with good attitude',
        'Open to relocation',
        '',
      ]),
      rating: range(1, 5),
      active: true,
      dateAdded,
      customFields: {
        "Expected Joining": pick(['Immediate', 'Within 15 days', '1 Month']),
        "Interview Round": range(1, 4),
        "Last Appraisal": `${range(5, 20)}%`
      }
    });

    console.log(`   ✓ [${prefix}-${pad(candSeq - 1)}] ${firstName} ${lastName} — ${status[status.length - 1]}`);
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('🎉  Seed complete!');
  console.log(`   Clients:    ${createdClients.length}`);
  console.log(`   Jobs:       ${createdJobs.length}`);
  console.log(`   Candidates: 60`);
  console.log('─'.repeat(50) + '\n');
};

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    await seed();
  } catch (err) {
    console.error('❌  Seed error:', err.message);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected.');
    process.exit(0);
  }
})();
