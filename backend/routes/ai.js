const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const GeminiService = require('../services/geminiService');
const logger = require('../utils/logger');
const { body, validationResult } = require('express-validator');

const databaseService = new DatabaseService();
const geminiService = new GeminiService();

/**
 * Analyze entire contact database
 */
router.post('/analyze-contacts', async (req, res) => {
    try {
        logger.info('Starting database analysis');
        
        const analysis = await databaseService.analyzeDatabaseHealth();
        
        res.json({
            success: true,
            analysis: analysis,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error analyzing contacts', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to analyze contacts',
            error: error.message
        });
    }
});

/**
 * Validate individual contact
 */
router.post('/validate-contact', [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('email').optional().isEmail().withMessage('Invalid email format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { name, phone, email, notes } = req.body;
        
        const contactData = { name, phone, email, notes };
        const analysis = await geminiService.analyzeContact(contactData);
        
        res.json({
            success: true,
            analysis: analysis,
            recommendations: analysis.recommendations,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error validating contact', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to validate contact',
            error: error.message
        });
    }
});

/**
 * Clean database - remove suspicious and invalid contacts
 */
router.post('/clean-database', [
    body('removeSuspicious').optional().isBoolean(),
    body('removeInvalidPhones').optional().isBoolean(),
    body('reanalyzeAll').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const options = {
            removeSuspicious: req.body.removeSuspicious || false,
            removeInvalidPhones: req.body.removeInvalidPhones || false,
            reanalyzeAll: req.body.reanalyzeAll || false
        };

        logger.info('Starting database cleanup', options);
        
        const results = await databaseService.cleanDatabase(options);
        
        res.json({
            success: true,
            results: results,
            message: `Cleanup completed: ${results.removed} removed, ${results.updated} updated`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error cleaning database', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to clean database',
            error: error.message
        });
    }
});

/**
 * Distribute contacts among advisors
 */
router.post('/distribute-contacts', async (req, res) => {
    try {
        logger.info('Starting contact distribution');
        
        const results = await databaseService.distributeContacts();
        
        res.json({
            success: true,
            results: results,
            message: `Distribution completed: ${results.assigned} contacts assigned`,
            recommendations: results.distribution.recommendations,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error distributing contacts', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to distribute contacts',
            error: error.message
        });
    }
});

/**
 * Get AI analysis for specific contact
 */
router.get('/contact-analysis/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        
        const contacts = await databaseService.getContacts();
        const contact = contacts.find(c => c.id == contactId);
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        const analysis = await geminiService.analyzeContact(contact);
        
        res.json({
            success: true,
            contact: {
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                email: contact.email
            },
            analysis: analysis,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting contact analysis', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to analyze contact',
            error: error.message
        });
    }
});

/**
 * Bulk analyze contacts
 */
router.post('/bulk-analyze', [
    body('contactIds').isArray().withMessage('Contact IDs must be an array'),
    body('contactIds.*').isInt().withMessage('Each contact ID must be an integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { contactIds } = req.body;
        
        const contacts = await databaseService.getContacts();
        const selectedContacts = contacts.filter(c => contactIds.includes(c.id));
        
        const results = [];
        
        for (const contact of selectedContacts) {
            try {
                const analysis = await geminiService.analyzeContact(contact);
                results.push({
                    contactId: contact.id,
                    name: contact.name,
                    analysis: analysis
                });
            } catch (error) {
                results.push({
                    contactId: contact.id,
                    name: contact.name,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results: results,
            processed: results.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error in bulk analysis', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk analysis',
            error: error.message
        });
    }
});

/**
 * Get database statistics and health metrics
 */
router.get('/database-stats', async (req, res) => {
    try {
        const stats = await databaseService.getStatistics();
        
        res.json({
            success: true,
            statistics: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting database stats', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get database statistics',
            error: error.message
        });
    }
});

/**
 * Suggest improvements for contact data quality
 */
router.post('/suggest-improvements', async (req, res) => {
    try {
        const analysis = await databaseService.analyzeDatabaseHealth();
        
        const suggestions = [];
        
        if (analysis.suspiciousContacts > 0) {
            suggestions.push({
                type: 'cleanup',
                priority: 'high',
                action: 'Remove suspicious contacts',
                description: `${analysis.suspiciousContacts} contacts appear to be fake or suspicious`,
                endpoint: '/api/ai/clean-database',
                params: { removeSuspicious: true }
            });
        }
        
        if (analysis.invalidContacts > 0) {
            suggestions.push({
                type: 'validation',
                priority: 'high',
                action: 'Fix invalid phone numbers',
                description: `${analysis.invalidContacts} contacts have invalid phone numbers`,
                endpoint: '/api/ai/clean-database',
                params: { removeInvalidPhones: true }
            });
        }
        
        if (analysis.duplicates.length > 0) {
            suggestions.push({
                type: 'deduplication',
                priority: 'medium',
                action: 'Remove duplicate contacts',
                description: `${analysis.duplicates.length} duplicate contacts found`,
                endpoint: '/api/ai/clean-database',
                params: { removeDuplicates: true }
            });
        }
        
        if (analysis.qualityDistribution.poor > 0) {
            suggestions.push({
                type: 'enhancement',
                priority: 'medium',
                action: 'Improve data quality',
                description: `${analysis.qualityDistribution.poor} contacts have poor data quality`,
                endpoint: '/api/ai/clean-database',
                params: { reanalyzeAll: true }
            });
        }
        
        const unassignedCount = analysis.totalContacts - (analysis.validContacts || 0);
        if (unassignedCount > 0) {
            suggestions.push({
                type: 'distribution',
                priority: 'low',
                action: 'Distribute unassigned contacts',
                description: `${unassignedCount} contacts are not assigned to advisors`,
                endpoint: '/api/ai/distribute-contacts',
                params: {}
            });
        }
        
        res.json({
            success: true,
            suggestions: suggestions,
            analysis: analysis,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error suggesting improvements', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to suggest improvements',
            error: error.message
        });
    }
});

module.exports = router;
