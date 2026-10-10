import express from 'express';
import { User, PFP, Post, Banner, Follow, Notification } from '../db/index.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import bcrypt from 'bcryptjs';
import FormData from 'form-data';

const httpsAgent = new https.Agent({
    keepAlive: true,
    family: 4, // Force IPv4 to prevent Telegram API ETIMEDOUT on IPv6
});
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

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

// GET /api/profile
router.get('/', optionalAuthMiddleware, async (req, res) => {
    try {
        const { username } = req.query;
        let user;
        
        if (username) {
            user = await User.findOne({ username });
        } else if (req.user && req.user.id) {
            user = await User.findOne({ id: req.user.id });
        } else {
            return res.status(401).json({ detail: "Unauthorized" });
        }

        if (!user) {
            return res.status(404).json({ detail: "User not found" });
        }

        // Get PFP and Banner
        const pfp = await PFP.findOne({ user_id: user.id });
        const pfpUrl = pfp ? pfp.media_url : null;
        
        const banner = await Banner.findOne({ user_id: user.id });
        const bannerUrl = banner ? banner.media_url : null;

        // Get posts count and list
        const posts = await Post.find({ author: user.username }).sort({ created_at: -1 }).lean();
        const verifiedPostsCount = posts.filter(p => p.status === 'verified').length;

        const sanitizedPosts = posts.map(p => {
            delete p.telegram_file_id;
            delete p.telegram_message_id;
            delete p.telegram_bot_token;
            delete p.telegram_chunks;
            return p;
        });

        // Calculate aggregated metrics
        const totalViews = sanitizedPosts.reduce((acc, p) => acc + (p.views || 0), 0);
        const totalLikes = sanitizedPosts.reduce((acc, p) => acc + (p.upvotes || 0), 0);

        const followersCount = await Follow.countDocuments({ following_id: user.id });
        let isFollowing = false;
        
        if (req.user) {
            const currentReqUser = await User.findOne({ id: req.user.id });
            if (currentReqUser) {
                const existingFollow = await Follow.findOne({ follower_id: currentReqUser.id, following_id: user.id });
                if (existingFollow) isFollowing = true;

                // Profile view notification logic
                if (currentReqUser.id !== user.id) {
                    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const recentView = await Notification.findOne({
                        user_id: user.id,
                        type: 'view',
                        actor_username: currentReqUser.username,
                        created_at: { $gte: yesterday }
                    });

                    if (!recentView) {
                        await Notification.create({
                            user_id: user.id,
                            type: 'view',
                            actor_username: currentReqUser.username
                        });
                    }
                }
            }
        }

        let city = user.city;
        let state = user.state;

        // Hide location if requested, unless the requester is the profile owner
        if (user.hide_location && (!req.user || req.user.id !== user.id)) {
            city = "";
            state = "";
        }

        res.json({
            user: {
                username: user.username,
                public_name: user.public_name || user.username,
                bio: user.bio,
                hide_location: user.hide_location,
                coffee_link: user.coffee_link,
                instagram_link: user.instagram_link,
                twitter_link: user.twitter_link,
                email: user.email,
                role: user.role,
                trust_score: user.trust_score,
                is_banned: user.is_banned,
                strikes: user.strikes,
                moderator_state: user.moderator_state,
                created_at: user.created_at,
                city,
                state,
                is_superadmin: user.email.toLowerCase().trim() === (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim()
            },
            pfp_url: pfpUrl,
            banner_url: bannerUrl,
            posts: sanitizedPosts,
            verifiedPostsCount: verifiedPostsCount,
            totalViews: totalViews,
            totalLikes: totalLikes,
            followersCount: followersCount,
            isFollowing: isFollowing
        });
    } catch (e) {
        console.error("[PROFILE] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Cache for Telegram profile pictures
const pfpUrlCache = new Map();
const PFP_URL_TTL = 45 * 60 * 1000; // 45 minutes

const getPfpTgDownloadUrl = async (token, tgFileId, TELEGRAM_URL) => {
    const cached = pfpUrlCache.get(tgFileId);
    if (cached) {
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
            pfpUrlCache.delete(tgFileId);
        } else {
            return cached.url || cached.promise;
        }
    }

    const agent = new https.Agent({ family: 4 });
    const promise = axios.get(`${TELEGRAM_URL}/bot${token}/getFile?file_id=${tgFileId}`, { httpsAgent: agent })
        .then(infoRes => {
            const url = `${TELEGRAM_URL}/file/bot${token}/${infoRes.data.result.file_path}`;
            pfpUrlCache.set(tgFileId, { url, expiresAt: Date.now() + PFP_URL_TTL });
            return url;
        })
        .catch(err => {
            pfpUrlCache.delete(tgFileId);
            throw err;
        });

    pfpUrlCache.set(tgFileId, { promise });
    return promise;
};

// GET /api/profile/pfp/:id
router.get('/pfp/:id', optionalAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const pfp = await PFP.findById(id);
        if (!pfp) {
            return res.status(404).json({ detail: "Profile picture not found" });
        }

        // Serve local file
        if (!pfp.telegram_file_id) {
            const filename = path.basename(pfp.media_url);
            const localPath = path.join(process.cwd(), '.uploads', filename);
            if (!fs.existsSync(localPath)) {
                return res.status(404).json({ detail: "Local file not found" });
            }
            return res.sendFile(localPath);
        }

        // Stream from Telegram
        let token = pfp.telegram_bot_token;
        if (!token) {
            const { StorageManager } = await import('../db/index.js');
            const config = await StorageManager.findOne({ state: 'National' });
            token = config?.telegram_bot_token;
        }

        if (!token) {
            return res.status(500).json({ detail: "Telegram configuration missing" });
        }
        const tgFileId = pfp.telegram_file_id;
        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

        const downloadUrl = await getPfpTgDownloadUrl(token, tgFileId, TELEGRAM_URL);
        const contentType = pfp.mime_type || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        const agent = new https.Agent({ family: 4 });
        const dlRes = await axios.get(downloadUrl, { responseType: 'stream', httpsAgent: agent });
        dlRes.data.pipe(res);
    } catch (e) {
        console.error("[PFP STREAM ERROR]", e);
        if (!res.headersSent) {
            res.status(500).json({ detail: "Failed to stream profile picture" });
        } else {
            res.end();
        }
    }
});

// POST /api/profile/update-username
router.post('/update-username', authMiddleware, async (req, res) => {
    let { username } = req.body;
    if (!username) {
        return res.status(400).json({ detail: "Username is required" });
    }
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
        return res.status(400).json({ detail: "Username must be at least 3 characters long" });
    }

    try {
        const currentUser = await User.findOne({ id: req.user.id });
        if (!currentUser) {
            return res.status(404).json({ detail: "User not found" });
        }

        if (currentUser.username.toLowerCase() === cleanUsername) {
            return res.json({ success: true, username: currentUser.username });
        }

        const existing = await User.findOne({ username: cleanUsername });
        if (existing) {
            return res.status(409).json({ detail: "Username is already taken" });
        }

        const oldUsername = currentUser.username;
        currentUser.username = cleanUsername;
        await currentUser.save();

        const { TempPost } = await import('../db/index.js');
        await Post.updateMany({ author: oldUsername }, { author: cleanUsername });
        await TempPost.updateMany({ author: oldUsername }, { author: cleanUsername });

        res.json({ success: true, username: cleanUsername });
    } catch (e) {
        console.error("[PROFILE_UPDATE_USERNAME] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/profile/update-password
router.post('/update-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ detail: "Current and new passwords are required" });
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return res.status(400).json({ detail: "Password must be at least 8 characters long, contain a number, and a special character" });
    }

    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user) {
            return res.status(404).json({ detail: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ detail: "Incorrect current password" });
        }

        user.password_hash = await bcrypt.hash(newPassword, 12);
        await user.save();

        res.json({ success: true });
    } catch (e) {
        console.error("[PROFILE_UPDATE_PASSWORD] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/profile/update-pfp
router.post('/update-pfp', authMiddleware, upload.single('pfp'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ detail: "No image file provided" });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const originalName = req.file.originalname;
    const size = req.file.size;

    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user) {
            fs.unlink(filePath, () => {});
            return res.status(404).json({ detail: "User not found" });
        }

        let pfp = await PFP.findOne({ user_id: user.id });

        const deleteOldLocalPfp = (oldPfp) => {
            if (oldPfp && !oldPfp.telegram_file_id && oldPfp.media_url.startsWith('/uploads/')) {
                const filename = path.basename(oldPfp.media_url);
                const localPath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(localPath)) {
                    fs.unlink(localPath, () => {});
                }
            }
        };

        const { PFPStorageConfig } = await import('../db/index.js');
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

            console.log(`[PFP_UPDATE] Uploading PFP ${originalName} to Telegram...`);
            const tgRes = await axios.post(endpoint, form, {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                httpsAgent
            });

            const result = tgRes.data.result;
            const tgFileId = result.document?.file_id || result.video?.file_id || result.photo?.[result.photo.length - 1]?.file_id;
            const tgMessageId = result.message_id;

            fs.unlink(filePath, () => {});

            if (pfp && pfp.telegram_message_id) {
                axios.post(`${TELEGRAM_URL}/bot${token}/deleteMessage`, {
                    chat_id: chatId,
                    message_id: pfp.telegram_message_id
                }).catch(() => {});
            }

            deleteOldLocalPfp(pfp);

            if (pfp) {
                pfp.telegram_file_id = tgFileId;
                pfp.telegram_message_id = tgMessageId;
                pfp.telegram_bot_token = token;
                pfp.media_url = `/api/profile/pfp/${pfp._id}`;
                pfp.mime_type = mimeType;
                await pfp.save();
            } else {
                pfp = await PFP.create({
                    user_id: user.id,
                    telegram_file_id: tgFileId,
                    telegram_message_id: tgMessageId,
                    telegram_bot_token: token,
                    media_url: `/api/profile/pfp/placeholder`,
                    mime_type: mimeType
                });
                pfp.media_url = `/api/profile/pfp/${pfp._id}`;
                await pfp.save();
            }
        } else {
            deleteOldLocalPfp(pfp);

            const filename = req.file.filename;
            const mediaUrl = `/uploads/${filename}`;

            if (pfp) {
                pfp.telegram_file_id = undefined;
                pfp.telegram_message_id = undefined;
                pfp.telegram_bot_token = undefined;
                pfp.media_url = mediaUrl;
                pfp.mime_type = mimeType;
                await pfp.save();
            } else {
                pfp = await PFP.create({
                    user_id: user.id,
                    media_url: mediaUrl,
                    mime_type: mimeType
                });
            }
        }

        res.json({ success: true, pfp_url: pfp.media_url });
    } catch (e) {
        console.error("[PFP_UPDATE] Error:", e);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
        }
        res.status(500).json({ detail: e.message || "Failed to update profile picture" });
    }
});



