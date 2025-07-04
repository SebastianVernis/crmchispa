const Twilio = require('twilio');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class TwilioService {
    constructor() {
        // Check if we're in demo mode (invalid credentials)
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        
        this.demoMode = !accountSid || !authToken || 
                       accountSid === 'your_twilio_account_sid_here' ||
                       authToken === 'your_twilio_auth_token_here' ||
                       !accountSid.startsWith('AC');

        if (this.demoMode) {
            logger.warn('TwilioService running in DEMO MODE - no actual calls/SMS will be sent');
            this.client = null;
        } else {
            try {
                this.client = Twilio(accountSid, authToken);
                logger.info('TwilioService initialized with real Twilio credentials');
            } catch (error) {
                logger.error('Failed to initialize Twilio client, falling back to demo mode', { error: error.message });
                this.demoMode = true;
                this.client = null;
            }
        }
        
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
        this.agentNumber = process.env.AGENT_PHONE_NUMBER || '+0987654321';
    }

    /**
     * Send SMS with enhanced error handling and logging
     */
    async sendSMS(to, body, options = {}) {
        try {
            if (this.demoMode) {
                // Demo mode - simulate SMS sending
                const demoMessageId = `demo_sms_${uuidv4()}`;
                
                logger.info('SMS sent successfully (DEMO MODE)', {
                    messageId: demoMessageId,
                    to: to,
                    from: options.from || this.fromNumber,
                    body: body
                });

                return {
                    success: true,
                    messageId: demoMessageId,
                    status: 'sent',
                    message: 'SMS sent successfully (Demo Mode)'
                };
            }

            const messageOptions = {
                body: body,
                from: options.from || this.fromNumber,
                to: to,
                ...options
            };

            const message = await this.client.messages.create(messageOptions);
            
            logger.info('SMS sent successfully', {
                messageId: message.sid,
                to: to,
                from: messageOptions.from,
                status: message.status
            });

            return {
                success: true,
                messageId: message.sid,
                status: message.status,
                message: 'SMS sent successfully'
            };
        } catch (error) {
            logger.error('Error sending SMS', {
                error: error.message,
                to: to,
                code: error.code
            });

            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Make a standard call
     */
    async makeCall(to, options = {}) {
        try {
            if (this.demoMode) {
                // Demo mode - simulate call
                const demoCallId = `demo_call_${uuidv4()}`;
                
                logger.info('Call initiated successfully (DEMO MODE)', {
                    callId: demoCallId,
                    to: to,
                    from: options.from || this.fromNumber,
                    message: options.message || 'Demo call'
                });

                return {
                    success: true,
                    callId: demoCallId,
                    status: 'initiated',
                    message: 'Call initiated successfully (Demo Mode)'
                };
            }

            const twiml = new Twilio.twiml.VoiceResponse();
            
            if (options.message) {
                twiml.say({ 
                    voice: options.voice || 'alice', 
                    language: options.language || 'es-MX' 
                }, options.message);
            }
            
            twiml.dial(to);

            const callOptions = {
                twiml: twiml.toString(),
                to: this.agentNumber,
                from: options.from || this.fromNumber,
                record: options.record || false,
                recordingStatusCallback: options.recordingCallback,
                statusCallback: options.statusCallback,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallbackMethod: 'POST'
            };

            const call = await this.client.calls.create(callOptions);
            
            logger.info('Call initiated successfully', {
                callId: call.sid,
                to: to,
                from: callOptions.from,
                status: call.status
            });

            return {
                success: true,
                callId: call.sid,
                status: call.status,
                message: 'Call initiated successfully'
            };
        } catch (error) {
            logger.error('Error making call', {
                error: error.message,
                to: to,
                code: error.code
            });

            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Make a spoof call with custom caller ID
     */
    async makeSpoofCall(to, spoofNumber, options = {}) {
        try {
            const sessionId = uuidv4();
            
            // Create TwiML for the spoof call
            const twiml = new Twilio.twiml.VoiceResponse();
            
            // Add voice modulation if specified
            if (options.voiceModulation) {
                twiml.say({ 
                    voice: options.voiceModulation.voice || 'alice',
                    language: options.voiceModulation.language || 'en-US'
                }, options.message || 'Connecting your call...');
            }

            // Conference-based spoofing for better control
            if (options.useConference) {
                const conferenceName = `spoof-${sessionId}`;
                
                // First, call the agent and put them in conference
                const agentDial = twiml.dial();
                agentDial.conference(conferenceName, {
                    startConferenceOnEnter: true,
                    endConferenceOnExit: true,
                    record: options.record || false
                });

                // Then call the target with spoofed caller ID
                const targetCallOptions = {
                    url: `${process.env.VOICE_WEBHOOK_URL}/conference/${conferenceName}`,
                    to: to,
                    from: spoofNumber || this.spoofCallerId,
                    statusCallback: options.statusCallback,
                    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                    statusCallbackMethod: 'POST'
                };

                const targetCall = await this.client.calls.create(targetCallOptions);
                
                this.activeCallSessions.set(sessionId, {
                    targetCallId: targetCall.sid,
                    conferenceName: conferenceName,
                    spoofNumber: spoofNumber,
                    targetNumber: to,
                    startTime: new Date(),
                    status: 'initiated'
                });

            } else {
                // Direct spoofed call
                twiml.dial(to, {
                    callerId: spoofNumber || this.spoofCallerId,
                    record: options.record || false,
                    recordingStatusCallback: options.recordingCallback
                });
            }

            const callOptions = {
                twiml: twiml.toString(),
                to: options.useConference ? this.agentPhoneNumber : to,
                from: options.useConference ? this.twilioPhoneNumber : (spoofNumber || this.spoofCallerId),
                record: options.record || false,
                statusCallback: options.statusCallback,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallbackMethod: 'POST'
            };

            const call = await this.client.calls.create(callOptions);
            
            logger.info('Spoof call initiated successfully', {
                sessionId: sessionId,
                callId: call.sid,
                to: to,
                spoofNumber: spoofNumber,
                useConference: options.useConference || false,
                status: call.status
            });

            return {
                success: true,
                sessionId: sessionId,
                callId: call.sid,
                status: call.status,
                spoofNumber: spoofNumber,
                message: 'Spoof call initiated successfully'
            };
        } catch (error) {
            logger.error('Error making spoof call', {
                error: error.message,
                to: to,
                spoofNumber: spoofNumber,
                code: error.code
            });

            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Generate TwiML for conference joining
     */
    generateConferenceTwiML(conferenceName, options = {}) {
        const twiml = new Twilio.twiml.VoiceResponse();
        
        if (options.welcomeMessage) {
            twiml.say({ 
                voice: options.voice || 'alice',
                language: options.language || 'en-US'
            }, options.welcomeMessage);
        }

        twiml.dial().conference(conferenceName, {
            startConferenceOnEnter: options.startOnEnter !== false,
            endConferenceOnExit: options.endOnExit !== false,
            record: options.record || false,
            recordingStatusCallback: options.recordingCallback,
            waitUrl: options.waitUrl,
            maxParticipants: options.maxParticipants || 10
        });

        return twiml.toString();
    }

    /**
     * Get call session information
     */
    getCallSession(sessionId) {
        return this.activeCallSessions.get(sessionId);
    }

    /**
     * End call session
     */
    async endCallSession(sessionId) {
        const session = this.activeCallSessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }

        try {
            // End the target call
            if (session.targetCallId) {
                await this.client.calls(session.targetCallId).update({ status: 'completed' });
            }

            this.activeCallSessions.delete(sessionId);
            
            logger.info('Call session ended', {
                sessionId: sessionId,
                duration: new Date() - session.startTime
            });

            return { success: true, message: 'Call session ended successfully' };
        } catch (error) {
            logger.error('Error ending call session', {
                sessionId: sessionId,
                error: error.message
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Get call recordings
     */
    async getCallRecordings(callSid) {
        try {
            const recordings = await this.client.recordings.list({ callSid: callSid });
            return {
                success: true,
                recordings: recordings.map(recording => ({
                    sid: recording.sid,
                    duration: recording.duration,
                    dateCreated: recording.dateCreated,
                    uri: recording.uri
                }))
            };
        } catch (error) {
            logger.error('Error fetching recordings', {
                callSid: callSid,
                error: error.message
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Validate phone number format
     */
    validatePhoneNumber(phoneNumber) {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        return phoneRegex.test(phoneNumber.replace(/[\s-()]/g, ''));
    }
}

module.exports = TwilioService;
