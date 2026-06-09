import DemoRequest from '../models/DemoRequest.js';

const allowedCompanySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];
const allowedStatuses = ['new', 'contacted', 'scheduled', 'closed'];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeText = (value) => String(value || '').trim();

const normalizePhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return '';
};

const parseFutureDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() <= Date.now()) return null;
  return parsed;
};

const buildValidationErrors = (body) => {
  const errors = {};

  const fullName = normalizeText(body.fullName);
  if (!fullName) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.length < 2 || !/[A-Za-z]/.test(fullName) || /^\d+$/.test(fullName)) {
    errors.fullName = 'Enter a valid full name.';
  }

  const workEmail = normalizeText(body.workEmail).toLowerCase();
  if (!workEmail) {
    errors.workEmail = 'Work email is required.';
  } else if (!emailPattern.test(workEmail)) {
    errors.workEmail = 'Enter a valid work email.';
  }

  const phoneNumber = normalizePhoneNumber(body.phoneNumber);
  if (!normalizeText(body.phoneNumber)) {
    errors.phoneNumber = 'Phone number is required.';
  } else if (!phoneNumber) {
    errors.phoneNumber = 'Enter a valid Indian mobile number.';
  }

  const companyName = normalizeText(body.companyName);
  if (!companyName) {
    errors.companyName = 'Company name is required.';
  } else if (companyName.length < 2) {
    errors.companyName = 'Enter a valid company name.';
  }

  const companySize = normalizeText(body.companySize);
  if (!companySize) {
    errors.companySize = 'Company size is required.';
  } else if (!allowedCompanySizes.includes(companySize)) {
    errors.companySize = 'Select a valid company size.';
  }

  const preferredDemoTime = parseFutureDate(body.preferredDemoTime);
  if (!normalizeText(body.preferredDemoTime)) {
    errors.preferredDemoTime = 'Preferred demo date and time is required.';
  } else if (!preferredDemoTime) {
    errors.preferredDemoTime = 'Choose a valid future date and time.';
  }

  const designation = normalizeText(body.designation);
  if (designation.length > 120) {
    errors.designation = 'Designation should be 120 characters or less.';
  }

  const message = normalizeText(body.message);
  if (message.length > 1000) {
    errors.message = 'Message should be 1000 characters or less.';
  }

  const source = normalizeText(body.source) || 'CMS Demo Request';
  if (source.length > 80) {
    errors.source = 'Source is too long.';
  }

  return {
    errors,
    normalized: {
      fullName,
      workEmail,
      phoneNumber,
      companyName,
      companySize,
      designation,
      preferredDemoTime,
      message,
      source,
    },
  };
};

export const createDemoRequest = async (req, res) => {
  try {
    const { errors, normalized } = buildValidationErrors(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: 'Please correct the highlighted fields.',
        errors,
      });
    }

    const demoRequest = await DemoRequest.create({
      ...normalized,
      status: 'new',
      isRead: false,
    });

    return res.status(201).json({
      message: 'Demo request submitted successfully. Our team will contact you soon.',
      demoRequest,
    });
  } catch (error) {
    console.error('Create demo request error:', error);
    return res.status(500).json({ message: 'Failed to submit demo request.' });
  }
};

export const getDemoRequests = async (req, res) => {
  try {
    const demoRequests = await DemoRequest.find().sort({ createdAt: -1 }).lean();
    return res.json(demoRequests);
  } catch (error) {
    console.error('Get demo requests error:', error);
    return res.status(500).json({ message: 'Failed to load demo requests.' });
  }
};

export const getUnreadDemoRequestCount = async (req, res) => {
  try {
    const count = await DemoRequest.countDocuments({ isRead: false });
    return res.json({ count });
  } catch (error) {
    console.error('Unread demo request count error:', error);
    return res.status(500).json({ message: 'Failed to load unread count.' });
  }
};

export const markDemoRequestAsRead = async (req, res) => {
  try {
    const demoRequest = await DemoRequest.findById(req.params.id);
    if (!demoRequest) {
      return res.status(404).json({ message: 'Demo request not found.' });
    }

    demoRequest.isRead = true;
    const updated = await demoRequest.save();

    return res.json({
      message: 'Demo request marked as read.',
      demoRequest: updated,
    });
  } catch (error) {
    console.error('Mark demo request read error:', error);
    return res.status(500).json({ message: 'Failed to update demo request.' });
  }
};

export const updateDemoRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Select a valid status.' });
    }

    const demoRequest = await DemoRequest.findById(req.params.id);
    if (!demoRequest) {
      return res.status(404).json({ message: 'Demo request not found.' });
    }

    demoRequest.status = status;
    demoRequest.isRead = true;
    const updated = await demoRequest.save();

    return res.json({
      message: 'Demo request status updated successfully.',
      demoRequest: updated,
    });
  } catch (error) {
    console.error('Update demo request status error:', error);
    return res.status(500).json({ message: 'Failed to update demo request status.' });
  }
};
