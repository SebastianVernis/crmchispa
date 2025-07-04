const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const logger = require('../utils/logger');
const { body, validationResult, param } = require('express-validator');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('./auth'); // Asumiendo que requireSuperAdmin se añadirá a auth.js

const databaseService = new DatabaseService();

// TODO: Implementar los métodos correspondientes en DatabaseService

// GET /api/users - Listar todos los usuarios (solo superadmin)
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await databaseService.getUsers(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error fetching users', { error: error.message, query: req.query });
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// POST /api/users - Crear un nuevo usuario (solo superadmin)
router.post('/', authenticateToken, requireSuperAdmin, [
    body('username').notEmpty().withMessage('Username is required').isLength({ min: 3 }),
    body('password').notEmpty().withMessage('Password is required') // La validación de fortaleza está en el modelo y servicio
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
        .withMessage('Password must be at least 8 characters, include an uppercase letter, a lowercase letter, and a number.'),
    body('role').isIn(['admin', 'asesor']).withMessage('Invalid role. Must be admin or asesor.')
    // superadmin no puede crear otro superadmin directamente por esta vía por ahora.
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const { username, password, role, isActive, advisorId } = req.body;
        const newUser = await databaseService.createUser({ username, password, role, isActive, advisorId });
        res.status(201).json({ success: true, user: newUser });
    } catch (error) {
        logger.error('Error creating user', { error: error.message, body: req.body });
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

// GET /api/users/:userId - Obtener un usuario específico (solo superadmin)
router.get('/:userId', authenticateToken, requireSuperAdmin, [
    param('userId').isInt().withMessage('User ID must be an integer')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const user = await databaseService.getUserById(req.params.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (error) {
        logger.error('Error fetching user', { error: error.message, userId: req.params.userId });
        res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
});

// PUT /api/users/:userId - Actualizar un usuario (solo superadmin)
router.put('/:userId', authenticateToken, requireSuperAdmin, [
    param('userId').isInt().withMessage('User ID must be an integer'),
    body('username').optional().isLength({ min: 3 }),
    body('password').optional() // La validación de fortaleza y longitud está en el modelo/servicio si se proporciona
        .custom((value) => { // Permitir cadena vacía para no cambiar contraseña, o validar si se proporciona
            if (value === '') return true; // No se actualiza
            if (value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value)) {
                throw new Error('If provided, password must be at least 8 characters, include an uppercase letter, a lowercase letter, and a number.');
            }
            return true;
        }),
    body('role').optional().isIn(['admin', 'asesor']).withMessage('Invalid role. Must be admin or asesor.'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
    body('advisorId').optional({ nullable: true }).isInt().withMessage('Advisor ID must be an integer or null.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const { userId } = req.params;
        const updateData = req.body;

        // No permitir que un superadmin se quite el rol a sí mismo si es el único
        if (parseInt(userId, 10) === req.user.userId && updateData.role && updateData.role !== 'superadmin') {
            const superAdminCount = await User.count({ where: { role: 'superadmin' } });
            if (superAdminCount <= 1) {
                return res.status(403).json({ success: false, message: "Cannot change the role of the last superadmin." });
            }
        }
        // No permitir cambiar a rol superadmin desde esta ruta
        if (updateData.role === 'superadmin') {
            delete updateData.role; // O devolver error
        }


        const updatedUser = await databaseService.updateUser(userId, updateData);
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        logger.error('Error updating user', { error: error.message, userId: req.params.userId, body: req.body });
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
});

// DELETE /api/users/:userId - Eliminar un usuario (solo superadmin)
// Por seguridad, un superadmin no debería poder eliminarse a sí mismo a través de esta ruta.
// Tampoco debería poder eliminar al último superadmin si es el único.
router.delete('/:userId', authenticateToken, requireSuperAdmin, [
    param('userId').isInt().withMessage('User ID must be an integer')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const userIdToDelete = parseInt(req.params.userId, 10);

        // La lógica de negocio (no auto-eliminarse, no eliminar último superadmin)
        // está ahora en databaseService.deleteUser. El servicio lanzará errores si es necesario.
        const success = await databaseService.deleteUser(userIdToDelete, req.user);

        if (!success) {
            // Esto podría significar que el usuario no fue encontrado si deleteUser devuelve false en ese caso.
            // O podría ser que el servicio ya lanzó un error manejado abajo.
            // Si deleteUser puede devolver false para "no encontrado", este chequeo es útil.
            return res.status(404).json({ success: false, message: 'User not found or deletion conditions not met' });
        }
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user', { error: error.message, userId: req.params.userId });
        if (error.statusCode === 403) { // Errores específicos lanzados por el servicio
            return res.status(403).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

module.exports = router;
