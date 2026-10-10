import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, StorageManager, PFPStorageConfig, PFP, RegionalAdmin, TempRegistration } from '../db/index.js';
import { generateTokens } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';

const uploadDir = path.join(process.cwd(), '.uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname).toLowerCase())
    }
});
const upload = multer({ storage });

const router = express.Router();
router.use(authLimiter);

// Elite Hacker Protection: Strict Validation
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isStrongPassword = (password) => {
    // At least 8 characters, 1 number, 1 special character
    return password.length >= 8 && /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);
};

const setTokenCookies = (res, tokens) => {
    const access_token_expire = parseInt(process.env.ACCESS_TOKEN_EXPIRE_IN_SECS || 1800) * 1000;
    const refresh_token_expire = parseInt(process.env.REFRESH_TOKEN_EXPIRE_IN_DAYS || 14) * 24 * 60 * 60 * 1000;
    
    res.cookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: access_token_expire
    });

    res.cookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: refresh_token_expire
    });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
        return res.status(400).json({ detail: "Email, username, and password are required", status: 'error' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ detail: "Invalid email format", status: 'error' });
    }
    if (!isStrongPassword(password)) {
        return res.status(400).json({ detail: "Password must be at least 8 characters long, contain a number, and a special character", status: 'error' });
    }

    try {
        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            return res.status(409).json({ detail: "User already exists", status: 'error' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const cleanEmail = email.toLowerCase().trim();
        const hasRegionalAdmin = await RegionalAdmin.findOne({ email: cleanEmail });
        const role = hasRegionalAdmin ? 'moderator' : 'user';

        const user = await User.create({
            username,
            email: cleanEmail,
            password_hash,
            role
        });

        const tokens = generateTokens(user.id);
        setTokenCookies(res, tokens);
        res.status(201).json({ status: 'success' });
    } catch (e) {
        console.error("[AUTH] Register error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ detail: "Email and password are required", status: 'error' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ detail: "Invalid email or password", status: 'error' });
        }
        if (user.is_banned) {
            return res.status(403).json({ detail: "Account Suspended", message: "This account has been permanently suspended for violating our community guidelines. If you believe this action was taken in error, please contact support.", status: 'error' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ detail: "Invalid email or password", status: 'error' });
        }

        const tokens = generateTokens(user.id);
        setTokenCookies(res, tokens);
        res.json({ status: 'success' });
    } catch (e) {
        console.error("[AUTH] Login error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/auth/unified
router.post('/unified', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ detail: "Email and password are required", status: 'error' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ detail: "Invalid email format", status: 'error' });
    }

    try {
        const existing = await User.findOne({ email });
        if (existing) {
            if (existing.is_banned) {
                return res.status(403).json({ detail: "Account Suspended", message: "This account has been permanently suspended for violating our community guidelines. If you believe this action was taken in error, please contact support.", status: 'error' });
            }
            // Login flow
            const isMatch = await bcrypt.compare(password, existing.password_hash);
            if (!isMatch) {
                return res.status(401).json({ detail: "Invalid password for existing account", status: 'error' });
            }

            const tokens = generateTokens(existing.id);
            setTokenCookies(res, tokens);
            return res.json({ status: 'success', action: 'login' });
        } else {
            // Signup flow — issue a temporary token for username claiming
            if (!isStrongPassword(password)) {
                return res.status(400).json({ detail: "Password must be at least 8 characters long, contain a number, and a special character", status: 'error' });
            }

            const password_hash = await bcrypt.hash(password, 12);
            
            // Create a temporary registration record in MongoDB to keep password hash server-side
            const tempReg = await TempRegistration.create({
                email,
                password_hash
            });

            return res.json({ status: 'success', action: 'claim_username', signup_token: tempReg.token });
        }
    } catch (e) {
        console.error("[AUTH] Unified error:", e);
        res.status(500).json({ detail: "Internal Server Error: " + (e.message || String(e)) });
    }
});

