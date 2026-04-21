// --- START OF FILE clientController.js ---
import Client from '../models/Client.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// @desc   Get all clients for this tenant
// @route  GET /api/clients
export const getClients = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const clients = await Client.find({ tenantOwnerId }).sort({ createdAt: -1 }).lean();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Create a client (auto-generates clientId per tenant)
// @route  POST /api/clients
export const createClient = async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to create clients' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);

    // Auto-generate clientId scoped to this tenant: find the highest CL number within the tenant
    let { clientId } = req.body;
    if (!clientId) {
      const last = await Client.findOne(
        { tenantOwnerId, clientId: { $regex: /^CL\d+$/ } },
        { clientId: 1 }
      ).sort({ clientId: -1 }).lean();

      const lastNum = last?.clientId ? parseInt(last.clientId.replace('CL', ''), 10) : 1000;
      clientId = `CL${lastNum + 1}`;
    }

    const updateData = { ...req.body };
    delete updateData.tenantOwnerId; // never allow caller to set tenant

    const client = await Client.create({ ...updateData, clientId, tenantOwnerId });
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc   Update a client (tenant-scoped)
// @route  PUT /api/clients/:id
export const updateClient = async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to update clients' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const updateData    = { ...req.body };
    delete updateData.tenantOwnerId;

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, tenantOwnerId },
      { $set: updateData },
      { new: true, lean: true }
    );
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc   Delete a client (tenant-scoped)
// @route  DELETE /api/clients/:id
export const deleteClient = async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to delete clients' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const client = await Client.findOneAndDelete({ _id: req.params.id, tenantOwnerId }).lean();
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};