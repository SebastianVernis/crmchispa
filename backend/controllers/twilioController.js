const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const TwilioService = require('../services/twilioService'); // Asumiendo que existe este servicio

// Instanciar el servicio de Twilio. Si usa variables de entorno, deberían estar cargadas.
// Considerar inyectar la instancia si se gestiona de forma centralizada.
let twilioService;
try {
    twilioService = new TwilioService();
} catch (error) {
    logger.error('Error al instanciar TwilioService en twilioController. Asegúrate que las variables de entorno de Twilio están configuradas.', { error: error.message });
    // Podrías tener un twilioService de fallback o modo demo si es apropiado, o dejar que falle.
    // Por ahora, si falla aquí, las llamadas a sus métodos fallarán.
}


exports.sendSmsController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Asegurarse que twilioService se instanció correctamente
    if (!twilioService) {
        logger.error('TwilioService no está disponible en sendSmsController.');
        return res.status(500).json({ success: false, message: 'Error interno del servidor (Twilio Service no configurado).' });
    }

    const { to, body, from } = req.body; // from es opcional y puede venir del body o estar preconfigurado

    try {
        const result = await twilioService.sendSMS({ to, body, from }); // Pasar un objeto de opciones
        if (result.success) {
            res.json({ success: true, messageId: result.messageId, message: result.message || 'SMS sent successfully.' });
        } else {
            // Usar el mensaje de error del servicio si está disponible
            res.status(result.status || 500).json({ success: false, message: result.error || 'Failed to send SMS.' });
        }
    } catch (error) {
        logger.error('Error in sendSmsController', { error: error.message, to });
        res.status(500).json({ success: false, message: 'Internal server error while sending SMS.' });
    }
};

exports.makeCallController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (!twilioService) {
        logger.error('TwilioService no está disponible en makeCallController.');
        return res.status(500).json({ success: false, message: 'Error interno del servidor (Twilio Service no configurado).' });
    }

    const { to, message, record, spoofNumber } = req.body; // spoofNumber será el 'from' para Twilio

    try {
        // Construir el objeto de opciones para makeCall
        // Asegúrate que VOICE_WEBHOOK_URL está definida en tus .env
        const statusCallbackUrl = process.env.VOICE_WEBHOOK_URL ? `${process.env.VOICE_WEBHOOK_URL}/status` : null;
        if (!statusCallbackUrl) {
            logger.warn('VOICE_WEBHOOK_URL no está definida. El callback de estado de la llamada no se configurará.');
        }

        const options = {
            message: message || 'Conectando su llamada...', // Mensaje por defecto si no se provee
            record: record || false, // Grabar por defecto es false si no se especifica
            from: spoofNumber, // El número falso es el 'from'
            statusCallback: statusCallbackUrl,
            // Podrías añadir más opciones aquí según tu twilioService.makeCall lo soporte
            // เช่น: statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        };

        const result = await twilioService.makeCall(to, options); // Pasar 'to' y 'options'

        if (result.success) {
            res.json({ success: true, callSid: result.callSid, message: result.message || 'Call initiated successfully.' }); // callSid en lugar de callid
        } else {
            res.status(result.status || 500).json({ success: false, message: result.error || 'Failed to make call.' });
        }
    } catch (error) {
        logger.error('Error in makeCallController', { error: error.message, to });
        res.status(500).json({ success: false, message: 'Internal server error while making call.' });
    }
};
