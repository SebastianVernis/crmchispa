#!/bin/bash

#=======
# SCRIPT DE DEPLOYMENT GENÉRICO PARA SSH/RSYNC (Adaptado)
#=======
# Uso:
# ./deploy-production.sh <usuario_ssh> <host_ssh> <ruta_remota_absoluta>
# Ejemplo:
# ./deploy-production.sh mi_usuario mi.servidor.com /var/www/mi_proyecto
#
# Este script tomará los valores por defecto si no se pasan argumentos,
# pero es recomendable pasarlos para flexibilidad.
#=======

set -e # Salir inmediatamente si un comando falla

#--- Sección de Configuración (Valores por defecto, pueden ser sobrescritos por argumentos)
DEFAULT_SSH_USER="a951193"
DEFAULT_SSH_HOST="access-5018020518.webspace-host.com"
DEFAULT_REMOTE_PATH="/home/a951193/crm-twilio" # Ruta absoluta en el servidor

SSH_PORT="22" # Puerto SSH, rara vez cambia
LOCAL_PATH="." # Directorio local del proyecto
APP_PORT="3001" # Puerto en el que corre la app Node.js en el servidor (informativo)

# Comando para iniciar la aplicación en el servidor (ejecutado desde la carpeta backend)
APP_START_COMMAND="node server.js"
# Patrón para encontrar el proceso de la aplicación y detenerlo/verificarlo
# Asegúrate que este patrón sea lo más específico posible para tu aplicación
# Ahora se busca 'node server.js' porque el CWD será la carpeta 'backend'
APP_PROCESS_NAME="node.*server.js" # Regex para pgrep/pkill

#--- Argumentos de Línea de Comandos
SSH_USER="${1:-$DEFAULT_SSH_USER}"
SSH_HOST="${2:-$DEFAULT_SSH_HOST}"
REMOTE_PATH="${3:-$DEFAULT_REMOTE_PATH}"

#--- Colores para la salida
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin Color

#--- Funciones para imprimir con colores
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

#--- Verificaciones Previas
print_status "Verificando archivos requeridos localmente..."
if [ ! -f ".env.production" ]; then
    print_error ".env.production no encontrado. Este archivo es crucial para la configuración del entorno de producción."
    print_error "Por favor, crea .env.production con las variables de entorno necesarias ANTES de desplegar."
    exit 1
fi
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Directorios 'backend' o 'frontend' no encontrados. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi
if ! command -v rsync &> /dev/null; then
    print_error "rsync no está instalado. Por favor, instálalo para continuar."
    exit 1
fi

#--- Inicio del Proceso de Deploy
echo ""
print_status "🚀 Iniciando deployment para ${SSH_USER}@${SSH_HOST}..."
print_status "Directorio remoto de destino: ${REMOTE_PATH}"
echo ""

# 1. Crear el paquete de deployment (directorio 'dist')
print_status "📦 Creando el paquete de deployment en '${LOCAL_PATH}/dist/'..."
rm -rf "${LOCAL_PATH}/dist/" # Limpiar directorio dist anterior
mkdir -p "${LOCAL_PATH}/dist/logs" # Crear logs dentro de dist para que se cree en el server
mkdir -p "${LOCAL_PATH}/dist/backend"
mkdir -p "${LOCAL_PATH}/dist/frontend"


# Copiar los directorios principales del backend y frontend
# Usar rsync para copiar localmente puede ser más eficiente si hay muchos archivos o para futuras exclusiones
rsync -av --exclude 'node_modules/' --exclude '.git/' --exclude 'dist/' "${LOCAL_PATH}/backend/" "${LOCAL_PATH}/dist/backend/"
rsync -av --exclude 'node_modules/' --exclude '.git/' --exclude 'dist/' "${LOCAL_PATH}/frontend/" "${LOCAL_PATH}/dist/frontend/"


# Copiar archivos de configuración importantes y otros archivos raíz
cp "${LOCAL_PATH}/backend/package.json" "${LOCAL_PATH}/dist/backend/"
cp "${LOCAL_PATH}/backend/package-lock.json" "${LOCAL_PATH}/dist/backend/" # Muy importante para 'npm ci'

# Renombrar .env.production a .env para el servidor
# Este .env debe estar en la raíz de dist, ya que server.js probablemente lo busca en ../.env desde backend/server.js
cp "${LOCAL_PATH}/.env.production" "${LOCAL_PATH}/dist/.env"
print_status "Archivo .env.production copiado como .env en el paquete."

# Copiar otros archivos si existen (ej. README, MANUAL_DE_USO)
cp "${LOCAL_PATH}/README.md" "${LOCAL_PATH}/dist/" 2>/dev/null || print_warning "README.md no encontrado, omitiendo."
cp "${LOCAL_PATH}/MANUAL_DE_USO.md" "${LOCAL_PATH}/dist/" 2>/dev/null || print_warning "MANUAL_DE_USO.md no encontrado, omitiendo."
# cp "${LOCAL_PATH}/config.php" "${LOCAL_PATH}/dist/" 2>/dev/null || true # Si aún los usas
# cp "${LOCAL_PATH}/status.php" "${LOCAL_PATH}/dist/" 2>/dev/null || true # Si aún los usas