// GET /api/profile/banner/:id
router.get('/banner/:id', optionalAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ detail: "Banner not found" });
        }

        // Serve local file
        if (!banner.telegram_file_id) {
            const filename = path.basename(banner.media_url);
            const localPath = path.join(process.cwd(), '.uploads', filename);
            if (!fs.existsSync(localPath)) {
                return res.status(404).json({ detail: "Local file not found" });
            }
            return res.sendFile(localPath);
        }

        // Stream from Telegram
        let token = banner.telegram_bot_token;
        if (!token) {
            const { StorageManager } = await import('../db/index.js');
            const config = await StorageManager.findOne({ state: 'National' });
            token = config?.telegram_bot_token;
        }

        if (!token) {
            return res.status(500).json({ detail: "Telegram configuration missing" });
        }
        const tgFileId = banner.telegram_file_id;
        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

        const downloadUrl = await getPfpTgDownloadUrl(token, tgFileId, TELEGRAM_URL); // reusing cache func
        const contentType = banner.mime_type || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const agent = new https.Agent({ family: 4 });
        const tgStreamRes = await axios.get(downloadUrl, {
            responseType: 'stream',
            httpsAgent: agent
        });

        tgStreamRes.data.pipe(res);
    } catch (e) {
        console.error("[BANNER_STREAM] Error streaming banner:", e);
        res.status(500).json({ detail: "Failed to stream banner" });
    }
});

