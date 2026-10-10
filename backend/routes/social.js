import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Post, User, StorageManager, TempPost, UploadLog, RegionalAdmin, PFP, AuditLog, PFPStorageConfig, Follow, Notification, SystemSettings, Report, ReportLog } from '../db/index.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { voteLimiter } from '../middleware/security.js';
import FormData from 'form-data';
import axios from 'axios';
import https from 'https';

const router = express.Router();

const getRegionFromIp = async (ip) => {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
        return { state: 'Maharashtra', city: 'Mumbai' };
    }

    try {
        console.log(`[GEOIP] Looking up IP: ${ip}`);
        const cleanIp = ip.replace(/^::ffff:/, '');
        const response = await axios.get(`http://ip-api.com/json/${cleanIp}`, { timeout: 3000 });
        if (response.data && response.data.status === 'success') {
            return {
                state: response.data.region || response.data.regionName || 'Maharashtra',
                city: response.data.city || 'Mumbai'
            };
        }
    } catch (e) {
        console.error(`[GEOIP] Error looking up IP ${ip}:`, e.message);
    }
    return { state: 'Maharashtra', city: 'Mumbai' };
};

// SSE Connected Clients for Admin Dashboard Live Feed
let sseClients = [];

const broadcastAdminEvent = (eventType, data) => {
    console.log(`[SSE] Broadcasting event '${eventType}' to ${sseClients.length} clients`);
    const payload = JSON.stringify({ event: eventType, data });
    sseClients.forEach(client => {
        try {
            client.res.write(`data: ${payload}\n\n`);
        } catch (e) {
            console.error("[SSE] Failed writing to client connection:", e.message);
        }
    });
};

const logAdminAction = async (actorId, actorUsername, action, target, details) => {
    try {
        await AuditLog.create({
            actor_id: actorId,
            actor_username: actorUsername,
            action,
            target,
            details
        });
        broadcastAdminEvent('audit_log', { action, target, actor_username: actorUsername, created_at: new Date() });
    } catch (e) {
        console.error("[AUDIT_LOG_ERROR] Failed to write audit log:", e);
    }
};

const screenContent = (title, description) => {
    const spamPhrases = [
        /buy now/i, /click link/i, /make money/i, /earn daily/i, /whatsapp me/i, 
        /subscribe/i, /telegram channel/i, /free gift/i, /giveaway/i, /invest/i
    ];
    
    if (title.trim().length < 4) {
        return { isFlagged: true, reason: "Title too short (minimum 4 characters)" };
    }
    if (description.trim().length < 10) {
        return { isFlagged: true, reason: "Description too short (minimum 10 characters)" };
    }
    
    for (const phrase of spamPhrases) {
        if (phrase.test(title) || phrase.test(description)) {
            return { isFlagged: true, reason: `Spam phrase matched: "${phrase.source}"` };
        }
    }
    
    return { isFlagged: false, reason: "" };
};

// Force IPv4 to avoid ETIMEDOUT on systems where IPv6 is not routable
const telegramHttpsAgent = new https.Agent({ family: 4, keepAlive: true });

const uploadToTelegram = async (filePath, filename, size, mimeType, state, city, attempt = 1) => {
    let config = null;
    if (state) {
        const cleanState = state.toLowerCase().trim();
        const cleanCity = (city || "").toLowerCase().trim();
        
        if (cleanCity) {
            config = await StorageManager.findOne({ state: cleanState, city: cleanCity });
        }
        if (!config) {
            config = await StorageManager.findOne({ 
                state: cleanState, 
                $or: [{ city: "" }, { city: null }, { city: "all" }] 
            });
        }
    }

    if (!config) {
        config = await StorageManager.findOne({ state: 'National' });
    }

    if (!config || (!config.telegram_bot_token && (!config.telegram_bot_tokens || config.telegram_bot_tokens.length === 0)) || !config.telegram_channel_id) {
        throw new Error("No Telegram storage configured for this region.");
    }

    let token = config.telegram_bot_token;
    if (config.telegram_bot_tokens && config.telegram_bot_tokens.length > 0) {
        token = config.telegram_bot_tokens[Math.floor(Math.random() * config.telegram_bot_tokens.length)];
    }
    const chatId = config.telegram_channel_id;
    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

    try {
        const form = new FormData();
        form.append('chat_id', chatId);

        const fileStream = fs.createReadStream(filePath);
        form.append('document', fileStream, {
            filename: filename,
            knownLength: size
        });

        console.log(`[TELEGRAM_UPLOAD] Sending file ${filename} to Telegram channel ${chatId}... (Attempt ${attempt})`);
        const tgRes = await axios.post(`${TELEGRAM_URL}/bot${token}/sendDocument`, form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            httpsAgent: telegramHttpsAgent,
            timeout: 10 * 60 * 1000, // 10 minute timeout for large files
        });

        const result = tgRes.data.result;
        const tgFileId = result.document?.file_id || result.video?.file_id || result.photo?.[result.photo.length - 1]?.file_id;
        const tgMessageId = result.message_id;

        return { tgFileId, tgMessageId, token };
    } catch (err) {
        if (err.response && err.response.status === 429 && attempt <= 5) {
            const retryAfter = err.response.data?.parameters?.retry_after || 5;
            console.warn(`[TELEGRAM_UPLOAD] Rate limited! Retrying after ${retryAfter}s... (Attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            return uploadToTelegram(filePath, filename, size, mimeType, state, city, attempt + 1);
        }
        // Auto-retry on ETIMEDOUT (up to 3 times)
        if ((err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') && attempt <= 3) {
            console.warn(`[TELEGRAM_UPLOAD] Connection error (${err.code}), retrying in 3s... (Attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return uploadToTelegram(filePath, filename, size, mimeType, state, city, attempt + 1);
        }
        console.error(`[TELEGRAM_UPLOAD] Failed to upload ${filename}:`, err.response?.data || err.message);
        throw err;
    }
};

const verifyPostHelper = async (tempPost) => {
    const post = await Post.create({
        _id: tempPost._id,
        id: tempPost.id,
        title: tempPost.title,
        description: tempPost.description,
        state: tempPost.state,
        city: tempPost.city,
        media_url: `/api/posts/media/${tempPost._id}`,
        mime_type: tempPost.mime_type,
        author: tempPost.author,
        status: 'verified',
        telegram_bot_token: tempPost.telegram_bot_token,
        telegram_file_id: tempPost.telegram_file_id,
        telegram_message_id: tempPost.telegram_message_id,
        telegram_chunks: tempPost.telegram_chunks,
        media_size: tempPost.media_size,
        created_at: tempPost.created_at,
        duration: tempPost.duration || 0
    });

    await TempPost.deleteOne({ _id: tempPost._id });

    // --- Notifications ---
    const authorUser = await User.findOne({ username: tempPost.author });
    if (authorUser) {
        // Notify Author
        await Notification.create({
            user_id: authorUser.id,
            type: 'verify',
            actor_username: 'System/Admin',
            post_id: post._id.toString()
        });

        // Notify Followers
        const followers = await Follow.find({ following_id: authorUser.id });
        if (followers.length > 0) {
            const notifications = followers.map(f => ({
                user_id: f.follower_id,
                type: 'new_follower_video',
                actor_username: authorUser.username,
                post_id: post._id.toString()
            }));
            // Insert in background to avoid blocking
            Notification.insertMany(notifications).catch(err => console.error("Follower notification error:", err));
        }
    }

    return post;
};

const refundUploadCredit = async (username) => {
    try {
        const authorUser = await User.findOne({ username });
        if (authorUser) {
            await UploadLog.findOneAndDelete(
                { user_id: authorUser.id },
                { sort: { created_at: 1 } }
            );
        }
    } catch(err) {
        console.error("Failed to refund upload credit:", err);
    }
};

const uploadDir = path.join(process.cwd(), '.uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const activeDownloads = new Map();
const cacheDir = path.join(uploadDir, 'cache');
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname).toLowerCase())
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB max file size per upload/chunk
});

// GET /api/feed
router.get('/feed', optionalAuthMiddleware, async (req, res) => {
    const { state, city } = req.query;
    let query = { 
        status: 'verified',
        $and: [
            {
                $or: [
                    { duration: { $gt: 60 } },
                    { duration: 0 },
                    { duration: { $exists: false } }
                ]
            }
        ]
    };
    
    const ip = req.ip;
    const detectedRegion = await getRegionFromIp(ip);

    let queryState = state;
    let queryCity = city;

    if (!queryState && detectedRegion && detectedRegion.state) {
        queryState = detectedRegion.state;
        queryCity = detectedRegion.city;
    }

    if (queryState) {
        const escapedState = queryState.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (queryCity) {
            const escapedCity = queryCity.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$and.push({
                $or: [
                    {
                        state: new RegExp('^' + escapedState + '$', 'i'),
                        city: new RegExp('^' + escapedCity + '$', 'i')
                    },
                    { state: new RegExp('^National$', 'i') }
                ]
            });
        } else {
            query.$and.push({
                $or: [
                    { state: new RegExp('^' + escapedState + '$', 'i') },
                    { state: new RegExp('^National$', 'i') }
                ]
            });
        }
    }

    try {
        const bannedUsers = await User.find({ is_banned: true }, 'username').lean();
        const bannedUsernames = bannedUsers.map(u => u.username);
        if (bannedUsernames.length > 0) {
            query.$and.push({ author: { $nin: bannedUsernames } });
        }

        let posts = await Post.find(query).sort({ created_at: -1 }).limit(50);
        
        if (posts.length === 0 && queryState) {
            let fallbackQuery = { 
                status: 'verified',
                $and: [
                    {
                        $or: [
                            { duration: { $gt: 60 } },
                            { duration: 0 },
                            { duration: { $exists: false } }
                        ]
                    }
                ]
            };
            if (bannedUsernames.length > 0) {
                fallbackQuery.$and.push({ author: { $nin: bannedUsernames } });
            }
            posts = await Post.find(fallbackQuery).sort({ created_at: -1 }).limit(50);
        }
        
        // Find PFPs for these authors
        const authors = [...new Set(posts.map(p => p.author))];
        const users = await User.find({ username: { $in: authors } });
        const userMap = new Map(users.map(u => [u.username, u.id]));
        const userIds = users.map(u => u.id);
        const pfps = await PFP.find({ user_id: { $in: userIds } });
        const pfpMap = new Map(pfps.map(p => [p.user_id, p.media_url]));

        const postsWithPfp = posts.map(post => {
            const userId = userMap.get(post.author);
            const pfpUrl = userId ? pfpMap.get(userId) : null;
            const obj = post.toObject();
            delete obj.telegram_file_id;
            delete obj.telegram_message_id;
            delete obj.telegram_bot_token;
            delete obj.telegram_chunks;
            return {
                ...obj,
                author_pfp: pfpUrl
            };
        });

        res.json({ status: 'success', data: postsWithPfp });
    } catch (e) {
        console.error("[FEED] Get error:", e);
        res.status(500).json({ status: 'error', message: "Internal Server Error" });
    }
});

