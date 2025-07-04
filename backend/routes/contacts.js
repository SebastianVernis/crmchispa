const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const { sequelize } = require('../models');
const logger = require('../utils/logger');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('./auth'); // Importar middlewares

const databaseService = new DatabaseService();

/**
 * Get all contacts with filtering options
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            assignedAdvisorId: req.query.advisorId,
            minQualityScore: req.query.minQuality ? parseInt(req.query.minQuality) : undefined,
            isValidPhone: req.query.validPhone === 'true' ? true : req.query.validPhone === 'false' ? false : undefined,
            isSuspicious: req.query.suspicious === 'true' ? true : req.query.suspicious === 'false' ? false : undefined
        };

        // Remove undefined filters
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

        const contacts = await databaseService.getContacts(filters);
        
        res.json({
            success: true,
            contacts: contacts,
            count: contacts.length,
            filters: filters,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching contacts', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contacts',
            error: error.message
        });
    }
});

/**
 * Get specific contact by ID
 */
router.get('/:contactId', authenticateToken, async (req, res) => {
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
        
        res.json({
            success: true,
            contact: contact,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching contact', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact',
            error: error.message
        });
    }
});

/**
 * Create new contact with AI analysis
 */
router.post('/', authenticateToken, requireAdmin, [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('status').optional().isIn(['New', 'Contacted', 'FollowUp', 'Not Interested', 'Converted']),
    body('notes').optional().isString(),
    body('source').optional().isString(),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent'])
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

        const contactData = {
            name: req.body.name,
            phone: req.body.phone,
            email: req.body.email,
            status: req.body.status || 'Nuevo',
            notes: req.body.notes,
            source: req.body.source,
            priority: req.body.priority || 'Medium'
        };

        const contact = await databaseService.createContact(contactData);
        
        res.status(201).json({
            success: true,
            contact: contact,
            message: 'Contact created successfully with AI analysis',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error creating contact', { error: error.message });
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Phone number already exists',
                error: 'A contact with this phone number already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to create contact',
            error: error.message
        });
    }
});

/**
 * Update contact with re-analysis
 */
router.put('/:contactId', authenticateToken, requireAdmin, [
    body('name').optional().isLength({ min: 2, max: 100 }),
    body('phone').optional().notEmpty(),
    body('email').optional().isEmail(),
    body('status').optional().isIn(['New', 'Contacted', 'FollowUp', 'Not Interested', 'Converted']),
    body('notes').optional().isString(),
    body('source').optional().isString(),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']),
    body('assignedAdvisorId').optional().isInt()
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

        const { contactId } = req.params;
        const updateData = req.body;

        const contact = await databaseService.updateContact(contactId, updateData);
        
        res.json({
            success: true,
            contact: contact,
            message: 'Contact updated successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error updating contact', { error: error.message });
        
        if (error.message === 'Contact not found') {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Phone number already exists',
                error: 'Another contact with this phone number already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update contact',
            error: error.message
        });
    }
});

/**
 * Delete contact
 */
router.delete('/:contactId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { contactId } = req.params;
        
        const success = await databaseService.deleteContact(contactId);
        
        res.json({
            success: true,
            message: 'Contact deleted successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error deleting contact', { error: error.message });
        
        if (error.message === 'Contact not found') {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to delete contact',
            error: error.message
        });
    }
});

/**
 * Bulk create contacts with AI analysis
 */
router.post('/bulk', authenticateToken, requireAdmin, [
    body('contacts').isArray().withMessage('Contacts must be an array'),
    body('contacts.*.name').notEmpty().withMessage('Name is required for each contact'),
    body('contacts.*.phone').notEmpty().withMessage('Phone is required for each contact'),
    body('contacts.*.email').optional().isEmail().withMessage('Invalid email format')
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

        const { contacts } = req.body;
        const results = {
            created: 0,
            errors: [],
            contacts: []
        };

        for (const contactData of contacts) {
            try {
                const contact = await databaseService.createContact({
                    name: contactData.name,
                    phone: contactData.phone,
                    email: contactData.email,
                    status: contactData.status || 'Nuevo',
                    notes: contactData.notes,
                    source: contactData.source || 'Bulk Import',
                    priority: contactData.priority || 'Medium'
                });
                
                results.created++;
                results.contacts.push(contact);
            } catch (error) {
                results.errors.push({
                    contact: contactData,
                    error: error.message
                });
            }
        }
        
        res.status(201).json({
            success: true,
            results: results,
            message: `Bulk import completed: ${results.created} contacts created, ${results.errors.length} errors`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error in bulk contact creation', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to create contacts in bulk',
            error: error.message
        });
    }
});