// POST /api/auth/claim-username
router.post('/claim-username', upload.single('profile_photo'), async (req, res) => {
    const { signup_token, username, lat, lng, public_name } = req.body;
    if (!signup_token || !username) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ detail: "Signup token and username are required", status: 'error' });
    }
    
    if (!lat || !lng) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ detail: "GPS location is required to create an account", status: 'error' });
    }

    // Validate username format
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 17) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ detail: "Username must be between 3 and 17 characters", status: 'error' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ detail: "Username can only contain letters, numbers, and underscores", status: 'error' });
    }

    try {
        // Verify the signup token in the database
        const tempReg = await TempRegistration.findOne({ token: signup_token });
        if (!tempReg) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(401).json({ detail: "Signup token expired or invalid. Please start over.", status: 'error' });
        }

        // Check if email or username already taken (race condition guard)
        const existingUser = await User.findOne({ $or: [{ email: tempReg.email }, { username: trimmedUsername }] });
        if (existingUser) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            if (existingUser.email === tempReg.email) {
                return res.status(409).json({ detail: "An account with this email was just created. Try logging in.", status: 'error' });
            }
            return res.status(409).json({ detail: "Username is already taken. Pick another one!", status: 'error' });
        }

        let state = '';
        let city = '';
        try {
            const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
            const geoRes = await axios.get(geocodeUrl, { headers: { 'User-Agent': 'Meriawaaaz/1.0' } });
            if (geoRes.data && geoRes.data.address) {
                const addr = geoRes.data.address;
                state = addr.state || '';
                city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
            }
        } catch (err) {
            console.error("Geocoding failed:", err.message);
        }

        // Create the user
        const cleanEmail = tempReg.email.toLowerCase().trim();
        const hasRegionalAdmin = await RegionalAdmin.findOne({ email: cleanEmail });
        const role = hasRegionalAdmin ? 'moderator' : 'user';

        const user = await User.create({
            username: trimmedUsername,
            public_name: public_name ? public_name.trim() : "",
            email: tempReg.email,
            password_hash: tempReg.password_hash,
            role,
            state,
            city
        });

        // Delete the temporary registration document
        await TempRegistration.deleteOne({ _id: tempReg._id });

        // Handle profile photo upload if provided
        if (req.file) {
            const filePath = req.file.path;
            const originalName = req.file.originalname;
            const mimeType = req.file.mimetype;
            const size = req.file.size;

            try {
                const config = await PFPStorageConfig.findOne({});
                if (config && config.telegram_bot_tokens && config.telegram_bot_tokens.length > 0 && config.telegram_channel_id) {
                    const tokens = config.telegram_bot_tokens;
                    const token = tokens[Math.floor(Math.random() * tokens.length)];
                    const chatId = config.telegram_channel_id;
                    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

                    const form = new FormData();
                    form.append('chat_id', chatId);

                    const endpoint = `${TELEGRAM_URL}/bot${token}/sendDocument`;
                    const fileStream = fs.createReadStream(filePath);
                    form.append('document', fileStream, {
                        filename: originalName,
                        knownLength: size
                    });

                    console.log(`[PFP_UPLOAD] Sending file ${originalName} to Telegram channel ${chatId}...`);
                    const agent = new https.Agent({ family: 4 });
                    const tgRes = await axios.post(endpoint, form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        httpsAgent: agent
                    });

                    const result = tgRes.data.result;
                    const tgFileId = result.document?.file_id || result.video?.file_id || result.photo?.[result.photo.length - 1]?.file_id;
                    const tgMessageId = result.message_id;

                    // Clean up the local temp file immediately
                    fs.unlink(filePath, () => {});

                    const pfp = await PFP.create({
                        user_id: user.id,
                        telegram_file_id: tgFileId,
                        telegram_message_id: tgMessageId,
                        telegram_bot_token: token,
                        media_url: `/api/profile/pfp/placeholder`,
                        mime_type: mimeType
                    });

                    // Update media_url
                    pfp.media_url = `/api/profile/pfp/${pfp._id}`;
                    await pfp.save();
                } else {
                    // Local fallback
                    const filename = req.file.filename;
                    const mediaUrl = `/uploads/${filename}`;
                    await PFP.create({
                        user_id: user.id,
                        media_url: mediaUrl,
                        mime_type: mimeType
                    });
                }
            } catch (pfpErr) {
                console.error("[PFP_UPLOAD_ERROR] Failed to save/upload PFP:", pfpErr);
                try {
                    const logPath = path.join(process.cwd(), '.logs', 'pfp_error.log');
                    const logMsg = `[${new Date().toISOString()}] PFP upload error: ${pfpErr.message}\nResponse: ${JSON.stringify(pfpErr.response?.data || '')}\nStack: ${pfpErr.stack || pfpErr}\n`;
                    fs.appendFileSync(logPath, logMsg);
                } catch (logErr) {}
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, () => {});
                }
            }
        }

        const tokens = generateTokens(user.id);
        setTokenCookies(res, tokens);
        return res.status(201).json({ status: 'success', action: 'register' });
    } catch (e) {
        console.error("[AUTH] Claim username error:", e);
        try {
            const logPath = path.join(process.cwd(), '.logs', 'pfp_error.log');
            const logMsg = `[${new Date().toISOString()}] Outer Claim username error: ${e.message}\nResponse: ${JSON.stringify(e.response?.data || '')}\nStack: ${e.stack || e}\n`;
            fs.appendFileSync(logPath, logMsg);
        } catch (logErr) {}
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({ detail: "Internal Server Error: " + (e.message || String(e)) });
    }
});

