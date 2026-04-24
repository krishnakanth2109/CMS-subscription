// --- START OF FILE server.js ---
import 'dotenv/config';

import express          from 'express';
import cors             from 'cors';
import mongoose         from 'mongoose';
import { createServer } from 'http';
import { Server }       from 'socket.io';
import path             from 'path';
import { fileURLToPath } from 'url';
import fs               from 'fs';

import { protect, authorize, getTenantOwnerId } from './middleware/authMiddleware.js';
import Candidate from './models/Candidate.js';
import User      from './models/User.js';

// ── Route modules ─────────────────────────────────────────────────────────────
import authRoutes      from './routes/authRoutes.js';
import recruiterRoutes from './routes/recruiterRoutes.js';
import candidateRoutes from './routes/candidateRoutes.js';
import clientRoutes    from './routes/clientRoutes.js';
import jobRoutes       from './routes/jobRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import messageRoutes   from './routes/messageRoutes.js';
import channelRoutes   from './routes/channelRoutes.js';
import aiMockRoutes    from './routes/aiMockRoutes.js';
import paymentRoutes   from './routes/paymentRoutes.js';   // 🔹 NEW

// ── Agreement Module ──────────────────────────────────────────────────────────
import { connectAgreementDB }   from './config/agreementDatabase.js';
import agreementCompanyRoutes   from './routes/agreementCompanyRoutes.js';
import agreementLetterRoutes    from './routes/agreementLetterRoutes.js';
import agreementEmailRoutes     from './routes/agreementEmailRoutes.js';
import agreementUploadRoutes    from './routes/agreementUploadRoutes.js';
import masterRoutes             from './routes/masterRoutes.js';

// ── __dirname shim for ES Modules ─────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const app        = express();
const httpServer = createServer(app);

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5174').trim().replace(/\/$/, '');

const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://vagarious-cms.netlify.app',
  'https://cms-vagarious.netlify.app',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://cms-subscription.netlify.app'
];

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true },
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:         ALLOWED_ORIGINS,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'forenten')));

