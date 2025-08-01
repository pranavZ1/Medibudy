#!/bin/bash

# Vaidam Comprehensive Scraper Runner
# This script helps you run either the Python or Node.js version of the scraper

echo "=== Vaidam Comprehensive Scraper ==="
echo ""

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "Error: .env file not found in parent directory"
    echo "Please create a .env file with your MongoDB URI and other environment variables"
    exit 1
fi

echo "Choose which scraper to run:"
echo "1. Python Scraper (Recommended - More robust)"
echo "2. Node.js Scraper (Enhanced version)"
echo "3. Install dependencies only"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "Running Python Scraper..."
        echo ""
        
        # Check if Python dependencies are installed
        if ! python3 -c "import aiohttp, beautifulsoup4, playwright, pymongo, motor, pandas" 2>/dev/null; then
            echo "Installing Python dependencies..."
            pip3 install -r requirements.txt
            echo ""
            echo "Installing Playwright browsers..."
            playwright install
            echo ""
        fi
        
        echo "Starting comprehensive scraping with Python..."
        python3 vaidam_comprehensive_scraper.py
        ;;
        
    2)
        echo "Running Node.js Scraper..."
        echo ""
        
        # Check if Node.js dependencies are installed
        if [ ! -d "node_modules" ]; then
            echo "Installing Node.js dependencies..."
            npm install puppeteer cheerio mongoose
            echo ""
        fi
        
        echo "Starting enhanced scraping with Node.js..."
        node vaidamScraper_enhanced.js
        ;;
        
    3)
        echo "Installing dependencies..."
        echo ""
        
        echo "Installing Python dependencies..."
        pip3 install -r requirements.txt
        playwright install
        echo ""
        
        echo "Installing Node.js dependencies..."
        npm install puppeteer cheerio mongoose
        echo ""
        
        echo "All dependencies installed successfully!"
        ;;
        
    *)
        echo "Invalid choice. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac

echo ""
echo "Script completed!"
