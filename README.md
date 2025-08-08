# Sistema CRM Avanzado con Gestión de Usuarios - v3.2.0

## Descripción General

Este es un sistema de Gestión de Relaciones con el Cliente (CRM) avanzado, diseñado para una gestión eficiente de contactos y asesores. Esta versión (3.2.0) introduce un robusto sistema de roles de usuario, incluyendo un Super Administrador, y mejoras significativas en seguridad, autenticación y la estructura general de la aplicación. El sistema está preparado para integraciones con IA (como Google Gemini) y servicios de comunicación (como Twilio), aunque el enfoque principal de esta versión ha sido la consolidación del núcleo y la gestión de usuarios.

## 🚀 Características Clave

### 👑 Gestión Jerárquica de Usuarios (Nuevo)
- **Roles Definidos:**
    -   **Super Administrador:** Control total del sistema, incluyendo la gestión de otros administradores y asesores. Creación inicial a través de una interfaz de setup.
    -   **Administrador:** Gestión de contactos, asesores y otras funciones administrativas.
    -   **Asesor:** Acceso limitado a sus contactos asignados y funcionalidades de comunicación.
- **Setup Inicial Seguro:** Interfaz para la creación del primer Super Administrador si el sistema es nuevo.
- **Panel de Gestión de Usuarios:** Interfaz dedicada para que el Super Administrador pueda crear, listar, editar y eliminar otros usuarios (administradores y asesores).

### 🧠 Preparado para Análisis Inteligente de Contactos
- **Validación de Datos:** Validación automática de números de teléfono (con `libphonenumber-js`) y correos electrónicos. Normalización de números de teléfono a formato E.164.
- **Potencial para Puntuación de Calidad:** El modelo de Contacto incluye campos para `qualityScore` y análisis de IA, sentando las bases para futuras integraciones.
- **Detección de Contactos Sospechosos (Potencial):** Estructura para la detección basada en patrones y análisis de IA.

### ♟️ Gestión Inteligente de Asesores (Potencial)
- **Distribución Automatizada de Contactos (Potencial):** Lógica preparada para asignación asistida por IA considerando el rendimiento del asesor, carga de trabajo y calidad del contacto.
- **Seguimiento de Rendimiento (Potencial):** El modelo de Asesor incluye `performanceScore`.

### 🗂️ Gestión Robusta de Datos
- **Modelos Sequelize (User, Contact, Advisor):** Campos enriquecidos, validaciones fuertes (ej. `isStrongPassword` para Usuario), hooks para hashing de contraseñas y normalización, e índices optimizados.
- **Operaciones Transaccionales:** Operaciones clave de base de datos (ej. eliminación de usuarios y reasignación de contactos) usan transacciones Sequelize para integridad de datos.
- **Carga Dinámica de Modelos:** `models/index.js` carga modelos dinámicamente.

### 📞 Preparado para Funciones de Comunicación Avanzadas (Twilio)
- **Sistema de Spoof Calling (Potencial):** Preparado para realizar llamadas con un Caller ID personalizado.
- **Integración SMS (Potencial):** Listo para enviar mensajes SMS.
- **Controlador y Rutas Twilio Dedicadas:** Lógica modularizada para futuras funcionalidades de Twilio.

### 🛡️ Seguridad y Fiabilidad Mejoradas
- **Autenticación Basada en JWT:** Flujo de login seguro con JSON Web Tokens.
- **Autorización Basada en Roles (RBAC):** Protección de rutas y funcionalidades según el rol del usuario (Super Administrador, Administrador, Asesor).
- **Helmet.js:** Configurado para cabeceras de seguridad, incluyendo una Política de Seguridad de Contenido (CSP) básica.
- **Cierre Controlado del Servidor (Graceful Shutdown):** Maneja conexiones activas y cierra recursos correctamente.
- **Manejo de Errores Mejorado:** Respuestas de API estandarizadas y logging detallado en servidor.
- **Configuración CORS:** Política CORS flexible configurable mediante variables de entorno.
- **Validación de Entradas:** `express-validator` usado en rutas para sanitizar y validar datos de las solicitudes.
- **Seguridad de Contrasñas:** `bcrypt` para hashing de contraseñas con rondas de sal configurables.
- **Rate Limiting:** Protección contra ataques de fuerza bruta (especialmente en login) y limitación general de tasa de solicitudes API.

### ⚙️ Rendimiento y Despliegue
- **Compresión de Respuestas:** Middleware `compression` habilitado.
- **Script de Despliegue Optimizado:** `deploy-production.sh` usa `rsync` y `npm ci`.
- **Logging Estructurado:** Logger Winston para seguimiento detallado de eventos.
- **Configuración de URL Base API en Frontend:** Archivo `config.js` para fácil gestión de la URL del backend.

## 🏗️ Arquitectura del Sistema

