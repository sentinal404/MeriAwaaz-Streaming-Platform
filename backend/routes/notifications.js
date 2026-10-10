import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { notificationLimiter } from '../middleware/security.js';
import { Notification, User } from '../db/index.js';

const router = express.Router();

// GET /api/notifications
// Fetch all notifications for the logged in user
router.get('/', authMiddleware, notificationLimiter, async (req, res) => {
    try {
        const notifications = await Notification.find({ user_id: req.user.id })
            .sort({ created_at: -1 })
            .limit(100); // Limit to last 100 notifications for performance
        
        res.json({ success: true, data: notifications });
    } catch (e) {
        console.error("Error fetching notifications:", e);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// GET /api/notifications/unread-count
// Get unread notification count
router.get('/unread-count', authMiddleware, notificationLimiter, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user_id: req.user.id, is_read: false });
        res.json({ success: true, count });
    } catch (e) {
        console.error("Error fetching unread count:", e);
        res.status(500).json({ error: "Failed to fetch unread count" });
    }
});

// POST /api/notifications/read-all
// Mark all notifications as read
router.post('/read-all', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { user_id: req.user.id, is_read: false },
            { $set: { is_read: true } }
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Error marking notifications read:", e);
        res.status(500).json({ error: "Failed to mark notifications read" });
    }
});

export default router;
