#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Get directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$ROOT_DIR/.venv"

# Ensure we run from root directory
cd "$ROOT_DIR"


echo "============================================="
echo "   Supertonic v3 TTS Arayüz Başlatıcı       "
echo "============================================="

# 1. Virtual Environment Validation
if [ ! -d "$VENV_DIR" ]; then
    echo "HATA: .venv dizini bulunamadı!"
    echo "Lütfen önce proje ana dizininde 'uv sync' veya 'python3 -m venv .venv' çalıştırın."
    exit 1
fi

# 2. Dependency Check & Installation
echo "-> Python bağımlılıkları kontrol ediliyor..."
if "$VENV_DIR/bin/python" -c "import fastapi, uvicorn, websockets" >/dev/null 2>&1; then
    echo "-> Bağımlılıklar zaten yüklü."
else
    echo "-> Eksik bağımlılıklar yükleniyor..."
    if "$VENV_DIR/bin/python" -m pip --version >/dev/null 2>&1; then
        "$VENV_DIR/bin/python" -m pip install -r "$SCRIPT_DIR/requirements.txt"
    elif command -v uv >/dev/null 2>&1; then
        uv pip install --python "$VENV_DIR/bin/python" -r "$SCRIPT_DIR/requirements.txt"
    else
        echo "-> pip modülü bulunamadı, kurulmaya çalışılıyor..."
        "$VENV_DIR/bin/python" -m ensurepip --default-pip >/dev/null 2>&1 || true
        "$VENV_DIR/bin/python" -m pip install -r "$SCRIPT_DIR/requirements.txt"
    fi
    echo "-> Bağımlılıklar güncellendi."
fi

# 3. Port Check (8000)
PORT=8000
if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "UYARI: $PORT numaralı port zaten kullanımda!"
    fi
fi

# 4. Start Uvicorn Server
echo "-> FastAPI sunucusu başlatılıyor..."
echo "-> Arayüze erişmek için tarayıcınızdan: http://localhost:$PORT adresini açın."
echo "============================================="

# Add root folder to pythonpath and start uvicorn
export PYTHONPATH="$ROOT_DIR:$ROOT_DIR/src:$PYTHONPATH"
exec "$VENV_DIR/bin/python" -m uvicorn tts_interface.main:app --host 0.0.0.0 --port $PORT --reload