// Middleware to check IP and User ID upload limit (max 3 uploads per 24h)
const checkUploadLimit = async (req, res, next) => {
    try {
        const ip = req.ip;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        let settings = await SystemSettings.findOne({});
        let limit = settings ? settings.daily_upload_limit : 3;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const countByUser = await UploadLog.countDocuments({ user_id: userId, created_at: { $gte: startOfDay } });

        if (countByUser >= limit) {
            return res.status(429).json({ 
                status: 'error', 
                message: `Daily upload limit reached. You can only upload ${limit} videos per 24 hours.` 
            });
        }
        next();
    } catch (e) {
        console.error("[LIMIT_MIDDLEWARE] Error:", e);
        next();
    }
};

// POST /api/feed
router.post('/feed', authMiddleware, checkUploadLimit, upload.single('media'), async (req, res) => {
    const { title, description, state, city, duration } = req.body;
    
    if (!title || !description || !req.file) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    if (title.length > 100) {
        return res.status(400).json({ status: 'error', message: 'Title cannot exceed 100 characters' });
    }

    if (description.length > 1000) {
        return res.status(400).json({ status: 'error', message: 'Description cannot exceed 1000 characters' });
    }

    const filePath = req.file.path;

    if (!req.file.mimetype || !req.file.mimetype.startsWith('video/')) {
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
        }
        return res.status(400).json({ status: 'error', message: 'Only video uploads are allowed.' });
    }

    try {
        const user = await User.findOne({ id: req.user.id });
        const screening = screenContent(title, description);
        
        // Upload to Telegram instantly
        const filename = path.basename(filePath);
        const tgInfo = await uploadToTelegram(filePath, filename, req.file.size, req.file.mimetype, state, city);
        
        // Wipe local file immediately
        fs.unlinkSync(filePath);

        // Save post into TempPost collection
        const tempPost = await TempPost.create({
            title,
            description,
            state,
            city,
            media_url: '', // Will update below
            mime_type: req.file.mimetype,
            author: user.username,
            duration: Number(duration) || 0,
            media_size: req.file.size,
            is_flagged: screening.isFlagged,
            flag_reason: screening.reason,
            telegram_bot_token: tgInfo.token,
            telegram_chunks: [{
                telegram_file_id: tgInfo.tgFileId,
                telegram_message_id: tgInfo.tgMessageId,
                position: 0,
                size: req.file.size
            }]
        });

        tempPost.media_url = `/api/posts/media/${tempPost._id}`;
        await tempPost.save();

        // Log upload for rate limit tracking (both IP and User ID)
        const ip = req.ip;
        await UploadLog.create({ ip, user_id: req.user.id });

        console.log(`[FEED_UPLOAD] Created temp post ${tempPost._id} with local media ${mediaUrl}. Flagged: ${screening.isFlagged}`);

        // Trust Score Bypass auto-verification
        if (user.trust_score >= 50 && !screening.isFlagged) {
            console.log(`[TRUST_BYPASS] User @${user.username} has trust score ${user.trust_score}. Auto-verifying post ${tempPost._id}...`);
            const verifiedPost = await verifyPostHelper(tempPost);
            broadcastAdminEvent('post_uploaded', { auto_verified: true, post: verifiedPost });
            return res.json({ status: 'success', data: verifiedPost, auto_verified: true });
        }

        broadcastAdminEvent('post_uploaded', { auto_verified: false, post: tempPost });
        return res.json({ status: 'success', data: tempPost, auto_verified: false });
    } catch (e) {
        console.error("[FEED] Temp Post error:", e);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
        }
        res.status(500).json({ status: 'error', message: e.message || "Internal Server Error" });
    }
});

const telegramUploadQueue = [];
let isProcessingQueue = false;

const processTelegramQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    while (telegramUploadQueue.length > 0) {
        const task = telegramUploadQueue.shift();
        try {
            await task();
        } catch (e) {
            console.error("Queue task failed:", e);
        }
    }
    isProcessingQueue = false;
};

