import express from 'express';
import { SecurityLog, AISettings, AIAction, BlockedIP, User, SecurityNotification } from '../db/index.js';
import { addSSEClient } from '../middleware/securityLogger.js';

const router = express.Router();

// SSE Stream for real-time logs
router.get('/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE with client

    addSSEClient(req, res);
});

// Get initial logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await SecurityLog.find().sort({ timestamp: -1 }).limit(100).lean();
        res.json({ status: 'success', logs });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Get AI Settings
router.get('/settings', async (req, res) => {
    try {
        let settings = await AISettings.findOne().lean();
        if (!settings) {
            settings = await AISettings.create({});
        }
        res.json({ status: 'success', settings });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Update AI Settings
router.post('/settings', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData._id;
        delete updateData.__v;

        const updated = await AISettings.findOneAndUpdate(
            {}, 
            { $set: updateData }, 
            { new: true, upsert: true }
        );
        res.json({ status: 'success', settings: updated });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Get AI Actions / Bans
router.get('/actions', async (req, res) => {
    try {
        const actions = await AIAction.find().sort({ timestamp: -1 }).lean();
        res.json({ status: 'success', actions });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Reverse an AI Action
router.post('/actions/:id/reverse', async (req, res) => {
    try {
        const action = await AIAction.findById(req.params.id);
        if (!action) return res.status(404).json({ status: 'error', message: "Action not found" });

        if (action.action_taken === 'Add IP Block') {
            await BlockedIP.findOneAndDelete({ ip_address: action.target_ip });
        } else if (action.action_taken === 'Disable Account') {
            await User.findOneAndUpdate(
                { username: action.target_user },
                { is_banned: false, banned_by_ai: false, ban_reason: "" }
            );
        }

        action.status = 'reversed';
        action.reversed_by = req.user?.username || 'admin';
        action.reversed_at = new Date();
        await action.save();

        res.json({ status: 'success', message: 'Action reversed successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Get Stats for Dashboard
router.get('/stats', async (req, res) => {
    try {
        const totalLogs = await SecurityLog.countDocuments();
        const suspiciousLogs = await SecurityLog.countDocuments({ risk_score: { $gte: 41 } });
        const activeThreats = await BlockedIP.countDocuments();
        const bannedUsers = await User.countDocuments({ is_banned: true, banned_by_ai: true });

        res.json({
            status: 'success',
            stats: { totalLogs, suspiciousLogs, activeThreats, bannedUsers }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

export default router;
