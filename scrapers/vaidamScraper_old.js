const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Treatment Schema
const treatmentSchema = new mongoose.Schema({
  name: String,
  department: String,
  description: String,
  minPrice: Number,
  maxPrice: Number,
  currency: String,
  hospital: String,
  location: String,
  country: String,
  procedure: String,
  category: String,
  subcategory: String,
  duration: String,
  recovery: String,
  details: Object,
  lastUpdated: { type: Date, default: Date.now }
});

const Treatment = mongoose.model('Treatment', treatmentSchema);

// Hospital Schema
const hospitalSchema = new mongoose.Schema({
  name: String,
  location: String,
  city: String,
  country: String,
  specialties: [String],
  rating: Number,
  accreditation: [String],
  description: String,
  contact: Object,
  coordinates: {
    lat: Number,
    lng: Number
  },
  treatments: [String],
  lastUpdated: { type: Date, default: Date.now }
});

const Hospital = mongoose.model('Hospital', hospitalSchema);

class VaidamScraper {
  constructor() {
    this.baseUrl = 'https://www.vaidam.com';
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false, // Set to false to see what's happening
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({ width: 1366, height: 768 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Remove automation detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrapeMainCategories() {
    try {
      console.log('Scraping main treatment categories...');
      await this.page.goto(`${this.baseUrl}`, { waitUntil: 'networkidle2' });
      
      // Wait for page to load
      await this.page.waitForTimeout(3000);
      
      // Try multiple approaches to find categories
      const categories = await this.page.evaluate(() => {
        const results = [];
        
        // Look for specialty links in navigation or main page
        const specialtyLinks = document.querySelectorAll('a[href*="/treatments/"], a[href*="/specialty/"], a[href*="/procedure/"]');
        specialtyLinks.forEach(link => {
          const text = link.textContent.trim();
          const href = link.href;
          if (text && href && text.length > 2) {
            results.push({
              name: text,
              link: href,
              description: text
            });
          }
        });
        
        // Also look for category cards or specialty sections
        const categoryCards = document.querySelectorAll('[class*="specialty"], [class*="category"], [class*="treatment-type"]');
        categoryCards.forEach(card => {
          const link = card.querySelector('a') || card.closest('a');
          const name = card.textContent.trim();
          if (link && name && name.length > 2) {
            results.push({
              name: name,
              link: link.href,
              description: name
            });
          }
        });
        
        // Remove duplicates based on name
        const unique = results.filter((item, index, arr) => 
          arr.findIndex(i => i.name === item.name) === index
        );
        
        return unique.slice(0, 20); // Limit to 20 categories
      });

      console.log(`Found ${categories.length} main categories`);
      
      // If no categories found, try some common medical specialties manually
      if (categories.length === 0) {
        const commonSpecialties = [
          'cardiology',
          'oncology', 
          'orthopedics',
          'neurology',
          'gastroenterology',
          'urology',
          'dermatology',
          'plastic-surgery'
        ];
        
        return commonSpecialties.map(specialty => ({
          name: specialty.charAt(0).toUpperCase() + specialty.slice(1).replace('-', ' '),
          link: `${this.baseUrl}/treatments/${specialty}`,
          description: `${specialty.charAt(0).toUpperCase() + specialty.slice(1)} treatments`
        }));
      }
      
      return categories;
    } catch (error) {
      console.error('Error scraping main categories:', error);
      return [];
    }
  }

  async scrapeTreatmentsByCategory(categoryUrl) {
    try {
      console.log(`Scraping treatments from: ${categoryUrl}`);
      await this.page.goto(categoryUrl, { waitUntil: 'networkidle2' });
      
      // Wait for content to load
      await this.page.waitForTimeout(2000);

      const treatments = await this.page.evaluate(() => {
        const treatmentElements = document.querySelectorAll('.treatment-card, .procedure-card, .treatment-item');
        return Array.from(treatmentElements).map(element => {
          const nameElement = element.querySelector('h3, h4, .treatment-name, .procedure-name');
          const priceElement = element.querySelector('.price, .cost, .starting-price');
          const linkElement = element.querySelector('a') || element;
          const descElement = element.querySelector('.description, .details');
          const hospitalElement = element.querySelector('.hospital-name, .clinic-name');
          const locationElement = element.querySelector('.location, .city');

          // Extract price information
          let minPrice = 0, maxPrice = 0, currency = 'USD';
          if (priceElement) {
            const priceText = priceElement.textContent;
            const priceMatch = priceText.match(/(\$|₹|€|£)?\s*(\d+(?:,\d+)*)\s*-?\s*(\d+(?:,\d+)*)?/);
            if (priceMatch) {
              currency = priceMatch[1] === '₹' ? 'INR' : priceMatch[1] === '€' ? 'EUR' : priceMatch[1] === '£' ? 'GBP' : 'USD';
              minPrice = parseInt(priceMatch[2].replace(/,/g, ''));
              maxPrice = priceMatch[3] ? parseInt(priceMatch[3].replace(/,/g, '')) : minPrice;
            }
          }

          return {
            name: nameElement ? nameElement.textContent.trim() : '',
            description: descElement ? descElement.textContent.trim() : '',
            minPrice,
            maxPrice,
            currency,
            hospital: hospitalElement ? hospitalElement.textContent.trim() : '',
            location: locationElement ? locationElement.textContent.trim() : '',
            link: linkElement ? linkElement.href : ''
          };
        }).filter(treatment => treatment.name);
      });

      console.log(`Found ${treatments.length} treatments in this category`);
      return treatments;
    } catch (error) {
      console.error('Error scraping treatments:', error);
      return [];
    }
  }

  async scrapeTreatmentDetails(treatmentUrl) {
    try {
      await this.page.goto(treatmentUrl, { waitUntil: 'networkidle2' });
      
      const details = await this.page.evaluate(() => {
        const titleElement = document.querySelector('h1, .treatment-title, .procedure-title');
        const descElement = document.querySelector('.treatment-description, .overview, .about');
        const durationElement = document.querySelector('.duration, .treatment-duration');
        const recoveryElement = document.querySelector('.recovery, .recovery-time');
        const procedureElements = document.querySelectorAll('.procedure-step, .treatment-step');

        const procedureSteps = Array.from(procedureElements).map(step => step.textContent.trim());

        return {
          title: titleElement ? titleElement.textContent.trim() : '',
          fullDescription: descElement ? descElement.textContent.trim() : '',
          duration: durationElement ? durationElement.textContent.trim() : '',
          recovery: recoveryElement ? recoveryElement.textContent.trim() : '',
          procedureSteps: procedureSteps
        };
      });

      return details;
    } catch (error) {
      console.error('Error scraping treatment details:', error);
      return null;
    }
  }

  async scrapeHospitals() {
    try {
      console.log('Scraping hospitals...');
      
      // Try different hospital listing pages
      const hospitalPages = [
        `${this.baseUrl}/hospitals`,
        `${this.baseUrl}/hospitals/india`,
        `${this.baseUrl}/hospitals/bangalore`
      ];
      
      let allHospitals = [];
      
      for (const pageUrl of hospitalPages) {
        try {
          console.log(`Trying to scrape from: ${pageUrl}`);
          await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
          await this.page.waitForTimeout(3000);
          
          const hospitals = await this.page.evaluate(() => {
            const results = [];
            
            // Look for hospital cards - based on your screenshot
            const hospitalElements = document.querySelectorAll('[class*="hospital"], [class*="clinic"], .card, [class*="listing"]');
            
            hospitalElements.forEach(element => {
              try {
                // Extract hospital name
                const nameElement = element.querySelector('h1, h2, h3, h4, h5, [class*="name"], [class*="title"]');
                const name = nameElement ? nameElement.textContent.trim() : '';
                
                // Extract location
                const locationElement = element.querySelector('[class*="location"], [class*="address"], [class*="city"]');
                const location = locationElement ? locationElement.textContent.trim() : '';
                
                // Extract rating
                const ratingElement = element.querySelector('[class*="rating"], [class*="star"], [class*="score"]');
                let rating = 0;
                if (ratingElement) {
                  const ratingText = ratingElement.textContent;
                  const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                  rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
                }
                
                // Extract specialties
                const specialtyElements = element.querySelectorAll('[class*="specialty"], [class*="department"], [class*="service"]');
                const specialties = Array.from(specialtyElements).map(el => el.textContent.trim()).filter(text => text.length > 0);
                
                // Extract link
                const linkElement = element.querySelector('a') || element.closest('a');
                const link = linkElement ? linkElement.href : '';
                
                // Extract description
                const descElement = element.querySelector('[class*="description"], [class*="detail"], p');
                const description = descElement ? descElement.textContent.trim() : '';
                
                if (name && name.length > 2) {
                  results.push({
                    name: name,
                    location: location,
                    rating: rating,
                    specialties: specialties,
                    description: description,
                    link: link
                  });
                }
              } catch (err) {
                console.log('Error processing hospital element:', err.message);
              }
            });
            
            return results;
          });
          
          console.log(`Found ${hospitals.length} hospitals on ${pageUrl}`);
          allHospitals = allHospitals.concat(hospitals);
          
          if (hospitals.length > 0) {
            break; // If we found hospitals, no need to try other pages
          }
          
        } catch (error) {
          console.log(`Error scraping ${pageUrl}:`, error.message);
          continue;
        }
      }
      
      // Remove duplicates based on name
      const uniqueHospitals = allHospitals.filter((hospital, index, arr) => 
        arr.findIndex(h => h.name === hospital.name) === index
      );
      
      console.log(`Found ${uniqueHospitals.length} unique hospitals total`);
      return uniqueHospitals;
      
    } catch (error) {
      console.error('Error scraping hospitals:', error);
      return [];
    }
  }

  }
  }

  async scrapeHospitalsBySpecialty(specialty) {
    try {
      console.log(`Scraping hospitals for specialty: ${specialty}`);
      
      // Try different URL patterns for specialty-based hospital search
      const searchUrls = [
        `${this.baseUrl}/hospitals?specialty=${encodeURIComponent(specialty)}`,
        `${this.baseUrl}/hospitals/${specialty.toLowerCase().replace(/\s+/g, '-')}`,
        `${this.baseUrl}/search?q=${encodeURIComponent(specialty)}&type=hospitals`
      ];
      
      for (const url of searchUrls) {
        try {
          await this.page.goto(url, { waitUntil: 'networkidle2' });
          await this.page.waitForTimeout(2000);
          
          const hospitals = await this.page.evaluate(() => {
            const results = [];
            
            // Look for hospital listings in search results
            const hospitalCards = document.querySelectorAll('[class*="hospital"], [class*="result"], [class*="listing"], [class*="card"]');
            
            hospitalCards.forEach(card => {
              const nameEl = card.querySelector('h1, h2, h3, h4, [class*="name"], [class*="title"]');
              const locationEl = card.querySelector('[class*="location"], [class*="city"], [class*="address"]');
              const ratingEl = card.querySelector('[class*="rating"], [class*="star"]');
              const linkEl = card.querySelector('a') || card.closest('a');
              
              const name = nameEl ? nameEl.textContent.trim() : '';
              const location = locationEl ? locationEl.textContent.trim() : '';
              const link = linkEl ? linkEl.href : '';
              
              let rating = 0;
              if (ratingEl) {
                const ratingMatch = ratingEl.textContent.match(/(\d+\.?\d*)/);
                rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
              }
              
              if (name && name.length > 3) {
                results.push({
                  name,
                  location,
                  rating,
                  specialties: [specialty],
                  link,
                  category: specialty
                });
              }
            });
            
            return results;
          });
          
          if (hospitals.length > 0) {
            console.log(`Found ${hospitals.length} hospitals for ${specialty}`);
            return hospitals;
          }
          
        } catch (error) {
          console.log(`Error with URL ${url}:`, error.message);
          continue;
        }
      }
      
      return [];
    } catch (error) {
      console.error(`Error scraping hospitals for ${specialty}:`, error);
      return [];
    }
  }

  async saveTreatmentToDB(treatmentData, category) {
    try {
      const treatment = new Treatment({
        ...treatmentData,
        category: category,
        lastUpdated: new Date()
      });
      await treatment.save();
      console.log(`Saved treatment: ${treatmentData.name}`);
    } catch (error) {
      console.error('Error saving treatment:', error);
    }
  }

  async saveHospitalToDB(hospitalData) {
    try {
      const hospital = new Hospital({
        ...hospitalData,
        lastUpdated: new Date()
      });
      await hospital.save();
      console.log(`Saved hospital: ${hospitalData.name}`);
    } catch (error) {
      console.error('Error saving hospital:', error);
    }
  }

  async scrapeAll() {
    await connectDB();
    await this.init();

    try {
      // Scrape treatment categories
      const categories = await this.scrapeMainCategories();
      
      for (const category of categories.slice(0, 5)) { // Limit to first 5 categories for initial run
        console.log(`Processing category: ${category.name}`);
        
        const treatments = await this.scrapeTreatmentsByCategory(category.link);
        
        for (const treatment of treatments.slice(0, 10)) { // Limit treatments per category
          // Get detailed information if available
          if (treatment.link) {
            const details = await this.scrapeTreatmentDetails(treatment.link);
            if (details) {
              treatment.details = details;
              treatment.description = details.fullDescription || treatment.description;
              treatment.duration = details.duration;
              treatment.recovery = details.recovery;
            }
          }
          
          await this.saveTreatmentToDB(treatment, category.name);
          
          // Add delay to avoid being blocked
          await this.page.waitForTimeout(1000);
        }
      }

      // Scrape hospitals
      const hospitals = await this.scrapeHospitals();
      for (const hospital of hospitals.slice(0, 20)) { // Limit to first 20 hospitals
        await this.saveHospitalToDB(hospital);
        await this.page.waitForTimeout(500);
      }

    } catch (error) {
      console.error('Error in scrapeAll:', error);
    } finally {
      await this.close();
      mongoose.connection.close();
    }
  }
}

module.exports = VaidamScraper;

// If running directly
if (require.main === module) {
  require('dotenv').config({ path: '../.env' });
  const scraper = new VaidamScraper();
  scraper.scrapeAll()
    .then(() => {
      console.log('Scraping completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}
