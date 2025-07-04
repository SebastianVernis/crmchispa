// Main Application JavaScript
class CRMApp {
    constructor() {
        if (typeof API_BASE_URL === 'undefined') {
            console.error("API_BASE_URL is not defined! Make sure config.js is loaded before app.js.");
            this.baseUrl = '/api'; // Fallback
        } else {
            this.baseUrl = API_BASE_URL;
        }
        this.currentUser = null;
        this.contacts = [];
        this.authToken = null;
        this.extraIA = []; // Property to hold extra AI configs
        this.init();
    }

    init() {
        this.setupSecurityFeatures();
        this.bindEvents();
        // this.checkExistingAuth(); // Moved to after checking setup status
        this.determineInitialView();
        this.startDashboardUpdates(); // This might need to be conditional based on login state
    }

    async determineInitialView() {
        try {
            // Ping the setup endpoint to see if it's available or if superadmin exists
            // We expect a 403 if superadmin already exists and setup is not allowed.
            // If it's any other status (e.g., 200 for a GET if we made one, or error if not found yet),
            // it implies setup might be needed or something else is wrong.
            // A more robust way would be a dedicated GET endpoint like /api/auth/setup-status

            // For now, let's assume if there's no token, we check setup.
            // If setup is needed, show setup form. Otherwise, show login form or app.
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                this.checkExistingAuth();
            } else {
                // Try to access the setup endpoint. If it fails with 403, superadmin exists.
                // Otherwise, assume setup is needed. This is a simplification.
                // A dedicated GET /api/auth/setup-status would be cleaner.
                const response = await fetch(`${this.baseUrl}/auth/setup-superadmin`, {
                    method: 'POST', // Send a dummy POST to trigger the checkSuperAdminSetupAllowed middleware
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: '', password: '' }) // Dummy data, will fail validation if setup allowed
                });

