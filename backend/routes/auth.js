const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Find user by username
        const user = await User.findByUsername(username);
        if (!user) {
            logger.warn('Login attempt with invalid username', { username, ip: req.ip });
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isValidPassword = await user.checkPassword(password);
        if (!isValidPassword) {
            logger.warn('Login attempt with invalid password', { username, ip: req.ip });
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        await user.update({ lastLogin: new Date() });

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        logger.info('User logged in successfully', { 
            userId: user.id, 
            username: user.username, 
            role: user.role,
            ip: req.ip 
        });

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        logger.error('Login error', { error: error.message, ip: req.ip });
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Logout endpoint (optional - mainly for logging)
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        logger.info('User logged out', { 
            userId: req.user.userId, 
            username: req.user.username,
            ip: req.ip 
        });

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        logger.error('Logout error', { error: error.message, ip: req.ip });
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId, {
            attributes: ['id', 'username', 'role', 'lastLogin', 'createdAt']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        logger.error('Get user info error', { error: error.message, ip: req.ip });
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            logger.warn('Invalid token attempt', { ip: req.ip });
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
    // Allow access if user is an admin or a superadmin
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        logger.warn('Admin/Superadmin access denied', { userId: req.user ? req.user.userId : 'N/A', role: req.user ? req.user.role : 'N/A', ip: req.ip, path: req.originalUrl });
        return res.status(403).json({
            success: false,
            message: 'Admin or Superadmin access required'
        });
    }
    next();
}

// Middleware to check if superadmin setup is allowed
async function checkSuperAdminSetupAllowed(req, res, next) {
    try {
        const superAdminCount = await User.count({ where: { role: 'superadmin' } });
        if (superAdminCount > 0) {
            return res.status(403).json({
                success: false,
                message: 'Super admin already exists. Setup not allowed.'
            });
        }
        next();
    } catch (error) {
        logger.error('Error checking superadmin count', { error: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error during setup check.' });
    }
}


// Endpoint to setup the first superadmin
router.post('/setup-superadmin', checkSuperAdminSetupAllowed, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required for superadmin setup'
            });
        }

        // Adicional: Validar la fortaleza de la contraseña aquí también si es necesario
        // (Aunque el modelo ya tiene una validación, es bueno tenerla en la ruta)
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, and a number.'
            });
        }

        const newUser = await User.create({
            username,
            password, // El hook beforeCreate en el modelo User se encargará del hasheo
            role: 'superadmin',
            isActive: true
        });

        logger.info('Superadmin created successfully', { userId: newUser.id, username: newUser.username });
        res.status(201).json({
            success: true,
            message: 'Superadmin created successfully. Please login.',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role
            }
        });

    } catch (error) {
        logger.error('Superadmin setup error', { error: error.message });
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors.map(e => e.message) });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }
        res.status(500).json({ success: false, message: 'Internal server error during superadmin setup' });
    }
});

// Middleware to check superadmin role
function requireSuperAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'superadmin') {
        logger.warn('Superadmin access denied', { userId: req.user ? req.user.userId : 'N/A', role: req.user ? req.user.role : 'N/A', ip: req.ip, path: req.originalUrl });
        return res.status(403).json({
            success: false,
            message: 'Superadmin access required'
        });
    }
    next();
}


module.exports = { router, authenticateToken, requireAdmin, requireSuperAdmin };