// GET /api/auth/check-username?username=xyz
router.get('/check-username', async (req, res) => {
    const { username } = req.query;
    if (!username || username.trim().length < 3) {
        return res.json({ available: false, suggestions: [] });
    }

    const trimmed = username.trim().toLowerCase();
    try {
        const existing = await User.findOne({ username: trimmed });
        if (!existing) {
            return res.json({ available: true, suggestions: [] });
        }

        // Username is taken — generate suggestions
        const base = trimmed.replace(/[\d_]+$/, '') || trimmed; // strip trailing numbers/underscores
        const candidates = [];
        
        // Generate candidate usernames
        for (let i = 0; i < 20 && candidates.length < 5; i++) {
            const suffix = Math.floor(Math.random() * 9000) + 1000;
            candidates.push(`${base}_${suffix}`);
        }
        // Also try simple increments
        for (let i = 1; i <= 5; i++) {
            candidates.push(`${base}${i}`);
        }

        // Check which ones are actually available (batch query)
        const taken = await User.find({ username: { $in: candidates } }).select('username').lean();
        const takenSet = new Set(taken.map(u => u.username));
        const suggestions = candidates.filter(c => !takenSet.has(c)).slice(0, 4);

        return res.json({ available: false, suggestions });
    } catch (e) {
        console.error("[AUTH] Check username error:", e);
        res.status(500).json({ available: false, suggestions: [] });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
        return res.status(401).json({ detail: "No refresh token provided", status: 'error' });
    }

    const { verifyRefreshToken } = await import('../middleware/auth.js');
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        return res.status(401).json({ detail: "Invalid or expired refresh token", status: 'error' });
    }

    // Optionally check if user still exists in DB
    const existing = await User.findOne({ id: decoded.sub });
    if (!existing) {
        return res.status(401).json({ detail: "User no longer exists", status: 'error' });
    }
    if (existing.is_banned) {
        return res.status(403).json({ detail: "Account Suspended", message: "This account has been permanently suspended for violating our community guidelines. If you believe this action was taken in error, please contact support.", status: 'error' });
    }

    const tokens = generateTokens(decoded.sub);
    setTokenCookies(res, tokens);
    res.json({ status: 'success' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ status: 'success' });
});

export default router;