// POST /api/feed/chunk
router.post('/feed/chunk', authMiddleware, checkUploadLimit, upload.single('chunk'), async (req, res) => {
    console.log(`[CHUNK] Received chunk upload request. Body:`, req.body);
    const { title, description, state, city, duration, chunkIndex, totalChunks, uploadId, filename } = req.body;
    
    if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !req.file) {
        return res.status(400).json({ status: 'error', message: 'Missing chunk upload parameters' });
    }

    if (title && title.length > 100) {
        return res.status(400).json({ status: 'error', message: 'Title cannot exceed 100 characters' });
    }

    if (description && description.length > 1000) {
        return res.status(400).json({ status: 'error', message: 'Description cannot exceed 1000 characters' });
    }

    const chunkIdx = parseInt(chunkIndex);
    const totalChks = parseInt(totalChunks);
    const tempChunkPath = req.file.path;

    // Validate video extension
    const ext = path.extname(filename || '').toLowerCase();
    const allowedVideoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    if (!allowedVideoExts.includes(ext)) {
        if (fs.existsSync(tempChunkPath)) {
            fs.unlinkSync(tempChunkPath);
        }
        return res.status(400).json({ status: 'error', message: 'Only video files are allowed.' });
    }

    let determinedMime = 'video/mp4';
    if (ext === '.webm') determinedMime = 'video/webm';
    else if (ext === '.ogg') determinedMime = 'video/ogg';

    try {
        const isLastChunk = (Number(chunkIdx) === Number(totalChks) - 1);
        res.json({ status: 'success', message: `Chunk ${chunkIdx} accepted for background processing`, merged: isLastChunk });

        // Queue the Telegram upload
        telegramUploadQueue.push(async () => {
            try {
                const tgInfo = await uploadToTelegram(tempChunkPath, `${uploadId}_chunk_${chunkIdx}${ext}`, req.file.size, determinedMime, state, city);
                
                if (fs.existsSync(tempChunkPath)) {
                    fs.unlinkSync(tempChunkPath);
                }

                const user = await User.findOne({ id: req.user.id });
                const screening = screenContent(title, description);

                // Store chunk info atomically directly into TempPost
                const tempPost = await TempPost.findOneAndUpdate(
                    { id: uploadId },
                    { 
                        $setOnInsert: {
                            title,
                            description,
                            state,
                            city,
                            author: user.username,
                            duration: Number(duration) || 0,
                            mime_type: determinedMime,
                            is_flagged: screening.isFlagged,
                            flag_reason: screening.reason,
                            status: 'uploading'
                        },
                        $push: { 
                            telegram_chunks: { 
                                telegram_file_id: tgInfo.tgFileId, 
                                telegram_message_id: tgInfo.tgMessageId, 
                                position: chunkIdx,
                                size: req.file.size
                            } 
                        } 
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                // Check if we have received all chunks
                if (tempPost.telegram_chunks.length === totalChks) {
                    console.log(`[CHUNK] All ${totalChks} chunks uploaded for: ${uploadId}. Finalizing TempPost...`);
                    
                    // Sort chunks to ensure they are in order
                    tempPost.telegram_chunks.sort((a, b) => a.position - b.position);
                    
                    // Calculate total size
                    const totalSize = tempPost.telegram_chunks.reduce((acc, curr) => acc + curr.size, 0);

                    tempPost.media_size = totalSize;
                    tempPost.media_url = `/api/posts/media/${tempPost._id}`;
                    tempPost.status = 'pending';
                    await tempPost.save();

                    const ip = req.ip;
                    await UploadLog.create({ ip, user_id: req.user.id });

                    console.log(`[FEED_UPLOAD_CHUNKED] Successfully finalized temp post ${tempPost._id}. Flagged: ${screening.isFlagged}`);

                    // Trust Score Bypass auto-verification
                    if (user.trust_score >= 50 && !screening.isFlagged) {
                        console.log(`[TRUST_BYPASS] User @${user.username} has trust score ${user.trust_score}. Auto-verifying post ${tempPost._id}...`);
                        const verifiedPost = await verifyPostHelper(tempPost);
                        broadcastAdminEvent('post_uploaded', { auto_verified: true, post: verifiedPost });
                    } else {
                        broadcastAdminEvent('post_uploaded', { auto_verified: false, post: tempPost });
                    }
                }
            } catch (err) {
                console.error("[CHUNK_QUEUE] Error processing chunk:", err);
                if (fs.existsSync(tempChunkPath)) {
                    fs.unlinkSync(tempChunkPath);
                }
            }
        });

        // Trigger queue processing
        processTelegramQueue();

    } catch (err) {
        console.error("[CHUNK] Initial Error:", err);
        if (fs.existsSync(tempChunkPath)) {
            fs.unlinkSync(tempChunkPath);
        }
        if (!res.headersSent) {
            return res.status(500).json({ status: 'error', message: 'Failed to process chunk: ' + err.message });
        }
    }
});

// POST /api/feed/cancel
router.post('/feed/cancel', authMiddleware, async (req, res) => {
    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ error: "uploadId required" });
    try {
        const tempPost = await TempPost.findOne({ id: uploadId, author: req.user.username });
        if (tempPost && tempPost.status === 'uploading') {
            await TempPost.deleteOne({ _id: tempPost._id });
            console.log(`[FEED_UPLOAD] Cancelled upload and deleted temp post ${tempPost._id}`);
            return res.json({ success: true });
        }
        return res.json({ success: false });
    } catch (err) {
        console.error("[FEED_CANCEL] Error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/watch
router.get('/watch', optionalAuthMiddleware, async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ detail: "id is required" });

    try {
        let post;
        // Mongoose throws CastError if you pass a UUID to findById, so we check format first
        if (id.includes('-')) {
            post = await Post.findOne({ id: id });
            if (!post) {
                post = await TempPost.findOne({ id: id });
            }
        } else {
            post = await Post.findById(id).catch(() => null);
            if (!post) {
                post = await TempPost.findById(id).catch(() => null);
            }
        }
        
        if (!post) return res.status(404).json({ detail: "Post not found" });
        
        if (req.user) {
            if (!post.viewed_by) post.viewed_by = [];
            if (!post.viewed_by.includes(req.user.id)) {
                post.viewed_by.push(req.user.id);
                post.views = post.viewed_by.length;
                await post.save();
            }
        }

        const related = await Post.find({ _id: { $ne: post._id }, city: post.city }).limit(5);

        // Find PFP for the post author
        const authorUser = await User.findOne({ username: post.author });
        let authorPfpUrl = null;
        if (authorUser) {
            const pfp = await PFP.findOne({ user_id: authorUser.id });
            authorPfpUrl = pfp ? pfp.media_url : null;
        }

        // Also fetch PFPs for the related posts' authors
        const relatedAuthors = [...new Set(related.map(r => r.author))];
        const relatedUsers = await User.find({ username: { $in: relatedAuthors } });
        const relatedUserMap = new Map(relatedUsers.map(u => [u.username, u.id]));
        const relatedUserIds = relatedUsers.map(u => u.id);
        const relatedPfps = await PFP.find({ user_id: { $in: relatedUserIds } });
        const relatedPfpMap = new Map(relatedPfps.map(p => [p.user_id, p.media_url]));

        const relatedWithPfp = related.map(rel => {
            const userId = relatedUserMap.get(rel.author);
            const pfpUrl = userId ? relatedPfpMap.get(userId) : null;
            const obj = rel.toObject();
            delete obj.telegram_file_id;
            delete obj.telegram_message_id;
            delete obj.telegram_bot_token;
            delete obj.telegram_chunks;
            return {
                ...obj,
                author_pfp: pfpUrl
            };
        });

        const postObj = post.toObject();
        delete postObj.telegram_file_id;
        delete postObj.telegram_message_id;
        delete postObj.telegram_bot_token;
        delete postObj.telegram_chunks;

        let is_owner = false;
        let is_following = false;

        if (req.user) {
            const currentUser = await User.findOne({ id: req.user.id });
            if (currentUser && currentUser.username === post.author) {
                is_owner = true;
            }
            if (authorUser && currentUser) {
                const followDoc = await Follow.findOne({ follower_id: currentUser.id, following_id: authorUser.id });
                if (followDoc) is_following = true;
            }
        }

        res.json({
            post: {
                ...postObj,
                author_pfp: authorPfpUrl
            },
            related: relatedWithPfp,
            upvotes: post.upvotes || 0,
            downvotes: post.downvotes || 0,
            is_owner,
            is_following
        });
    } catch (e) {
        console.error("[WATCH] Get error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/shorts
router.get('/shorts', optionalAuthMiddleware, async (req, res) => {
    try {
        const bannedUsers = await User.find({ is_banned: true }, 'username').lean();
        const bannedUsernames = bannedUsers.map(u => u.username);
        
        let query = {
            status: 'verified',
            mime_type: { $regex: /^video\// },
            duration: { $gt: 0, $lte: 60 }
        };
        
        if (bannedUsernames.length > 0) {
            query.author = { $nin: bannedUsernames };
        }

        let posts = await Post.find(query).sort({ created_at: -1 }).limit(50);

        // Find PFPs for these authors
        const authors = [...new Set(posts.map(p => p.author))];
        const users = await User.find({ username: { $in: authors } });
        const userMap = new Map(users.map(u => [u.username, u.id]));
        const userIds = users.map(u => u.id);
        const pfps = await PFP.find({ user_id: { $in: userIds } });
        const pfpMap = new Map(pfps.map(p => [p.user_id, p.media_url]));

        const postsWithPfp = posts.map(post => {
            const userId = userMap.get(post.author);
            const pfpUrl = userId ? pfpMap.get(userId) : null;
            const obj = post.toObject();
            delete obj.telegram_file_id;
            delete obj.telegram_message_id;
            delete obj.telegram_bot_token;
            delete obj.telegram_chunks;
            return {
                ...obj,
                author_pfp: pfpUrl
            };
        });

        res.json({ status: 'success', data: postsWithPfp });
    } catch (e) {
        console.error("[SHORTS] Get error:", e);
        res.status(500).json({ status: 'error', message: "Internal Server Error" });
    }
});

// POST /api/votes
router.post('/votes', authMiddleware, voteLimiter, async (req, res) => {
    const { post_id, type } = req.body; // type is 'upvote' or 'downvote'
    
    try {
        const post = await Post.findById(post_id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

        if (!post.liked_by) post.liked_by = [];
        if (!post.disliked_by) post.disliked_by = [];
        let isLiked = false;
        let isDisliked = false;
        
        if (type === 'upvote' || type === 'vote') {
            const likeIndex = post.liked_by.indexOf(req.user.id);
            const dislikeIndex = post.disliked_by.indexOf(req.user.id);

            if (dislikeIndex !== -1) {
                post.disliked_by.splice(dislikeIndex, 1);
            }

            if (likeIndex === -1) {
                // Not liked, add like
                post.liked_by.push(req.user.id);
                isLiked = true;

                // Create Notification for the author (if not self-like)
                const authorUser = await User.findOne({ username: post.author });
                if (authorUser && authorUser.id !== req.user.id) {
                    const votingUser = await User.findOne({ id: req.user.id });
                    const actorUsername = votingUser ? votingUser.username : 'Unknown';
                    
                    // Prevent replay attacks by only creating the notification if it doesn't already exist
                    const existingNotification = await Notification.findOne({
                        user_id: authorUser.id,
                        type: 'like',
                        actor_username: actorUsername,
                        post_id: post.id
                    });

                    if (!existingNotification) {
                        await Notification.create({
                            user_id: authorUser.id,
                            type: 'like',
                            actor_username: actorUsername,
                            post_id: post._id.toString()
                        });
                    }
                }
            } else {
                // Already liked, remove like
                post.liked_by.splice(likeIndex, 1);
                isLiked = false;
            }
        } else if (type === 'downvote') {
            const likeIndex = post.liked_by.indexOf(req.user.id);
            const dislikeIndex = post.disliked_by.indexOf(req.user.id);

            if (likeIndex !== -1) {
                post.liked_by.splice(likeIndex, 1);
            }

            if (dislikeIndex === -1) {
                post.disliked_by.push(req.user.id);
                isDisliked = true;
            } else {
                post.disliked_by.splice(dislikeIndex, 1);
                isDisliked = false;
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid vote type' });
        }

        post.upvotes = post.liked_by.length;
        post.downvotes = post.disliked_by.length;
        await post.save();

        res.json({ success: true, isLiked, isDisliked, upvotes: post.upvotes, downvotes: post.downvotes });
    } catch (e) {
        console.error("[VOTES] Post error:", e);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// In-memory cache for Telegram download URLs.
const tgUrlCache = new Map();
const TG_URL_TTL = 45 * 60 * 1000; // 45 minutes

const getTgDownloadUrl = async (token, tgFileId, TELEGRAM_URL) => {
    const cached = tgUrlCache.get(tgFileId);
    if (cached) {
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
            tgUrlCache.delete(tgFileId);
        } else {
            return cached.url || cached.promise;
        }
    }

    const agent = new https.Agent({ family: 4 });
    const promise = axios.get(`${TELEGRAM_URL}/bot${token}/getFile?file_id=${tgFileId}`, { httpsAgent: agent })
        .then(infoRes => {
            const url = `${TELEGRAM_URL}/file/bot${token}/${infoRes.data.result.file_path}`;
            tgUrlCache.set(tgFileId, { url, expiresAt: Date.now() + TG_URL_TTL });
            return url;
        })
        .catch(err => {
            tgUrlCache.delete(tgFileId);
            throw err;
        });

    tgUrlCache.set(tgFileId, { promise });
    return promise;
};

// GET /api/admin/pfp-storage-config
router.get('/admin/pfp-storage-config', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden" });
        }
        let config = await PFPStorageConfig.findOne({});
        if (!config) {
            config = await PFPStorageConfig.create({});
        }
        res.json({
            status: 'success',
            data: {
                storage_name: config.telegram_channel_name,
                storage_id: config.telegram_channel_id,
                storage_tokens: config.telegram_bot_tokens
            }
        });
    } catch (e) {
        console.error("[PFP_CONFIG_GET] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/pfp-storage-config
router.post('/admin/pfp-storage-config', authMiddleware, async (req, res) => {
    const { storage_name, storage_id, storage_tokens } = req.body;
    try {
        const user = await User.findOne({ id: req.user.id });
        if (user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden" });
        }

        const cleanTokens = Array.isArray(storage_tokens) ? storage_tokens.filter(t => t.trim() !== '') : [];

        let config = await PFPStorageConfig.findOne({});
        if (!config) {
            config = new PFPStorageConfig();
        }

        config.telegram_channel_name = storage_name || "";
        config.telegram_channel_id = storage_id || "";
        config.telegram_bot_tokens = cleanTokens;
        
        await config.save();
        
        res.json({ status: 'success', message: 'PFP Storage config updated successfully' });
    } catch (e) {
        console.error("[PFP_CONFIG_POST] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});


// GET /api/admin/detect-chat-id
router.get('/admin/detect-chat-id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        let token = req.query.token;
        if (!token) {
            const config = await StorageManager.findOne({ state: 'National' });
            if (!config || !config.telegram_bot_token) {
                return res.status(400).json({ detail: "Please provide a bot token or save it first." });
            }
            token = config.telegram_bot_token;
        }

        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

        console.log(`[DETECT_CHAT] Fetching updates from Telegram...`);
        const response = await axios.get(`${TELEGRAM_URL}/bot${token}/getUpdates`);
        
        const updates = response.data.result || [];
        const detectedChats = [];
        const seenIds = new Set();

        for (const update of updates) {
            let chat = null;
            if (update.message) chat = update.message.chat;
            else if (update.channel_post) chat = update.channel_post.chat;
            else if (update.my_chat_member) chat = update.my_chat_member.chat;

            if (!chat || !chat.id) continue;

            if (seenIds.has(chat.id)) continue;
            seenIds.add(chat.id);

            detectedChats.push({
                id: chat.id.toString(),
                title: chat.title || chat.username || chat.first_name || "Unknown Chat",
                type: chat.type || "unknown"
            });
        }

        res.json({ success: true, chats: detectedChats });
    } catch (err) {
        console.error("[DETECT_CHAT_ERROR]", err);
        res.status(500).json({ detail: err.response?.data?.description || err.message || "Failed to fetch updates from storage provider" });
    }
});

// GET /api/admin/system-settings
router.get('/admin/system-settings', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden" });
        }
        let config = await SystemSettings.findOne({});
        if (!config) {
            config = await SystemSettings.create({});
        }
        res.json({
            status: 'success',
            data: {
                daily_upload_limit: config.daily_upload_limit
            }
        });
    } catch (e) {
        console.error("[SYSTEM_SETTINGS_GET] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/system-settings
router.post('/admin/system-settings', authMiddleware, async (req, res) => {
    const { daily_upload_limit } = req.body;
    try {
        const user = await User.findOne({ id: req.user.id });
        if (user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden" });
        }
        let config = await SystemSettings.findOne({});
        if (!config) {
            config = new SystemSettings();
        }
        if (daily_upload_limit !== undefined) {
            config.daily_upload_limit = Number(daily_upload_limit);
        }
        await config.save();
        res.json({ status: 'success', message: 'System settings updated' });
    } catch (e) {
        console.error("[SYSTEM_SETTINGS_POST] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/posts/upload-limit
router.get('/posts/upload-limit', authMiddleware, async (req, res) => {
    try {
        const ip = req.ip;
        const userId = req.user?.id;

        let settings = await SystemSettings.findOne({});
        let limit = settings ? settings.daily_upload_limit : 3;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const countByUser = await UploadLog.countDocuments({ user_id: userId, created_at: { $gte: startOfDay } });

        const remaining = Math.max(0, limit - countByUser);

        res.json({
            success: true,
            used: countByUser,
            limit: limit,
            remaining: remaining
        });
    } catch (e) {
        console.error("[LIMIT_GET] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/posts
router.get('/posts', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
            return res.status(403).json({ detail: "Forbidden: Admin or Moderator access only" });
        }

        const ip = req.ip;
        const detectedRegion = await getRegionFromIp(ip);

        let query = {};

        if (user.role === 'moderator') {
            const assignments = await RegionalAdmin.find({ email: user.email.toLowerCase().trim() });
            const orClauses = [];
            
            const addClause = (state, city) => {
                if (!state) return;
                const stateName = state.trim();
                const cityName = city ? city.trim() : "";
                if (stateName.toLowerCase() === 'national') {
                    orClauses.push({}); // Match all
                } else if (!cityName || cityName.toLowerCase() === 'all' || cityName.toLowerCase() === 'fallback') {
                    orClauses.push({ state: new RegExp('^' + stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
                } else {
                    orClauses.push({
                        state: new RegExp('^' + stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
                        city: new RegExp('^' + cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
                    });
                }
            };

            for (const a of assignments) {
                addClause(a.state, a.city);
            }
            if (user.moderator_state && user.moderator_state.trim() !== '') {
                addClause(user.moderator_state, user.moderator_city);
            }

            if (orClauses.length === 0) {
                return res.json({ status: 'success', data: [], detected_region: detectedRegion });
            }

            const isGlobal = orClauses.some(c => Object.keys(c).length === 0);
            if (!isGlobal) {
                query = { $or: orClauses };
            }
        }

        query.status = 'pending';
        query.escalated_to_admin = { $ne: true };

        const posts = await TempPost.find(query).sort({ created_at: -1 });
        res.json({ status: 'success', data: posts, detected_region: detectedRegion });
    } catch (err) {
        console.error("[ADMIN_POSTS] GET error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/posts
router.post('/posts', authMiddleware, async (req, res) => {
    const { action } = req.query;
    const { post_id } = req.body;
    if (!post_id) return res.status(400).json({ detail: "post_id is required" });

    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
            return res.status(403).json({ detail: "Forbidden" });
        }

        let tempPost = await TempPost.findById(post_id);
        if (!tempPost) {
            tempPost = await TempPost.findOne({ _id: post_id });
        }

        let post = null;
        if (!tempPost) {
            post = await Post.findById(post_id);
            if (!post) {
                post = await Post.findOne({ _id: post_id });
            }
        }

        const targetPost = tempPost || post;
        if (!targetPost) {
            return res.status(404).json({ detail: "Post not found" });
        }

        if (user.role === 'moderator') {
            const assignments = await RegionalAdmin.find({ email: user.email.toLowerCase().trim() });
            
            const checkAuth = (state, city) => {
                if (!state) return false;
                if (state.trim().toLowerCase() === 'national') return true;
                const stateMatch = targetPost.state && targetPost.state.trim().toLowerCase() === state.trim().toLowerCase();
                if (!stateMatch) return false;
                if (!city || city.trim() === "" || city.trim().toLowerCase() === "all" || city.trim().toLowerCase() === "fallback") {
                    return true;
                }
                return targetPost.city && targetPost.city.trim().toLowerCase() === city.trim().toLowerCase();
            };

            let isAuthorized = assignments.some(a => checkAuth(a.state, a.city));
            
            if (!isAuthorized && user.moderator_state) {
                isAuthorized = checkAuth(user.moderator_state, user.moderator_city);
            }

            if (!isAuthorized) {
                return res.status(403).json({ detail: "Forbidden: You are not authorized to moderate this region." });
            }
        }

        if (tempPost) {
            if (action === 'verify') {
                await verifyPostHelper(tempPost);

                // Update author trust score (+5)
                const authorUser = await User.findOne({ username: tempPost.author });
                if (authorUser) {
                    authorUser.trust_score = (authorUser.trust_score || 0) + 5;
                    await authorUser.save();
                }

                await logAdminAction(user.id, user.username, 'verify_post', tempPost.title, { post_id: tempPost._id, author: tempPost.author });
                broadcastAdminEvent('posts_updated', {});

                return res.json({ success: true });

            } else if (action === 'reject') {
                const { reason } = req.body;
                if (!reason || reason.trim() === '') {
                    return res.status(400).json({ detail: "Reason is required for rejection." });
                }

                const cleanedReason = reason.trim();
                let isSuspicious = false;
                
                if (cleanedReason.length < 15) isSuspicious = true;
                if (/(.)\1{4,}/.test(cleanedReason)) isSuspicious = true;
                if (cleanedReason.length > 20 && !cleanedReason.includes(' ')) isSuspicious = true;

                if (isSuspicious) {
                    tempPost.escalated_to_admin = true;
                    tempPost.escalation_reason = `Suspicious rejection reason by moderator @${user.username}: "${cleanedReason}"`;
                    tempPost.rejected_reason = cleanedReason;
                    tempPost.moderator_id = user.username;
                    await tempPost.save();

                    await logAdminAction(user.id, user.username, 'escalate_post_suspicious_reason', tempPost.title, { post_id: tempPost._id });
                    broadcastAdminEvent('post_escalated', { post: tempPost, reason: tempPost.escalation_reason });
                    
                    return res.json({ success: true, message: "Reason flagged as suspicious. Post escalated to admin." });
                }

                const filename = path.basename(tempPost.media_url);
                const filePath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, () => {});
                }
                await TempPost.deleteOne({ _id: tempPost._id });
                await refundUploadCredit(tempPost.author);

                // Update author trust score (-10)
                const authorUser = await User.findOne({ username: tempPost.author });
                if (authorUser) {
                    authorUser.trust_score = (authorUser.trust_score || 0) - 10;
                    await authorUser.save();

                    // Notify Author
                    await Notification.create({
                        user_id: authorUser.id,
                        type: 'reject',
                        actor_username: 'System/Admin',
                        post_id: tempPost._id
                    });
                }

                await logAdminAction(user.id, user.username, 'reject_post', tempPost.title, { post_id: tempPost._id, author: tempPost.author });
                broadcastAdminEvent('posts_updated', {});

                return res.json({ success: true });
            } else {
                return res.status(400).json({ detail: "Invalid action" });
            }
        }

        // Fallback to legacy posts if not found in TempPost
        if (!post) return res.status(404).json({ detail: "Post not found" });

        if (action === 'verify') {
            post.status = 'verified';
            await post.save();

            await logAdminAction(user.id, user.username, 'verify_post_legacy', post.title, { post_id: post._id, author: post.author });
            broadcastAdminEvent('posts_updated', {});

            res.json({ success: true });
        } else if (action === 'reject') {
            if (post.telegram_message_id) {
                const config = await StorageManager.findOne({ state: 'National' });
                if (config && config.telegram_bot_token && config.telegram_channel_id) {
                    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                    axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                        chat_id: config.telegram_channel_id,
                        message_id: post.telegram_message_id
                    }).catch(e => console.error("Failed to delete telegram message on reject:", e.message));
                }
            }
            if (!post.telegram_file_id && post.media_url.startsWith('/uploads/')) {
                const filename = path.basename(post.media_url);
                const localPath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(localPath)) {
                    fs.unlink(localPath, () => {});
                }
            }
            await Post.deleteOne({ _id: post._id });

            await logAdminAction(user.id, user.username, 'reject_post_legacy', post.title, { post_id: post._id, author: post.author });
            broadcastAdminEvent('posts_updated', {});

            res.json({ success: true });
        } else {
            res.status(400).json({ detail: "Invalid action" });
        }
    } catch (err) {
        console.error("[ADMIN_POSTS_ACTION] POST error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/posts/media/:id
router.get('/posts/media/:id', optionalAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        let post = await Post.findById(id);
        if (!post) {
            post = await TempPost.findById(id);
        }
        if (!post) {
            return res.status(404).json({ detail: "Post not found" });
        }

        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
        let token = post.telegram_bot_token;
        if (!token) {
            token = (await StorageManager.findOne({ state: 'National' }))?.telegram_bot_token;
        }

        // New chunked streaming logic
        if (post.telegram_chunks && post.telegram_chunks.length > 0) {
            const chunks = post.telegram_chunks.sort((a,b) => a.position - b.position);
            const totalSize = post.media_size || chunks.reduce((acc, curr) => acc + curr.size, 0);
            
            let start = 0;
            let end = totalSize - 1;
            
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                start = parseInt(parts[0], 10);
                end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
            }

            const headers = {
                'Accept-Ranges': 'bytes',
                'Content-Length': (end - start) + 1,
                'Content-Type': post.mime_type || 'video/mp4',
            };
            if (range) {
                headers['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
            }
            res.writeHead(range ? 206 : 200, headers);

            if (!token) {
                res.end();
                return;
            }

            let currentByte = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkStart = currentByte;
                const chunkEnd = currentByte + chunk.size - 1;
                
                if (chunkEnd >= start && chunkStart <= end) {
                    const downloadUrl = await getTgDownloadUrl(token, chunk.telegram_file_id, TELEGRAM_URL);
                    const chunkOffset = Math.max(0, start - chunkStart);
                    const chunkLimit = Math.min(chunk.size - 1, end - chunkStart);
                    
                    try {
                        const dlRes = await new Promise((resolve, reject) => {
                            const req = https.get(downloadUrl, {
                                headers: { Range: `bytes=${chunkOffset}-${chunkLimit}` },
                                family: 4
                            }, (res) => {
                                resolve(res);
                            });
                            req.on('error', reject);
                        });
                        
                        await new Promise((resolve, reject) => {
                            if (dlRes.statusCode === 206) {
                                dlRes.on('data', d => res.write(d));
                                dlRes.on('end', resolve);
                                dlRes.on('error', reject);
                            } else {
                                let bytesPassed = 0;
                                dlRes.on('data', (data) => {
                                    let sliceStart = 0;
                                    let sliceEnd = data.length;
                                    
                                    if (bytesPassed < chunkOffset) {
                                        if (bytesPassed + data.length <= chunkOffset) {
                                            bytesPassed += data.length;
                                            return;
                                        } else {
                                            sliceStart = chunkOffset - bytesPassed;
                                        }
                                    }
                                    
                                    if (bytesPassed + data.length > chunkLimit + 1) {
                                        sliceEnd = (chunkLimit + 1) - bytesPassed;
                                    }
                                    
                                    if (sliceStart < sliceEnd) {
                                        res.write(data.slice(sliceStart, sliceEnd));
                                    }
                                    
                                    bytesPassed += data.length;
                                    if (bytesPassed > chunkLimit) {
                                        dlRes.destroy();
                                        resolve();
                                    }
                                });
                                dlRes.on('end', resolve);
                                dlRes.on('error', reject);
                            }
                        });
                    } catch(err) {
                        console.error("[CHUNK_STREAM] Error streaming chunk:", err.message);
                        break;
                    }
                }
                currentByte += chunk.size;
                if (currentByte > end) break;
            }
            
            res.end();
            return;
        }

        // Backward compatibility for single file caching
        if (!post.telegram_file_id) {
            const filename = path.basename(post.media_url);
            const localPath = path.join(process.cwd(), '.uploads', filename);
            if (!fs.existsSync(localPath)) return res.status(404).json({ detail: "Local file not found" });
            return res.sendFile(localPath, { maxAge: '1y', immutable: true });
        }

        const ext = path.extname(post.media_url) || '.mp4';
        const cachePath = path.join(cacheDir, `${post._id}${ext}`);
        if (fs.existsSync(cachePath)) return res.sendFile(cachePath, { maxAge: '1y', immutable: true });

        if (!token) return res.status(500).json({ detail: "Telegram configuration missing" });

        let downloadPromise = activeDownloads.get(id);
        if (!downloadPromise) {
            downloadPromise = (async () => {
                const downloadUrl = await getTgDownloadUrl(token, post.telegram_file_id, TELEGRAM_URL);
                const tempFilePath = `${cachePath}.tmp`;
                const writer = fs.createWriteStream(tempFilePath);
                const dlRes = await axios.get(downloadUrl, { responseType: 'stream' });
                dlRes.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                fs.renameSync(tempFilePath, cachePath);
            })();
            activeDownloads.set(id, downloadPromise);
        }

        try {
            await downloadPromise;
        } catch (downloadError) {
            activeDownloads.delete(id);
            const tempFilePath = `${cachePath}.tmp`;
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            return res.status(500).json({ detail: "Error fetching media" });
        }

        return res.sendFile(cachePath, { maxAge: '1y', immutable: true });

    } catch (err) {
        console.error("[MEDIA] Error serving media:", err);
        if (!res.headersSent) {
            res.status(500).json({ detail: "Internal Server Error" });
        } else {
            res.end();
        }
    }
});

// GET /api/admin/storage-managers
router.get('/admin/storage-managers', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }
        const managers = await StorageManager.find().sort({ state: 1, city: 1 }).lean();
        const maskedManagers = managers.map(m => ({
            _id: m._id,
            name: m.name,
            state: m.state,
            city: m.city,
            storage_tokens: (m.telegram_bot_tokens && m.telegram_bot_tokens.length > 0) 
                ? m.telegram_bot_tokens.map(() => '************') 
                : (m.telegram_bot_token ? ['************'] : []),
            storage_id: m.telegram_channel_id,
            id: m.id
        }));
        res.json({ success: true, data: maskedManagers });
    } catch (err) {
        console.error("[STORAGE_MANAGERS] GET error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/storage-managers
router.post('/admin/storage-managers', authMiddleware, async (req, res) => {
    const { name, state, city, storage_tokens, storage_id } = req.body;
    if (!name || !state || !storage_tokens || !Array.isArray(storage_tokens) || storage_tokens.length === 0 || !storage_id) {
        return res.status(400).json({ detail: "Missing required fields or invalid storage_tokens array" });
    }

    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        const cleanTokens = storage_tokens.filter(t => t && typeof t === 'string' && t.trim().length > 0).map(t => t.trim());

        const manager = await StorageManager.create({
            name,
            state: state.toLowerCase().trim(),
            city: (city || "").toLowerCase().trim(),
            telegram_bot_token: cleanTokens[0] || "",
            telegram_bot_tokens: cleanTokens,
            telegram_channel_id: storage_id.trim()
        });

        res.status(201).json({ success: true, data: {
            _id: manager._id,
            name: manager.name,
            state: manager.state,
            city: manager.city,
            storage_tokens: manager.telegram_bot_tokens.map(t => '************'),
            storage_id: manager.telegram_channel_id,
            id: manager.id
        } });
    } catch (err) {
        console.error("[STORAGE_MANAGERS] POST error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// DELETE /api/admin/storage-managers/:id
router.delete('/admin/storage-managers/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        await StorageManager.deleteOne({ id });
        res.json({ success: true });
    } catch (err) {
        console.error("[STORAGE_MANAGERS] DELETE error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/regional-admins
router.get('/admin/regional-admins', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        const superadminEmail = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
        if (!user || user.role !== 'admin' || user.email.toLowerCase().trim() !== superadminEmail) {
            return res.status(403).json({ detail: "Forbidden: Only SuperAdmin can manage regional admins" });
        }
        const admins = await RegionalAdmin.find().sort({ email: 1, state: 1 });
        res.json({ success: true, data: admins });
    } catch (err) {
        console.error("[REGIONAL_ADMINS] GET error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/regional-admins
router.post('/admin/regional-admins', authMiddleware, async (req, res) => {
    const { email, state, city } = req.body;
    if (!email || !state) {
        return res.status(400).json({ detail: "Email and State are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanState = state.toLowerCase().trim();
    const cleanCity = (city || "").toLowerCase().trim();

    try {
        const user = await User.findOne({ id: req.user.id });
        const superadminEmail = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
        if (!user || user.role !== 'admin' || user.email.toLowerCase().trim() !== superadminEmail) {
            return res.status(403).json({ detail: "Forbidden: Only SuperAdmin can manage regional admins" });
        }

        const targetUser = await User.findOne({ email: cleanEmail });
        if (targetUser && targetUser.role === 'user') {
            targetUser.role = 'moderator';
            await targetUser.save();
        }

        const adminAssignment = await RegionalAdmin.create({
            email: cleanEmail,
            state: cleanState,
            city: cleanCity
        });

        res.status(201).json({ success: true, data: adminAssignment });
    } catch (err) {
        console.error("[REGIONAL_ADMINS] POST error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// DELETE /api/admin/regional-admins/:id
router.delete('/admin/regional-admins/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findOne({ id: req.user.id });
        const superadminEmail = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
        if (!user || user.role !== 'admin' || user.email.toLowerCase().trim() !== superadminEmail) {
            return res.status(403).json({ detail: "Forbidden: Only SuperAdmin can manage regional admins" });
        }

        const assignment = await RegionalAdmin.findById(id);
        if (!assignment) {
            return res.status(404).json({ detail: "Assignment not found" });
        }

        const cleanEmail = assignment.email.toLowerCase().trim();

        await RegionalAdmin.deleteOne({ _id: id });

        const remaining = await RegionalAdmin.countDocuments({ email: cleanEmail });
        if (remaining === 0) {
            const targetUser = await User.findOne({ email: cleanEmail });
            if (targetUser && targetUser.role === 'moderator') {
                targetUser.role = 'user';
                await targetUser.save();
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[REGIONAL_ADMINS] DELETE error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// PUT /api/posts/:id
router.put('/posts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, description, state, city } = req.body;

    if (!title || !description || !state || !city) {
        return res.status(400).json({ detail: "Missing required fields" });
    }

    try {
        let post = await Post.findById(id);
        let isTemp = false;
        if (!post) {
            post = await TempPost.findById(id);
            isTemp = true;
        }
        if (!post) {
            return res.status(404).json({ detail: "Post not found" });
        }

        const user = await User.findOne({ id: req.user.id });
        if (!user) {
            return res.status(401).json({ detail: "Unauthorized" });
        }

        if (post.author !== user.username && user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: You are not the author of this post" });
        }

        post.title = title;
        post.description = description;
        post.state = state;
        post.city = city;
        await post.save();

        if (post.telegram_message_id && !isTemp) {
            const config = await StorageManager.findOne({ state: 'National' });
            if (config && config.telegram_bot_token && config.telegram_channel_id) {
                const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                const caption = `**${title}**\n\n${description}\n\n📍 ${city}, ${state}\n👤 Reporter: @${post.author}`;
                axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/editMessageCaption`, {
                    chat_id: config.telegram_channel_id,
                    message_id: post.telegram_message_id,
                    caption: caption.substring(0, 1024),
                    parse_mode: 'Markdown'
                }).catch(e => console.error("Failed to edit Telegram caption:", e.message));
            }
        }

        res.json({ success: true, data: post });
    } catch (e) {
        console.error("[POST_EDIT] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// DELETE /api/posts/:id
router.delete('/posts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        let post = await Post.findById(id);
        if (!post) {
            post = await TempPost.findById(id);
        }
        if (!post) {
            return res.status(404).json({ detail: "Post not found" });
        }

        const user = await User.findOne({ id: req.user.id });
        if (!user) {
            return res.status(401).json({ detail: "Unauthorized" });
        }

        if (post.author !== user.username && user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: You are not the author of this post" });
        }

        if (post.telegram_message_id) {
            const config = await StorageManager.findOne({ state: 'National' });
            if (config && config.telegram_bot_token && config.telegram_channel_id) {
                const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                    chat_id: config.telegram_channel_id,
                    message_id: post.telegram_message_id
                }).catch(e => console.error("Failed to delete telegram message on post delete:", e.message));
            }
        }

        if (!post.telegram_file_id && post.media_url && post.media_url.startsWith('/uploads/')) {
            const filename = path.basename(post.media_url);
            const localPath = path.join(process.cwd(), '.uploads', filename);
            if (fs.existsSync(localPath)) {
                fs.unlink(localPath, () => {});
            }
        }

        const ext = path.extname(post.media_url || '') || '.mp4';
        const cachePath = path.join(process.cwd(), '.uploads', 'cache', `${post._id}${ext}`);
        if (fs.existsSync(cachePath)) {
            fs.unlink(cachePath, () => {});
        }

        await Post.deleteOne({ _id: post._id });
        await TempPost.deleteOne({ _id: post._id });

        if (user.role === 'admin' || user.role === 'moderator') {
            await logAdminAction(user.id, user.username, 'delete_post', post.title, { post_id: post._id });
        }
        broadcastAdminEvent('posts_updated', {});

        res.json({ success: true, message: "Post deleted successfully" });
    } catch (e) {
        console.error("[POST_DELETE] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});
// POST /api/reports
router.post('/reports', authMiddleware, async (req, res) => {
    const { post_id, category, description } = req.body;
    if (!post_id || !category) return res.status(400).json({ detail: "Post ID and Category are required" });
    if (description && description.length > 500) {
        return res.status(400).json({ detail: "Description must be less than 500 characters" });
    }
    
    try {
        const ip = req.ip;
        const userId = req.user.id;
        
        // Rate limiting check
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const reportCount = await ReportLog.countDocuments({ user_id: userId, created_at: { $gte: startOfDay } });
        if (reportCount >= 5) {
            return res.status(429).json({ detail: "Daily report limit reached. Try again tomorrow." });
        }
        
        await ReportLog.create({ ip, user_id: userId });
        await Report.create({
            reporter_id: userId,
            post_id,
            category,
            description
        });
        
        res.json({ success: true, message: "Report submitted successfully" });
    } catch (e) {
        console.error("[REPORT_POST] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/reports
router.get('/admin/reports', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (user.role !== 'admin' && user.role !== 'moderator') {
            return res.status(403).json({ detail: "Forbidden" });
        }
        
        const reports = await Report.find({ status: 'pending' }).sort({ created_at: -1 }).lean();
        
        // Populate additional details
        const enrichedReports = await Promise.all(reports.map(async (r) => {
            const reporter = await User.findOne({ id: r.reporter_id });
            const post = await Post.findOne({ _id: r.post_id });
            return {
                ...r,
                reporter_username: reporter ? reporter.username : "Unknown",
                post_title: post ? post.title : "Deleted Post",
                post_author: post ? post.author : "Unknown"
            };
        }));
        
        res.json({ success: true, data: enrichedReports });
    } catch (e) {
        console.error("[ADMIN_REPORTS_GET] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/reports/:id/action
router.post('/admin/reports/:id/action', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'dismiss' or 'delete_post'
    
    try {
        const user = await User.findOne({ id: req.user.id });
        if (user.role !== 'admin' && user.role !== 'moderator') {
            return res.status(403).json({ detail: "Forbidden" });
        }
        
        const report = await Report.findOne({ id });
        if (!report) return res.status(404).json({ detail: "Report not found" });
        
        if (action === 'dismiss') {
            report.status = 'dismissed';
            await report.save();
        } else if (action === 'delete_post') {
            // Delete the associated post logic here (similar to DELETE /posts/:id)
            const post = await Post.findOne({ _id: report.post_id });
            if (post) {
                if (post.telegram_message_id) {
                    const config = await StorageManager.findOne({ state: 'National' });
                    if (config && config.telegram_bot_token && config.telegram_channel_id) {
                        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                        axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                            chat_id: config.telegram_channel_id,
                            message_id: post.telegram_message_id
                        }).catch(e => console.error("Failed to delete telegram message on report delete:", e.message));
                    }
                }
                await Post.deleteOne({ _id: post._id });
                await TempPost.deleteOne({ _id: post._id });
            }
            report.status = 'reviewed';
            await report.save();
            await logAdminAction(user.id, user.username, 'delete_post_via_report', post?.title || 'Unknown', { report_id: report.id });
            broadcastAdminEvent('posts_updated', {});
        } else {
            return res.status(400).json({ detail: "Invalid action" });
        }
        
        res.json({ success: true, message: `Report marked as ${action === 'dismiss' ? 'dismissed' : 'reviewed'}` });
    } catch (e) {
        console.error("[ADMIN_REPORT_ACTION] Error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});


router.get('/admin/analytics', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        const totalUsers = await User.countDocuments();
        const totalPosts = await Post.countDocuments({ status: 'verified' });
        const totalPendingPosts = await TempPost.countDocuments({ status: 'pending' });
        
        const viewsResult = await Post.aggregate([
            { $match: { status: 'verified' } },
            { $group: { _id: null, totalViews: { $sum: '$views' } } }
        ]);
        const totalViews = viewsResult[0]?.totalViews || 0;

        const postsByRegion = await Post.aggregate([
            { $match: { status: 'verified' } },
            { $group: { _id: '$state', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyUploadsResult = await Post.aggregate([
            { $match: { status: 'verified', created_at: { $gte: sevenDaysAgo, $type: "date" } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const tempDailyUploads = await TempPost.aggregate([
            { $match: { created_at: { $gte: sevenDaysAgo, $type: "date" } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const dailyUploads = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split('T')[0];
            const verifiedItem = dailyUploadsResult.find(x => x._id === dateStr);
            const pendingItem = tempDailyUploads.find(x => x._id === dateStr);
            dailyUploads.push({
                date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                verified: verifiedItem ? verifiedItem.count : 0,
                pending: pendingItem ? pendingItem.count : 0
            });
        }

        const topCreators = await Post.aggregate([
            { $match: { status: 'verified' } },
            { $group: { _id: '$author', count: { $sum: 1 }, views: { $sum: '$views' } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            summary: {
                totalUsers,
                totalPosts,
                totalPendingPosts,
                totalViews
            },
            postsByRegion,
            dailyUploads,
            topCreators
        });
    } catch (err) {
        console.error("[ADMIN_ANALYTICS] error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/users
router.get('/admin/users', authMiddleware, async (req, res) => {
    const { search } = req.query;
    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        let query = {};
        if (search) {
            const cleanSearch = search.trim();
            query = {
                $or: [
                    { username: new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                    { email: new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
                ]
            };
        }

        const users = await User.find(query, 'id username email role trust_score is_banned strikes').limit(50);
        res.json({ success: true, data: users });
    } catch (err) {
        console.error("[ADMIN_USERS] GET error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/users/:id/action
router.post('/admin/users/:id/action', authMiddleware, async (req, res) => {
    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        let targetUser;
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            targetUser = await User.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
        } else {
            targetUser = await User.findOne({ id: req.params.id });
        }
        if (!targetUser) return res.status(404).json({ detail: "User not found" });

        const { action } = req.body;
        
        switch (action) {
            case 'ban':
                targetUser.is_banned = true;
                break;
            case 'unban':
                targetUser.is_banned = false;
                break;
            case 'strike':
                targetUser.strikes += 1;
                if (targetUser.strikes >= 3) {
                    targetUser.is_banned = true;
                }
                break;
            case 'remove_strike':
                targetUser.strikes = Math.max(0, targetUser.strikes - 1);
                break;
            case 'make_moderator':
                targetUser.role = 'moderator';
                break;
            case 'remove_moderator':
                targetUser.role = 'user';
                break;
            default:
                return res.status(400).json({ detail: "Invalid action" });
        }
        await targetUser.save();

        await AuditLog.create({
            actor_id: adminUser.id,
            actor_username: adminUser.username,
            action: `user_${action}`,
            target: targetUser.id,
            details: { username: targetUser.username }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("[ADMIN_USER_ACTION] error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/users/bulk-action
router.post('/admin/users/bulk-action', authMiddleware, async (req, res) => {
    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        const { userIds, action } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ detail: "User IDs required" });
        }

        for (const uid of userIds) {
            let targetUser;
            if (uid.match(/^[0-9a-fA-F]{24}$/)) {
                targetUser = await User.findOne({ $or: [{ id: uid }, { _id: uid }] });
            } else {
                targetUser = await User.findOne({ id: uid });
            }
            if (!targetUser) continue;

            switch (action) {
                case 'ban':
                    targetUser.is_banned = true;
                    break;
                case 'unban':
                    targetUser.is_banned = false;
                    break;
                case 'strike':
                    targetUser.strikes += 1;
                    if (targetUser.strikes >= 3) targetUser.is_banned = true;
                    break;
                case 'remove_strike':
                    targetUser.strikes = Math.max(0, targetUser.strikes - 1);
                    break;
            }
            await targetUser.save();

            await AuditLog.create({
                actor_id: adminUser.id,
                actor_username: adminUser.username,
                action: `user_bulk_${action}`,
                target: targetUser.id,
                details: { username: targetUser.username }
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[ADMIN_BULK_ACTION] error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/escalated
router.get('/admin/escalated', authMiddleware, async (req, res) => {
    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        const posts = await TempPost.find({ escalated_to_admin: true }).sort({ created_at: -1 }).limit(50);
        res.json({ success: true, data: posts });
    } catch (err) {
        console.error("[ADMIN_ESCALATED] GET error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/escalated/:id/action
router.post('/admin/escalated/:id/action', authMiddleware, async (req, res) => {
    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        const { action } = req.body; // 'confirm_rejection' or 'overturn_rejection'
        const post = await TempPost.findOne({ id: req.params.id, escalated_to_admin: true });
        
        if (!post) {
            return res.status(404).json({ detail: "Escalated post not found" });
        }

        if (action === 'confirm_rejection') {
            post.status = 'rejected';
            post.escalated_to_admin = false;
            await post.save();
            await refundUploadCredit(post.author);

            await AuditLog.create({
                actor_id: adminUser.id,
                actor_username: adminUser.username,
                action: 'confirm_mod_rejection',
                target: post.id,
                details: { title: post.title }
            });
            // Optional: Send notification to mod that rejection was confirmed
        } else if (action === 'overturn_rejection') {
            // Overturn: Issue mod strike, approve post
            post.status = 'verified';
            post.escalated_to_admin = false;
            await post.save();

            // Find mod
            if (post.moderator_id) {
                const mod = await User.findOne({ id: post.moderator_id });
                if (mod) {
                    mod.moderator_strikes = (mod.moderator_strikes || 0) + 1;
                    if (mod.moderator_strikes >= 3) {
                        mod.role = 'user'; // Demote mod
                    }
                    await mod.save();
                    
                    await Notification.create({
                        user_id: mod.id,
                        type: 'mod_strike_issued',
                        actor_username: 'System',
                        post_id: post.id,
                        message: `Admin approved the video you rejected ("${post.title}"). Automatic security system issued a strike on your account. You now have ${mod.moderator_strikes}/3 strikes.`
                    });
                }
            }

            // Move to verified Posts
            await verifyPostHelper(post);

            await AuditLog.create({
                actor_id: adminUser.id,
                actor_username: adminUser.username,
                action: 'overturn_mod_rejection',
                target: post.id,
                details: { title: post.title }
            });
        } else {
            return res.status(400).json({ detail: "Invalid action" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[ADMIN_ESCALATED_ACTION] error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// DELETE /api/admin/users/:identifier
router.delete('/admin/users/:identifier', authMiddleware, async (req, res) => {
    const { identifier } = req.params;
    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        const queryConditions = [
            { id: identifier },
            { username: identifier.toLowerCase().trim() },
            { email: identifier.toLowerCase().trim() }
        ];
        if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
            queryConditions.push({ _id: identifier });
        }
        const targetUser = await User.findOne({ $or: queryConditions });

        if (!targetUser) {
            return res.status(404).json({ detail: "User not found" });
        }

        if (targetUser.id === adminUser.id) {
            return res.status(400).json({ detail: "You cannot delete your own admin account!" });
        }

        const username = targetUser.username;
        const email = targetUser.email.toLowerCase().trim();

        // 1. Delete verified posts of the user
        const posts = await Post.find({ author: username });
        for (const post of posts) {
            if (post.telegram_message_id) {
                const config = await StorageManager.findOne({ state: 'National' });
                if (config && config.telegram_bot_token && config.telegram_channel_id) {
                    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                    axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                        chat_id: config.telegram_channel_id,
                        message_id: post.telegram_message_id
                    }).catch(e => console.error("Failed to delete telegram message on user delete:", e.message));
                }
            }
            if (!post.telegram_file_id && post.media_url && post.media_url.startsWith('/uploads/')) {
                const filename = path.basename(post.media_url);
                const localPath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(localPath)) {
                    fs.unlink(localPath, () => {});
                }
            }
            const ext = path.extname(post.media_url || '') || '.mp4';
            const cachePath = path.join(process.cwd(), '.uploads', 'cache', `${post._id}${ext}`);
            if (fs.existsSync(cachePath)) {
                fs.unlink(cachePath, () => {});
            }
        }
        await Post.deleteMany({ author: username });

        // 2. Delete pending/temp posts of the user
        const tempPosts = await TempPost.find({ author: username });
        for (const tempPost of tempPosts) {
            if (tempPost.media_url && tempPost.media_url.startsWith('/uploads/')) {
                const filename = path.basename(tempPost.media_url);
                const localPath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(localPath)) {
                    fs.unlink(localPath, () => {});
                }
            }
        }
        await TempPost.deleteMany({ author: username });

        // 3. Delete Profile Photo (PFP)
        const pfp = await PFP.findOne({ user_id: targetUser.id });
        if (pfp) {
            if (pfp.telegram_message_id && pfp.telegram_bot_token) {
                const config = await StorageManager.findOne({ state: 'National' });
                const chatId = config?.telegram_channel_id;
                if (chatId) {
                    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                    axios.post(`${TELEGRAM_URL}/bot${pfp.telegram_bot_token}/deleteMessage`, {
                        chat_id: chatId,
                        message_id: pfp.telegram_message_id
                    }).catch(e => console.error("Failed to delete user PFP telegram message:", e.message));
                }
            }
            if (!pfp.telegram_file_id && pfp.media_url && pfp.media_url.startsWith('/uploads/')) {
                const filename = path.basename(pfp.media_url);
                const localPath = path.join(process.cwd(), '.uploads', filename);
                if (fs.existsSync(localPath)) {
                    fs.unlink(localPath, () => {});
                }
            }
            await PFP.deleteOne({ _id: pfp._id });
        }

        // 4. Delete regional admin assignments
        await RegionalAdmin.deleteMany({ email: email });

        // 5. Delete storages and storage workers
        
        

        // 6. Delete user document
        await User.deleteOne({ id: targetUser.id });

        await logAdminAction(adminUser.id, adminUser.username, 'delete_user', `@${username}`, { email, id: targetUser.id });
        broadcastAdminEvent('users_updated', {});

        res.json({ success: true, message: `User @${username} and all their posts/data deleted successfully.` });
    } catch (err) {
        console.error("[ADMIN_USERS] DELETE error:", err);
        res.status(500).json({ detail: err.message || "Internal Server Error" });
    }
});

// GET /admin/posts-all
router.get('/admin/posts-all', authMiddleware, async (req, res) => {
    const { search } = req.query;
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        let query = {};
        if (search) {
            const cleanSearch = search.trim();
            const searchRegex = new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query = {
                $or: [
                    { title: searchRegex },
                    { author: searchRegex },
                    { state: searchRegex },
                    { city: searchRegex }
                ]
            };
        }

        const posts = await Post.find(query).sort({ created_at: -1 }).limit(100);
        res.json({ success: true, data: posts });
    } catch (err) {
        console.error("[ADMIN_POSTS_ALL] GET error:", err);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/audit-logs
router.get('/admin/audit-logs', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }
        const { limit = 50, page = 1, search = "" } = req.query;
        const lim = parseInt(limit);
        const pg = parseInt(page);
        
        let query = {};
        if (search) {
            const cleanSearch = search.trim();
            const searchRegex = new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query = {
                $or: [
                    { actor_username: searchRegex },
                    { action: searchRegex },
                    { target: searchRegex }
                ]
            };
        }
        
        const logs = await AuditLog.find(query)
            .sort({ created_at: -1 })
            .skip((pg - 1) * lim)
            .limit(lim);
            
        const total = await AuditLog.countDocuments(query);
        res.json({ success: true, data: logs, total, pages: Math.ceil(total / lim) });
    } catch (e) {
        console.error("[ADMIN_AUDIT_LOGS] GET error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/moderator-logs
router.get('/admin/moderator-logs', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }
        
        const query = {
            action: { $in: ['verify_post', 'reject_post', 'escalate_post_suspicious_reason'] }
        };
        
        const logs = await AuditLog.find(query)
            .sort({ created_at: -1 })
            .limit(100);
            
        res.json({ success: true, data: logs });
    } catch (e) {
        console.error("[ADMIN_MODERATOR_LOGS] GET error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/logs
router.get('/admin/logs', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }
        
        const { logFile = 'global_error' } = req.query;
        let filename = 'global_error.log';
        if (logFile === 'crash') filename = 'crash.log';
        else if (logFile === 'pfp_error') filename = 'pfp_error.log';
        
        const logPath = path.join(process.cwd(), '.logs', filename);
        if (!fs.existsSync(logPath)) {
            return res.json({ success: true, content: `Log file ${filename} does not exist.` });
        }
        
        // Read last 200 lines
        const fileContent = fs.readFileSync(logPath, 'utf8');
        const lines = fileContent.split('\n');
        const tailLines = lines.slice(-200).join('\n');
        
        res.json({ success: true, content: tailLines });
    } catch (e) {
        console.error("[ADMIN_SYSTEM_LOGS] GET error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// GET /api/admin/events (Server-Sent Events)
router.get('/admin/events', authMiddleware, async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ detail: "Forbidden: Admin access only" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = { id: req.user.id, res };
    sseClients.push(client);
    console.log(`[SSE] Admin client connected. Total: ${sseClients.length}`);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c.res !== res);
        console.log(`[SSE] Admin client disconnected. Total: ${sseClients.length}`);
    });
});

// POST /api/admin/posts/batch-action
router.post('/admin/posts/batch-action', authMiddleware, async (req, res) => {
    const { action, post_ids } = req.body;
    if (!action || !Array.isArray(post_ids) || post_ids.length === 0) {
        return res.status(400).json({ detail: "action and post_ids array are required" });
    }

    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        let verifyCount = 0;
        let rejectCount = 0;
        let deleteCount = 0;

        for (const postId of post_ids) {
            if (action === 'verify' || action === 'reject') {
                let tempPost = await TempPost.findById(postId) || await TempPost.findOne({ _id: postId });
                let post = null;
                if (!tempPost) {
                    post = await Post.findById(postId) || await Post.findOne({ _id: postId });
                }

                const targetPost = tempPost || post;
                if (!targetPost) continue;

                const authorUser = await User.findOne({ username: targetPost.author });

                if (tempPost) {
                    if (action === 'verify') {
                        await verifyPostHelper(tempPost);
                        verifyCount++;

                        if (authorUser) {
                            authorUser.trust_score = (authorUser.trust_score || 0) + 5;
                            await authorUser.save();
                        }
                    } else if (action === 'reject') {
                        const filename = path.basename(tempPost.media_url);
                        const filePath = path.join(process.cwd(), '.uploads', filename);
                        if (fs.existsSync(filePath)) {
                            fs.unlink(filePath, () => {});
                        }
                        await TempPost.deleteOne({ _id: tempPost._id });
                        await refundUploadCredit(tempPost.author);
                        rejectCount++;

                        if (authorUser) {
                            authorUser.trust_score = (authorUser.trust_score || 0) - 10;
                            await authorUser.save();

                            // Notify Author
                            await Notification.create({
                                user_id: authorUser.id,
                                type: 'reject',
                                actor_username: 'System/Admin',
                                post_id: tempPost._id
                            });
                        }
                    }
                } else if (post) {
                    if (action === 'verify') {
                        post.status = 'verified';
                        await post.save();
                        verifyCount++;
                    } else if (action === 'reject') {
                        if (post.telegram_message_id) {
                            const config = await StorageManager.findOne({ state: 'National' });
                            if (config && config.telegram_bot_token && config.telegram_channel_id) {
                                const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                                axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                                    chat_id: config.telegram_channel_id,
                                    message_id: post.telegram_message_id
                                }).catch(e => console.error("Failed to delete telegram message on reject:", e.message));
                            }
                        }
                        if (!post.telegram_file_id && post.media_url.startsWith('/uploads/')) {
                            const filename = path.basename(post.media_url);
                            const localPath = path.join(process.cwd(), '.uploads', filename);
                            if (fs.existsSync(localPath)) {
                                fs.unlink(localPath, () => {});
                            }
                        }
                        await Post.deleteOne({ _id: post._id });
                        rejectCount++;

                        if (authorUser) {
                            // Notify Author
                            await Notification.create({
                                user_id: authorUser.id,
                                type: 'reject',
                                actor_username: 'System/Admin',
                                post_id: post._id
                            });
                        }
                    }
                }
            } else if (action === 'delete') {
                const post = await Post.findById(postId) || await Post.findOne({ _id: postId });
                if (!post) continue;

                if (post.telegram_message_id) {
                    const config = await StorageManager.findOne({ state: 'National' });
                    if (config && config.telegram_bot_token && config.telegram_channel_id) {
                        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                        axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                            chat_id: config.telegram_channel_id,
                            message_id: post.telegram_message_id
                        }).catch(e => console.error("Failed to delete telegram message:", e.message));
                    }
                }
                if (!post.telegram_file_id && post.media_url && post.media_url.startsWith('/uploads/')) {
                    const filename = path.basename(post.media_url);
                    const localPath = path.join(process.cwd(), '.uploads', filename);
                    if (fs.existsSync(localPath)) {
                        fs.unlink(localPath, () => {});
                    }
                }
                const ext = path.extname(post.media_url || '') || '.mp4';
                const cachePath = path.join(process.cwd(), '.uploads', 'cache', `${post._id}${ext}`);
                if (fs.existsSync(cachePath)) {
                    fs.unlink(cachePath, () => {});
                }
                await Post.deleteOne({ _id: post._id });
                deleteCount++;
            }
        }

        let summaryStr = "";
        if (verifyCount > 0) summaryStr += `Verified ${verifyCount} posts. `;
        if (rejectCount > 0) summaryStr += `Rejected ${rejectCount} posts. `;
        if (deleteCount > 0) summaryStr += `Deleted ${deleteCount} posts. `;

        await logAdminAction(user.id, user.username, 'batch_posts_action', `${post_ids.length} posts`, { action, count: post_ids.length });
        broadcastAdminEvent('posts_updated', {});

        res.json({ success: true, message: summaryStr || "Batch action completed." });
    } catch (e) {
        console.error("[ADMIN_POSTS_BATCH] POST error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// POST /api/admin/users/batch-delete
router.post('/admin/users/batch-delete', authMiddleware, async (req, res) => {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ detail: "user_ids array is required" });
    }

    try {
        const adminUser = await User.findOne({ id: req.user.id });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ detail: "Forbidden: Admin access only" });
        }

        let deletedCount = 0;
        for (const targetId of user_ids) {
            if (targetId === adminUser.id) continue;

            let targetUser;
            if (targetId.match(/^[0-9a-fA-F]{24}$/)) {
                targetUser = await User.findOne({ $or: [{ id: targetId }, { _id: targetId }] });
            } else {
                targetUser = await User.findOne({ id: targetId });
            }
            if (!targetUser) continue;

            const username = targetUser.username;
            const email = targetUser.email.toLowerCase().trim();

            // 1. Delete verified posts
            const posts = await Post.find({ author: username });
            for (const post of posts) {
                if (post.telegram_message_id) {
                    const config = await StorageManager.findOne({ state: 'National' });
                    if (config && config.telegram_bot_token && config.telegram_channel_id) {
                        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                        axios.post(`${TELEGRAM_URL}/bot${config.telegram_bot_token}/deleteMessage`, {
                            chat_id: config.telegram_channel_id,
                            message_id: post.telegram_message_id
                        }).catch(e => console.error("Failed to delete telegram message:", e.message));
                    }
                }
                if (!post.telegram_file_id && post.media_url && post.media_url.startsWith('/uploads/')) {
                    const filename = path.basename(post.media_url);
                    const localPath = path.join(process.cwd(), '.uploads', filename);
                    if (fs.existsSync(localPath)) {
                        fs.unlink(localPath, () => {});
                    }
                }
                const ext = path.extname(post.media_url || '') || '.mp4';
                const cachePath = path.join(process.cwd(), '.uploads', 'cache', `${post._id}${ext}`);
                if (fs.existsSync(cachePath)) {
                    fs.unlink(cachePath, () => {});
                }
            }
            await Post.deleteMany({ author: username });

            // 2. Delete pending/temp posts
            const tempPosts = await TempPost.find({ author: username });
            for (const tempPost of tempPosts) {
                if (tempPost.media_url && tempPost.media_url.startsWith('/uploads/')) {
                    const filename = path.basename(tempPost.media_url);
                    const localPath = path.join(process.cwd(), '.uploads', filename);
                    if (fs.existsSync(localPath)) {
                        fs.unlink(localPath, () => {});
                    }
                }
            }
            await TempPost.deleteMany({ author: username });

            // 3. Delete Profile Photo
            const pfp = await PFP.findOne({ user_id: targetUser.id });
            if (pfp) {
                if (pfp.telegram_message_id && pfp.telegram_bot_token) {
                    const config = await StorageManager.findOne({ state: 'National' });
                    const chatId = config?.telegram_channel_id;
                    if (chatId) {
                        const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
                        axios.post(`${TELEGRAM_URL}/bot${pfp.telegram_bot_token}/deleteMessage`, {
                            chat_id: chatId,
                            message_id: pfp.telegram_message_id
                        }).catch(e => console.error("Failed to delete user PFP telegram message:", e.message));
                    }
                }
                if (!pfp.telegram_file_id && pfp.media_url && pfp.media_url.startsWith('/uploads/')) {
                    const filename = path.basename(pfp.media_url);
                    const localPath = path.join(process.cwd(), '.uploads', filename);
                    if (fs.existsSync(localPath)) {
                        fs.unlink(localPath, () => {});
                    }
                }
                await PFP.deleteOne({ _id: pfp._id });
            }

            // 4. Delete regional admin assignments
            await RegionalAdmin.deleteMany({ email: email });

            // 5. Delete storages and storage workers
            
            

            // 6. Delete user document
            await User.deleteOne({ id: targetUser.id });
            deletedCount++;
        }

        await logAdminAction(adminUser.id, adminUser.username, 'batch_users_delete', `${deletedCount} users`, { count: deletedCount });
        broadcastAdminEvent('users_updated', {});

        res.json({ success: true, message: `Recursively deleted ${deletedCount} users.` });
    } catch (e) {
        console.error("[ADMIN_USERS_BATCH] DELETE error:", e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});




// POST /follow
router.post('/follow', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        const { action } = req.query;
        
        if (!username || !action) {
            return res.status(400).json({ detail: "Missing username or action" });
        }

        const currentUser = await User.findOne({ id: req.user.id });
        if (!currentUser) return res.status(404).json({ detail: "Current user not found" });

        const targetUser = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (!targetUser) return res.status(404).json({ detail: "Target user not found" });

        if (currentUser.id === targetUser.id) {
            return res.status(400).json({ detail: "Cannot follow yourself" });
        }

        if (action === 'toggle') {
            const existingFollow = await Follow.findOne({ follower_id: currentUser.id, following_id: targetUser.id });
            if (existingFollow) {
                await Follow.deleteOne({ _id: existingFollow._id });
                return res.json({ success: true, message: "Unfollowed successfully", isFollowing: false });
            } else {
                await Follow.create({ follower_id: currentUser.id, following_id: targetUser.id });
                
                // Create Notification for target user
                await Notification.create({
                    user_id: targetUser.id,
                    type: 'follow',
                    actor_username: currentUser.username
                });

                return res.json({ success: true, message: "Followed successfully", isFollowing: true });
            }
        }

        res.status(400).json({ detail: "Invalid action" });
    } catch (e) {
        console.error("[FOLLOW] Error:", e);
        res.status(500).json({ detail: "Internal server error" });
    }
});

// POST /api/moderation/assign-area
router.post('/moderation/assign-area', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'moderator') {
            return res.status(403).json({ detail: "Forbidden: Moderator access only" });
        }
        
        if (user.moderator_state) {
            return res.status(400).json({ detail: "Area assignment is permanent and cannot be changed" });
        }

        const { state, city, pincode } = req.body;
        if (!state || !city || !pincode) {
            return res.status(400).json({ detail: "State, city, and pincode are required" });
        }

        user.moderator_state = state;
        user.moderator_city = city;
        user.moderator_pincode = pincode;
        await user.save();

        res.json({ success: true, user: { moderator_state: state, moderator_city: city, moderator_pincode: pincode } });
    } catch (err) {
        console.error("[MODERATION_ASSIGN_AREA]", err);
        res.status(500).json({ detail: "Internal server error" });
    }
});

// GET /api/moderation/queue
router.get('/moderation/queue', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'moderator') {
            return res.status(403).json({ detail: "Forbidden: Moderator access only" });
        }
        
        if (!user.moderator_state) {
            return res.status(400).json({ detail: "Moderator area not assigned" });
        }

        const query = { 
            status: 'pending',
            state: user.moderator_state,
            city: user.moderator_city
        };

        if (user.moderator_pincode) {
            query.pincode = user.moderator_pincode;
        }

        const queue = await TempPost.find(query).sort({ created_at: 1 }).limit(20);
        res.json({ success: true, data: queue });
    } catch (err) {
        console.error("[MODERATION_QUEUE]", err);
        res.status(500).json({ detail: "Internal server error" });
    }
});

// POST /api/moderation/action
router.post('/moderation/action', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || user.role !== 'moderator') {
            return res.status(403).json({ detail: "Forbidden: Moderator access only" });
        }

        const { post_id, action, reason } = req.body;
        if (!post_id || !action) {
            return res.status(400).json({ detail: "Post ID and action are required" });
        }

        const post = await TempPost.findOne({ id: post_id });
        if (!post) {
            return res.status(404).json({ detail: "Post not found" });
        }

        if (action === 'approve') {
            await verifyPostHelper(post);
            return res.json({ success: true, status: 'approved' });
        } else if (action === 'reject') {
            if (!reason || reason.trim().length < 5) {
                return res.status(400).json({ detail: "A valid descriptive reason is required to reject a post" });
            }

            const cleanReason = reason.trim().toLowerCase();
            const suspiciousPatterns = [/^\.+$/, /^test$/, /^idk$/, /^random/, /^heee+$/];
            const isSuspicious = suspiciousPatterns.some(regex => regex.test(cleanReason));

            post.moderator_id = user.id;
            post.rejected_reason = reason.trim();

            if (isSuspicious || cleanReason.length < 10) {
                post.escalated_to_admin = true;
                await post.save();
                return res.json({ 
                    success: true, 
                    status: 'escalated',
                    warning: "Quality Review Notice: Your rejection reason appears incomplete or unprofessional. This review has been forwarded to administrators for verification."
                });
            } else {
                post.status = 'rejected';
                await post.save();
                await refundUploadCredit(post.author);
                return res.json({ success: true, status: 'rejected' });
            }
        } else {
            return res.status(400).json({ detail: "Invalid action" });
        }
    } catch (err) {
        console.error("[MODERATION_ACTION]", err);
        res.status(500).json({ detail: "Internal server error" });
    }
});

export default router;
