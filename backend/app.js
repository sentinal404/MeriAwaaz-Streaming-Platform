import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import { apiLimiter } from './middleware/security.js';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';

import profileRouter from './routes/profile.js';
import socialRouter from './routes/social.js';
import notificationsRouter from './routes/notifications.js';

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://vortex-eviil-cloud.vercel.app',
    'http://localhost:5001',
    'http://127.0.0.1:5001',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, server2server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        
        // Allow local network IPs and any localhost port for development testing
        if (/^http:\/\/(10\.|172\.|192\.|localhost|127\.0\.0\.1)/.test(origin)) {
            return callback(null, true);
        }

        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// --- Security Middleware ---
// Set security HTTP headers
app.use(helmet());
// Sanitize data against NoSQL query injection
app.use(mongoSanitize());
// Sanitize data against XSS
app.use(xss());
// Apply general rate limiting to all requests
app.use('/api', apiLimiter);
// ---------------------------

import { securityLogger } from './middleware/securityLogger.js';

// Routing mimicking Axum's nest("/api", ...)
app.use(securityLogger);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/notifications', notificationsRouter);
import adminAiRouter from './routes/admin_ai.js';
app.use('/api/admin/ai', adminAiRouter);
app.use('/api', socialRouter);
app.use('/uploads', express.static(path.join(process.cwd(), '.uploads')));

// Basic health check
app.get('/', (req, res) => {
    res.json({ status: "MeriAwaaz API is running" });
});


app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR]", err.stack);
    try {
        const logPath = path.join(process.cwd(), '.logs', 'global_error.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${err.stack || err.message}\n`);
    } catch (e) { }
    res.status(500).json({ detail: "Internal Server Error", message: "An unexpected error occurred on the server." });
});

export default app;
