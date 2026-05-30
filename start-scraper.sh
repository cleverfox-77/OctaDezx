#!/bin/bash

echo "============================================"
echo "  OctaDezx Product Scraper - Quick Start"
echo "============================================"
echo ""

cd scraper || exit 1

echo "[1/3] Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found. Please install Python 3.8+"
    exit 1
fi
python3 --version

echo ""
echo "[2/3] Installing dependencies..."
pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "[3/3] Starting scraper service..."
echo ""
echo "Scraper API will be available at: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 product_scraper.py
