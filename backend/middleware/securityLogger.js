import { SecurityLog, BlockedIP, User } from '../db/index.js';

let sseClients = [];

export const addSSEClient = (req, res) => {
    sseClients.push(res);
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
};

export const broadcastSecurityLog = (logData) => {
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify(logData)}\n\n`);
    });
};

export const securityLogger = async (req, res, next) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;

        // 1. Check if IP is blocked
        const blocked = await BlockedIP.findOne({ ip_address: ip }).lean();
        if (blocked) {
            return res.status(403).send(`<h1>Access Permanently Denied</h1><p>You have been banned. Reason: ${blocked.detection_reason}</p>`);
        }

        // Wait for the response to finish to get the status code
        res.on('finish', async () => {
            try {
                // Ignore SSE streams and static files
                if (req.url.includes('/api/admin/ai/logs/stream') || req.url.startsWith('/assets/')) {
                    return;
                }

                // Determine Action Type
                let actionType = 'General Request';
                if (req.url.includes('/login')) actionType = 'Login Attempt';
                else if (req.url.includes('/logout')) actionType = 'Logout';
                else if (req.url.includes('/signup') || req.url.includes('/register')) actionType = 'Signup Attempt';
                else if (req.url.includes('/upload') || req.url.includes('/chunk')) actionType = 'File Upload';
                else if (req.method === 'DELETE') actionType = 'Delete Action';
                else if (req.url.includes('/admin')) actionType = 'Admin Action';
                else if (req.url.includes('/password') || req.url.includes('/reset')) actionType = 'Password Reset';

                let payloadSummary = "";
                if (req.method !== 'GET' && req.body) {
                    const clonedBody = { ...req.body };
                    if (clonedBody.password) clonedBody.password = '***';
                    if (clonedBody.oldPassword) clonedBody.oldPassword = '***';
                    if (clonedBody.newPassword) clonedBody.newPassword = '***';
                    payloadSummary = JSON.stringify(clonedBody).substring(0, 500); // Truncate
                }

                let username = "anonymous";
                let userId = "";
                let email = "";

                if (req.user) {
                    username = req.user.username || "unknown";
                    userId = req.user.id || "";
                    // Fetch user email if not in token
                    if (!req.user.email) {
                        const dbUser = await User.findOne({ id: req.user.id }).lean();
                        if (dbUser) email = dbUser.email;
                    } else {
                        email = req.user.email;
                    }
                }

                const logEntry = {
                    timestamp: new Date(),
                    username,
                    user_id: userId,
                    email,
                    ip_address: ip,
                    user_agent: req.headers['user-agent'] || "",
                    action_type: actionType,
                    endpoint: req.originalUrl || req.url,
                    method: req.method,
                    payload_summary: payloadSummary,
                    status_code: res.statusCode,
                    is_processed: false,
                    risk_score: 0,
                    ai_analysis_result: ""
                };

                // Asynchronously save to DB
                SecurityLog.create(logEntry).then(savedLog => {
                    broadcastSecurityLog(savedLog);
                }).catch(err => {
                    console.error("[SecurityLogger] Error saving log:", err);
                });

            } catch (err) {
                console.error("[SecurityLogger] Error in finish event:", err);
            }
        });

        next();
    } catch (err) {
        console.error("[SecurityLogger] Error:", err);
        next();
    }
};
