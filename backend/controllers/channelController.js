import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

export const getChannels = async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const tenantId = req.tenantId;

    // 🔹 Filter by tenantId + membership
    const query = { 
      tenantId, 
      $or: [{ members: userId }, { createdBy: userId }, { type: 'public' }] 
    };

    const channels = await Channel.find(query)
      .sort({ pinned: -1, lastMessageAt: -1, createdAt: -1 })
      .populate('members', 'firstName lastName username role')
      .lean();
    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createChannel = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const tenantId = req.tenantId;

    // 🔹 Ensure members belong to the same company
    const validUsers = await User.find({ 
      _id: { $in: memberIds }, 
      $or: [{ tenantOwnerId: tenantId }, { _id: tenantId }] 
    }).select('_id');

    const channel = await Channel.create({
      ...req.body,
      tenantId, // 🔹 Mandatory Link
      createdBy: req.user._id,
      members: validUsers.map(u => u._id)
    });

    res.status(201).json(channel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const channel = await Channel.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    await Message.deleteMany({ channelId: channel._id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ... (getChannelMessages and sendChannelMessage also use { channelId: id, tenantId: req.tenantId })