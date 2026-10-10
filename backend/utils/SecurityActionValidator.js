import { User, BlockedIP, AIAction, SecurityNotification } from '../db/index.js';

export const executeSecurityAction = async (decision, targetUser, targetIp) => {
    try {
        const allowedActions = ['Logout User', 'Revoke Sessions', 'Disable Account', 'Add IP Block', 'Create Alert'];
        const riskScore = parseInt(decision.risk_score) || 0;
        
        let actionTaken = 'Create Alert'; // Default action

        // Force critical threshold actions
        if (riskScore >= 71) {
            actionTaken = 'Add IP Block';
            if (targetUser && targetUser !== 'anonymous') {
                actionTaken = 'Disable Account';
            }
        } else if (riskScore >= 41) {
            actionTaken = 'Create Alert';
        }

        // Validate the AI recommended action if provided
        if (decision.recommended_action && allowedActions.includes(decision.recommended_action)) {
            // Overwrite if it's explicitly allowed
            actionTaken = decision.recommended_action;
        }

        console.log(`[SecurityActionValidator] Executing action: ${actionTaken} for IP: ${targetIp}, User: ${targetUser}. Reason: ${decision.reason}`);

        if (actionTaken === 'Add IP Block') {
            await BlockedIP.findOneAndUpdate(
                { ip_address: targetIp },
                { detection_reason: decision.reason, country: "Unknown" },
                { upsert: true }
            );
        } else if (actionTaken === 'Disable Account' || actionTaken === 'Revoke Sessions' || actionTaken === 'Logout User') {
            if (targetUser && targetUser !== 'anonymous') {
                await User.findOneAndUpdate(
                    { username: targetUser },
                    { is_banned: true, banned_by_ai: true, ban_reason: decision.reason }
                );
            }
        }

        // Record the action taken
        await AIAction.create({
            target_user: targetUser,
            target_ip: targetIp,
            action_taken: actionTaken,
            reason: decision.reason,
            risk_score: riskScore,
            status: "executed"
        });

        // Create an alert notification
        await SecurityNotification.create({
            username: targetUser,
            ip_address: targetIp,
            risk_score: riskScore,
            action_taken: actionTaken,
            reason: decision.reason
        });

    } catch (err) {
        console.error("[SecurityActionValidator] Error executing action:", err);
    }
};
