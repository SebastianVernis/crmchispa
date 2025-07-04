const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const logger = require('../utils/logger');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('./auth'); // Importar middlewares

const databaseService = new DatabaseService();

/**
 * Get all advisors with their contact assignments
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const advisors = await databaseService.getAdvisors();
        
        res.json({
            success: true,
            advisors: advisors,
            count: advisors.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching advisors', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advisors',
            error: error.message
        });
    }
});

/**
 * Get specific advisor by ID
 */
router.get('/:advisorId', authenticateToken, async (req, res) => {
    try {
        const { advisorId } = req.params;
        
        const advisors = await databaseService.getAdvisors();
        const advisor = advisors.find(a => a.id == advisorId);
        
        if (!advisor) {
            return res.status(404).json({
                success: false,
                message: 'Advisor not found'
            });
        }
        
        res.json({
            success: true,
            advisor: advisor,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching advisor', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advisor',
            error: error.message
        });
    }
});

/**
 * Create new advisor
 */
router.post('/', authenticateToken, requireAdmin, [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('department').optional().isString(),
    body('maxContacts').optional().isInt({ min: 1, max: 200 }).withMessage('Max contacts must be between 1 and 200'),
    body('specialties').optional().isArray(),
    body('workingHours').optional().isObject()
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

        const advisorData = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            department: req.body.department,
            maxContacts: req.body.maxContacts || 50,
            specialties: req.body.specialties,
            workingHours: req.body.workingHours
        };

        const advisor = await databaseService.createAdvisor(advisorData);
        
        res.status(201).json({
            success: true,
            advisor: advisor,
            message: 'Advisor created successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error creating advisor', { error: error.message });
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Email already exists',
                error: 'An advisor with this email already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to create advisor',
            error: error.message
        });
    }
});

/**
 * Update advisor
 */
router.put('/:advisorId', authenticateToken, requireAdmin, [
    body('name').optional().isLength({ min: 2, max: 100 }),
    body('email').optional().isEmail(),
    body('phone').optional().notEmpty(),
    body('department').optional().isString(),
    body('maxContacts').optional().isInt({ min: 1, max: 200 }),
    body('isActive').optional().isBoolean(),
    body('specialties').optional().isArray(),
    body('workingHours').optional().isObject(),
    body('performanceScore').optional().isFloat({ min: 0, max: 100 })
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

        const { advisorId } = req.params;
        const updateData = req.body;

        const advisor = await databaseService.updateAdvisor(advisorId, updateData);
        
        res.json({
            success: true,
            advisor: advisor,
            message: 'Advisor updated successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error updating advisor', { error: error.message });
        
        if (error.message === 'Advisor not found') {
            return res.status(404).json({
                success: false,
                message: 'Advisor not found'
            });
        }
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Email already exists',
                error: 'Another advisor with this email already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update advisor',
            error: error.message
        });
    }
});

/**
 * Delete advisor (soft delete - set as inactive)
 */
