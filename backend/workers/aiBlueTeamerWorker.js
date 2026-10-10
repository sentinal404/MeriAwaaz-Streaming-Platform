import axios from 'axios';
import { SecurityLog, AISettings, AIAnalysisResult } from '../db/index.js';
import { executeSecurityAction } from '../utils/SecurityActionValidator.js';
import { v4 as uuidv4 } from 'uuid';

export const startAiBlueTeamerWorker = () => {
    let isRunning = false;

    const analyzeLogs = async () => {
        if (isRunning) return;
        
        try {
            const settings = await AISettings.findOne().lean();
            if (!settings || !settings.ai_enabled) return;

            isRunning = true;

            const batchSize = settings.batch_size || 750;
            const logsToProcess = await SecurityLog.find({ is_processed: false }).limit(batchSize).lean();

            if (logsToProcess.length === 0) {
                isRunning = false;
                return;
            }

            console.log(`[AI_BLUE_TEAMER] Analyzing ${logsToProcess.length} logs...`);

            const prompt = `You are an expert cybersecurity AI Blue Teamer for an Express backend application.
Analyze the following batch of security logs. Identify any suspicious activities (brute force, SQLi, XSS, path traversal, API abuse, malicious uploads).
If an IP or User is acting suspiciously, output a decision for them.

Logs:
${JSON.stringify(logsToProcess, null, 2)}

Provide your analysis strictly as a JSON array of objects. Format:
[
  {
    "target_ip": "1.2.3.4",
    "target_user": "username or anonymous",
    "risk_score": 85,
    "reason": "Suspicious login attempts detected",
    "recommended_action": "Add IP Block" // Choose from: 'Logout User', 'Revoke Sessions', 'Disable Account', 'Add IP Block', 'Create Alert'
  }
]
If there are no threats, return an empty array [].
Do not include any markdown or text outside the JSON array.`;

            const response = await axios.post(settings.endpoint_url, {
                model: settings.model_name,
                prompt: prompt,
                stream: false
            }, {
                headers: settings.api_key ? { Authorization: `Bearer ${settings.api_key}` } : {},
                timeout: 60000 
            });

            const rawText = response.data.response || response.data.message?.content || "";
            let findings = [];

            try {
                const jsonMatch = rawText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    findings = JSON.parse(jsonMatch[0]);
                } else {
                    findings = JSON.parse(rawText);
                }
            } catch (err) {
                console.error("[AI_BLUE_TEAMER] Failed to parse AI JSON response:", rawText.substring(0, 200));
            }

            const batchId = uuidv4();
            await AIAnalysisResult.create({
                batch_id: batchId,
                logs_analyzed: logsToProcess.length,
                findings: findings
            });

            // Process decisions
            if (Array.isArray(findings) && settings.auto_action_toggle) {
                for (const decision of findings) {
                    if (decision.target_ip || decision.target_user) {
                        await executeSecurityAction(decision, decision.target_user, decision.target_ip);
                    }
                }
            }

            // Mark logs as processed
            const logIds = logsToProcess.map(log => log._id);
            await SecurityLog.updateMany(
                { _id: { $in: logIds } },
                { $set: { is_processed: true } }
            );

            console.log(`[AI_BLUE_TEAMER] Finished analyzing batch ${batchId}. Found ${findings.length} issues.`);

        } catch (err) {
            console.error("[AI_BLUE_TEAMER] Error running analysis:", err.message);
        } finally {
            isRunning = false;
        }
    };

    // Initial run setup
    setTimeout(async () => {
        const settings = await AISettings.findOne().lean();
        const interval = settings?.analysis_interval_ms || 60000;
        setInterval(analyzeLogs, interval);
        analyzeLogs(); // Run once immediately
    }, 5000);
};
