import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { Storage, StorageWorker, StorageWorkerUsage, File } from '../db/index.js';

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB (Crucial: Telegram direct download limit is 20MB)
const GLOBAL_CONCURRENCY = 100;

// Create global keepAlive agents to prevent TLS handshake overhead on every chunk
// Shared across all uploads to reuse connection pools
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: GLOBAL_CONCURRENCY });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: GLOBAL_CONCURRENCY });

export const uploadFileChunks = async (filePath, storageId, userId, fileIdDb, originalName = 'file') => {
    // 1. Get a storage worker for this storage
    const worker = await StorageWorker.findOne({
        $or: [{ storage_id: storageId }, { user_id: userId }]
    });

    if (!worker) {
        throw new Error("No storage workers available");
    }

    const token = worker.token;
    const workerId = worker.id;

    // 2. Get chat_id
    const storage = await Storage.findOne({ id: storageId });
    if (!storage) throw new Error("Storage not found");
    let chatId = storage.chat_id;  // use `let` so we can update it on migration

    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
    const apiUrl = `${TELEGRAM_URL}/bot${token}/sendDocument`;

    let position = 0;
    const chunksToSave = [];

    const fileStats = await fs.promises.stat(filePath);
    const totalSize = fileStats.size;

    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    let uploadedChunksCount = 0;

    // Create a list of all chunk offsets and positions
    const chunkRequests = [];
    for (let i = 0; i < totalChunks; i++) {
        const offset = i * CHUNK_SIZE;
        const end = Math.min(offset + CHUNK_SIZE - 1, totalSize - 1);
        chunkRequests.push({ offset, end, position: i });
    }

    const CONCURRENCY = 7; // Increased to 7 for faster uploads
    const results = [];

    // Worker function to process chunks
    const uploadWorker = async (workerIndex) => {
        console.log(`[UPLOAD WORKER #${workerIndex}] Started.`);
        while (chunkRequests.length > 0) {
            // Check if file still exists in DB (hasn't been cancelled/deleted)
            const stillExists = await File.exists({ id: fileIdDb });
            if (!stillExists) {
                console.log(`[UPLOAD WORKER #${workerIndex}] File ${fileIdDb} no longer exists. Aborting upload.`);
                return;
            }

            const chunk = chunkRequests.shift();
            if (!chunk) break;

            const { offset, end, position } = chunk;
            console.log(`[UPLOAD WORKER #${workerIndex}] Processing chunk ${position + 1}/${totalChunks} (Offset: ${offset})`);

            let uploaded = false;
            let retries = 0;
            const MAX_RETRIES = 4;

            while (!uploaded && retries <= MAX_RETRIES) {
                try {
                    // One more check before the actual network request
                    if (!(await File.exists({ id: fileIdDb }))) return;

                    const chunkLength = end - offset + 1;
                    const chunkStream = fs.createReadStream(filePath, { start: offset, end: end });
                    const form = new FormData();
                    form.append('chat_id', chatId);
                    form.append('document', chunkStream, {
                        filename: totalSize > CHUNK_SIZE ? `${originalName}.part${position + 1}` : originalName,
                        knownLength: chunkLength
                    });

                    console.log(`[UPLOAD WORKER #${workerIndex}] Sending chunk ${position} to Telegram...`);
                    const response = await axios.post(apiUrl, form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout: 300000, // 5 minutes
                        httpAgent,
                        httpsAgent
                    });

                    const tgMessage = response.data.result;
                    const tgFileId = tgMessage.document.file_id;
                    const tgMessageId = tgMessage.message_id;
                    console.log(`[UPLOAD WORKER #${workerIndex}] Chunk ${position} success. FileID: ${tgFileId}, MessageID: ${tgMessageId}`);

                    uploadedChunksCount++;
                    const progress = Math.round((uploadedChunksCount / totalChunks) * 100);

                    // Final check before updating DB: if record is gone, we should delete this message too
                    const record = await File.findOneAndUpdate(
                        { id: fileIdDb },
                        {
                            $push: { chunks: { telegram_file_id: tgFileId, telegram_message_id: tgMessageId, position } },
                            $set: { telegram_upload_progress: progress }
                        }
                    );

                    if (!record) {
                        console.log(`[UPLOAD WORKER #${workerIndex}] File record vanished during upload. Cleaning up chunk ${tgMessageId}`);
                        axios.post(`${TELEGRAM_URL}/bot${token}/deleteMessage`, { chat_id: chatId, message_id: tgMessageId }).catch(() => { });
                        return;
                    }

                    uploaded = true;
                } catch (error) {
                    const errorData = error.response?.data;

                    if (errorData?.parameters?.migrate_to_chat_id) {
                        const newChatId = errorData.parameters.migrate_to_chat_id;
                        console.log(`[TELEGRAM] Chat migration: ${chatId} → ${newChatId}. Retrying chunk ${position}...`);
                        await Storage.updateOne({ id: storageId }, { chat_id: newChatId });
                        chatId = newChatId;
                        retries++;
                        continue;
                    }

                    // Handle 429 Too Many Requests
                    if (error.response?.status === 429 || errorData?.error_code === 429) {
                        const retryAfter = (errorData?.parameters?.retry_after || 5) + 2;
                        console.log(`[TELEGRAM] Rate limit exceeded. Waiting ${retryAfter}s before retrying chunk ${position}...`);
                        await new Promise(r => setTimeout(r, retryAfter * 1000));
                        retries++;
                        continue;
                    }

                    const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error.code)
                        || error.message?.includes('timeout');

                    if (isNetworkError && retries < MAX_RETRIES) {
                        const waitMs = (retries + 1) * 3000;
                        console.log(`[TELEGRAM] Network error (${error.code}) on chunk ${position}, retry ${retries + 1}/${MAX_RETRIES} in ${waitMs / 1000}s...`);
                        await new Promise(r => setTimeout(r, waitMs));
                        retries++;
                        continue;
                    }

                    console.error(`Failed to upload chunk ${position} after ${retries} retries:`, errorData || error.message);
                    throw new Error(`Telegram upload failed: ${error.code || error.message}`);
                }
            }
        }
    };

    // Start workers
    console.log(`[UPLOAD] Spawning ${Math.min(CONCURRENCY, chunkRequests.length)} upload workers for ${totalChunks} chunks.`);
    const workers = Array(Math.min(CONCURRENCY, chunkRequests.length)).fill(null).map((_, i) => uploadWorker(i));
    try {
        await Promise.all(workers);

        // Ensure it reaches 100% only if still exists
        const finalized = await File.findOneAndUpdate(
            { id: fileIdDb },
            { $set: { telegram_upload_progress: 100 } }
        );

        if (finalized) {
            // Update worker usage
            await StorageWorkerUsage.create({ storage_worker_id: workerId });
        }
    } finally {
        // Always clean up temp file
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') console.error("Final cleanup failed:", err);
        });
    }
};

