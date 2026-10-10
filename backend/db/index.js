import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meriawaaz';
        await mongoose.connect(uri);
        console.log("Connected to MongoDB successfully.");
    } catch (e) {
        console.error("Failed to connect to MongoDB:", e);
        throw e;
    }
};

// --- Models ---
const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: 'user' },
    trust_score: { type: Number, default: 0 },
    state: { type: String },
    city: { type: String },
    public_name: { type: String, default: "" },
    bio: { type: String, default: "", maxLength: 160 },
    hide_location: { type: Boolean, default: false },
    coffee_link: { type: String, default: "" },
    instagram_link: { type: String, default: "" },
    twitter_link: { type: String, default: "" },
    is_banned: { type: Boolean, default: false },
    strikes: { type: Number, default: 0 },
    moderator_strikes: { type: Number, default: 0 },
    moderator_state: { type: String, default: "" },
    moderator_city: { type: String, default: "" },
    moderator_pincode: { type: String, default: "" },
    banned_by_ai: { type: Boolean, default: false },
    ban_reason: { type: String, default: "" },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const User = mongoose.model('User', userSchema);


const postSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    title: { type: String, required: true },
    description: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, default: "" },
    media_url: { type: String, required: true },
    thumbnail_url: { type: String },
    mime_type: { type: String },
    author: { type: String, required: true },
    status: { type: String, default: 'pending' },
    rejected_reason: { type: String, default: "" },
    moderator_id: { type: String, default: "" },
    escalated_to_admin: { type: Boolean, default: false },
    duration: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    liked_by: [{ type: String }],
    disliked_by: [{ type: String }],
    viewed_by: [{ type: String }],
    telegram_file_id: { type: String },
    telegram_message_id: { type: Number },
    telegram_bot_token: { type: String },
    telegram_chunks: [{
        telegram_file_id: { type: String, required: true },
        telegram_message_id: { type: Number },
        position: { type: Number, required: true },
        size: { type: Number, required: true }
    }],
    media_size: { type: Number },
    created_at: { type: Date, default: Date.now }
}, { id: false });

postSchema.set('toObject', {
    transform: (doc, ret, options) => {
        delete ret.telegram_file_id;
        delete ret.telegram_message_id;
        delete ret.telegram_bot_token;
        delete ret.telegram_chunks;
        return ret;
    }
});

postSchema.set('toJSON', {
    transform: (doc, ret, options) => {
        delete ret.telegram_file_id;
        delete ret.telegram_message_id;
        delete ret.telegram_bot_token;
        delete ret.telegram_chunks;
        return ret;
    }
});

export const Post = mongoose.model('Post', postSchema);


const tempPostSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    title: { type: String, required: true },
    description: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, default: "" },
    media_url: { type: String, required: true },
    mime_type: { type: String },
    author: { type: String, required: true },
    duration: { type: Number, default: 0 },
    media_size: { type: Number },
    status: { type: String, default: 'uploading' },
    is_flagged: { type: Boolean, default: false },
    flag_reason: { type: String, default: "" },
    escalated_to_admin: { type: Boolean, default: false },
    escalation_reason: { type: String, default: "" },
    rejected_reason: { type: String, default: "" },
    moderator_id: { type: String, default: "" },
    telegram_file_id: { type: String },
    telegram_message_id: { type: Number },
    telegram_bot_token: { type: String },
    telegram_chunks: [{
        telegram_file_id: { type: String, required: true },
        telegram_message_id: { type: Number },
        position: { type: Number, required: true },
        size: { type: Number, required: true }
    }],
    created_at: { type: Date, default: Date.now }
}, { id: false });

tempPostSchema.set('toObject', {
    transform: (doc, ret, options) => {
        delete ret.telegram_file_id;
        delete ret.telegram_message_id;
        delete ret.telegram_bot_token;
        delete ret.telegram_chunks;
        return ret;
    }
});

tempPostSchema.set('toJSON', {
    transform: (doc, ret, options) => {
        delete ret.telegram_file_id;
        delete ret.telegram_message_id;
        delete ret.telegram_bot_token;
        delete ret.telegram_chunks;
        return ret;
    }
});

