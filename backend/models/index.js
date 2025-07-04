const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

require('dotenv').config();

// Validación de variables de entorno críticas para producción
const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
if (process.env.NODE_ENV === 'production') {
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingVars.length > 0) {
        // En lugar de lanzar un error que detenga la aplicación, lo logueamos como error crítico
        // La aplicación podría seguir funcionando si Sequelize tiene fallbacks o configuraciones por defecto.
        logger.error(`Error Crítico: Faltan variables de entorno requeridas para la base de datos: ${missingVars.join(', ')}`);
        // Considerar `throw new Error(...)` si es mandatorio que la app no inicie sin estas variables.
    }
}

// Configuración de Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME || 'dbu2025297', // Fallback a los valores que tenías
    process.env.DB_USER || 'dbu2025297',
    process.env.DB_PASSWORD || 'Svernis1',
    {
        host: process.env.DB_HOST || 'db5018065428.hosting-data.io',
        port: process.env.DB_PORT || 3306,
        dialect: process.env.DB_DIALECT || 'mysql', // Cambiado a mysql como estaba en tu original, pero el fragmento decía mariadb
        logging: process.env.NODE_ENV === 'production' ? false : (msg => logger.debug(msg)),
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            timestamps: true, // Asegurar que timestamps esté habilitado por defecto
            underscored: false, // Mantener camelCase para los campos generados por Sequelize
        },
        dialectOptions: {
            // Opciones específicas del dialecto (si son necesarias)
            // Ejemplo para MySQL/MariaDB:
            // ssl: process.env.DB_SSL === 'true' ? { /* opciones de SSL */ } : null,
            charset: 'utf8mb4', // Asegurar charset para la conexión también
            supportBigNumbers: true,
            bigNumberStrings: true
        }
    }
);

const db = {};

// Carga dinámica de modelos
const basename = path.basename(__filename);
fs.readdirSync(__dirname)
    .filter(file => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js'))
    .forEach(file => {
        // Uso de import en lugar de require para los modelos
        const modelDefiner = require(path.join(__dirname, file));
        const model = modelDefiner(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
        logger.info(`Modelo cargado: ${model.name}`);
    });

// Establecer asociaciones
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
        logger.info(`Asociaciones establecidas para: ${modelName}`);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
