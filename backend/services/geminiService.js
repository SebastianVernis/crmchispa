const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { isValidPhoneNumber } = require('libphonenumber-js'); // Corregido: quitado parsePhoneNumber que no se usa aquí directamente
const validator = require('validator');

const SCORING_WEIGHTS = {
    VALID_PHONE: 30,
    VALID_EMAIL: 20,
    COMPLETE_NAME: 20,
    IS_COMPLETE: 20, // Asumo que esto es para la completitud general de campos requeridos
    OPTIONAL_FIELDS_BONUS: 10, // Bonus por campos opcionales llenos
    AI_SUSPICION_PENALTY: -20 // Penalización si IA lo marca como sospechoso
    // Podrías añadir más pesos aquí (ej. antiguedad del contacto, fuente, etc.)
};

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            logger.warn('Clave de API de Gemini no encontrada. El servicio de IA se ejecutará en modo demo.');
            this.demoMode = true;
            // No instanciamos genAI ni model si no hay API Key, para evitar errores.
        } else {
            try {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
                this.demoMode = false;
                logger.info('Servicio Gemini AI inicializado correctamente.');
            } catch (error) {
                logger.error('Error al inicializar Gemini AI. Se ejecutará en modo demo.', { error: error.message });
                this.demoMode = true;
            }
        }
    }

    /**
     * Valida si un nombre parece sospechoso basado en patrones.
     * @param {string} name - El nombre a validar.
     * @returns {boolean} - True si el nombre es sospechoso, false en caso contrario.
     */
    isSuspiciousName(name) {
        if (!name || typeof name !== 'string') return false; // Manejo de entrada inválida
        const suspiciousPatterns = [
            /^test/i,        // Empieza con "test"
            /^demo/i,        // Empieza con "demo"
            /^fake/i,        // Empieza con "fake"
            /^\d+$/,         // Solo números
            /(.)\1{2,}/,     // Tres o más caracteres idénticos repetidos consecutivamente (e.g., "aaa", "XXX")
            /asdf/i,         // Patrones comunes de teclado
            /qwerty/i,
            /^.{1,2}$/i,     // Nombres muy cortos (1 o 2 caracteres) podrían ser sospechosos en algunos contextos
            /^[a-z]+$/,      // Solo minúsculas (podría ser, dependiendo del caso de uso)
            /^[A-Z]+$/       // Solo mayúsculas (podría ser)
        ];
        return suspiciousPatterns.some(pattern => pattern.test(name.trim()));
    }

    /**
     * Analiza la calidad de un contacto individual.
     * @param {object} contact - El objeto de contacto con propiedades como phone, email, name.
     * @returns {Promise<object>} - Un objeto con qualityScore, issues, y recommendations.
     */
    async analyzeContact(contact) {
        const analysis = {
            qualityScore: 0,
            issues: [],
            recommendations: [],
            isSuspiciousByPattern: false,
            isSuspiciousByAI: false,
            aiAnalysisDetails: null
        };

        if (!contact) {
            analysis.issues.push('Objeto de contacto vacío o nulo.');
            return analysis;
        }

        // Validar número de teléfono
        // Usar isValidPhoneNumber de libphonenumber-js, asumiendo que 'contact.phone' ya está en un formato que la librería pueda entender (e.g., E.164 o nacional con código de país si es necesario)
        // La normalización a E.164 debería ocurrir antes de llamar a este servicio (ej. en el hook del modelo Contact)
        if (contact.phone && isValidPhoneNumber(contact.phone)) { // Asumimos que el hook del modelo ya normalizó y validó inicialmente. Aquí re-validamos.
            analysis.qualityScore += SCORING_WEIGHTS.VALID_PHONE;
        } else {
            analysis.issues.push(`Número de teléfono inválido o ausente: ${contact.phone || 'N/A'}`);
            analysis.recommendations.push('Verificar y corregir el número de teléfono. Asegurar formato internacional si es posible.');
        }

        // Validar email
        if (contact.email && validator.isEmail(contact.email)) {
            analysis.qualityScore += SCORING_WEIGHTS.VALID_EMAIL;
        } else if (contact.email) { // Si hay email pero no es válido
            analysis.issues.push(`Formato de email inválido: ${contact.email}`);
            analysis.recommendations.push('Corregir el formato del email o eliminarlo si es incorrecto.');
        } else {
            // No tener email no siempre es un "issue" crítico, pero podría no sumar puntos.
            // analysis.issues.push('Email ausente');
        }

        // Validar nombre completo
        if (contact.name && contact.name.trim().length >= 3 && contact.name.trim().includes(' ')) { // Un nombre completo usualmente tiene un espacio
            analysis.qualityScore += SCORING_WEIGHTS.COMPLETE_NAME;
        } else if (contact.name && contact.name.trim().length >= 3) {
            analysis.qualityScore += SCORING_WEIGHTS.COMPLETE_NAME / 2; // Medio puntaje si no parece tener apellido
            analysis.issues.push(`Nombre parece incompleto o muy corto: ${contact.name}`);
            analysis.recommendations.push('Asegurar que el nombre completo (nombre y apellido) esté registrado.');
        } else {
            analysis.issues.push(`Nombre ausente o demasiado corto: ${contact.name || 'N/A'}`);
            analysis.recommendations.push('Registrar el nombre completo del contacto.');
        }

        // Chequeo de completitud general (ej. nombre y teléfono son requeridos)
        if (contact.name && contact.name.trim().length > 0 && contact.phone && isValidPhoneNumber(contact.phone)) {
            analysis.qualityScore += SCORING_WEIGHTS.IS_COMPLETE;
        } else {
            analysis.issues.push('Información básica incompleta (nombre y/o teléfono).');
            analysis.recommendations.push('Completar todos los campos requeridos del contacto.');
        }

        // Bonus por campos opcionales (ejemplo: si 'address' o 'company' estuvieran definidos en SCORING_WEIGHTS)
        // if (contact.address) analysis.qualityScore += SCORING_WEIGHTS.OPTIONAL_FIELDS_BONUS;

        // Detección de nombre sospechoso por patrones
        if (contact.name && this.isSuspiciousName(contact.name)) {
            analysis.issues.push(`El nombre "${contact.name}" parece sospechoso según patrones.`);
            analysis.qualityScore += SCORING_WEIGHTS.AI_SUSPICION_PENALTY / 2; // Penalización parcial por patrones
            analysis.isSuspiciousByPattern = true;
            analysis.recommendations.push('Revisar la autenticidad del nombre del contacto.');
        }

        // Análisis con IA de Gemini (si no está en modo demo y hay API key)
        if (!this.demoMode && this.model) {
            try {
                const prompt = this.constructPromptForContactAnalysis(contact);
                const result = await this.model.generateContent(prompt);
                const responseText = result.response.text();
                
                // Intentar parsear la respuesta JSON de la IA
                let aiData = null;
                try {
                    // Extraer el JSON del texto, incluso si está rodeado de ```json ... ```
                    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
                    if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
                        aiData = JSON.parse(jsonMatch[1] || jsonMatch[2]);
                        analysis.aiAnalysisDetails = aiData;
                        logger.info('Análisis de IA recibido para contacto:', { contactId: contact.id, aiData });

                        if (aiData.is_suspicious || (aiData.suspicion_score && aiData.suspicion_score > 0.7)) {
                            analysis.isSuspiciousByAI = true;
                            analysis.issues.push(`IA marcó el contacto como sospechoso. Razón: ${aiData.suspicion_reason || 'Ver detalles de IA.'}`);
                            analysis.qualityScore += SCORING_WEIGHTS.AI_SUSPICION_PENALTY;
                            analysis.recommendations.push('El contacto ha sido marcado como potencialmente problemático por la IA. Se recomienda revisión manual.');
                        }
                        if (aiData.quality_issues && aiData.quality_issues.length > 0) {
                            analysis.issues.push(`IA identificó problemas de calidad: ${aiData.quality_issues.join(', ')}`);
                        }
                         if (aiData.recommendations && aiData.recommendations.length > 0) {
                            analysis.recommendations.push(`Sugerencias de IA: ${aiData.recommendations.join(', ')}`);
                        }
                    } else {
                        logger.warn('No se pudo extraer JSON de la respuesta de IA para contacto:', { contactId: contact.id, responseText });
                        analysis.issues.push('Respuesta de IA no pudo ser parseada como JSON.');
                    }
                } catch (parseError) {
                    logger.error('Error parseando JSON de la respuesta de IA para contacto:', { contactId: contact.id, error: parseError.message, responseText });
                    analysis.issues.push(`Error procesando respuesta de IA: ${parseError.message}`);
                }

            } catch (aiError) {
                logger.error('Error durante la llamada a la API de Gemini para análisis de contacto:', { contactId: contact.id, error: aiError.message });
                analysis.issues.push(`Fallo en el análisis de IA: ${aiError.message}`);
                // No penalizar si la IA falla, solo loguear.
            }
        } else if (this.demoMode) {
            analysis.issues.push('Servicio de IA en modo demo. No se realizó análisis con Gemini.');
            // Simular una posible respuesta de IA en modo demo si es útil para pruebas
            if (contact.name && contact.name.toLowerCase().includes("demo")) {
                analysis.isSuspiciousByAI = true; // Simulación
                analysis.issues.push('IA (demo) marcó el contacto como sospechoso.');
                analysis.qualityScore += SCORING_WEIGHTS.AI_SUSPICION_PENALTY;
            }
        }


        // Asegurar que el qualityScore esté entre 0 y 100
        analysis.qualityScore = Math.max(0, Math.min(100, Math.round(analysis.qualityScore)));

        logger.info(`Análisis de contacto finalizado para: ${contact.name || contact.id}`, { qualityScore: analysis.qualityScore, issuesCount: analysis.issues.length });
        return analysis;
    }

    /**
     * Construye el prompt para el análisis de calidad de contacto con Gemini.
     * @param {object} contact - El objeto de contacto.
     * @returns {string} - El prompt formateado.
     */
    constructPromptForContactAnalysis(contact) {
        // Adaptar el prompt para que sea más específico y pida un JSON bien definido
        return `
        Analiza la calidad y autenticidad de los siguientes datos de contacto. Responde EXCLUSIVAMENTE con un objeto JSON.
        No incluyas explicaciones adicionales fuera del JSON. El JSON debe tener la siguiente estructura:
        {
          "is_genuine_person": boolean, // ¿Parece ser una persona real?
          "is_suspicious": boolean, // ¿Hay alguna bandera roja o patrón sospechoso?
          "suspicion_score": float, // Puntuación de sospecha de 0.0 a 1.0 (1.0 es muy sospechoso)
          "suspicion_reason": string, // Breve explicación si es sospechoso (e.g., "Nombre parece falso", "Teléfono de prueba")
          "data_completeness_score": float, // Puntuación de completitud de datos de 0.0 a 1.0
          "data_accuracy_score": float, // Puntuación de precisión de datos de 0.0 a 1.0 (basado en formato y coherencia)
          "quality_issues": [string], // Lista de problemas de calidad específicos (e.g., "Email malformado", "Nombre muy corto")
          "recommendations": [string] // Lista de sugerencias para mejorar la calidad del contacto
        }

        Datos del Contacto:
        Nombre: ${contact.name || "No proporcionado"}
        Teléfono: ${contact.phone || "No proporcionado"}
        Email: ${contact.email || "No proporcionado"}
        Fuente: ${contact.source || "No proporcionada"}
        Notas Adicionales: ${contact.notes || "Ninguna"}

        Por favor, proporciona tu análisis en el formato JSON especificado arriba.
        `;
    }


    /**
     * Sugiere distribución de contactos entre asesores.
     * Esta es una implementación heurística y puede ser mejorada con IA en el futuro.
     * @param {Array<object>} contacts - Lista de contactos a distribuir.
     * @param {Array<object>} advisors - Lista de asesores disponibles.
     * @returns {Promise<object>} - Un objeto con las asignaciones y recomendaciones.
     */
    async suggestContactDistribution(contacts, advisors) {
        logger.info('Iniciando sugerencia de distribución de contactos.', { numContacts: contacts.length, numAdvisors: advisors.length });

        const assignments = [];
        const unassignedContacts = [];
        const distributionLog = []; // Para loguear decisiones

        if (!advisors || advisors.length === 0) {
            logger.warn('No hay asesores disponibles para la distribución.');
            return { assignments, unassignedContacts: contacts, log: ['No hay asesores activos para asignar.'] };
        }

        // Filtrar asesores activos y con capacidad
        const activeAdvisors = advisors.filter(a => a.isActive && (a.currentContactCount || 0) < (a.maxContacts || 50));

        if (activeAdvisors.length === 0) {
            logger.warn('No hay asesores activos con capacidad disponible.');
            return { assignments, unassignedContacts: contacts, log: ['Todos los asesores activos han alcanzado su capacidad máxima.'] };
        }

        // Ordenar contactos: mayor qualityScore primero, luego por fecha de creación (más nuevos primero)
        const sortedContacts = [...contacts].sort((a, b) => {
            const scoreDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        // Ordenar asesores: mayor performanceScore primero, luego menor carga actual
        const sortedAdvisors = [...activeAdvisors].sort((a, b) => {
            const performanceDiff = (b.performanceScore || 0) - (a.performanceScore || 0);
            if (performanceDiff !== 0) return performanceDiff;
            return (a.currentContactCount || 0) - (b.currentContactCount || 0);
        });

        // Crear un mapa para actualizar la cuenta de contactos de los asesores dinámicamente
        const advisorLoad = new Map(sortedAdvisors.map(a => [a.id, a.currentContactCount || 0]));
        const advisorMaxContacts = new Map(sortedAdvisors.map(a => [a.id, a.maxContacts || 50]));


        for (const contact of sortedContacts) {
            let assigned = false;
            // Intentar asignar al mejor asesor disponible que no haya alcanzado su límite
            // Iteramos sobre una copia ordenada de asesores para esta asignación particular
            const availableAdvisorsForContact = [...sortedAdvisors].sort((a,b) => {
                 // Priorizar asesores con menos carga actual para este contacto específico
                const loadA = advisorLoad.get(a.id);
                const loadB = advisorLoad.get(b.id);
                if (loadA !== loadB) return loadA - loadB;
                // Luego por performance
                return (b.performanceScore || 0) - (a.performanceScore || 0);
            });


            for (const advisor of availableAdvisorsForContact) {
                const currentAdvisorLoad = advisorLoad.get(advisor.id);
                const maxCap = advisorMaxContacts.get(advisor.id);

                if (currentAdvisorLoad < maxCap) {
                    assignments.push({ contactId: contact.id, advisorId: advisor.id, contactName: contact.name, advisorName: advisor.name });
                    advisorLoad.set(advisor.id, currentAdvisorLoad + 1); // Actualizar carga
                    distributionLog.push(`Contacto ${contact.id} (${contact.name}, QS:${contact.qualityScore}) asignado a Asesor ${advisor.id} (${advisor.name}, Perf:${advisor.performanceScore}, Carga:${currentAdvisorLoad + 1}/${maxCap})`);
                    assigned = true;
                    break; // Contacto asignado, pasar al siguiente contacto
                }
            }

            if (!assigned) {
                unassignedContacts.push(contact);
                distributionLog.push(`Contacto ${contact.id} (${contact.name}) no pudo ser asignado (todos los asesores llenos o no disponibles).`);
            }
        }
        
        if (unassignedContacts.length > 0) {
            logger.warn(`${unassignedContacts.length} contactos no pudieron ser asignados.`, { reason: "Capacidad de asesores alcanzada o falta de asesores."});
        }

        logger.info('Distribución de contactos sugerida finalizada.', { assignedCount: assignments.length, unassignedCount: unassignedContacts.length });
        return { assignments, unassignedContacts, log: distributionLog };
    }

    // Otros métodos del servicio (ej. análisis de sentimiento de notas, etc.) podrían ir aquí.
}

module.exports = GeminiService;