// POST /api/profile/update-banner
router.post('/update-banner', authMiddleware, upload.single('banner'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ detail: "No image file provided" });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const originalName = req.file.originalname;
    const size = req.file.size;

    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user) {
            fs.unlink(filePath, () => {});
            return res.status(404).json({ detail: "User not found" });
        }

        let banner = await Banner.findOne({ user_id: user.id });

        const deleteOldLocalBanner = (oldBanner) => {
            if (oldBanner && !oldBanner.telegram_file_id && oldBanner.media_url.startsWith('/uploads/')) {
                const filename = path.basename(oldBanner.media_url);
                const localPath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(localPath)) {
                    fs.unlink(localPath, () => {});
                }
            }
        };

        const { PFPStorageConfig } = await import('../db/index.js');
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

            console.log(`[BANNER_UPDATE] Uploading Banner ${originalName} to Telegram...`);
            const tgRes = await axios.post(endpoint, form, {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                httpsAgent
            });

            const result = tgRes.data.result;
            const tgFileId = result.document?.file_id || result.video?.file_id || result.photo?.[result.photo.length - 1]?.file_id;
            const tgMessageId = result.message_id;

            fs.unlink(filePath, () => {});

            if (banner && banner.telegram_message_id) {
                axios.post(`${TELEGRAM_URL}/bot${token}/deleteMessage`, {
                    chat_id: chatId,
                    message_id: banner.telegram_message_id
                }).catch(() => {});
            }

            deleteOldLocalBanner(banner);

            if (banner) {
                banner.telegram_file_id = tgFileId;
                banner.telegram_message_id = tgMessageId;
                banner.telegram_bot_token = token;
                banner.media_url = `/api/profile/banner/${banner._id}`;
                banner.mime_type = mimeType;
                await banner.save();
            } else {
                banner = await Banner.create({
                    user_id: user.id,
                    telegram_file_id: tgFileId,
                    telegram_message_id: tgMessageId,
                    telegram_bot_token: token,
                    media_url: `/api/profile/banner/placeholder`,
                    mime_type: mimeType
                });
                banner.media_url = `/api/profile/banner/${banner._id}`;
                await banner.save();
            }
        } else {
            deleteOldLocalBanner(banner);

            const filename = req.file.filename;
            const mediaUrl = `/uploads/${filename}`;

            if (banner) {
                banner.telegram_file_id = undefined;
                banner.telegram_message_id = undefined;
                banner.telegram_bot_token = undefined;
                banner.media_url = mediaUrl;
                banner.mime_type = mimeType;
                await banner.save();
            } else {
                banner = await Banner.create({
                    user_id: user.id,
                    media_url: mediaUrl,
                    mime_type: mimeType
                });
            }
        }

        res.json({ success: true, banner_url: banner.media_url });
    } catch (e) {
        console.error("[BANNER_UPDATE] Error:", e);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
        }
        res.status(500).json({ detail: e.message || "Failed to update banner" });
    }
});
// POST /api/profile/update-details
router.post('/update-details', authMiddleware, async (req, res) => {
    try {
        const { public_name, bio, hide_location, coffee_link, instagram_link, twitter_link } = req.body;
        const user = await User.findOne({ id: req.user.id });
        if (!user) return res.status(404).json({ detail: "User not found" });

        // URL Validation helper to prevent SSRF/XSS
        const isValidUrl = (url) => {
            if (!url) return true; // empty is ok
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'http:' || parsed.protocol === 'https:';
            } catch {
                return false;
            }
        };

        if (!isValidUrl(coffee_link) || !isValidUrl(instagram_link) || !isValidUrl(twitter_link)) {
            return res.status(400).json({ detail: "Invalid URL provided for social links. Must include http:// or https://" });
        }

        user.public_name = public_name || "";
        user.bio = bio ? bio.substring(0, 160) : ""; // Max 160 chars
        user.hide_location = !!hide_location;
        user.coffee_link = coffee_link || "";
        user.instagram_link = instagram_link || "";
        user.twitter_link = twitter_link || "";

        await user.save();
        res.json({ success: true, message: "Profile updated successfully" });
    } catch (e) {
        console.error("[PROFILE_UPDATE] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});
export default router;
