#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==============================================================${NC}"
echo -e "${GREEN}    ACTUALIZANDO BIBI STORE A LA ÚLTIMA VERSIÓN EN TU VPS    ${NC}"
echo -e "${BLUE}==============================================================${NC}"

APP_DIR="/var/www/bibi-store"
REPO_URL="https://github.com/monetizacionreymonfr2-max/Bibi-Store.git"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo -e "${YELLOW}[1/3] Obteniendo la última versión desde GitHub...${NC}"
if [ -d ".git" ]; then
    git fetch --all
    git reset --hard origin/main || git pull origin main
else
    rm -rf /tmp/bibi-repo-temp
    git clone "$REPO_URL" /tmp/bibi-repo-temp
    cp -r /tmp/bibi-repo-temp/. "$APP_DIR/"
    rm -rf /tmp/bibi-repo-temp
fi

echo -e "${YELLOW}[2/3] Compilando la aplicación (Vite + React)...${NC}"
export NODE_OPTIONS="--max-old-space-size=768"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
    echo "Instalando dependencias necesarias..."
    npm install --no-audit --no-fund
fi

npm run build

echo -e "${YELLOW}[3/3] Recargando Nginx...${NC}"
systemctl reload nginx || systemctl restart nginx || true

echo -e "${GREEN}==============================================================${NC}"
echo -e "${GREEN}  ✓ ¡BIBI STORE ACTUALIZADO EXITOSAMENTE EN TU VPS!          ${NC}"
echo -e "${GREEN}  Abre en tu navegador: http://64.227.15.171                 ${NC}"
echo -e "${GREEN}==============================================================${NC}"
