// Cargar variables de entorno primero
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const logger = require('./utils/logger'); // Asumiendo que tienes un logger en utils/
const { sequelize } = require('./models'); // Importar para cerrar la conexión al final

// Importar Rutas
const authRoutes = require('./routes/auth').router; // Asegúrate que auth.js exporta { router }
const twilioRoutes = require('./routes/twilio'); // Anteriormente spoofCallingRoutes
const contactRoutes = require('./routes/contacts');
const advisorRoutes = require('./routes/advisors');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/users'); // Importar nuevas rutas de usuarios
const DatabaseService = require('./services/databaseService'); // Para inicialización
const { apiLimiter, loginLimiter } = require('./middleware/rateLimiter'); // Importar limitadores

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de Seguridad
app.use(helmet({
    contentSecurityPolicy: { // Ejemplo de política más restrictiva, ajusta según necesidades
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"], // Permitir estilos inline y fuentes externas si son necesarias
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Cuidado con 'unsafe-inline' en producción para scripts
            imgSrc: ["'self'", "data:", "https:"], // Permitir imágenes de data URIs y HTTPS
            connectSrc: ["'self'"], // Limitar conexiones a 'self' por defecto
            // frameSrc: ["'self'", "https://youtube.com"], // Si embebes iframes de sitios específicos
        },
    },
    crossOriginEmbedderPolicy: false, // Ajustar si es necesario para COEP
}));

// Configuración de CORS más específica
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'];
logger.info(`Orígenes CORS permitidos: ${allowedOrigins.join(', ')}`);

app.use(cors({
    origin: function (origin, callback) {
        // Permitir solicitudes sin origen (como mobile apps o curl requests) o si el origen está en la lista blanca
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`Origen CORS bloqueado: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Si necesitas enviar cookies o encabezados de autorización
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Métodos HTTP permitidos
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Encabezados permitidos
}));


// Middlewares de Rendimiento y Parsing
app.use(compression()); // Comprimir respuestas
app.use(express.json({ limit: '10mb' })); // Parsear JSON, con límite de tamaño
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parsear application/x-www-form-urlencoded

// Middleware de logging de peticiones
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip} - ${req.get('User-Agent')}`);
    });
    next();
});


// Montaje de Rutas de la API
// Es buena práctica tener un prefijo base para todas las rutas de la API, ej. /api/v1
const apiPrefix = process.env.API_PREFIX || '/api';

// Aplicar rate limiters
app.use(`${apiPrefix}/auth`, loginLimiter, authRoutes); // loginLimiter específico para auth
app.use(`${apiPrefix}/twilio`, apiLimiter, twilioRoutes); // apiLimiter general para otras rutas API
app.use(`${apiPrefix}/contacts`, apiLimiter, contactRoutes);
app.use(`${apiPrefix}/advisors`, apiLimiter, advisorRoutes);
app.use(`${apiPrefix}/ai`, apiLimiter, aiRoutes);
app.use(`${apiPrefix}/users`, apiLimiter, userRoutes); // Registrar rutas de usuarios


// Ruta de health check básica (puede o no estar sujeta a rate limiting general, dependiendo de la necesidad)
app.get(`${apiPrefix}/health`, apiLimiter, (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});


// Servir archivos estáticos del Frontend (si este backend también sirve el frontend)
// Asumiendo que el frontend está en una carpeta 'frontend' en el directorio raíz del proyecto.
// __dirname se refiere al directorio actual (backend), así que necesitamos subir un nivel.
const frontendPath = path.join(__dirname, '../../frontend'); // Ajusta esta ruta si tu estructura es diferente
if (require('fs').existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    logger.info(`Sirviendo archivos estáticos desde: ${frontendPath}`);

    // Si es una SPA (Single Page Application), todas las rutas no API deben servir el index.html
    app.get('*', (req, res, next) => {
        if (!req.path.startsWith(apiPrefix)) { // Solo si no es una ruta de API
            const indexPath = path.join(frontendPath, 'index.html');
            if (require('fs').existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                // Si index.html no existe, podría ser un 404 real o pasar al siguiente manejador
                logger.warn(`index.html no encontrado en ${frontendPath} para la ruta ${req.path}`);
                next();
            }
        } else {
            next(); // Es una ruta de API, pasar a los manejadores de error de API
        }
    });
} else {
    logger.warn(`Directorio de frontend no encontrado en ${frontendPath}. No se servirán archivos estáticos.`);
}


