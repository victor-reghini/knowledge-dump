#!/usr/bin/env bash
# ==============================================================================
# Knowledge Dump - Script de Inicialização Rápida no macOS / Docker
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}======================================================${RESET}"
echo -e "${BOLD}${CYAN}   Knowledge Dump - Inicializador macOS / Docker      ${RESET}"
echo -e "${BOLD}${CYAN}======================================================${RESET}\n"

# 1. Validação do Sistema Operacional
OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
  echo -e "🍏 Ambiente detectado: ${GREEN}macOS ($OS_NAME)${RESET}"
else
  echo -e "🐧 Ambiente detectado: ${GREEN}$OS_NAME${RESET}"
fi

# 2. Verificação do Docker Engine
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}❌ Docker não foi encontrado no PATH.${RESET}"
  echo -e "Por favor, instale o OrbStack (recomendado para macOS) ou Docker Desktop:"
  echo -e "  - OrbStack: https://orbstack.dev"
  echo -e "  - Docker Desktop: https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  O Docker daemon não está em execução.${RESET}"
  if [ "$OS_NAME" = "Darwin" ]; then
    if [ -d "/Applications/OrbStack.app" ]; then
      echo -e "Tentando iniciar OrbStack..."
      open -a OrbStack
    elif [ -d "/Applications/Docker.app" ]; then
      echo -e "Tentando iniciar Docker Desktop..."
      open -a Docker
    fi
    echo -e "Aguardando 10 segundos para inicialização do motor Docker..."
    sleep 10
  fi

  if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Não foi possível comunicar com o Docker. Inicie o daemon e tente novamente.${RESET}"
    exit 1
  fi
fi

echo -e "🐳 Motor Docker ativo: ${GREEN}$(docker --version)${RESET}"

# 3. Preparação do Volume Local e Permissões (Host)
DATA_DIR="$DIR/data"
REFS_DIR="$DATA_DIR/references"

mkdir -p "$DATA_DIR" "$REFS_DIR"
# Assegura permissões completas de leitura/escrita para container (compatível com OrbStack e VirtioFS)
chmod -R u+rwX,g+rwX,o+rX "$DATA_DIR" 2>/dev/null || true
echo -e "💾 Volume de dados local configurado em: ${GREEN}$DATA_DIR${RESET}"

# 4. Verificação de Conflito de Porta (3000)
PORT="${PORT:-3000}"
if lsof -i ":$PORT" >/dev/null 2>&1; then
  OCCUPYING_PID=$(lsof -ti ":$PORT" | head -n 1 || true)
  echo -e "${YELLOW}⚠️  A porta $PORT já está em uso pelo processo PID $OCCUPYING_PID.${RESET}"
  echo -e "Se você tem o servidor de desenvolvimento Vite rodando, finalize-o ou ajuste a variável PORT."
fi

# 5. Build e Subida do Container
echo -e "\n📦 Construindo e inicializando os serviços via Docker Compose..."
docker compose up -d --build

# 6. Aguardar Healthcheck da API
echo -e "⏳ Aguardando prontidão do Knowledge Dump (porta $PORT)..."
MAX_ATTEMPTS=30
ATTEMPT=0
HEALTH_OK=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ "$HEALTH_OK" = true ]; then
  echo -e "\n${BOLD}${GREEN}✅ Knowledge Dump está pronto e operacional!${RESET}"
  echo -e "🌐 Acesse: ${BOLD}${CYAN}http://localhost:$PORT${RESET}"
  echo -e "📱 Para instalar no macOS Dock: abra no Chrome/Brave/Safari e clique no ícone 'Instalar Aplicativo' na barra de URL."
  echo -e "📄 Para ver logs: ${BOLD}docker compose logs -f${RESET}"
  echo -e "🛑 Para parar: ${BOLD}docker compose down${RESET}\n"

  # Abre o navegador automaticamente
  if [ "$OS_NAME" = "Darwin" ]; then
    open "http://localhost:$PORT" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    xdg-open "http://localhost:$PORT" 2>/dev/null || true
  fi
else
  echo -e "\n${YELLOW}⚠️  O container iniciou, mas o endpoint /api/health ainda não respondeu.${RESET}"
  echo -e "Verifique os logs com: ${BOLD}docker compose logs${RESET}"
fi