// In-memory set to track message IDs currently being deleted.
// Prevents concurrent deletion requests for the same messages (e.g. deleting folder + file inside).
const deletingMessages = new Set();

export const deleteFilesFromTelegram = async (files, userId) => {
    if (!files || files.length === 0) return;

    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
    const CONCURRENCY = 5; // Delete 5 messages at a time

    for (const file of files) {
        if (!file.chunks || file.chunks.length === 0) continue;

        // 1. Get a storage worker
        const worker = await StorageWorker.findOne({
            $or: [{ storage_id: file.storage_id }, { user_id: userId }]
        });

        if (!worker) {
            console.error(`[DELETE] No worker found for file ${file.id}`);
            continue;
        }

        // 2. Get chat_id
        const storage = await Storage.findOne({ id: file.storage_id });
        if (!storage) {
            console.error(`[DELETE] Storage ${file.storage_id} not found`);
            continue;
        }

        const token = worker.token;
        const chatId = storage.chat_id;

        // Collect message IDs that aren't already being deleted
        const messageIds = file.chunks
            .map(c => c.telegram_message_id)
            .filter(id => id && !deletingMessages.has(id));

        if (messageIds.length === 0) continue;

        // Add to global deleting set
        messageIds.forEach(id => deletingMessages.add(id));

        console.log(`[DELETE] Starting deletion of ${messageIds.length} messages for file: ${file.path}`);

        // Process message deletions with concurrency
        const deletePool = [...messageIds];
        const workers = Array(Math.min(CONCURRENCY, deletePool.length)).fill(null).map(async () => {
            while (deletePool.length > 0) {
                const messageId = deletePool.shift();
                if (!messageId) break;

                try {
                    await axios.post(`${TELEGRAM_URL}/bot${token}/deleteMessage`, {
                        chat_id: chatId,
                        message_id: messageId
                    });
                } catch (e) {
                    const errorDetails = e.response?.data;
                    // Ignore "message not found" or "message to delete not found" (already deleted)
                    if (errorDetails?.description?.includes('not found')) {
                        // Silent ignore
                    } else if (errorDetails?.error_code === 429) {
                        // Rate limit — wait a bit and move on (best effort)
                        console.warn(`[DELETE] Rate limited while deleting ${messageId}.`);
                    } else {
                        console.error(`[DELETE] Failed to delete message ${messageId}:`, errorDetails || e.message);
                    }
                } finally {
                    deletingMessages.delete(messageId);
                }
            }
        });

        await Promise.all(workers);
        console.log(`[DELETE] Finished deletion process for file: ${file.path}`);
    }
};

export const downloadFileStream = async (fileIdDb, storageId, userId, writableStream) => {
    // 1. Get chunks
    const file = await File.findOne({ id: fileIdDb });
    if (!file || !file.chunks || file.chunks.length === 0) {
        throw new Error("No chunks found");
    }

    // Sort chunks by position using vanilla sort
    const chunks = file.chunks.sort((a, b) => a.position - b.position);

    // 2. Get a storage worker to download
    const worker = await StorageWorker.findOne({
        $or: [{ storage_id: storageId }, { user_id: userId }]
    });

    if (!worker) {
        throw new Error("No storage workers available");
    }

    const token = worker.token;
    const workerId = worker.id;
    const TELEGRAM_URL = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

    for (const chunk of chunks) {
        const tgFileId = chunk.telegram_file_id;

        // 3. Get file path from Telegram
        const fileInfoUrl = `${TELEGRAM_URL}/bot${token}/getFile?file_id=${tgFileId}`;
        const fileInfoResponse = await axios.get(fileInfoUrl);
        const filePath = fileInfoResponse.data.result.file_path;

        // 4. Download file from Telegram as a stream
        const downloadUrl = `${TELEGRAM_URL}/file/bot${token}/${filePath}`;
        const downloadResponse = await axios.get(downloadUrl, { responseType: 'stream' });

        // Pipe chunk to the writable stream (can be HTTP res or a file stream)
        await new Promise((resolve, reject) => {
            downloadResponse.data.pipe(writableStream, { end: false });
            downloadResponse.data.on('end', resolve);
            downloadResponse.data.on('error', reject);
        });
    }

    // End the stream
    await new Promise((resolve) => {
        writableStream.end(resolve);
    });

    // Update worker usage
    await StorageWorkerUsage.create({ storage_worker_id: workerId });
};