router.delete('/:advisorId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { advisorId } = req.params;
        
        // Instead of deleting, we set the advisor as inactive
        const advisor = await databaseService.updateAdvisor(advisorId, { isActive: false });
        
        res.json({
            success: true,
            message: 'Advisor deactivated successfully',
            advisor: advisor,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error deactivating advisor', { error: error.message });
        
        if (error.message === 'Advisor not found') {
            return res.status(404).json({
                success: false,
                message: 'Advisor not found'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate advisor',
            error: error.message
        });
    }
});

/**
 * Get advisor performance metrics
 */
router.get('/:advisorId/performance', authenticateToken, async (req, res) => {
    try {
        const { advisorId } = req.params;
        
        const advisors = await databaseService.getAdvisors();
        const advisor = advisors.find(a => a.id == advisorId);
        
        if (!advisor) {
            return res.status(404).json({
                success: false,
                message: 'Advisor not found'
            });
        }

        // Calculate performance metrics
        const contacts = advisor.contacts || [];
        const totalContacts = contacts.length;
        const convertedContacts = contacts.filter(c => c.status === 'Convertido').length;
        const contactedContacts = contacts.filter(c => c.status === 'Contactado').length;
        const avgQualityScore = totalContacts > 0 
            ? contacts.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / totalContacts 
            : 0;

        const performance = {
            advisorId: advisor.id,
            name: advisor.name,
            totalContactsHandled: advisor.totalContactsHandled || totalContacts,
            currentContactCount: totalContacts,
            maxContacts: advisor.maxContacts,
            capacityUtilization: (totalContacts / advisor.maxContacts) * 100,
            conversionRate: totalContacts > 0 ? (convertedContacts / totalContacts) * 100 : 0,
            contactRate: totalContacts > 0 ? (contactedContacts / totalContacts) * 100 : 0,
            averageQualityScore: avgQualityScore,
            performanceScore: advisor.performanceScore || 0,
            successfulConversions: advisor.successfulConversions || convertedContacts,
            averageResponseTime: advisor.averageResponseTime || 0,
            isActive: advisor.isActive,
            department: advisor.department
        };
        
        res.json({
            success: true,
            performance: performance,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching advisor performance', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advisor performance',
            error: error.message
        });
    }
});

/**
 * Get advisor workload distribution
 */
router.get('/:advisorId/workload', authenticateToken, async (req, res) => {
    try {
        const { advisorId } = req.params;
        
        const advisors = await databaseService.getAdvisors();
        const advisor = advisors.find(a => a.id == advisorId);
        
        if (!advisor) {
            return res.status(404).json({
                success: false,
                message: 'Advisor not found'
            });
        }

        const contacts = advisor.contacts || [];
        
        // Group contacts by status
        const statusDistribution = contacts.reduce((acc, contact) => {
            acc[contact.status] = (acc[contact.status] || 0) + 1;
            return acc;
        }, {});

        // Group contacts by priority
        const priorityDistribution = contacts.reduce((acc, contact) => {
            const priority = contact.priority || 'Medium';
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
        }, {});

        // Group contacts by quality score ranges
        const qualityDistribution = contacts.reduce((acc, contact) => {
            const score = contact.qualityScore || 0;
            if (score >= 80) acc.excellent = (acc.excellent || 0) + 1;
            else if (score >= 60) acc.good = (acc.good || 0) + 1;
            else if (score >= 40) acc.fair = (acc.fair || 0) + 1;
            else acc.poor = (acc.poor || 0) + 1;
            return acc;
        }, {});

        const workload = {
            advisorId: advisor.id,
            name: advisor.name,
            totalContacts: contacts.length,
            maxContacts: advisor.maxContacts,
            availableCapacity: advisor.maxContacts - contacts.length,
            statusDistribution: statusDistribution,
            priorityDistribution: priorityDistribution,
            qualityDistribution: qualityDistribution,
            workingHours: advisor.workingHours,
            isActive: advisor.isActive
        };
        
        res.json({
            success: true,
            workload: workload,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error fetching advisor workload', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advisor workload',
            error: error.message
        });
    }
});

/**
 * Assign contacts to advisor
 */
router.post('/:advisorId/assign-contacts', authenticateToken, requireAdmin, [
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

        const { advisorId } = req.params;
        const { contactIds } = req.body;

        const advisors = await databaseService.getAdvisors();
        const advisor = advisors.find(a => a.id == advisorId);
        
        if (!advisor) {
            return res.status(404).json({
                success: false,
                message: 'Advisor not found'
            });
        }

        // Check if advisor has capacity
        const currentContactCount = advisor.contacts ? advisor.contacts.length : 0;
        const availableCapacity = advisor.maxContacts - currentContactCount;
        
        if (contactIds.length > availableCapacity) {
            return res.status(400).json({
                success: false,
                message: `Advisor capacity exceeded. Available: ${availableCapacity}, Requested: ${contactIds.length}`
            });
        }

        // Assign contacts
        const results = {
            assigned: 0,
            errors: []
        };

        for (const contactId of contactIds) {
            try {
                await databaseService.updateContact(contactId, { assignedAdvisorId: advisorId });
                results.assigned++;
            } catch (error) {
                results.errors.push(`Failed to assign contact ${contactId}: ${error.message}`);
            }
        }

        // Update advisor's current contact count
        await databaseService.updateAdvisor(advisorId, {
            currentContactCount: currentContactCount + results.assigned
        });
        
        res.json({
            success: true,
            results: results,
            message: `${results.assigned} contacts assigned to advisor`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error assigning contacts to advisor', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to assign contacts',
            error: error.message
        });
    }
});

module.exports = router;
