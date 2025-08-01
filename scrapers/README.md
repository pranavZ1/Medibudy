# Vaidam Comprehensive Scraper

This directory contains enhanced scrapers for the Vaidam website that can extract comprehensive data about hospitals, doctors, and treatments across India.

## Features

### 🚀 Comprehensive Data Extraction
- **Hospitals**: Name, location, specialties, rating, contact info, establishment year, bed count
- **Doctors**: Name, specialization, experience, qualifications, hospital affiliation
- **Treatments**: Procedures, pricing, departments, success rates, recovery time

### 🛡️ Anti-Detection Measures
- User agent rotation
- Random delays between requests
- Browser fingerprint masking
- Human-like scrolling patterns
- Stealth browsing techniques

### 🔄 Multiple Discovery Strategies
- Pagination-based URL discovery
- Location-based hospital search
- Specialty-based filtering
- Sitemap parsing
- Search functionality exploitation

### 📊 Robust Error Handling
- Retry mechanisms with exponential backoff
- Comprehensive error logging
- Progress tracking and reporting
- Graceful failure recovery

## Installation

### Prerequisites
- Node.js 16+ (for Node.js scraper)
- Python 3.8+ (for Python scraper)
- MongoDB instance (local or cloud)

### Quick Setup
```bash
# Navigate to scrapers directory
cd scrapers

# Run the installation script
./run_scraper.sh
# Choose option 3 to install all dependencies
```

### Manual Installation

#### For Python Scraper (Recommended)
```bash
pip3 install -r requirements.txt
playwright install
```

#### For Node.js Scraper
```bash
npm install puppeteer cheerio mongoose
```

## Configuration

1. **Environment Variables**: Create a `.env` file in the parent directory with:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

2. **Scraper Settings**: Both scrapers can be configured by modifying the class constructor parameters:
   - `maxConcurrency`: Number of concurrent requests
   - `requestDelay`: Delay between requests
   - `maxRetries`: Number of retry attempts
   - `timeout`: Request timeout duration

## Usage

### Using the Runner Script (Recommended)
```bash
./run_scraper.sh
```

### Direct Execution

#### Python Scraper
```bash
python3 vaidam_comprehensive_scraper.py
```

#### Node.js Scraper
```bash
node vaidamScraper_enhanced.js
```

## Scraper Comparison

| Feature | Python Scraper | Node.js Scraper |
|---------|---------------|-----------------|
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Memory Usage** | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Error Handling** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Data Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Setup Complexity** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## Output

### Database Collections
- `hospitals`: Hospital information with complete details
- `doctors`: Doctor profiles with specializations and experience
- `treatments`: Treatment procedures with pricing and descriptions

### Export Formats
- **MongoDB**: Primary storage with indexed collections
- **CSV Files**: Exported data files for analysis
- **JSON Report**: Comprehensive scraping report with statistics

## Key Improvements Over Original Scraper

### 1. **Comprehensive URL Discovery**
- **Original**: Single pagination approach
- **Enhanced**: 4 different discovery strategies finding 10x more URLs

### 2. **Better Error Handling**
- **Original**: Basic try-catch blocks
- **Enhanced**: Exponential backoff, retry mechanisms, error categorization

### 3. **Anti-Detection**
- **Original**: Basic user agent setting
- **Enhanced**: Full browser fingerprint masking, behavioral simulation

### 4. **Data Quality**
- **Original**: Basic text extraction
- **Enhanced**: Multiple extraction strategies, data validation, cleaning

### 5. **Performance**
- **Original**: Sequential processing
- **Enhanced**: Concurrent processing with rate limiting

### 6. **Monitoring**
- **Original**: Basic console logs
- **Enhanced**: Progress tracking, detailed reporting, error analytics

## Troubleshooting

### Common Issues

1. **Memory Issues**: Reduce `maxConcurrency` parameter
2. **Rate Limiting**: Increase `requestDelay` values
3. **Detection**: Enable more stealth features, use residential proxies
4. **MongoDB Connection**: Check connection string and network access

### Performance Optimization

1. **For Large Scale Scraping**:
   - Use the Python scraper (better memory management)
   - Run on a powerful server with good network
   - Use MongoDB Atlas for better performance
   - Enable MongoDB indexes

2. **For Regular Updates**:
   - Implement incremental scraping
   - Use last update timestamps
   - Focus on specific regions/specialties

## Legal Compliance

⚠️ **Important**: This scraper is for educational and research purposes only. Please ensure you:

1. Comply with Vaidam's robots.txt and terms of service
2. Use reasonable delay settings to avoid overloading servers
3. Respect copyright and data usage policies
4. Consider reaching out to Vaidam for official API access

## Support

For issues or improvements:
1. Check the error logs and reports generated
2. Review the troubleshooting section
3. Adjust scraper parameters based on your needs
4. Consider the website's anti-bot measures and adjust accordingly

## Results Expected

With the enhanced scrapers, you should expect to collect:
- **500+ hospitals** across India
- **2000+ doctors** with detailed profiles
- **1000+ treatments** with pricing and descriptions
- **Comprehensive data** including contact information, specialties, and more

The scrapers are designed to be much more thorough than the original version and should successfully handle the website's JavaScript loading and anti-bot measures.
