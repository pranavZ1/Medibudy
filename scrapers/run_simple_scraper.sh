#!/bin/bash

echo "=============================================="
echo "    Vaidam Website Complete Scraper Tool     "
echo "=============================================="
echo ""

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "❌ Error: .env file not found in parent directory"
    echo "Please create a .env file with your MONGODB_URI"
    exit 1
fi

echo "📋 Available scraping options:"
echo "1. 🐍 Python Scraper (Selenium + BeautifulSoup) - RECOMMENDED"
echo "2. 🔧 Node.js Scraper (Puppeteer + Cheerio)"
echo ""

read -p "Choose scraper (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "🐍 Running Python scraper..."
        echo "Installing Python dependencies..."
        
        # Install Python dependencies
        pip install -r requirements.txt
        
        echo ""
        echo "🚀 Starting complete Vaidam website scraping with Python..."
        echo "This will scrape ALL hospitals, doctors, and treatments"
        echo ""
        
        python3 vaidam_simple_scraper.py
        ;;
    2)
        echo ""
        echo "🔧 Running Node.js scraper..."
        echo "Installing Node.js dependencies..."
        
        # Install Node.js dependencies
        npm install
        
        echo ""
        echo "🚀 Starting complete Vaidam website scraping with Node.js..."
        echo "This will scrape ALL hospitals, doctors, and treatments"
        echo ""
        
        node vaidamScraper_enhanced.js
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and choose 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "✅ Scraping completed! Check the log files and CSV exports."
echo "📊 Data has been saved to your MongoDB database."
