import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication routes (login, register, unified)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 authentication requests per windowMs
    message: { 
        detail: "Too many login attempts from this IP, please try again after 15 minutes.", 
        status: "error" 
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    validate: { trustProxy: false },
});

// General rate limiter for all other API endpoints
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { 
        detail: "Too many requests from this IP, please try again later.", 
        status: "error" 
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});

// Strict rate limiter for voting
export const voteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 votes per minute
    message: { 
        detail: "You are voting too fast. Please wait a minute.", 
        status: "error",
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});

// Rate limiter for internal notification endpoints
export const notificationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 notification fetches per minute
    message: { 
        detail: "Too many notification requests. Please slow down.", 
        status: "error" 
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});
