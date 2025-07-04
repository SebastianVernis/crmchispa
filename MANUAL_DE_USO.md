# Manual de Usuario - Sistema CRM Avanzado v3.2.0

## Índice
1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
   - [Configuración Inicial (Primer Uso)](#configuración-inicial-primer-uso)
   - [Inicio de Sesión Regular](#inicio-de-sesión-regular)
3. [Interfaz Principal](#interfaz-principal)
   - [Navegación y Componentes Comunes](#navegación-y-componentes-comunes)
4. [Gestión de Usuarios (Solo Super Administrador)](#gestión-de-usuarios-solo-super-administrador)
   - [Acceder a la Gestión de Usuarios](#acceder-a-la-gestión-de-usuarios)
   - [Listar Usuarios](#listar-usuarios)
   - [Crear un Nuevo Usuario](#crear-un-nuevo-usuario)
   - [Editar un Usuario Existente](#editar-un-usuario-existente)
   - [Eliminar un Usuario](#eliminar-un-usuario)
5. [Gestión de Contactos (Administradores y Super Administradores)](#gestión-de-contactos-administradores-y-super-administradores)
   - [Ver Lista de Contactos](#ver-lista-de-contactos)
   - [Crear un Nuevo Contacto](#crear-un-nuevo-contacto)
   - [Buscar y Filtrar Contactos](#buscar-y-filtrar-contactos)
   - [Editar un Contacto](#editar-un-contacto)
   - [Eliminar un Contacto](#eliminar-un-contacto)
   - [Registrar Interacción con Contacto](#registrar-interacción-con-contacto)
   - [Exportar Contactos](#exportar-contactos)
6. [Gestión de Asesores (Administradores y Super Administradores)](#gestión-de-asesores-administradores-y-super-administradores)
   - [Ver Lista de Asesores](#ver-lista-de-asesores)
   - [Crear un Nuevo Asesor](#crear-un-nuevo-asesor)
   - [Editar un Asesor](#editar-un-asesor)
   - [Desactivar un Asesor](#desactivar-un-asesor)
   - [Ver Rendimiento y Carga de Trabajo](#ver-rendimiento-y-carga-de-trabajo)
   - [Asignar Contactos a un Asesor](#asignar-contactos-a-un-asesor)
7. [Funcionalidades para Asesores](#funcionalidades-para-asesores)
   - [Visualizar Contactos Asignados](#visualizar-contactos-asignados)
   - [Interactuar con Contactos (Llamadas/SMS - Potencial)](#interactuar-con-contactos-llamadasSMS-potencial)
8. [Configuración de API (Administradores y Super Administradores)](#configuración-de-api-administradores-y-super-administradores)
9. [Solución de Problemas Básicos](#solución-de-problemas-básicos)

---

## 1. Introducción

Bienvenido al Manual de Usuario del Sistema CRM Avanzado v3.2.0. Esta guía te ayudará a comprender y utilizar las funcionalidades clave de la aplicación, desde el acceso inicial y la configuración del superadministrador hasta la gestión diaria de usuarios, contactos y asesores.

Este sistema está diseñado para ser una herramienta robusta y segura para la administración de relaciones con clientes, con una arquitectura que permite futuras expansiones como integraciones con IA y servicios de comunicación.

---

## 2. Acceso al Sistema

### Configuración Inicial (Primer Uso)

Si estás accediendo a una instancia nueva del CRM (por ejemplo, después de una instalación limpia donde no existen usuarios):

1.  Abre la URL de la aplicación en tu navegador web.
2.  Se te presentará automáticamente una pantalla para **"Configurar Super Administrador"**.
    ![Pantalla de Setup de Superadmin](https://i.imgur.com/placeholder_setup.png) *(Nota: Reemplazar con una captura de pantalla real si es posible)*
3.  Ingresa el **nombre de usuario** deseado para la cuenta principal del sistema.
4.  Ingresa una **contraseña segura**. La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una minúscula y un número.
5.  **Confirma la contraseña**.
6.  Haz clic en el botón **"Crear Super Administrador"**.
7.  Si la creación es exitosa, verás un mensaje de confirmación y serás redirigido a la pantalla de inicio de sesión normal.

Esta cuenta de Super Administrador será la única que podrá gestionar otros administradores y la configuración crítica del sistema.

### Inicio de Sesión Regular

Una vez que el Super Administrador (o cualquier otro usuario) ha sido creado:

1.  Abre la URL de la aplicación en tu navegador.
2.  Verás la pantalla de **Inicio de Sesión**.
    ![Pantalla de Login](https://i.imgur.com/placeholder_login.png) *(Nota: Reemplazar con una captura de pantalla real si es posible)*
3.  Ingresa tu **Usuario** y **Contraseña**.
4.  Haz clic en **"Iniciar Sesión"**.

Si las credenciales son correctas, accederás al panel principal de la aplicación.

**Cerrar Sesión:** Para cerrar tu sesión, haz clic en el botón "Cerrar Sesión" <i class="fas fa-sign-out-alt"></i> ubicado en la parte superior derecha de la pantalla.

---

## 3. Interfaz Principal

Al iniciar sesión, verás el panel principal del CRM.

![Panel Principal](https://i.imgur.com/placeholder_dashboard.png) *(Nota: Reemplazar con una captura de pantalla real si es posible)*

### Navegación y Componentes Comunes
-   **Encabezado:** Muestra el nombre de la aplicación, tu nombre de usuario y rol. Aquí también encontrarás botones para:
    -   <i class="fas fa-users-cog"></i> **Gestionar Usuarios** (Visible solo para Super Administradores).
    -   <i class="fas fa-cogs"></i> **Configuración de API** (Visible para Administradores y Super Administradores).
    -   <i class="fas fa-sign-out-alt"></i> **Cerrar Sesión**.
-   **Dashboard Stats:** Tarjetas con estadísticas rápidas como total de contactos, contactados hoy, etc.
-   **Módulos:** Diferentes secciones de la aplicación como "Comunicación Estándar" (Gestión de Contactos), "Desglose por Estado", "Métricas de Rendimiento" y "Estado del Sistema". La visibilidad de algunos módulos dependerá de tu rol.

---

## 4. Gestión de Usuarios (Solo Super Administrador)

Esta sección solo es accesible para usuarios con el rol de **Super Administrador**.

### Acceder a la Gestión de Usuarios
1.  Haz clic en el botón "Gestionar Usuarios" <i class="fas fa-users-cog"></i> en el encabezado.
2.  Se mostrará el módulo de "Gestión de Usuarios".

### Listar Usuarios
Al acceder al módulo, verás una tabla con todos los usuarios del sistema, mostrando:
-   Username
-   Rol (admin, asesor)
-   Estado (Activo Sí/No)
-   ID de Asesor (si aplica)
-   Último Login
-   Acciones (Editar, Eliminar)

### Crear un Nuevo Usuario
1.  Haz clic en el botón **"<i class="fas fa-user-plus"></i> Agregar Nuevo Usuario"**.
2.  Se abrirá un formulario modal.
3.  Completa los campos:
    *   **Username:** Nombre de usuario único.
    *   **Password:** Contraseña segura (mínimo 8 caracteres, mayúscula, minúscula, número).
    *   **Rol:** Selecciona "Admin" o "Asesor". (No puedes crear otro Super Administrador desde aquí).
    *   **ID Asesor (Opcional):** Si el rol es "Asesor", puedes ingresar el ID numérico de un perfil de Asesor existente para vincularlos.
    *   **Activo:** Marca esta casilla para que el usuario pueda iniciar sesión.
4.  Haz clic en **"Guardar Usuario"**.
5.  Si es exitoso, el usuario aparecerá en la tabla.

### Editar un Usuario Existente
1.  En la tabla de usuarios, haz clic en el botón "Editar" <i class="fas fa-edit"></i> correspondiente al usuario que deseas modificar.
2.  El formulario modal se abrirá con los datos del usuario.
3.  Modifica los campos necesarios.
    *   Si dejas el campo de **Password en blanco**, la contraseña actual del usuario no se cambiará.
    *   No puedes cambiar el rol de un usuario a "superadmin" o quitarle el rol de "superadmin" a través de este formulario.
4.  Haz clic en **"Guardar Usuario"**.

### Eliminar un Usuario
1.  En la tabla de usuarios, haz clic en el botón "Eliminar" <i class="fas fa-trash"></i> correspondiente al usuario que deseas eliminar.
2.  Aparecerá un mensaje de confirmación. Haz clic en "OK" para confirmar.
3.  **Importante:**
    *   Un Super Administrador no puede eliminarse a sí mismo.
    *   No se puede eliminar al último Super Administrador del sistema.
    *   Si eliminas un usuario que está vinculado a un perfil de Asesor, los contactos asignados a ese asesor serán desvinculados (quedarán sin asesor asignado).
4.  Si la eliminación es exitosa, el usuario desaparecerá de la tabla.

---

## 5. Gestión de Contactos (Administradores y Super Administradores)

Los usuarios con rol Administrador o Super Administrador pueden gestionar los contactos.

### Ver Lista de Contactos
-   El módulo "Comunicación Estándar" muestra la tabla de contactos con información como Nombre, Teléfono, Email, Estado y Notas.

### Crear un Nuevo Contacto
1.  Haz clic en el botón **"<i class="fas fa-plus"></i> Nuevo Contacto"** (visible para roles autorizados).
2.  Completa el formulario con los detalles del contacto.
    *   El sistema realizará validaciones básicas (ej. formato de email, teléfono).
    *   (Potencial) Se podría realizar un análisis de IA para evaluar la calidad del contacto.
3.  Guarda el contacto.

### Buscar y Filtrar Contactos
-   **Buscar:** Utiliza el campo "Buscar contactos..." para encontrar contactos por nombre, teléfono o email.
-   **Filtrar por Estado:** Usa el menú desplegable "Todos los estados" para ver contactos según su estado actual (Pendiente, Contactado, etc.).

### Editar un Contacto
-   En la tabla de contactos, busca el contacto y haz clic en el botón "Editar" <i class="fas fa-edit"></i> en la columna "Acciones".
-   Modifica los datos necesarios y guarda los cambios.

### Eliminar un Contacto
-   (Si la funcionalidad de eliminar contactos está habilitada para tu rol) En la tabla de contactos, busca el contacto y haz clic en el botón "Eliminar" <i class="fas fa-trash"></i>. Confirma la acción.

### Registrar Interacción con Contacto
-   (Si la funcionalidad está habilitada) Podrás registrar interacciones (llamadas, SMS, reuniones) con un contacto, actualizando su estado y añadiendo notas.

### Exportar Contactos
-   (Si la funcionalidad está habilitada) Haz clic en el botón **"<i class="fas fa-download"></i> Exportar"** para descargar una lista de contactos (generalmente en formato JSON o CSV).

---

## 6. Gestión de Asesores (Administradores y Super Administradores)

Permite administrar los perfiles de los asesores que interactuarán con los contactos.

### Ver Lista de Asesores
-   (Si hay una sección dedicada) Podrás ver una lista de todos los asesores, su estado, y posiblemente métricas básicas.

### Crear un Nuevo Asesor
-   Completa el formulario con los detalles del asesor: nombre, email, teléfono (nuevo campo), departamento (nuevo campo), especialidades (nuevo campo), horas de trabajo (nuevo campo) y capacidad máxima de contactos.

### Editar un Asesor
-   Modifica los detalles de un asesor existente, incluyendo su estado (activo/inactivo) y puntaje de rendimiento.

### Desactivar un Asesor
-   En lugar de eliminar, los asesores se desactivan (soft delete) para mantener la integridad de los datos históricos. Un asesor inactivo no recibirá nuevos contactos.

### Ver Rendimiento y Carga de Trabajo
-   Secciones dedicadas (si están implementadas) pueden mostrar métricas sobre el rendimiento de los asesores y su carga de trabajo actual.

### Asignar Contactos a un Asesor
-   Permite asignar manualmente uno o varios contactos a un asesor específico, respetando su capacidad.

---

## 7. Funcionalidades para Asesores

Los usuarios con rol Asesor tienen una vista más enfocada:

### Visualizar Contactos Asignados
-   Principalmente verán y gestionarán los contactos que les han sido asignados.

### Interactuar con Contactos (Llamadas/SMS - Potencial)
-   La interfaz puede incluir botones para iniciar llamadas o enviar SMS directamente desde la ficha del contacto, utilizando la integración con Twilio (si está configurada y habilitada).

---

## 8. Configuración de API (Administradores y Super Administradores)

El botón "Configuración de API" <i class="fas fa-cogs"></i> en el encabezado abre un panel para gestionar:
-   Credenciales de Twilio (Account SID, Auth Token, Número de Teléfono).
-   Credenciales de Gemini AI (API Key, Endpoint URL).
-   Otras integraciones de IA que se puedan añadir.

**Importante:** Modificar estas configuraciones solo si sabes lo que estás haciendo, ya que afectan la capacidad del sistema para comunicarse con servicios externos.

---

## 9. Solución de Problemas Básicos

-   **No puedo iniciar sesión:**
    *   Verifica que tu usuario y contraseña sean correctos (sensible a mayúsculas/minúsculas).
    *   Si es el primer uso, asegúrate de haber completado el setup del Super Administrador si se te presentó esa pantalla.
    *   Contacta a tu Super Administrador si el problema persiste.
-   **No veo una funcionalidad que debería estar disponible:**
    *   Asegúrate de que tu rol de usuario (Asesor, Admin, Super Admin) tenga los permisos necesarios para esa funcionalidad.
    *   Algunas funcionalidades pueden depender de configuraciones de API (Twilio, Gemini) que deben estar correctamente ingresadas.
-   **Errores al guardar datos:**
    *   Revisa los mensajes de error que muestra la aplicación. Pueden indicar campos obligatorios que faltan o datos en formato incorrecto.
-   **La aplicación se ve extraña o no carga bien:**
    *   Intenta refrescar la página (Ctrl+R o Cmd+R).
    *   Limpia la caché de tu navegador.
    *   Asegúrate de tener una conexión a internet estable.

Si los problemas continúan, contacta al administrador del sistema o al equipo de soporte técnico proporcionando tantos detalles como sea posible sobre el error.

---
*Manual de Usuario v3.2.0*
*Última actualización: [Fecha Actual]*
