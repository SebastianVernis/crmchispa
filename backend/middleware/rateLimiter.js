const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
        });
    }
});

// Strict rate limiter for calling endpoints
const callLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // limit each IP to 10 calls per 5 minutes
    message: {
        error: 'Too many call attempts from this IP, please try again later.',
        retryAfter: 300
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Call rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many call attempts from this IP, please try again later.',
            retryAfter: 300
        });
    }
});

// SMS rate limiter
const smsLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // limit each IP to 20 SMS per 10 minutes
    message: {
        error: 'Too many SMS attempts from this IP, please try again later.',
        retryAfter: 600
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`SMS rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many SMS attempts from this IP, please try again later.',
            retryAfter: 600
        });
    }
});

    smsLimiter
};

// Stricter rate limiter for login attempts
const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 10, // Limit each IP to 10 login requests per windowMs
    message: {
        error: 'Too many login attempts from this IP, please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins towards the rate limit
    handler: (req, res, /*next, options*/) => {
        logger.warn(`Login rate limit exceeded for IP: ${req.ip} to path: ${req.path}`);
        res.status(429).json({
            error: 'Too many login attempts from this IP, please try again after 15 minutes.',
        });
    }
});

module.exports = {
    apiLimiter,
    callLimiter,
    smsLimiter,
    loginLimiter
};