                if (response.status === 403) { // Superadmin exists, setup not allowed
                    document.getElementById('login-container').classList.remove('hidden');
                } else {
                    // Either setup is allowed (e.g. middleware passed and then validation failed on empty body),
                    // or another error occurred (e.g. server down, endpoint not found yet during dev).
                    // For simplicity, if not 403, try to show setup.
                    document.getElementById('setup-superadmin-container').classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error("Error determining initial view:", error);
            // Fallback to login or an error message if API is down
            document.getElementById('login-container').classList.remove('hidden');
            this.showToast("Could not connect to server to check setup status. Please try again later.", "error");
        }
    }


    setupSecurityFeatures() {
        // Anti-screenshot protection
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
                e.preventDefault();
                this.showSecurityWarning();
            }
            if (e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
                this.showSecurityWarning();
            }
        });

        // Disable right-click context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showSecurityWarning();
        });

        // Blur content when window loses focus (anti-screenshot)
        window.addEventListener('blur', () => document.body.classList.add('security-blur'));
        window.addEventListener('focus', () => document.body.classList.remove('security-blur'));

        // Detect developer tools
        const threshold = 160;
        setInterval(() => {
            const devtoolsOpen = (window.outerHeight - window.innerHeight > threshold) ||
                                 (window.outerWidth - window.innerWidth > threshold);
            if (devtoolsOpen && !document.body.classList.contains('security-blur')) {
                this.showSecurityWarning();
                document.body.classList.add('security-blur');
            }
        }, 500);
    }

    showSecurityWarning() {
        this.showToast('Security feature: This action is not allowed.', 'warning');
    }

    bindEvents() {
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            if (button.classList.contains('send-sms-btn')) this.sendSMS(button.dataset.contactId);
            if (button.classList.contains('call-btn')) this.makeCall(button.dataset.contactId);
            if (button.classList.contains('edit-btn')) this.editContact(button.dataset.contactId);
        });

        const searchInput = document.getElementById('search-contacts');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.filterContacts(e.target.value), 300);
            });
        }

        document.getElementById('status-filter')?.addEventListener('change', (e) => this.filterContactsByStatus(e.target.value));

        document.getElementById('open-api-config-btn')?.addEventListener('click', (e) => this._toggleApiConfigPanel(e));
        document.getElementById('api-config-form')?.addEventListener('submit', (e) => this._saveApiConfig(e));
        document.getElementById('add-ia-btn')?.addEventListener('click', () => this._addExtraIa());
        document.addEventListener('click', (e) => this._closeApiConfigPanelOnClickOutside(e));

        document.getElementById('setup-superadmin-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSuperAdminSetupSubmit();
        });

        this._bindUserManagementEvents(); // Call new method to bind user management specific events
    }

    async handleSuperAdminSetupSubmit() {
        const username = document.getElementById('setup-username').value;
        const password = document.getElementById('setup-password').value;
        const confirmPassword = document.getElementById('setup-confirm-password').value;
        const messageElement = document.getElementById('setup-message');
        messageElement.textContent = ''; // Clear previous messages

        if (!username || !password || !confirmPassword) {
            messageElement.textContent = 'Todos los campos son requeridos.';
            return;
        }
        if (password !== confirmPassword) {
            messageElement.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        // Adicional: validación de fortaleza de contraseña en el frontend (opcional, ya que el backend también valida)
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
            messageElement.textContent = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/setup-superadmin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showToast('Super Administrador creado exitosamente. Por favor, inicia sesión.', 'success');
                document.getElementById('setup-superadmin-container').classList.add('hidden');
                document.getElementById('login-container').classList.remove('hidden');
                document.getElementById('username').value = username; // Pre-fill username for convenience
                document.getElementById('password').focus();
            } else {
                messageElement.textContent = data.message || `Error: ${response.status}`;
            }
        } catch (error) {
            console.error('Super Admin Setup error:', error);
            messageElement.textContent = 'Error al conectar con el servidor. Inténtalo de nuevo más tarde.';
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showToast('Por favor, introduce usuario y contraseña', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (data.success && data.token) {
                localStorage.setItem('authToken', data.token);
                // Assuming the backend returns user info in data.user
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                this.currentUser = data.user;
                this.authToken = data.token;

                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');

                this.setupUserInterface();
                this.showToast(`¡Bienvenido ${data.user.username}!`, 'success');
                this.loadContacts(); // Load contacts after successful login
            } else {
                this.showToast(data.message || 'Credenciales inválidas o error en el servidor.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Falló el inicio de sesión. Verifica tu conexión o contacta al administrador.', 'error');
        }
    }

    async handleLogout() {
        // Optional: Inform the backend about logout, though JWT logout is primarily client-side
        if (this.authToken) {
            try {
                await fetch(`${this.baseUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });
            } catch (error) {
                console.warn('Error during server-side logout:', error);
                // Client-side logout should proceed regardless
            }
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        this.authToken = null;

        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        this.setupUserInterface();
        this.showToast('Sesión cerrada correctamente', 'success');
    }

    checkExistingAuth() {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('currentUser');
        if (storedToken && storedUser) {
            try {
                this.authToken = storedToken;
                this.currentUser = JSON.parse(storedUser);

                document.getElementById('setup-superadmin-container')?.classList.add('hidden');
                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');

                this.setupUserInterface();
                this.loadContacts();
            } catch (error) {
                console.error('Error parsing stored user data or token invalid:', error);
                // If token is invalid (e.g. backend restarted and JWT secret changed, or token tampered)
                // or user data is corrupted, logout and show login.
                this.handleLogout(); // This will show login-container
                // Potentially, we might need to re-run determineInitialView if logout doesn't handle it
                // but handleLogout should already make login-container visible.
                // To be safe, explicitly show login if setup isn't needed.
                if (!document.getElementById('setup-superadmin-container')?.classList.contains('hidden')) {
                    // This case should ideally not be hit if determineInitialView ran first
                    // and correctly decided setup is not needed.
                } else {
                     document.getElementById('login-container').classList.remove('hidden');
                }
            }
        }
    }

    setupUserInterface() {
        const userInfo = document.getElementById('user-info');
        const adminElements = document.querySelectorAll('.admin-only');
        const superAdminElements = document.querySelectorAll('.superadmin-only');

        if (this.currentUser && userInfo) {
            userInfo.textContent = `${this.currentUser.username} (${this.currentUser.role})`;
            const isAdmin = this.currentUser.role === 'admin';
            const isSuperAdmin = this.currentUser.role === 'superadmin';

            adminElements.forEach(el => el.classList.toggle('hidden', !(isAdmin || isSuperAdmin))); // Superadmin también es un tipo de admin
            superAdminElements.forEach(el => el.classList.toggle('hidden', !isSuperAdmin));

            // Si es superadmin y el módulo de gestión de usuarios existe, cargamos los usuarios
            if (isSuperAdmin && document.getElementById('user-management-module')) {
                this.loadUsers();
            }

        } else {
            if (userInfo) userInfo.textContent = '';
            adminElements.forEach(el => el.classList.add('hidden'));
            superAdminElements.forEach(el => el.classList.add('hidden'));
        }
    }

    // To be called from bindEvents
    _bindUserManagementEvents() {
        document.getElementById('open-user-management-btn')?.addEventListener('click', () => {
            document.getElementById('user-management-module')?.classList.toggle('hidden');
        });

        document.getElementById('add-new-user-btn')?.addEventListener('click', () => {
            this.openUserForm('add');
        });

        document.getElementById('user-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUserFormSubmit();
        });

        document.getElementById('user-form-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('user-form-modal').classList.add('hidden');
        });

        // Event delegation for edit/delete buttons in the users table
        document.getElementById('users-table')?.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const userId = target.dataset.userId;
            if (target.classList.contains('edit-user-btn')) {
                this.handleEditUser(userId);
            } else if (target.classList.contains('delete-user-btn')) {
                this.handleDeleteUser(userId);
            }
        });
        this.systemUsers = []; // Initialize property to store users
    }

    // Placeholder functions for user management - to be implemented
    async loadUsers() {
        this.showToast("Cargando lista de usuarios...", "info");
        try {
            const response = await fetch(`${this.baseUrl}/users`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.showToast('Sesión expirada o no autorizada para ver usuarios.', 'error');
                    this.handleLogout();
                    return;
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: No se pudieron cargar los usuarios`);
            }
            const data = await response.json();
            this.systemUsers = data.users || []; // Assuming backend sends { users: [...] }
            this.renderUsersTable();
            this.showToast(`Se cargaron ${this.systemUsers.length} usuarios.`, "success");

        } catch (error) {
            console.error("Error loading users:", error);
            this.showToast(`Error al cargar usuarios: ${error.message}`, "error");
            this.systemUsers = [];
            this.renderUsersTable();
        }
    }

    renderUsersTable() {
        const tbody = document.querySelector('#users-table tbody');
        if (!tbody) return;

        if (this.systemUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay usuarios para mostrar.</td></tr>';
            return;
        }

        tbody.innerHTML = this.systemUsers.map(user => `
            <tr class="fade-in" data-user-id="${user.id}">
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${user.isActive ? 'Sí' : 'No'}</td>
                <td>${user.advisorId || 'N/A'}</td>
                <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Nunca'}</td>
                <td class="contact-actions">
                    <button class="edit-user-btn btn-secondary btn-small" data-user-id="${user.id}" title="Editar Usuario"><i class="fas fa-edit"></i></button>
                    <button class="delete-user-btn btn-danger btn-small" data-user-id="${user.id}" title="Eliminar Usuario"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    openUserForm(mode = 'add', user = null) {
        // Clear previous messages
        const messageElement = document.getElementById('user-form-message');
        if(messageElement) messageElement.textContent = '';

        console.log("openUserForm called", mode, user);
        document.getElementById('user-form-modal').classList.remove('hidden');
        document.getElementById('user-form-title').textContent = mode === 'add' ? 'Agregar Nuevo Usuario' : 'Editar Usuario';
        // Reset form or populate with user data
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = '';
        if (mode === 'edit' && user) {
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-role').value = user.role;
            document.getElementById('user-isActive').checked = user.isActive;
            document.getElementById('user-advisorId').value = user.advisorId || '';
        }
    }

    async handleUserFormSubmit() {
        const userId = document.getElementById('user-id').value;
        const username = document.getElementById('user-username').value;
        const password = document.getElementById('user-password').value; // Puede estar vacío
        const role = document.getElementById('user-role').value;
        const isActive = document.getElementById('user-isActive').checked;
        const advisorIdInput = document.getElementById('user-advisorId').value;
        const advisorId = advisorIdInput.trim() === '' ? null : parseInt(advisorIdInput, 10);

        const messageElement = document.getElementById('user-form-message');
        messageElement.textContent = '';

        if (!username) {
            messageElement.textContent = 'El nombre de usuario es requerido.';
            return;
        }
        if (userId === '' && !password) { // Password es requerido para nuevos usuarios
            messageElement.textContent = 'La contraseña es requerida para nuevos usuarios.';
            return;
        }
        if (password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
             messageElement.textContent = 'Si se proporciona, la contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';
            return;
        }


        const userData = { username, role, isActive, advisorId };
        if (password) { // Solo incluir la contraseña si se proporcionó
            userData.password = password;
        }

        const method = userId ? 'PUT' : 'POST';
        const url = userId ? `${this.baseUrl}/users/${userId}` : `${this.baseUrl}/users`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showToast(`Usuario ${userId ? 'actualizado' : 'creado'} exitosamente.`, 'success');
                document.getElementById('user-form-modal').classList.add('hidden');
                this.loadUsers(); // Recargar la lista de usuarios
            } else {
                messageElement.textContent = data.message || (data.errors ? data.errors.map(e => e.msg).join(', ') : `Error: ${response.status}`);
            }
        } catch (error) {
            console.error("Error submitting user form:", error);
            messageElement.textContent = 'Error al conectar con el servidor.';
        }
    }

    handleEditUser(userId) {
        const userToEdit = this.systemUsers.find(u => u.id.toString() === userId);
        if (userToEdit) {
            this.openUserForm('edit', userToEdit);
        } else {
            this.showToast(`Usuario con ID ${userId} no encontrado.`, 'error');
        }
    }

    async handleDeleteUser(userId) {
        if (!confirm(`¿Estás seguro de que quieres eliminar al usuario con ID ${userId}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showToast('Usuario eliminado exitosamente.', 'success');
                this.loadUsers(); // Recargar la lista
            } else {
                this.showToast(data.message || `Error: ${response.status}`, 'error');
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            this.showToast('Error al conectar con el servidor para eliminar usuario.', 'error');
        }
    }


    _toggleApiConfigPanel(e) {
        e.stopPropagation();
        const panel = document.getElementById('api-config-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this._loadApiConfig();
        }
    }

    _closeApiConfigPanelOnClickOutside(e) {
        const panel = document.getElementById('api-config-panel');
        const button = document.getElementById('open-api-config-btn');
        if (panel && button && !panel.classList.contains('hidden') && !panel.contains(e.target) && !button.contains(e.target)) {
            panel.classList.add('hidden');
        }
    }

    async _loadApiConfig() {
        this.showToast('Cargando configuración...', 'success');
        // Mock API call
        setTimeout(() => {
            const mockConfig = {
                twilio: { sid: 'AC123...', token: 'tok_abc...', phone: '+15005550006' },
                gemini: { key: 'AIzaSy...', url: 'https://gemini.api.google.com' },
                extraIA: [{ name: 'OpenAI', apiUrl: 'https://api.openai.com/v1' }]
            };
            document.getElementById('twilio-sid').value = mockConfig.twilio?.sid || '';
            document.getElementById('twilio-token').value = mockConfig.twilio?.token || '';
            document.getElementById('twilio-phone').value = mockConfig.twilio?.phone || '';
            document.getElementById('gemini-api-key').value = mockConfig.gemini?.key || '';
            document.getElementById('gemini-url').value = mockConfig.gemini?.url || '';
            this.extraIA = mockConfig.extraIA || [];
            this._refreshExtraIaList();
        }, 500);
    }

    async _saveApiConfig(e) {
        e.preventDefault();
        // In a real app, this would send data to a server.
        this.showToast('¡Configuración guardada!', 'success');
        document.getElementById('api-config-panel').classList.add('hidden');
    }

    _addExtraIa() {
        this._showPromptModal('Agregar Nueva IA', [
            { id: 'ia-name', placeholder: 'Nombre de la IA', label: 'Nombre IA' },
            { id: 'ia-url', placeholder: 'URL del API o endpoint', label: 'URL del API' }
        ], (values) => {
            const name = values['ia-name'];
            const apiUrl = values['ia-url'];
            if (name && apiUrl) {
                this.extraIA.push({ name, apiUrl });
                this._refreshExtraIaList();
            }
        });
    }

    _refreshExtraIaList() {
        const listElement = document.getElementById('extra-ia-list');
        if (!listElement) return;
        listElement.innerHTML = this.extraIA.map((ia, index) =>
            `<div class="extra-ia-item">
                <span><strong>${ia.name}:</strong> ${ia.apiUrl}</span>
                <button type="button" class="btn-danger btn-small" onclick="crmApp._removeExtraIa(${index})"><i class="fas fa-trash"></i></button>
            </div>`
        ).join('');
    }

    _removeExtraIa(index) {
        this.extraIA.splice(index, 1);
        this._refreshExtraIaList();
    }

    _showPromptModal(title, fields, callback) {
        document.querySelector('.overlay')?.remove();
        const modal = document.createElement('div');
        modal.className = 'overlay';
        const fieldsHtml = fields.map(field => `
            <div style="margin-bottom: 10px;">
                <label for="${field.id}" style="display: block; margin-bottom: 5px;">${field.label}:</label>
                <input type="text" id="${field.id}" placeholder="${field.placeholder}">
            </div>
        `).join('');
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${title}</h3>
                ${fieldsHtml}
                <div class="modal-actions">
                    <button id="prompt-cancel-btn" class="btn-secondary">Cancelar</button>
                    <button id="prompt-save-btn" class="btn-success">Guardar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('prompt-save-btn').onclick = () => {
            const values = {};
            fields.forEach(field => values[field.id] = document.getElementById(field.id).value);
            callback(values);
            modal.remove();
        };
        document.getElementById('prompt-cancel-btn').onclick = () => modal.remove();
    }

    async loadContacts() {
        this.showToast('Cargando contactos...', 'info');
        try {
            const response = await fetch(`${this.baseUrl}/contacts`, { // baseUrl now includes /api
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.showToast('Sesión expirada o no autorizada. Por favor, inicia sesión de nuevo.', 'error');
                    this.handleLogout(); // Forzar logout
                    return; // Detener ejecución adicional
                }
                const errorData = await response.json().catch(() => ({ message: 'Error desconocido al procesar la respuesta.' }));
                throw new Error(errorData.message || `Error ${response.status}: No se pudieron cargar los contactos`);
            }

            const data = await response.json();
            this.contacts = data.contacts || []; // Asegurarse de que this.contacts sea un array
            this.renderContacts();
            this.updateDashboard();
            // No mostramos toast de éxito aquí para no ser muy ruidoso si se llama frecuentemente
            // this.showToast('Contactos cargados exitosamente.', 'success');
        } catch (error) {
            console.error('Error loading contacts:', error);
            // Evitar mostrar el toast si ya se manejó el logout por 401/403
            if (document.getElementById('login-container').classList.contains('hidden')) { // Solo mostrar si no estamos ya en login
                 this.showToast(`Error al cargar contactos: ${error.message}`, 'error');
            }
            this.contacts = []; // Limpiar contactos en caso de error grave
            this.renderContacts();
            this.updateDashboard(); // Reflejar que no hay contactos
        }
    }

    renderContacts(contactsToRender = this.contacts) {
        const tbody = document.querySelector('#contacts-table tbody');
        if (!tbody) return;
        tbody.innerHTML = contactsToRender.map(contact => `
            <tr class="fade-in">
                <td>${contact.name}</td>
                <td>${contact.phone}</td>
                <td>${contact.email}</td>
                <td><span class="status-badge status-${contact.status.replace(/ /g, '_')}">${contact.status.replace('_', ' ')}</span></td>
                <td>${contact.notes}</td>
                <td class="contact-actions">
                    <button class="call-btn btn-success" data-contact-id="${contact.id}" title="Llamar"><i class="fas fa-phone"></i></button>
                    <button class="send-sms-btn btn-secondary" data-contact-id="${contact.id}" title="Enviar SMS"><i class="fas fa-sms"></i></button>
                    <button class="edit-btn btn-secondary" data-contact-id="${contact.id}" title="Editar"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `).join('');
    }
    
    async makeCall(contactId) { this.showToast('Iniciando llamada (simulado)...', 'success'); }
    async sendSMS(contactId) { this.showToast('Enviando SMS (simulado)...', 'success'); }
    editContact(contactId) { this.showToast('Editando contacto (simulado)...', 'success'); }

    filterContacts(searchTerm) {
        const filtered = this.contacts.filter(contact => 
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.phone.includes(searchTerm) ||
            contact.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderContacts(filtered);
    }

    filterContactsByStatus(status) {
        if (status === 'all') {
            this.renderContacts();
        } else {
            const filtered = this.contacts.filter(contact => contact.status === status);
            this.renderContacts(filtered);
        }
    }

    updateDashboard() {
        const totalContacts = this.contacts.length;
        const statusCounts = this.contacts.reduce((acc, contact) => {
            acc[contact.status] = (acc[contact.status] || 0) + 1;
            return acc;
        }, {});

        document.getElementById('total-contacts').textContent = totalContacts;
        document.getElementById('contacted-today').textContent = statusCounts['Contactado'] || 0;
        document.getElementById('pending-followup').textContent = statusCounts['Requiere_Seguimiento'] || 0;

        const statusList = document.getElementById('status-breakdown');
        if (statusList) {
            statusList.innerHTML = Object.entries(statusCounts).map(([status, count]) => `
                <li><span>${status.replace('_', ' ')}</span><span>${count}</span></li>
            `).join('');
        }
    }
    
    startDashboardUpdates() {
        this.updateDashboard();
        setInterval(() => this.updateDashboard(), 30000);
    }

    showToast(message, type = 'success') {
        document.querySelectorAll('.toast').forEach(toast => toast.remove());
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.crmApp = new CRMApp();
});