// ── Database ──────────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();
  connectAgreementDB().catch(err => console.warn('Agreement DB not connected:', err.message));
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.IO with DB: ${mongoose.connection.db?.databaseName}`);
  });
};

startServer();

// ── Socket.IO events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`⚡ Socket Connected: ${socket.id}`);

  socket.on('join_room', (roomId) => {
    if (roomId) { socket.join(roomId); console.log(`👤 Socket joined room: ${roomId}`); }
  });

  socket.on('leave_room', (roomId) => {
    if (roomId) socket.leave(roomId);
  });

  socket.on('send_message', (data) => {
    if (data.to === 'all') socket.broadcast.emit('receive_message', data);
    else socket.to(data.to).emit('receive_message', data);
  });

  socket.on('channel_message', (data) => {
    if (data.channelId) socket.to(`channel_${data.channelId}`).emit('channel_message', data);
  });

  socket.on('channel_created', (channel) => socket.broadcast.emit('channel_created', channel));
  socket.on('channel_updated', (channel) => socket.broadcast.emit('channel_updated', channel));
  socket.on('channel_deleted', (payload) => socket.broadcast.emit('channel_deleted', payload));

  socket.on('disconnect', () => console.log(`⚡ Socket Disconnected: ${socket.id}`));
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MODULES
// ═══════════════════════════════════════════════════════════════════════════════
app.use('/api/auth',       authRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/clients',    clientRoutes);
app.use('/api/jobs',       jobRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/messages',   messageRoutes);
app.use('/api/channels',   channelRoutes);
app.use('/api/ai-mock',    aiMockRoutes);
app.use('/api/payments',   paymentRoutes);

// Agreement module
app.use('/agreement-companies', protect, agreementCompanyRoutes);
app.use('/agreement-letters', protect, agreementLetterRoutes);
app.use('/agreement-email', protect, agreementEmailRoutes);
app.use('/upload', protect, agreementUploadRoutes);
app.use('/api/master',          masterRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY FALLBACK ROUTES (matches frontend when VITE_API_URL doesn't end in /api)
// ═══════════════════════════════════════════════════════════════════════════════
app.use('/auth',       authRoutes);
app.use('/recruiters', recruiterRoutes);
app.use('/candidates', candidateRoutes);
app.use('/clients',    clientRoutes);
app.use('/jobs',       jobRoutes);
app.use('/interviews', interviewRoutes);
app.use('/messages',   messageRoutes);
app.use('/channels',   channelRoutes);
app.use('/ai-mock',    aiMockRoutes);
app.use('/payments',   paymentRoutes);    // 🔹 FIXED: Added missing payment fallback
app.use('/master',     masterRoutes);     // 🔹 FIXED: Added missing master fallback
app.use('/',           aiMockRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reports — Admin & Manager dashboard (TENANT-SCOPED)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reports', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { filter = 'all', date, month } = req.query;

    const now = new Date();
    let dateQuery = {};

    if (date) {
      const [yyyy, mm, dd] = date.split('-').map(Number);
      dateQuery = {
        createdAt: {
          $gte: new Date(yyyy, mm - 1, dd, 0, 0, 0, 0),
          $lte: new Date(yyyy, mm - 1, dd, 23, 59, 59, 999),
        },
      };
    } else if (filter === 'day') {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      dateQuery = { createdAt: { $gte: s } };
    } else if (filter === 'week') {
      const s = new Date(now); s.setDate(now.getDate() - 7);
      dateQuery = { createdAt: { $gte: s } };
    } else if (filter === 'month') {
      if (month !== undefined) {
        const mIdx = parseInt(month);
        const yr   = mIdx > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
        dateQuery  = {
          createdAt: {
            $gte: new Date(yr, mIdx, 1, 0, 0, 0, 0),
            $lte: new Date(yr, mIdx + 1, 0, 23, 59, 59, 999),
          },
        };
      } else {
        const s = new Date(now); s.setMonth(now.getMonth() - 1);
        dateQuery = { createdAt: { $gte: s } };
      }
    }

    const INTERVIEW_STAGES = [
      'L1 Interview', 'L2 Interview', 'L3 Interview', 'L4 Interview', 'L5 Interview',
      'Final Interview', 'Technical Round', 'Technical Interview', 'HR Round', 'HR Interview', 'Interview',
    ];

    const hasStatus       = (c, s) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s);
    const hasAnyInterview = (c)    => (Array.isArray(c.status) ? c.status : [c.status || '']).some(s => INTERVIEW_STAGES.includes(s));

    const candidates = await Candidate.find({ tenantOwnerId, ...dateQuery })
      .select('status recruiterId recruiterName createdAt')
      .lean();

    const totalSelected = candidates.filter(c => hasStatus(c, 'Selected')).length;
    const totalJoined   = candidates.filter(c => hasStatus(c, 'Joined')).length;
    const conversionNum = totalSelected > 0 ? Math.round((totalJoined / totalSelected) * 100) : 0;

    const activeRecruiters = await User.countDocuments({
      role: 'recruiter',
      active: true,
      $or: [{ tenantOwnerId }, { _id: tenantOwnerId }],
    });

    const recruiterMap = new Map();
    for (const c of candidates) {
      const key  = c.recruiterId?.toString() || 'unassigned';
      const name = c.recruiterName || 'Unassigned';
      if (!recruiterMap.has(key)) {
        recruiterMap.set(key, { name, Submissions: 0, Turnups: 0, Selected: 0, Joined: 0 });
      }
      const row = recruiterMap.get(key);
      row.Submissions += 1;
      if (hasAnyInterview(c))      row.Turnups  += 1;
      if (hasStatus(c, 'Selected')) row.Selected += 1;
      if (hasStatus(c, 'Joined'))   row.Joined   += 1;
    }
    const recruiterPerformance = Array.from(recruiterMap.values())
      .sort((a, b) => b.Submissions - a.Submissions);

    const MONTHS      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const mC    = await Candidate.find({ tenantOwnerId, createdAt: { $gte: start, $lte: end } })
        .select('status')
        .lean();
      monthlyData.push({
        month:      MONTHS[d.getMonth()],
        candidates: mC.length,
        joined:     mC.filter(c => hasStatus(c, 'Joined')).length,
        selected:   mC.filter(c => hasStatus(c, 'Selected')).length,
        rejected:   mC.filter(c => hasStatus(c, 'Rejected')).length,
        hold:       mC.filter(c => hasStatus(c, 'Hold')).length,
      });
    }

    res.json({
      overview: {
        totalCandidates: candidates.length,
        activeRecruiters,
        conversionRate: `${conversionNum}%`,
      },
      recruiterPerformance,
      monthlyData,
    });
  } catch (error) {
    console.error('[Reports] /api/reports error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reports/recruiter
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reports/recruiter', protect, async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const recruiterId   = req.user._id;

    const INTERVIEW_STAGES = new Set([
      'L1 Interview', 'L2 Interview', 'L3 Interview', 'L4 Interview', 'L5 Interview',
      'Final Interview', 'Technical Round', 'Technical Interview', 'HR Round', 'HR Interview', 'Interview',
    ]);

    const all = await Candidate.find({ tenantOwnerId, recruiterId })
      .select('status createdAt')
      .lean();

    const hasStatus       = (c, s) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s);
    const hasAnyInterview = (c)    => (Array.isArray(c.status) ? c.status : [c.status || '']).some(s => INTERVIEW_STAGES.has(s));

    const totalSubmissions         = all.length;
    const totalInterviewsScheduled = all.filter(c => hasAnyInterview(c)).length;
    const joined                   = all.filter(c => hasStatus(c, 'Joined')).length;
    const selected                 = all.filter(c => hasStatus(c, 'Selected')).length;
    const rejected                 = all.filter(c => hasStatus(c, 'Rejected')).length;
    const hold                     = all.filter(c => hasStatus(c, 'Hold')).length;
    const successRate              = totalSubmissions > 0
      ? Math.round((joined / totalSubmissions) * 100) : 0;

    const now        = new Date();
    const weeklyData = [];

    for (let w = 3; w >= 0; w--) {
      const wEnd = new Date(now);
      wEnd.setDate(now.getDate() - w * 7);
      wEnd.setHours(23, 59, 59, 999);
      const wStart = new Date(wEnd);
      wStart.setDate(wEnd.getDate() - 6);
      wStart.setHours(0, 0, 0, 0);

      const wC = all.filter(c => {
        const d = new Date(c.createdAt);
        return d >= wStart && d <= wEnd;
      });

      weeklyData.push({
        week:       `W${4 - w}`,
        submitted:  wC.length,
        interviews: wC.filter(c => hasAnyInterview(c)).length,
        selected:   wC.filter(c => hasStatus(c, 'Selected')).length,
        rejected:   wC.filter(c => hasStatus(c, 'Rejected')).length,
        hold:       wC.filter(c => hasStatus(c, 'Hold')).length,
        joined:     wC.filter(c => hasStatus(c, 'Joined')).length,
      });
    }

    const MONTHS      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const d      = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const mC     = all.filter(c => {
        const cd = new Date(c.createdAt);
        return cd >= mStart && cd <= mEnd;
      });
      if (mC.length > 0 || i < 6) {
        monthlyData.push({
          month:      MONTHS[d.getMonth()],
          submitted:  mC.length,
          interviews: mC.filter(c => hasAnyInterview(c)).length,
          selected:   mC.filter(c => hasStatus(c, 'Selected')).length,
          rejected:   mC.filter(c => hasStatus(c, 'Rejected')).length,
          hold:       mC.filter(c => hasStatus(c, 'Hold')).length,
          joined:     mC.filter(c => hasStatus(c, 'Joined')).length,
        });
      }
    }

    res.json({
      stats: { totalSubmissions, totalInterviewsScheduled, joined, selected, rejected, hold, successRate },
      weeklyData,
      monthlyData,
    });
  } catch (error) {
    console.error('[Reports] /api/reports/recruiter error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Server Error Log:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});