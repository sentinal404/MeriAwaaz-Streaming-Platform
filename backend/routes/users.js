import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { User } from '../db/index.js';

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id }, 'id email');
        if (!user) {
            return res.status(404).json({ detail: "User not found" });
        }
        res.json({ id: user.id, email: user.email });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

export default router;