const express = require('express');
const { body } = require('express-validator');
const { sendSmsController, makeCallController } = require('../controllers/twilioController');
const { callLimiter, smsLimiter } = require('../middleware/rateLimiter'); // Asumiendo que existen estos limiters
// const { authenticateToken } = require('../middleware/auth'); // Descomentar si se implementa autenticación

const router = express.Router();

// POST /api/twilio/send-sms (o la ruta que decidas, ej. /api/spoof/sms)
// Aplicar authenticateToken si la ruta debe ser protegida
router.post(
    '/send-sms',
    // authenticateToken,
    smsLimiter, // Aplicar rate limiting específico para SMS si es diferente del global
    [
        body('to', 'El número de destino es obligatorio y debe ser válido').isMobilePhone('any'), // 'any' para validar formatos internacionales
        body('body', 'El cuerpo del mensaje es obligatorio').notEmpty().isString().isLength({ min: 1, max: 1600 }),
        body('from', 'El número de origen (spoof) debe ser válido').optional().isMobilePhone('any')
    ],
    sendSmsController
);

// POST /api/twilio/make-call (o la ruta que decidas, ej. /api/spoof/call)
// Aplicar authenticateToken si la ruta debe ser protegida
router.post(
    '/make-call',
    // authenticateToken,
    callLimiter, // Aplicar rate limiting específico para llamadas
    [
        body('to', 'El número de destino es obligatorio y debe ser válido').isMobilePhone('any'),
        body('spoofNumber', 'El Caller ID (spoof) es obligatorio y debe ser válido').isMobilePhone('any'),
        body('message', 'El mensaje debe ser texto').optional().isString().isLength({ max: 500 }), // Limitar longitud del mensaje
        body('record', 'El valor de "record" debe ser booleano').optional().isBoolean()
        // Podrías añadir más validaciones según las opciones de tu makeCallController (ej. voiceModulation)
    ],
    makeCallController
);


// Mantener las rutas de webhooks y otras específicas de spoofCalling que ya tenías, si son necesarias.
// Por ejemplo, si twilioService.makeSpoofCall, getCallSession, etc., son distintos de twilioService.makeCall general.
// Si las funcionalidades son las mismas, estas rutas podrían simplificarse o eliminarse si los nuevos controladores las cubren.

const TwilioService = require('../services/twilioService');
const logger = require('../utils/logger');
// const { validationResult } = require('express-validator'); // Ya importado arriba si se usa en otras partes del archivo

let twilioService; // Re-declarar para este alcance si es necesario o asegurarse que la instancia es accesible.
try {
    twilioService = new TwilioService();
} catch (error) {
    logger.error('Error al instanciar TwilioService en spoofCalling routes (parte inferior).', { error: error.message });
}


// Ejemplo de cómo podrían quedar otras rutas si son específicas para "spoof" y no genéricas de "twilio"
// GET /api/spoof/session/:sessionId
router.get('/session/:sessionId', (req, res) => {
    if (!twilioService) return res.status(503).json({ success: false, message: 'Servicio no disponible' });
    try {
        const { sessionId } = req.params;
        const session = twilioService.getCallSession ? twilioService.getCallSession(sessionId) : null; // Verificar si el método existe

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found or method not available.' });
        }
        res.json({ success: true, session });
    } catch (error) {
        logger.error('Error getting session info', { error: error.message, sessionId: req.params.sessionId });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// POST /api/spoof/session/:sessionId/end
router.post('/session/:sessionId/end', async (req, res) => {
    if (!twilioService) return res.status(503).json({ success: false, message: 'Servicio no disponible' });
    try {
        const { sessionId } = req.params;
        // Asumir que endCallSession es un método en tu TwilioService
        const result = twilioService.endCallSession ? await twilioService.endCallSession(sessionId) : { success: false, error: 'Method not available' };

        if (result.success) {
            res.json({ success: true, message: result.message || 'Session ended.' });
        } else {
            res.status(result.status || 404).json({ success: false, message: result.error || 'Failed to end session.' });
        }
    } catch (error) {
        logger.error('Error ending session', { error: error.message, sessionId: req.params.sessionId });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Webhooks: Asegúrate que las URLs en Twilio apuntan a estas rutas si las mantienes bajo /api/spoof/webhook/...
// O actualiza las URLs en Twilio si mueves los webhooks a /api/twilio/webhook/...

router.post('/webhook/voice', (req, res) => {
    if (!twilioService) return res.status(503).send('Servicio no disponible');
    try {
        const { CallSid, CallStatus } = req.body;
        logger.info('Voice webhook received (/api/spoof/webhook/voice)', { callSid: CallSid, status: CallStatus });
        const twiml = new (require('twilio')).twiml.VoiceResponse();
        // Lógica de TwiML aquí... ej. twiml.say(...), twiml.dial(...), etc.
        // Esta es una respuesta genérica, ajústala a tus necesidades.
        if (CallStatus === 'ringing') {
            // Podrías querer hacer algo más específico aquí basado en tu flujo de llamada
             twiml.say({ voice: 'alice' }, 'Conectando la llamada de spoofing.');
        } else if (CallStatus === 'in-progress') {
            // Lógica para cuando la llamada está en progreso
        } else {
            twiml.hangup();
        }
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        logger.error('Error in /api/spoof/webhook/voice', { error: error.message, body: req.body });
        res.status(500).send('Error processing voice webhook');
    }
});

router.post('/webhook/status', (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;
        logger.info('Call status update (/api/spoof/webhook/status)', { callSid: CallSid, status: CallStatus, duration: CallDuration });
        // Aquí podrías actualizar el estado de la llamada en tu BD si es necesario
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Error in /api/spoof/webhook/status', { error: error.message, body: req.body });
        res.status(500).send('Error processing status webhook');
    }
});

router.post('/webhook/recording', (req, res) => {
    try {
        const { RecordingSid, RecordingUrl, CallSid } = req.body;
        logger.info('Recording completed (/api/spoof/webhook/recording)', { recordingSid: RecordingSid, recordingUrl: RecordingUrl, callSid: CallSid });
        // Guardar RecordingUrl en tu BD asociado al CallSid
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Error in /api/spoof/webhook/recording', { error: error.message, body: req.body });
        res.status(500).send('Error processing recording webhook');
    }
});


module.exports = router;
