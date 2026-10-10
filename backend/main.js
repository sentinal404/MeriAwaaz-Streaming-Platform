import dotenv from 'dotenv';
import app from './app.js';

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env is now in the same folder as main.js (Backend/)
let envPath = path.resolve(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    // Fallback to project root if needed
    envPath = path.resolve(__dirname, '..', '.env');
}

dotenv.config({ path: envPath });

const PORT = process.env.PORT || 8000;

process.on('uncaughtException', (err) => {
    console.error("[CRASH] Uncaught Exception:", err);
    try {
        const logDir = path.join(process.cwd(), '.logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        fs.appendFileSync(path.join(logDir, 'crash.log'), `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack || err}\n`);
    } catch (e) { }
    // Optional: process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("[CRASH] Unhandled Rejection at:", promise, "reason:", reason);
    try {
        const logDir = path.join(process.cwd(), '.logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        fs.appendFileSync(path.join(logDir, 'crash.log'), `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason?.stack || reason}\n`);
    } catch (e) { }
});

const cleanupUploads = () => {
    const uploadDir = path.join(process.cwd(), '.uploads');
    if (!fs.existsSync(uploadDir)) return;

    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    const threshold = 1 * 60 * 60 * 1000;

    let cleaned = 0;
    files.forEach(file => {
        const filePath = path.join(uploadDir, file);
        try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > threshold) {
                fs.unlinkSync(filePath);
                cleaned++;
            }
        } catch (e) {
            console.error(`Failed to cleanup ${file}:`, e.message);
        }
    });
    if (cleaned > 0) {
        console.log(`[CLEANUP] Removed ${cleaned} stale upload files.`);
    }
};

const startServer = async () => {
    try {
        const { connectDB, createSuperuser } = await import('./db/index.js');
        await connectDB();
        await createSuperuser();

        const server = app.listen(PORT, '0.0.0.0', async () => {
            console.log(`Server listening on http://0.0.0.0:${PORT}`);
            // Run cleanup once on start and then every hour
            cleanupUploads();
            setInterval(cleanupUploads, 60 * 60 * 1000);
            
            const { startAiBlueTeamerWorker } = await import('./workers/aiBlueTeamerWorker.js');
            startAiBlueTeamerWorker();
        });
        server.timeout = 30 * 60 * 1000; // 30 minutes timeout
        server.keepAliveTimeout = 30 * 60 * 1000;
        server.headersTimeout = 31 * 60 * 1000;
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

startServer();
console.log('trigger restart');