### Backend (Node.js/Express)
```
backend/
├── controllers/      # Manejadores de solicitudes (ej. twilioController.js)
├── middleware/       # Middlewares personalizados (ej. rateLimiter.js, lógica de auth en routes/auth.js)
├── models/           # Modelos de base de datos Sequelize (User, Contact, Advisor, index.js)
├── routes/           # Endpoints de la API (auth.js, contacts.js, advisors.js, users.js, twilio.js, ai.js)
├── services/         # Lógica de negocio (databaseService.js, geminiService.js, twilioService.js)
├── utils/            # Funciones de utilidad (ej. logger.js)
└── server.js         # Configuración principal del servidor Express, seguridad, manejo de errores
```

### Frontend (HTML/CSS/JavaScript Vainilla)
```
frontend/
├── css/
│   └── styles.css    # Estilos principales
├── js/
│   ├── app.js        # Lógica principal de la aplicación frontend
│   ├── config.js     # Configuración de la URL base de la API
│   └── spoofCalling.js # Funcionalidad específica (potencial)
└── index.html        # Estructura principal del frontend
```

## 🛠️ Instalación y Configuración

**Requisitos Previos:**

1.  **Node.js y npm**: Versión 18 o superior. (Instalar desde [nodejs.org](https://nodejs.org/)).
2.  **Git**: (Instalar desde [git-scm.com](https://git-scm.com/)).
3.  **Base de Datos MariaDB o MySQL**: Para desarrollo local o producción.
4.  **Claves API (Opcional, para funcionalidad completa):**
    *   Google Gemini AI.
    *   Twilio (Account SID, Auth Token, Número de Teléfono).

**Pasos de Instalación Local:**

1.  **Clonar el Repositorio**:
    ```bash
    git clone https://github.com/SebastianVernis/crmchispa.git 
    cd crmchispa
    ```

2.  **Configurar Variables de Entorno (Backend)**:
    *   Navega a la carpeta `backend/`.
    *   Copia `backend/.env.example` a `backend/.env`.
    *   Edita `backend/.env` con tu configuración local:
        ```env
        NODE_ENV=development
        PORT=3001
        API_PREFIX=/api
        CORS_ORIGIN=http://localhost:3001 # O el puerto donde sirvas el frontend si es separado en desarrollo

        JWT_SECRET=tu_secreto_jwt_muy_largo_y_seguro # ¡Cambia esto!
        BCRYPT_SALT_ROUNDS=12

        # Configuración de Base de Datos (ej. MySQL/MariaDB local)
        DB_HOST=localhost
        DB_PORT=3306
        DB_NAME=crm_dev_db
        DB_USER=crm_user
        DB_PASSWORD=tu_contraseña_de_bd
        DB_DIALECT=mysql # o mariadb

        # Rate Limiting (ejemplos, ajústalos según necesidad)
        RATE_LIMIT_WINDOW_MS=900000 # 15 minutos
        RATE_LIMIT_MAX_REQUESTS=100
        LOGIN_RATE_LIMIT_WINDOW_MS=900000 # 15 minutos
        LOGIN_RATE_LIMIT_MAX_REQUESTS=10

        # Twilio (opcional)
        TWILIO_ACCOUNT_SID=
        TWILIO_AUTH_TOKEN=
        TWILIO_PHONE_NUMBER=
        VOICE_WEBHOOK_URL=http://localhost:3001/api/twilio/webhook # Para pruebas locales con ngrok

        # Google Gemini AI (opcional)
        GEMINI_API_KEY=
        ```

3.  **Instalar Dependencias del Backend**:
    *   En la carpeta `backend/`:
        ```bash
        npm install
        ```

4.  **Iniciar el Servidor Backend**:
    *   En la carpeta `backend/`:
        ```bash
        npm run dev
        ```
    El backend estará corriendo (por defecto en `http://localhost:3001`).

5.  **Acceder al Frontend**:
    *   El backend Express sirve los archivos estáticos de la carpeta `frontend/`.
    *   Abre tu navegador y ve a `http://localhost:3001` (o el puerto que hayas configurado).

6.  **Configuración Inicial del Super Administrador**:
    *   Al acceder por primera vez (con una base de datos limpia), el frontend debería presentar una pantalla para crear el primer usuario Super Administrador. Sigue las instrucciones en pantalla.
    *   Si esta pantalla no aparece y ves el login normal, es posible que ya exista un superadministrador o que necesites limpiar la base de datos.

## 🚀 Despliegue a Producción

El script `deploy-production.sh` está diseñado para facilitar el despliegue a un servidor de producción.

**Requisitos en el Servidor de Producción:**
1.  Acceso SSH.
2.  Node.js (v18+) y npm.
3.  PM2 o un gestor de procesos similar (recomendado para mantener la aplicación corriendo). (El script actual usa PM2).
4.  Base de datos configurada y accesible para la aplicación.

**Pasos (resumido):**
1.  **Configurar `.env.production`**: En tu máquina local (en la raíz del proyecto), crea un archivo `.env.production` con todas las variables de entorno para producción (CORS_ORIGIN debe ser el dominio de tu frontend, URLs de webhook reales, credenciales de BD de producción, JWT_SECRET fuerte, etc.). Este archivo será copiado al servidor como `.env`.
2.  **Permisos al Script**: En tu máquina local, `chmod +x deploy-production.sh`.
3.  **Ejecutar Script**:
    ```bash
    ./deploy-production.sh tu_usuario_ssh@tu_servidor.com /ruta/remota/para/la_app
    ```
    (Reemplaza los placeholders con tus datos). El script se encargará de transferir los archivos, instalar dependencias de producción, configurar PM2 y reiniciar la aplicación.
4.  **Verificar**: Accede a tu aplicación en el dominio de producción. Revisa los logs en el servidor si es necesario (usualmente en `/ruta/remota/para/la_app/logs/`).

## 📊 Endpoints de la API (Ilustrativo)

Ruta base: `/api` (configurable mediante `API_PREFIX`)

### Autenticación (`/auth`)
-   `POST /setup-superadmin`: Creación del primer superadmin (solo si no existe).
-   `POST /login`: Inicio de sesión.
-   `POST /logout`: Cierre de sesión.
-   `GET /me`: Obtener información del usuario autenticado.

### Gestión de Usuarios (`/users` - Solo Superadmin)
-   `GET /`: Listar usuarios (con paginación).
-   `POST /`: Crear un nuevo usuario (admin o asesor).
-   `GET /:userId`: Obtener un usuario específico.
-   `PUT /:userId`: Actualizar un usuario.
-   `DELETE /:userId`: Eliminar un usuario.

### Gestión de Contactos (`/contacts` - Admin/Superadmin para modificar, todos autenticados para leer)
-   `POST /`: Crear contacto.
-   `GET /`: Listar contactos (preparado para filtros/paginación).
-   `GET /:contactId`: Obtener un contacto.
-   `PUT /:contactId`: Actualizar contacto.
-   `DELETE /:contactId`: Eliminar contacto.
-   `POST /:contactId/interaction`: Registrar interacción.
-   `POST /bulk`: Creación masiva.
-   `GET /search/:query`: Búsqueda (a optimizar).
-   `GET /stats/overview`: Estadísticas.
-   `GET /export/json`: Exportar.

### Gestión de Asesores (`/advisors` - Admin/Superadmin para modificar, todos autenticados para leer)
-   `POST /`: Crear asesor.
-   `GET /`: Listar asesores.
-   `GET /:advisorId`: Obtener asesor.
-   `PUT /:advisorId`: Actualizar asesor.
-   `DELETE /:advisorId`: Desactivar asesor (soft delete).
-   `GET /:advisorId/performance`: Métricas de rendimiento.
-   `GET /:advisorId/workload`: Carga de trabajo.
-   `POST /:advisorId/assign-contacts`: Asignar contactos.

### Otros (`/twilio`, `/ai`)
-   Rutas preparadas para funcionalidades de Twilio y análisis de IA.

## 🔒 Características de Seguridad Implementadas
-   Autenticación JWT.
-   Autorización basada en roles (Superadmin, Admin, Asesor).
-   Hashing de contraseñas con `bcrypt`.
-   Protección contra CSRF y XSS (básica con Helmet, considerar CSP más estricta).
-   Validación de entradas en API.
-   Rate limiting en endpoints sensibles y generales.
-   CORS configurado.
-   Manejo seguro de variables de entorno.

## 🧪 Pruebas
-   Se recomienda realizar pruebas manuales exhaustivas de la API con herramientas como Postman o Insomnia.
-   Probar todos los flujos de usuario en el frontend con los diferentes roles.
-   `supertest` está en `devDependencies` para futuras pruebas de integración automatizadas.

## 📝 Logging y Monitoreo
-   Logger Winston configurado para logs estructurados (ver `utils/logger.js`).
-   Logging de solicitudes y errores en `server.js`.
-   Logs de despliegue en la consola y logs de aplicación en el servidor (gestionados por PM2).

## 🤝 Contribuciones
Seguir un flujo estándar: fork, rama de característica, pruebas, y pull request. Asegurar que el código pase el linting (`npm run lint`) y formateo (`npm run format`).

## 📄 Licencia
Este proyecto está bajo la Licencia MIT.

## 🔮 Mejoras Futuras Anotadas
-   **Importación/Exportación de Datos desde/hacia Hojas de Cálculo.**
-   Implementación completa de paginación y búsqueda/filtrado del lado del servidor para Contactos y Asesores.
-   Optimización de recursos estáticos del frontend (minificación).
-   Revisión y activación completa de funcionalidades de Twilio y Gemini AI.
-   Capa de caché (ej. Redis) para endpoints de alto tráfico.
-   Pruebas automatizadas exhaustivas (unitarias, integración, E2E).
-   Política de Seguridad de Contenido (CSP) más estricta.

---
**Versión 3.2.0** - Funcionalidad de Super Administrador, RBAC y mejoras de seguridad.
```
