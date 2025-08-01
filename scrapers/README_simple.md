# Simple Vaidam Website Scraper

This is a simplified, efficient scraper for the complete Vaidam website using Selenium + BeautifulSoup. It's designed to be straightforward and effective for scraping ALL hospitals, doctors, and treatments.

## 🎯 What This Scraper Does

- **Hospitals**: Scrapes ALL 500+ hospitals from the website with complete details
- **Doctors**: Extracts doctor information for each hospital including specializations  
- **Treatments**: Collects treatment information across all categories
- **Database**: Saves everything directly to your MongoDB database

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up Environment**:
   Create a `.env` file in the parent directory with your MongoDB URI:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

3. **Run the Scraper**:
   ```bash
   ./run_simple_scraper.sh
   ```
   Or directly:
   ```bash
   python3 vaidam_simple_scraper.py
   ```

## 📊 What Gets Scraped

### Hospitals (500+ Expected)
- Name, location, city, state
- Address, phone, email, website
- Specialties, services, facilities
- Rating, establishment year, bed count
- Accreditations and awards

### Doctors (2000+ Expected)
- Name and specialization
- Experience and qualifications
- Consultation fees
- Hospital affiliation

### Treatments (1000+ Expected)
- Treatment names and categories
- Descriptions and pricing
- Hospital associations

## 💾 Data Storage

All data is automatically saved to:
- **MongoDB**: Your database collections (hospitals, doctors, treatments)
- **CSV Files**: Local backup files for easy viewing

## 🔧 How It Works

### Discovery Strategy
1. **Pagination**: Goes through all hospital listing pages
2. **Location Search**: Searches 100+ Indian cities and states
3. **Specialty Search**: Searches 50+ medical specialties

### Scraping Approach
- **Selenium**: Handles JavaScript and dynamic content
- **BeautifulSoup**: Parses HTML for data extraction
- **Smart Delays**: Avoids rate limiting with human-like behavior
- **Error Handling**: Continues even if individual pages fail

### Anti-Detection Features
- Random user agents
- Human-like scrolling and delays
- Stealth browser settings
- Retry logic for failed requests

## 📈 Performance

- **Speed**: Processes 1 hospital per 3-5 seconds
- **Memory**: Low memory usage compared to async versions
- **Reliability**: Robust error handling and recovery
- **Progress**: Real-time logging of scraping progress

## 🛠️ Technical Details

### Dependencies
- `selenium`: Web browser automation
- `beautifulsoup4`: HTML parsing
- `pymongo`: MongoDB database connection
- `pandas`: Data processing and CSV export
- `python-dotenv`: Environment variable management

### Browser Requirements
- Chrome browser installed
- ChromeDriver (automatically managed by selenium)

## 📝 Output Files

- `vaidam_hospitals_simple.csv`: All hospital data
- `vaidam_doctors_simple.csv`: All doctor data  
- `vaidam_treatments_simple.csv`: All treatment data
- `vaidam_simple_scraper.log`: Detailed scraping log

## 🔍 Monitoring Progress

The scraper provides real-time updates:
- Current hospital being processed
- Total progress (X/Y hospitals)
- Number of doctors found per hospital
- Periodic database saves
- Final statistics

## ⚡ Why This Approach?

**Simple & Effective**: Unlike complex async scrapers, this uses straightforward Selenium + BeautifulSoup for maximum compatibility.

**Complete Coverage**: Multiple discovery strategies ensure we get ALL hospitals (not just 50 like before).

**Direct Database Save**: No complex pipelines - data goes straight to your MongoDB.

**Easy to Debug**: Clear logging and step-by-step processing make issues easy to identify.

**Proven Libraries**: Uses well-established, stable libraries instead of cutting-edge async tools.

## 🎯 Expected Results

Based on the website structure, you should get:
- **500-600 hospitals** (vs your current 50)
- **2000-3000 doctors** with specializations
- **1000+ treatments** across all categories

## 🚨 Important Notes

1. **Browser Visibility**: The scraper runs with a visible browser window to ensure JavaScript loads properly
2. **Time Required**: Expect 2-3 hours for complete scraping (depending on internet speed)
3. **Rate Limiting**: Built-in delays prevent the scraper from being blocked
4. **Resume Capability**: Database saves are periodic, so you can resume if interrupted

## 🆘 Troubleshooting

**Chrome Issues**: Install latest Chrome browser
**Permission Errors**: Run with `sudo` if needed for ChromeDriver
**MongoDB Connection**: Verify your MONGODB_URI in .env file
**Timeout Errors**: Check your internet connection

This scraper is designed to be your reliable solution for getting complete Vaidam website data into your MongoDB database efficiently and simply.