print_status "Paquete de deployment creado con éxito."
echo ""

# 2. Subir archivos vía Rsync (más eficiente que SFTP para transferencias incrementales)
print_status "📤 Subiendo archivos al servidor vía rsync..."
# --delete borrará archivos en el destino que no estén en el origen (dist/)
# Esto asegura que el servidor remoto sea un espejo exacto de 'dist/'
rsync -avz -e "ssh -p ${SSH_PORT}" --delete --exclude '/logs/*' "${LOCAL_PATH}/dist/" "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/"
# Excluimos /logs/* de la sincronización con --delete para no borrar logs existentes en el servidor,
# pero la estructura de logs se crea si no existe porque dist/logs está.

print_status "Archivos subidos."
echo ""

# 3. Instalar dependencias y reiniciar la aplicación vía SSH
print_status "⚙️  Ejecutando comandos remotos (instalación de dependencias, reinicio de app)..."
# Usamos << 'ENDSSH' para evitar expansión de variables locales no deseadas dentro del bloque SSH
ssh -p "${SSH_PORT}" "${SSH_USER}@${SSH_HOST}" bash << ENDSSH
set -e # Salir si un comando falla dentro del script SSH

echo "[REMOTE] Cambiando al directorio de la aplicación: ${REMOTE_PATH}"
cd "${REMOTE_PATH}" # Todavía vamos a la raíz primero para crear logs

echo "[REMOTE] Asegurando que el directorio de logs exista en la raíz..."
mkdir -p logs # Asegurar que exista el directorio de logs en la raíz del proyecto

echo "[REMOTE] Cambiando al directorio del backend: ${REMOTE_PATH}/backend"
cd "${REMOTE_PATH}/backend"

echo "[REMOTE] Instalando dependencias de Node.js (npm ci --omit=dev) en ${REMOTE_PATH}/backend ..."
# 'npm ci' es mejor para producción: instala desde package-lock.json y es más rápido.
# '--omit=dev' (o NODE_ENV=production npm ci) para no instalar devDependencies.
# El .env se copia a la raíz de 'dist', por lo que server.js (en backend) lo buscará en '../.env'
NODE_ENV=production npm ci --omit=dev --legacy-peer-deps

echo "[REMOTE] Deteniendo cualquier proceso existente de la aplicación (buscando 'node.*server.js' en 'backend')..."
# Usar pkill con el patrón definido. '|| true' para no fallar si no hay procesos corriendo.
# El patrón APP_PROCESS_NAME necesita ser ajustado si el CWD del proceso cambia.
# Si ahora corremos desde backend/, el patrón podría ser más simple o necesitar cd para pgrep/pkill
# Por ahora, asumimos que el patrón original sigue siendo válido o se ajustará.
# Si APP_START_COMMAND ahora es 'node server.js' desde backend/, entonces APP_PROCESS_NAME debe ser "node.*server.js" y no "node.*backend/server.js"
# Vamos a ajustar APP_PROCESS_NAME y APP_START_COMMAND globalmente en el script.
pkill -f "node.*server.js" || true # Asumiendo que el proceso correrá como "node server.js" desde la carpeta backend
echo "[REMOTE] Procesos anteriores detenidos (si existían)."

echo "[REMOTE] Iniciando la aplicación en segundo plano con nohup desde ${REMOTE_PATH}/backend ..."
# nohup para que siga corriendo si se cierra la sesión SSH
# Redirigir stdout y stderr a un archivo de log en la raíz del proyecto. '&' para segundo plano.
nohup node server.js > "${REMOTE_PATH}/logs/app.log" 2>&1 &

echo "[REMOTE] Aplicación iniciada. Verificando estado en 5 segundos..."
sleep 5

# Verificar si la aplicación está corriendo
# Usar pgrep con el patrón definido
if pgrep -f "node.*server.js" > /dev/null; then # Ajustado para el nuevo patrón de proceso
    echo -e "${GREEN}[REMOTE] ✅ ¡Aplicación iniciada correctamente!${NC}"
    echo "[REMOTE] PID del proceso: \$(pgrep -f "node.*server.js")"
    # echo "[REMOTE] 🌐 URL de la aplicación (aproximada): http://<tu_dominio_o_IP>:${APP_PORT}"
else
    echo -e "${RED}[REMOTE] ❌ Fallo al iniciar la aplicación.${NC} Revisa los logs:"
    echo "[REMOTE] --- Últimas 20 líneas de ${REMOTE_PATH}/logs/app.log ---"
    tail -20 "${REMOTE_PATH}/logs/app.log"
    echo "[REMOTE] --- Fin de logs ---"
    exit 1 # Salir con error para que el script principal también falle
fi
ENDSSH

# Verificar el código de salida del bloque SSH
if [ $? -ne 0 ]; then
    print_error "Hubo un error durante la ejecución de comandos remotos. Revisa la salida."
    exit 1
fi

print_status "✅ Deployment completado con éxito."
print_warning "Verifica la aplicación visitando su URL y revisando los logs en el servidor si es necesario."
echo ""

# 4. Limpieza local
print_status "🧹 Limpiando directorio 'dist/' local..."
rm -rf "${LOCAL_PATH}/dist/"

echo ""
print_status "🎉 ¡Deployment finalizado!"
echo ""
