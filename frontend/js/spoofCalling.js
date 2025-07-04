// Spoof Calling Module
class SpoofCalling {
    constructor() {
        this.baseUrl = window.location.origin; // O la URL base de tu API si es diferente
        this.apiPrefix = '/api'; // Coincidir con el prefijo del backend
        this.activeSessions = new Map(); // Para rastrear sesiones activas y sus timeouts de polling
        this.elements = {}; // Objeto para cachear elementos del DOM
        this.init();
    }

    init() {
        this.createSpoofInterface(); // Crear la interfaz si no existe
        this.cacheDOMElements();    // Cachear elementos del DOM para acceso rápido
        this.bindEvents();          // Vincular eventos a los elementos
        console.info("SpoofCalling module initialized.");
    }

    cacheDOMElements() {
        this.elements.targetNumber = document.getElementById('spoofTargetNumber');
        this.elements.spoofCallerID = document.getElementById('spoofCallerID');
        this.elements.message = document.getElementById('spoofMessage'); // Asumiendo que tienes este campo
        this.elements.recordCall = document.getElementById('recordCall'); // Asumiendo
        this.elements.startCallBtn = document.getElementById('startSpoofCall');
        this.elements.sendSmsBtn = document.getElementById('sendSpoofSMS'); // Si tienes botón de SMS
        this.elements.sessionsContainer = document.getElementById('activeSessionsContainer');
        this.elements.voiceOptions = document.querySelectorAll('.voice-option'); // Si tienes opciones de voz
        // Cachear otros elementos que se usen repetidamente
    }

    createSpoofInterface() {
        // Verificar si la interfaz ya existe para no duplicarla
        if (document.getElementById('spoofControlsSection')) {
            console.warn("Spoof interface already exists. Skipping creation.");
            return;
        }

        const spoofSection = document.createElement('div');
        spoofSection.id = 'spoofControlsSection'; // ID para la sección principal
        spoofSection.className = 'module spoof-controls';
        // El HTML es similar al que ya tenías, pero usando this.elements para IDs
        spoofSection.innerHTML = `
            <h3><i class="fas fa-mask"></i> Controles de Spoof Calling</h3>
            <div class="spoof-form">
                <div>
                    <label for="spoofTargetNumber">Número de Destino:</label>
                    <input type="tel" id="spoofTargetNumber" placeholder="+1234567890" required>
                </div>
                <div>
                    <label for="spoofCallerID">Caller ID Falso (Origen):</label>
                    <input type="tel" id="spoofCallerID" placeholder="+0987654321" required>
                </div>
                <div>
                    <label for="spoofMessage">Mensaje Personalizado (Opcional):</label>
                    <input type="text" id="spoofMessage" placeholder="Conectando su llamada..." maxlength="500">
                </div>
                <div>
                    <label>
                        <input type="checkbox" id="recordCall"> Grabar Llamada
                    </label>
                    <!-- <label>
                        <input type="checkbox" id="useConference"> Usar Modo Conferencia (si aplica)
                    </label> -->
                </div>
            </div>
            
            <!-- Si tienes opciones de voz, mantenlas -->
            <div class="voice-options" style="margin-top:10px; margin-bottom:15px;">
                <div class="voice-option active" data-voice="alice">Alice (Mujer Pred.)</div>
                <div class="voice-option" data-voice="man">Hombre</div>
                <div class="voice-option" data-voice="woman">Mujer</div>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 12px;">
                <button id="startSpoofCall" class="btn-success">
                    <i class="fas fa-phone"></i> Iniciar Llamada Falsa
                </button>
                <button id="sendSpoofSMS" class="btn-secondary">
                    <i class="fas fa-sms"></i> Enviar SMS Falso
                </button>
            </div>
            
            <div id="activeSessionsContainer" style="margin-top:20px;"></div>
        `;

        const appContainer = document.querySelector('#app-container') || document.body; // Fallback a body
        // Insertar después de otros módulos si existen, o al final
        const existingModules = appContainer.querySelectorAll('.module');
        if (existingModules.length > 0) {
            existingModules[existingModules.length - 1].insertAdjacentElement('afterend', spoofSection);
        } else {
            appContainer.appendChild(spoofSection);
        }
    }