export const TempPost = mongoose.model('TempPost', tempPostSchema);


const storageManagerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    name: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, default: "" },
    telegram_bot_token: { type: String },
    telegram_bot_tokens: [{ type: String }],
    telegram_channel_id: { type: String, required: true }
}, { id: false });
export const StorageManager = mongoose.model('StorageManager', storageManagerSchema);

const pfpSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    user_id: { type: String, required: true, unique: true, ref: 'User' },
    telegram_file_id: { type: String },
    telegram_message_id: { type: Number },
    telegram_bot_token: { type: String },
    media_url: { type: String, required: true },
    mime_type: { type: String },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const PFP = mongoose.model('PFP', pfpSchema);

const bannerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    user_id: { type: String, required: true, unique: true, ref: 'User' },
    telegram_file_id: { type: String },
    telegram_message_id: { type: Number },
    telegram_bot_token: { type: String },
    media_url: { type: String, required: true },
    mime_type: { type: String },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const Banner = mongoose.model('Banner', bannerSchema);

const pfpStorageConfigSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    telegram_channel_name: { type: String, default: "" },
    telegram_channel_id: { type: String, default: "" },
    telegram_bot_tokens: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now }
});
export const PFPStorageConfig = mongoose.model('PFPStorageConfig', pfpStorageConfigSchema);

const systemSettingsSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    daily_upload_limit: { type: Number, default: 3 }, // Default limit
    updated_at: { type: Date, default: Date.now }
}, { id: false });
export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);


const uploadLogSchema = new mongoose.Schema({
    ip: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    created_at: { type: Date, default: Date.now, expires: 86400 } // 24 hours TTL
}, { id: false });
export const UploadLog = mongoose.model('UploadLog', uploadLogSchema);


const regionalAdminSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    email: { type: String, required: true, lowercase: true, trim: true },
    state: { type: String, required: true },
    city: { type: String, default: "" }
}, { id: false });
export const RegionalAdmin = mongoose.model('RegionalAdmin', regionalAdminSchema);


const auditLogSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    actor_id: { type: String, required: true },
    actor_username: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);


const followSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    follower_id: { type: String, required: true, ref: 'User', index: true },
    following_id: { type: String, required: true, ref: 'User', index: true },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const Follow = mongoose.model('Follow', followSchema);


const tempRegistrationSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true, default: uuidv4 },
    email: { type: String, required: true },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now, expires: 900 } // 15 minutes TTL
}, { id: false });
export const TempRegistration = mongoose.model('TempRegistration', tempRegistrationSchema);

const reportSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    reporter_id: { type: String, required: true, index: true },
    post_id: { type: String, required: true, index: true },
    category: { type: String, required: true },
    description: { type: String, maxlength: 500 },
    status: { type: String, default: 'pending', enum: ['pending', 'reviewed', 'dismissed'] },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const Report = mongoose.model('Report', reportSchema);

const reportLogSchema = new mongoose.Schema({
    ip: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    created_at: { type: Date, default: Date.now, expires: 86400 } // 24 hours TTL
}, { id: false });
export const ReportLog = mongoose.model('ReportLog', reportLogSchema);

const notificationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: uuidv4 },
    user_id: { type: String, required: true, index: true }, // Recipient
    type: { type: String, required: true, enum: ['like', 'follow', 'view', 'verify', 'reject', 'new_follower_video', 'banned', 'restored', 'strike_issued', 'strike_removed', 'review_assigned', 'admin_confirmation', 'admin_override', 'mod_strike_issued', 'suspension_warning'] },
    actor_username: { type: String, required: true }, // Who triggered it
    post_id: { type: String, default: null }, // Optional related post
    is_read: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
}, { id: false });
export const Notification = mongoose.model('Notification', notificationSchema);

