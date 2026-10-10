import jwt from 'jsonwebtoken';
import { User } from '../db/index.js';

// Assuming you set ACCESS_TOKEN_EXPIRE_IN_SECS and REFRESH_TOKEN_EXPIRE_IN_DAYS in .env
export const generateTokens = (userId) => {
    const access_token_expire = parseInt(process.env.ACCESS_TOKEN_EXPIRE_IN_SECS || 1800);
    const refresh_token_expire = parseInt(process.env.REFRESH_TOKEN_EXPIRE_IN_DAYS || 14) * 24 * 60 * 60;

    // Check if secret key exists
    let secret = process.env.SECRET_KEY;

    const accessToken = jwt.sign({ sub: userId, type: 'access' }, secret, {
        expiresIn: access_token_expire
    });

    const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, secret, {
        expiresIn: refresh_token_expire
    });

    return {
        access_token: accessToken,
        refresh_token: refreshToken
    };
};

export const verifyAccessToken = (token) => {
    let secret = process.env.SECRET_KEY;
    try {
        const decoded = jwt.verify(token, secret);
        if (decoded.type !== 'access') return null;
        return decoded;
    } catch (e) {
        return null;
    }
};

export const verifyRefreshToken = (token) => {
    let secret = process.env.SECRET_KEY;
    try {
        const decoded = jwt.verify(token, secret);
        if (decoded.type !== 'refresh') return null;
        return decoded;
    } catch (e) {
        return null;
    }
};

export const authMiddleware = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
        token = req.cookies.access_token;
    } else if (req.query._token) {
        token = req.query._token;
        if (token.startsWith('Bearer%20')) token = token.replace('Bearer%20', '');
        if (token.startsWith('Bearer ')) token = token.replace('Bearer ', '');
    }

    if (!token) {
        return res.status(401).json({ detail: "Unauthorized" });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
        return res.status(401).json({ detail: "Unauthorized" });
    }

    try {
        const user = await User.findOne({ id: decoded.sub }).select('id username is_banned role strikes moderator_state moderator_city moderator_pincode moderator_strikes');
        if (!user) {
            return res.status(401).json({ detail: "User not found" });
        }
        if (user.is_banned) {
            return res.status(403).json({ 
                detail: "Account Suspended",
                message: "This account has been suspended due to violations of our platform policies. Content from this account is currently unavailable."
            });
        }
        req.user = { id: user.id, ...user.toObject() };
        next();
    } catch (err) {
        return res.status(500).json({ detail: "Internal Server Error" });
    }
};

export const optionalAuthMiddleware = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
        token = req.cookies.access_token;
    } else if (req.query._token) {
        token = req.query._token;
        if (token.startsWith('Bearer%20')) token = token.replace('Bearer%20', '');
        if (token.startsWith('Bearer ')) token = token.replace('Bearer ', '');
    }

    if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded) {
            try {
                const user = await User.findOne({ id: decoded.sub }).select('id username is_banned role strikes moderator_state moderator_city moderator_pincode moderator_strikes');
                if (user && !user.is_banned) {
                    req.user = { id: user.id, ...user.toObject() };
                }
            } catch (err) {
                // Ignore DB error
            }
        }
    }
    next();
};