    bindEvents() {
        // Usar los elementos cacheados
        if (this.elements.startCallBtn) {
            this.elements.startCallBtn.addEventListener('click', () => this.startSpoofCall());
        }
        if (this.elements.sendSmsBtn) {
            this.elements.sendSmsBtn.addEventListener('click', () => this.sendSpoofSMS());
        }

        if (this.elements.voiceOptions && this.elements.voiceOptions.length > 0) {
            this.elements.voiceOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    this.elements.voiceOptions.forEach(opt => opt.classList.remove('active'));
                    e.target.classList.add('active');
                });
            });
        }

        // Delegación de eventos para botones de terminar llamada (si se generan dinámicamente)
        if (this.elements.sessionsContainer) {
            this.elements.sessionsContainer.addEventListener('click', (e) => {
                const endButton = e.target.closest('.btn-end-session'); // Clase para el botón de terminar
                if (endButton && endButton.dataset.sessionId) {
                    this.endSession(endButton.dataset.sessionId);
                }
            });
        }
    }

    async startSpoofCall() {
        // Validaciones y obtención de datos usando this.elements
        const targetNumber = this.elements.targetNumber ? this.elements.targetNumber.value.trim() : '';
        const spoofNumber = this.elements.spoofCallerID ? this.elements.spoofCallerID.value.trim() : '';
        const message = this.elements.message ? this.elements.message.value.trim() : '';
        const record = this.elements.recordCall ? this.elements.recordCall.checked : false;
        // const useConference = this.elements.useConference ? this.elements.useConference.checked : false; // Si lo usas
        const selectedVoiceElement = document.querySelector('.voice-option.active');
        const voice = selectedVoiceElement ? selectedVoiceElement.dataset.voice : 'alice';


        if (!targetNumber || !spoofNumber) {
            this.showToast('Por favor, ingrese número de destino y Caller ID falso.', 'error');
            return;
        }
        if (!this.validatePhoneNumber(targetNumber) || !this.validatePhoneNumber(spoofNumber)) {
            this.showToast('Por favor, ingrese números de teléfono válidos.', 'error');
            return;
        }

        const button = this.elements.startCallBtn;
        const originalText = button.innerHTML;
        button.innerHTML = '<div class="spinner"></div> Iniciando...';
        button.disabled = true;

        try {
            // La ruta ahora es /api/twilio/make-call según los cambios del backend
            const response = await fetch(`${this.baseUrl}${this.apiPrefix}/twilio/make-call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: targetNumber,
                    spoofNumber: spoofNumber, // El backend espera 'spoofNumber'
                    message: message || 'Conectando su llamada...',
                    record: record,
                    // useConference: useConference, // Enviar si el backend lo maneja
                    voiceModulation: { voice: voice, language: 'es-US' } // Ejemplo, ajustar si es necesario
                })
            });
            const result = await response.json();

            if (result.success && result.callSid) { // El backend ahora devuelve callSid
                this.showToast('Llamada falsa iniciada con éxito!', 'success');
                // Adaptar addActiveSession para usar callSid como sessionId o el que devuelva el backend
                this.addActiveSession({ ...result, sessionId: result.callSid, targetNumber, spoofNumber, status: 'initiated' });
                this.clearForm();
            } else {
                this.showToast(`Error: ${result.message || 'Fallo al iniciar la llamada.'}`, 'error');
            }
        } catch (error) {
            console.error('Error iniciando llamada falsa:', error);
            this.showToast('Error de red o del servidor al iniciar llamada.', 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async sendSpoofSMS() {
        const targetNumber = this.elements.targetNumber ? this.elements.targetNumber.value.trim() : '';
        const spoofNumber = this.elements.spoofCallerID ? this.elements.spoofCallerID.value.trim() : '';
        
        if (!targetNumber || !spoofNumber) {
            this.showToast('Ingrese número de destino y Caller ID falso para SMS.', 'error');
            return;
        }

        const smsBody = prompt('Ingrese el mensaje del SMS:');
        if (smsBody === null || smsBody.trim() === "") return; // Si cancela o no escribe nada

        const button = this.elements.sendSmsBtn;
        const originalText = button.innerHTML;
        button.innerHTML = '<div class="spinner"></div> Enviando...';
        button.disabled = true;

        try {
            // La ruta ahora es /api/twilio/send-sms
            const response = await fetch(`${this.baseUrl}${this.apiPrefix}/twilio/send-sms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: targetNumber,
                    body: smsBody,
                    from: spoofNumber // El backend espera 'from' para el origen del SMS
                })
            });
            const result = await response.json();

            if (result.success) {
                this.showToast('SMS falso enviado con éxito!', 'success');
            } else {
                this.showToast(`Error: ${result.message || 'Fallo al enviar SMS.'}`, 'error');
            }
        } catch (error) {
            console.error('Error enviando SMS falso:', error);
            this.showToast('Error de red o del servidor al enviar SMS.', 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    addActiveSession(sessionData) {
        // sessionData debe tener al menos sessionId, targetNumber, spoofNumber, status
        const sessionId = sessionData.sessionId || sessionData.callSid; // Usar callSid si es lo que viene del backend
        if (!sessionId) {
            console.error("No se pudo añadir sesión activa: falta sessionId.", sessionData);
            return;
        }
        // Limpiar cualquier timeout anterior para esta sesión si se está re-añadiendo o actualizando
        if (this.activeSessions.has(sessionId) && this.activeSessions.get(sessionId).timerId) {
            clearTimeout(this.activeSessions.get(sessionId).timerId);
        }
        this.activeSessions.set(sessionId, { ...sessionData, timerId: null }); // Inicializar timerId
        this.updateActiveSessionsDisplay();
        this.pollSessionStatus(sessionId); // Iniciar polling para esta nueva sesión
    }

    // Usar polling robusto con setTimeout recursivo
    pollSessionStatus(sessionId) {
        const session = this.activeSessions.get(sessionId);
        // Si la sesión ya no existe (ej. fue terminada manualmente), o ya está completada, no seguir polleando.
        if (!session || session.status === 'completed' || session.status === 'failed' || session.status === 'canceled') {
            if (session && session.timerId) clearTimeout(session.timerId); // Limpiar si existe
            this.activeSessions.delete(sessionId); // Asegurar que se elimina si está completada
            this.updateActiveSessionsDisplay();
            return;
        }

        const poll = async () => {
            // Verificar nuevamente si la sesión aún debe ser polleada antes de hacer el fetch
            const currentSessionState = this.activeSessions.get(sessionId);
            if (!currentSessionState || currentSessionState.status === 'completed' || currentSessionState.status === 'failed' || currentSessionState.status === 'canceled') {
                if (currentSessionState && currentSessionState.timerId) clearTimeout(currentSessionState.timerId);
                this.activeSessions.delete(sessionId);
                this.updateActiveSessionsDisplay();
                return;
            }

            try {
                // Ajustar la ruta de polling si es necesario, ej. /api/twilio/session/:sessionId
                const response = await fetch(`${this.baseUrl}${this.apiPrefix}/twilio/session/${sessionId}`); // Asumiendo que esta ruta existe y devuelve el estado
                if (!response.ok) {
                    // Si el servidor devuelve 404 (sesión no encontrada) o similar, tratar como terminada.
                    console.warn(`Polling para sesión ${sessionId} falló con status ${response.status}. Deteniendo polling.`);
                    if (currentSessionState.timerId) clearTimeout(currentSessionState.timerId);
                    this.activeSessions.delete(sessionId);
                    this.updateActiveSessionsDisplay();
                    return;
                }
                const result = await response.json();

                if (result.success && result.session) {
                    const updatedSession = { ...currentSessionState, ...result.session };
                    this.activeSessions.set(sessionId, updatedSession);
                    this.updateActiveSessionsDisplay();

                    // Si la llamada terminó, detener el polling para esta sesión
                    if (result.session.status === 'completed' || result.session.status === 'failed' || result.session.status === 'canceled') {
                        console.info(`Polling para sesión ${sessionId} detenido. Estado final: ${result.session.status}`);
                        if (updatedSession.timerId) clearTimeout(updatedSession.timerId); // Limpiar el timeout actual
                        // No eliminarla inmediatamente para que se muestre el estado final, se limpiará en el próximo ciclo o al terminar manualmente.
                        return;
                    }
                } else {
                    // Si result.success es false, o no hay result.session, puede ser un error recuperable o no.
                    console.warn(`Polling para ${sessionId} no exitoso o sin datos de sesión.`, result.message);
                }
            } catch (error) {
                console.error(`Error en polling para sesión ${sessionId}:`, error);
                // En caso de error de red, podríamos querer reintentar después de un backoff, o detener si son muchos errores.
                // Por ahora, simplemente logueamos y el siguiente timeout continuará el ciclo.
            }

            // Volver a llamar solo si la sesión sigue activa y en el mapa
            if (this.activeSessions.has(sessionId) && this.activeSessions.get(sessionId).status !== 'completed' && this.activeSessions.get(sessionId).status !== 'failed' && this.activeSessions.get(sessionId).status !== 'canceled') {
                 // Guardar el ID del timer para poder limpiarlo
                const timerId = setTimeout(poll, 5000); // Poll cada 5 segundos
                this.activeSessions.get(sessionId).timerId = timerId;
            } else {
                // Si llegó aquí y la sesión ya no debe pollearse, limpiar.
                const finalState = this.activeSessions.get(sessionId);
                if (finalState && finalState.timerId) clearTimeout(finalState.timerId);
                this.activeSessions.delete(sessionId); // Limpiar si ya no es necesaria
                this.updateActiveSessionsDisplay();
            }
        };
        poll(); // Iniciar el primer poll
    }


    updateActiveSessionsDisplay() {
        if (!this.elements.sessionsContainer) return;
        const container = this.elements.sessionsContainer;
        
        if (this.activeSessions.size === 0) {
            container.innerHTML = '<p style="color:#ccc; font-style:italic;">No hay sesiones de llamada activas.</p>';
            return;
        }

        let html = '<h4 style="color: white; margin-top: 20px;">Sesiones de Llamada Activas</h4>';
        this.activeSessions.forEach((session, sessionId) => {
            const shortSessionId = typeof sessionId === 'string' ? sessionId.substring(0, 8) : 'N/A';
            html += `
                <div class="call-session" data-session-id="${sessionId}" style="background-color: #333; padding: 10px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="session-info">
                        <div class="session-detail"><strong>ID:</strong> ${shortSessionId}...</div>
                        <div class="session-detail"><strong>Destino:</strong> ${session.targetNumber || 'N/A'}</div>
                        <div class="session-detail"><strong>Origen Falso:</strong> ${session.spoofNumber || 'N/A'}</div>
                        <div class="session-detail"><strong>Estado:</strong> <span class="status-${(session.status || 'unknown').toLowerCase()}">${session.status || 'Desconocido'}</span></div>
                    </div>
                    ${ (session.status !== 'completed' && session.status !== 'failed' && session.status !== 'canceled') ?
                    `<button class="btn-danger btn-end-session" data-session-id="${sessionId}">
                        <i class="fas fa-phone-slash"></i> Terminar
                    </button>` :
                    `<button class="btn-secondary btn-clear-session" data-session-id="${sessionId}" title="Limpiar de la lista">
                        <i class="fas fa-times"></i> Limpiar
                     </button>`
                    }
                </div>
            `;
        });
        container.innerHTML = html;

        // Añadir listener para botones de limpiar si no se usa delegación para ellos
        container.querySelectorAll('.btn-clear-session').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sId = e.currentTarget.dataset.sessionId;
                if (this.activeSessions.has(sId)) {
                    if (this.activeSessions.get(sId).timerId) {
                        clearTimeout(this.activeSessions.get(sId).timerId);
                    }
                    this.activeSessions.delete(sId);
                    this.updateActiveSessionsDisplay();
                }
            });
        });
    }

    async endSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session && session.timerId) {
            clearTimeout(session.timerId); // Limpiar el timeout de polling inmediatamente
            console.info(`Polling detenido para sesión ${sessionId} al intentar terminarla.`);
        }

        try {
            // La ruta para terminar la sesión, ej. /api/twilio/session/:sessionId/end
            const response = await fetch(`${this.baseUrl}${this.apiPrefix}/twilio/session/${sessionId}/end`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                this.showToast(`Sesión ${sessionId.substring(0,8)}... terminada.`, 'success');
            } else {
                this.showToast(`Error al terminar sesión: ${result.message || 'Respuesta no exitosa.'}`, 'error');
            }
        } catch (error) {
            console.error(`Error terminando sesión ${sessionId}:`, error);
            this.showToast('Error de red o del servidor al terminar sesión.', 'error');
        } finally {
            // Independientemente del resultado del backend, la quitamos de la lista activa y actualizamos UI
            this.activeSessions.delete(sessionId);
            this.updateActiveSessionsDisplay();
        }
    }

    validatePhoneNumber(phoneNumber) {
        if (!phoneNumber) return false;
        // Regex simple para validar números internacionales con +, o números locales. Ajustar según necesidad.
        const phoneRegex = /^\+?[1-9]\d{7,14}$/;
        return phoneRegex.test(phoneNumber.replace(/[\s-()]/g, ''));
    }

    clearForm() {
        if (this.elements.targetNumber) this.elements.targetNumber.value = '';
        if (this.elements.spoofCallerID) this.elements.spoofCallerID.value = '';
        if (this.elements.message) this.elements.message.value = '';
        if (this.elements.recordCall) this.elements.recordCall.checked = false;
        // if (this.elements.useConference) this.elements.useConference.checked = false;
    }

    showToast(message, type = 'info') { // Default a 'info'
        // Remover toasts existentes para evitar acumulación
        document.querySelectorAll('.toast-notification').forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`; // Usar clases más específicas
        toast.textContent = message;
        
        document.body.appendChild(toast);

        // Auto remover después de 3-5 segundos
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            toast.addEventListener('animationend', () => {
                 if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            });
        }, type === 'error' ? 5000 : 3000); // Errores duran más
    }
}

// Inicializar el módulo cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que solo se inicializa una vez
    if (!window.spoofCallingInstance) {
        window.spoofCallingInstance = new SpoofCalling();
    }
});

// Opcional: Exportar para sistemas de módulos si es necesario (ej. para pruebas)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpoofCalling;
}