// Manejadores de Errores de API (deben ir después de todas las rutas)

// Middleware para rutas API no encontradas (404)
app.use(apiPrefix, (req, res, next) => { // Solo aplica a rutas bajo /api que no fueron manejadas antes
    res.status(404).json({ success: false, message: `Ruta API no encontrada: ${req.method} ${req.originalUrl}` });
});

// Middleware de manejo de errores global (500)
// Este es el último middleware, por lo que captura cualquier error pasado por next(error)
app.use((error, req, res, next) => {
    logger.error('Error no manejado:', {
        message: error.message,
        stack: error.stack, // No exponer stack en producción
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    const statusCode = error.statusCode || 500;
    const responseError = {
        success: false,
        message: process.env.NODE_ENV === 'production' && statusCode === 500 ? 'Error interno del servidor.' : error.message,
    };
    // Añadir stack en desarrollo para debugging
    if (process.env.NODE_ENV !== 'production') {
        responseError.stack = error.stack;
    }

    res.status(statusCode).json(responseError);
});


// Arranque del Servidor y Cierre Seguro
let server; // Declarar server aquí para que sea accesible en gracefulShutdown

const startServer = async () => {
    try {
        // Inicializar servicios (como la base de datos) ANTES de que el servidor empiece a escuchar
        const dbService = new DatabaseService();
        await dbService.initialize(); // Esto ya loguea sus propios mensajes

        server = app.listen(PORT, '0.0.0.0', () => { // Escuchar en 0.0.0.0 para aceptar conexiones externas
            logger.info(`Servidor corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}.`);
            logger.info(`Accede en http://localhost:${PORT} o la IP correspondiente.`);
        });
    } catch (error) {
        logger.error('Fallo catastrófico al iniciar el servidor o sus servicios.', { error: error.message, stack: error.stack });
        process.exit(1); // Salir si la inicialización de servicios críticos falla
    }
};


const gracefulShutdown = () => {
    logger.info('Recibida señal de cierre. Cerrando servidor HTTP...');
    if (server) {
        server.close(async () => { // Esperar a que todas las conexiones existentes terminen
            logger.info('Servidor HTTP cerrado.');
            try {
                await sequelize.close(); // Cerrar la conexión de la base de datos
                logger.info('Conexión de la base de datos cerrada.');
            } catch (dbError) {
                logger.error('Error al cerrar la conexión de la base de datos.', { error: dbError.message });
            }
            process.exit(0); // Salir del proceso limpiamente
        });
    } else {
        // Si el servidor nunca se inició, simplemente salir
        logger.info('El servidor no se había iniciado. Saliendo.');
        process.exit(0);
    }

    // Forzar cierre después de un timeout si las conexiones no terminan
    setTimeout(() => {
        logger.error('No se pudieron cerrar las conexiones a tiempo, forzando cierre.');
        process.exit(1);
    }, 10000); // 10 segundos de gracia
};

process.on('SIGTERM', gracefulShutdown); // Señal de terminación estándar
process.on('SIGINT', gracefulShutdown);  // Ctrl+C

// Manejo de promesas no capturadas y excepciones no capturadas
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason: reason.stack || reason });
    // Considerar cerrar el servidor aquí si es un error crítico, o dejarlo para SIGTERM/SIGINT
    // process.exit(1); // Descomentar si se desea que la app falle rápido ante estos errores
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { message: error.message, stack: error.stack });
    // Es mandatorio cerrar tras una excepción no capturada, ya que el estado de la app es desconocido
    gracefulShutdown(); // Intentar un cierre seguro
    // Forzar salida si gracefulShutdown no funciona rápido
    setTimeout(() => process.exit(1), 2000);
});

// Iniciar el servidor
startServer();

module.exports = app; // Exportar app para posibles pruebas o uso programático
