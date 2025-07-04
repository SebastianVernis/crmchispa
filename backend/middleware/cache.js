const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({ 
    stdTTL: 300, // 5 minutes
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false // Better performance
});

/**
 * Cache middleware for GET requests
 * @param {number} duration - Cache duration in seconds (default: 300)
 */
const cacheMiddleware = (duration = 300) => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const key = req.originalUrl || req.url;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            logger.debug('Cache hit', { key: key });
            return res.json(cachedResponse);
        }

        // Store original res.json function
        const originalJson = res.json;

        // Override res.json to cache the response
        res.json = function(data) {
            // Cache the response
            cache.set(key, data, duration);
            logger.debug('Response cached', { key: key, duration: duration });
            
            // Call original json function
            return originalJson.call(this, data);
        };

        next();
    };
};

/**
 * Clear cache for specific key or pattern
 * @param {string} keyPattern - Key or pattern to clear
 */
const clearCache = (keyPattern) => {
    if (keyPattern) {
        const keys = cache.keys();
        const matchingKeys = keys.filter(key => key.includes(keyPattern));
        
        matchingKeys.forEach(key => {
            cache.del(key);
        });
        
        logger.info('Cache cleared', { pattern: keyPattern, keysCleared: matchingKeys.length });
    } else {
        cache.flushAll();
        logger.info('All cache cleared');
    }
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
    const stats = cache.getStats();
    return {
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        ksize: stats.ksize,
        vsize: stats.vsize
    };
};

/**
 * Cache warming function for frequently accessed data
 */
const warmCache = async () => {
    try {
        logger.info('Starting cache warming...');
        
        // Add any frequently accessed data here
        // Example: cache.set('contacts', await getContacts(), 600);
        
        logger.info('Cache warming completed');
    } catch (error) {
        logger.error('Error during cache warming', { error: error.message });
    }
};

module.exports = {
    cacheMiddleware,
    clearCache,
    getCacheStats,
    warmCache,
    cache
};