// --- Superadmin Init ---
export const createSuperuser = async () => {
    if (!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASS) {
        console.log("No superadmin credentials provided, skipping.");
        return;
    }

    try {
        const existing = await User.findOne({ email: process.env.SUPERADMIN_EMAIL });
        if (existing) {
            // FIX: Always verify the hash matches current SUPERADMIN_PASS.
            // If .env password was changed after initial creation, update it so login works.
            // Also ensure the role is set to admin.
            let updateNeeded = false;
            let updateData = {};

            const isMatch = await bcrypt.compare(process.env.SUPERADMIN_PASS, existing.password_hash);
            if (!isMatch) {
                updateData.password_hash = await bcrypt.hash(process.env.SUPERADMIN_PASS, 12);
                updateNeeded = true;
            }
            if (existing.role !== 'admin') {
                updateData.role = 'admin';
                updateNeeded = true;
            }

            if (updateNeeded) {
                await User.updateOne({ email: process.env.SUPERADMIN_EMAIL }, updateData);
                console.log("Superadmin updated to match current .env credentials/role.");
            } else {
                console.log("Superadmin already exists with correct credentials and role; skipping.");
            }
            return;
        }

        const password_hash = await bcrypt.hash(process.env.SUPERADMIN_PASS, 12);
        const username = process.env.SUPERADMIN_EMAIL.split('@')[0] + '_admin';
        await User.create({
            username: username,
            email: process.env.SUPERADMIN_EMAIL,
            password_hash,
            role: 'admin'
        });
        console.log("Superadmin created successfully.");
    } catch (e) {
        console.error("Failed to create superadmin:", e);
    }
};
// --- AI Blue Teamer Models ---

const securityLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    username: { type: String, default: "anonymous" },
    user_id: { type: String, default: "" },
    email: { type: String, default: "" },
    ip_address: { type: String, required: true },
    user_agent: { type: String, default: "" },
    action_type: { type: String, required: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    payload_summary: { type: String, default: "" },
    status_code: { type: Number, required: true },
    is_processed: { type: Boolean, default: false },
    risk_score: { type: Number, default: 0 },
    ai_analysis_result: { type: String, default: "" }
}, { id: false });
export const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

const aiAnalysisResultSchema = new mongoose.Schema({
    batch_id: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    logs_analyzed: { type: Number, required: true },
    findings: [{ type: mongoose.Schema.Types.Mixed }]
}, { id: false });
export const AIAnalysisResult = mongoose.model('AIAnalysisResult', aiAnalysisResultSchema);

const aiActionSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    target_user: { type: String, default: "" },
    target_ip: { type: String, default: "" },
    action_taken: { type: String, required: true },
    reason: { type: String, required: true },
    risk_score: { type: Number, required: true },
    status: { type: String, default: "executed" }, // executed, reversed
    reversed_by: { type: String, default: "" },
    reversed_at: { type: Date }
}, { id: false });
export const AIAction = mongoose.model('AIAction', aiActionSchema);

const blockedIPSchema = new mongoose.Schema({
    ip_address: { type: String, required: true, unique: true },
    country: { type: String, default: "Unknown" },
    user_agent: { type: String, default: "" },
    detection_reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}, { id: false });
export const BlockedIP = mongoose.model('BlockedIP', blockedIPSchema);

const aiSettingsSchema = new mongoose.Schema({
    ai_enabled: { type: Boolean, default: false },
    endpoint_url: { type: String, default: "https://nature-developers-culture-conferencing.trycloudflare.com/api/generate" },
    model_name: { type: String, default: "qwen:7b" },
    api_key: { type: String, default: "" },
    batch_size: { type: Number, default: 750 },
    analysis_interval_ms: { type: Number, default: 60000 }, // default 1 minute
    auto_action_toggle: { type: Boolean, default: false }
}, { id: false });
export const AISettings = mongoose.model('AISettings', aiSettingsSchema);

const securityNotificationSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    username: { type: String, default: "" },
    ip_address: { type: String, default: "" },
    risk_score: { type: Number, required: true },
    action_taken: { type: String, required: true },
    reason: { type: String, required: true },
    is_read: { type: Boolean, default: false }
}, { id: false });
export const SecurityNotification = mongoose.model('SecurityNotification', securityNotificationSchema);

