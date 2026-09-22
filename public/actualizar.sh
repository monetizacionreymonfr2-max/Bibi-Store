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

# URLs de descarga
APP_URL="https://ais-pre-gblqqchksfkcg6b6rsqrxx-48346512190.us-east1.run.app"
DEV_URL="https://ais-dev-gblqqchksfkcg6b6rsqrxx-48346512190.us-east1.run.app"

echo -e "${YELLOW}[1/3] Descargando última versión de Bibi Store...${NC}"
mkdir -p /var/www/bibi-store/dist
rm -f /tmp/bibi-store-dist.tar.gz

if curl -fSL "${APP_URL}/bibi-store-dist.tar.gz" -o /tmp/bibi-store-dist.tar.gz; then
  echo "✓ Paquete descargado con éxito desde el servidor principal."
elif curl -fSL "${DEV_URL}/bibi-store-dist.tar.gz" -o /tmp/bibi-store-dist.tar.gz; then
  echo "✓ Paquete descargado desde servidor alternativo."
else
  echo -e "${RED}Error al descargar paquete de actualización.${NC}"
  exit 1
fi

echo -e "${YELLOW}[2/3] Instalando archivos en /var/www/bibi-store/dist...${NC}"
tar -xzf /tmp/bibi-store-dist.tar.gz -C /var/www/bibi-store/dist
rm -f /tmp/bibi-store-dist.tar.gz

echo -e "${YELLOW}[3/3] Recargando Nginx y servicios...${NC}"
systemctl reload nginx || systemctl restart nginx || true
systemctl restart bibi-backend || true

echo -e "${GREEN}==============================================================${NC}"
echo -e "${GREEN}  ✓ ¡BIBI STORE ACTUALIZADO CON ÉXITO EN TU VPS!            ${NC}"
echo -e "${GREEN}  Ya puedes abrir: http://64.227.15.171                      ${NC}"
echo -e "${GREEN}==============================================================${NC}"
