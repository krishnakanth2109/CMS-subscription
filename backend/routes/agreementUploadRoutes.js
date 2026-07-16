import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { getAgreementDB as getDB } from '../config/agreementDatabase.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Configure disk storage for legacy template-pdf local upload
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', '..', 'client', 'public');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, publicDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        cb(null, baseName + '_' + uniqueSuffix + extension);
    }
});

const uploadLocal = multer({ storage: storage });
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ── GET /templates — Retrieve all custom templates ──
router.get('/templates', async (req, res) => {
    try {
        const db = getDB();
        const templatesColl = db.collection('agreement_templates');
        const list = await templatesColl.find({}).sort({ createdAt: -1 }).toArray();
        const formattedList = list.map(item => ({
            id: item._id.toString(),
            name: item.name,
            fileName: item.fileName,
            mimeType: item.mimeType,
            size: item.size,
            url: item.url,
            publicId: item.publicId,
            resourceType: item.resourceType || 'raw',
            createdAt: item.createdAt
        }));
        res.json(formattedList);
    } catch (err) {
        console.error('List templates error:', err);
        res.status(500).json({ detail: err.message });
    }
});

// ── POST /templates — Upload template to Cloudinary and database ──
router.post('/templates', uploadMemory.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ detail: 'No file uploaded' });
        }

        const name = req.body.name || file.originalname;
        const resourceType = (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') ? 'image' : 'raw';

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'agreement_templates',
                    resource_type: resourceType,
                    public_id: `template_${Date.now()}`
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(file.buffer);
        });

        // Save in MongoDB collection 'agreement_templates'
        const db = getDB();
        const templatesColl = db.collection('agreement_templates');
        const templateData = {
            name: name,
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            resourceType: resourceType,
            createdAt: new Date()
        };

        const result = await templatesColl.insertOne(templateData);
        
        res.json({
            status: 'success',
            message: 'Template uploaded successfully',
            template: {
                id: result.insertedId.toString(),
                ...templateData
            }
        });
    } catch (err) {
        console.error('Template upload error:', err);
        res.status(500).json({ detail: err.message });
    }
});

// ── DELETE /templates/:id — Delete a template ──
router.delete('/templates/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const db = getDB();
        const templatesColl = db.collection('agreement_templates');
        
        const template = await templatesColl.findOne({ _id: new ObjectId(id) });
        if (!template) {
            return res.status(404).json({ detail: 'Template not found' });
        }

        // Delete from Cloudinary
        try {
            await cloudinary.uploader.destroy(template.publicId, { resource_type: template.resourceType || 'raw' });
        } catch (cloudErr) {
            console.error('Cloudinary destroy error:', cloudErr);
        }

        // Delete from database
        await templatesColl.deleteOne({ _id: new ObjectId(id) });

        res.json({
            status: 'success',
            message: 'Template deleted successfully'
        });
    } catch (err) {
        console.error('Delete template error:', err);
        res.status(500).json({ detail: err.message });
    }
});

// ── POST /template-pdf — Legacy upload custom template PDF ──
router.post('/template-pdf', uploadLocal.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ detail: 'No file uploaded' });
        }
        res.json({
            status: 'success',
            filename: file.filename,
            url: `/${file.filename}`,
            message: 'Template uploaded successfully'
        });
    } catch (err) {
        console.error('Legacy Upload error:', err);
        res.status(500).json({ detail: err.message });
    }
});

export default router;

