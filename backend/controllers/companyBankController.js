import CompanyBank from '../models/CompanyBank.js';

// @desc    Get all company bank accounts
// @route   GET /api/company-banks
// @access  Private
export const getCompanyBanks = async (req, res) => {
  try {
    let banks = await CompanyBank.find().sort({ isDefault: -1, createdAt: -1 });
    if (banks.length === 0) {
      const defaultBank = new CompanyBank({
        label: "Vagarious Solutions Pvt Ltd (Default)",
        accountNumber: "6000805022576",
        name: "Vagarious Solutions Pvt Ltd.",
        bank: "ICICI Bank",
        branch: "Begumpet Branch",
        ifsc: "ICICI0000183",
        pan: "AAHCV0176E",
        gst: "36AAHCV0176E1ZE",
        isDefault: true
      });
      await defaultBank.save();
      banks = [defaultBank];
    }
    res.json(banks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a company bank account
// @route   POST /api/company-banks
// @access  Private
export const createCompanyBank = async (req, res) => {
  try {
    const { label, accountNumber, name, bank, branch, ifsc, pan, gst, isDefault } = req.body;

    if (!label || !accountNumber || !name || !bank || !branch || !ifsc) {
      return res.status(400).json({ message: 'Missing required bank fields.' });
    }

    if (isDefault) {
      // Set all other accounts default flag to false
      await CompanyBank.updateMany({}, { $set: { isDefault: false } });
    }

    const count = await CompanyBank.countDocuments();

    const companyBank = new CompanyBank({
      label,
      accountNumber,
      name,
      bank,
      branch,
      ifsc,
      pan,
      gst,
      isDefault: count === 0 ? true : !!isDefault // Force first bank account to be default
    });

    const saved = await companyBank.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a company bank account
// @route   PUT /api/company-banks/:id
// @access  Private
export const updateCompanyBank = async (req, res) => {
  try {
    const { label, accountNumber, name, bank, branch, ifsc, pan, gst, isDefault } = req.body;

    if (isDefault) {
      // Set all other accounts default flag to false
      await CompanyBank.updateMany({ _id: { $ne: req.params.id } }, { $set: { isDefault: false } });
    }

    const updated = await CompanyBank.findByIdAndUpdate(
      req.params.id,
      {
        label,
        accountNumber,
        name,
        bank,
        branch,
        ifsc,
        pan,
        gst,
        isDefault
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a company bank account
// @route   DELETE /api/company-banks/:id
// @access  Private
export const deleteCompanyBank = async (req, res) => {
  try {
    const deleted = await CompanyBank.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    // If deleted bank account was the default, make the next one default if exists
    if (deleted.isDefault) {
      const nextBank = await CompanyBank.findOne();
      if (nextBank) {
        nextBank.isDefault = true;
        await nextBank.save();
      }
    }

    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