/**
 * Search contacts
 */
router.get('/search/:query', authenticateToken, async (req, res) => {
    try {
        const { query } = req.params;
        
        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters long'
            });
        }

        const allContacts = await databaseService.getContacts();
        
        // Simple search implementation
        const searchResults = allContacts.filter(contact => 
            contact.name.toLowerCase().includes(query.toLowerCase()) ||
            contact.phone.includes(query) ||
            (contact.email && contact.email.toLowerCase().includes(query.toLowerCase())) ||
            (contact.notes && contact.notes.toLowerCase().includes(query.toLowerCase()))
        );
        
        res.json({
            success: true,
            query: query,
            results: searchResults,
            count: searchResults.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error searching contacts', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to search contacts',
            error: error.message
        });
    }
});

/**
 * Get contact statistics
 */
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await databaseService.getStatistics();
        
        res.json({
            success: true,
            statistics: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching contact statistics', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact statistics',
            error: error.message
        });
    }
});

/**
 * Export contacts (JSON format)
 */
router.get('/export/json', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            assignedAdvisorId: req.query.advisorId,
            minQualityScore: req.query.minQuality ? parseInt(req.query.minQuality) : undefined,
            isValidPhone: req.query.validPhone === 'true' ? true : req.query.validPhone === 'false' ? false : undefined,
            isSuspicious: req.query.suspicious === 'true' ? true : req.query.suspicious === 'false' ? false : undefined
        };

        // Remove undefined filters
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

        const contacts = await databaseService.getContacts(filters);
        
        // Clean up sensitive data for export
        const exportData = contacts.map(contact => ({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            status: contact.status,
            notes: contact.notes,
            source: contact.source,
            priority: contact.priority,
            qualityScore: contact.qualityScore,
            isValidPhone: contact.isValidPhone,
            isComplete: contact.isComplete,
            assignedAdvisor: contact.advisor ? contact.advisor.name : null,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt
        }));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=contacts-export-${new Date().toISOString().split('T')[0]}.json`);
        
        res.json({
            exportDate: new Date().toISOString(),
            totalContacts: exportData.length,
            filters: filters,
            contacts: exportData
        });
    } catch (error) {
        logger.error('Error exporting contacts', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to export contacts',
            error: error.message
        });
    }
});

/**
 * Update contact status and add interaction log
 */
router.post('/:contactId/interaction', authenticateToken, requireAdmin, [
    body('type').isIn(['call', 'sms', 'email', 'meeting']).withMessage('Invalid interaction type'),
    body('status').optional().isIn(['New', 'Contacted', 'FollowUp', 'Not Interested', 'Converted']),
    body('notes').optional().isString(),
    body('outcome').optional().isString()
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

        const { contactId } = req.params;
        const { type, status, notes, outcome } = req.body;

        // Update contact with interaction
        const updateData = {
            lastContactDate: new Date(),
            contactCount: sequelize.literal('contactCount + 1')
        };

        if (status) {
            updateData.status = status;
        }

        if (notes) {
            updateData.notes = notes;
        }

        const contact = await databaseService.updateContact(contactId, updateData);
        
        res.json({
            success: true,
            contact: contact,
            interaction: {
                type: type,
                timestamp: new Date().toISOString(),
                outcome: outcome
            },
            message: 'Interaction logged successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error logging interaction', { error: error.message });
        
        if (error.message === 'Contact not found') {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to log interaction',
            error: error.message
        });
    }
});

module.exports = router;
