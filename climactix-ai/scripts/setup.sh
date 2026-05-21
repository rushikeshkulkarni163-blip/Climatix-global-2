#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Climactix AI Core v1 — One-Shot Setup Script
# Run this ONCE from the climactix-ai/ directory:
#   bash scripts/setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Climactix AI Core v1 — Setup${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# 1. Check Python
echo -e "${BOLD}[1/5] Checking Python version...${RESET}"
python3 --version
echo ""

# 2. Create virtual environment
echo -e "${BOLD}[2/5] Creating virtual environment (.venv)...${RESET}"
python3 -m venv .venv
echo -e "${GREEN}✓ .venv created${RESET}"
echo ""

# 3. Activate and upgrade pip
echo -e "${BOLD}[3/5] Activating .venv and upgrading pip...${RESET}"
source .venv/bin/activate
pip install --upgrade pip --quiet
echo -e "${GREEN}✓ pip upgraded${RESET}"
echo ""

# 4. Install dependencies
echo -e "${BOLD}[4/5] Installing dependencies from requirements.txt...${RESET}"
pip install -r requirements.txt
echo -e "${GREEN}✓ All packages installed${RESET}"
echo ""

# 5. Ensure directories exist
echo -e "${BOLD}[5/5] Creating runtime directories...${RESET}"
mkdir -p logs data
echo -e "${GREEN}✓ logs/ and data/ ready${RESET}"
echo ""

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  Setup complete.${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "Next steps:"
echo -e "  ${YELLOW}1. Add your OPENAI_API_KEY to .env${RESET}"
echo -e "  ${YELLOW}2. Activate venv:   source .venv/bin/activate${RESET}"
echo -e "  ${YELLOW}3. Start server:    uvicorn main:app --reload${RESET}"
echo -e "  ${YELLOW}4. Open docs:       http://localhost:8000/docs${RESET}"
echo ""
