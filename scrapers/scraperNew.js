const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
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

// Doctor Schema
const doctorSchema = new mongoose.Schema({
  name: String,
  specialization: String,
  hospital: String,
  location: String,
  experience: String,
  qualifications: String,
  profileLink: String,
  lastUpdated: { type: Date, default: Date.now }
});

const Doctor = mongoose.model('Doctor', doctorSchema);

class VaidamScraper {
  constructor() {
    this.baseUrl = 'https://www.vaidam.com';
    this.browser = null;
    this.page = null;
  }

  // Helper function to wait
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  async scrapeAllHospitalsWithPagination() {
    let allHospitals = [];
    let pageNum = 1;
    let hasMore = true;

    console.log('Starting to scrape all hospitals with pagination...');

    while (hasMore && pageNum <= 50) { // Limit to 50 pages for safety
      try {
        const url = `${this.baseUrl}/hospitals/india?page=${pageNum}`;
        console.log(`Scraping page ${pageNum}: ${url}`);
        
        await this.page.goto(url, { waitUntil: 'networkidle2' });
        await this.delay(2000);

        const hospitals = await this.page.evaluate(() => {
          const results = [];
          
          // Multiple selectors to find hospital cards
          const hospitalSelectors = [
            '.hospital-card',
            '.hospital-listing',
            '.listing-card',
            '[class*="hospital"]',
            '.card',
            '.result-item'
          ];
          
          let hospitalElements = [];
          for (const selector of hospitalSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              hospitalElements = Array.from(elements);
              break;
            }
          }

          hospitalElements.forEach(card => {
            try {
              // Extract name
              const nameSelectors = ['h1', 'h2', 'h3', 'h4', '.name', '.title', '.hospital-name'];
              let name = '';
              for (const selector of nameSelectors) {
                const nameEl = card.querySelector(selector);
                if (nameEl && nameEl.textContent.trim()) {
                  name = nameEl.textContent.trim();
                  break;
                }
              }

              // Extract location
              const locationSelectors = ['.location', '.city', '.address', '[class*="location"]'];
              let location = '';
              for (const selector of locationSelectors) {
                const locEl = card.querySelector(selector);
                if (locEl && locEl.textContent.trim()) {
                  location = locEl.textContent.trim();
                  break;
                }
              }

              // Extract rating
              const ratingEl = card.querySelector('[class*="rating"], [class*="star"], .score');
              let rating = 0;
              if (ratingEl) {
                const match = ratingEl.textContent.match(/(\d+\.?\d*)/);
                rating = match ? parseFloat(match[1]) : 0;
              }

              // Extract specialties
              const specialtyElements = card.querySelectorAll('[class*="specialty"], [class*="department"], .service');
              const specialties = Array.from(specialtyElements).map(el => el.textContent.trim()).filter(text => text.length > 0);

              // Extract link
              const linkEl = card.querySelector('a') || card.closest('a');
              const link = linkEl ? linkEl.href : '';

              // Extract description
              const descEl = card.querySelector('p, .description, .details');
              const description = descEl ? descEl.textContent.trim() : '';

              if (name && name.length > 2) {
                results.push({
                  name,
                  location,
                  rating,
                  specialties,
                  description,
                  link
                });
              }
            } catch (err) {
              console.log('Error processing hospital card:', err.message);
            }
          });

          return results;
        });

        console.log(`Found ${hospitals.length} hospitals on page ${pageNum}`);
        
        if (hospitals.length === 0) {
          hasMore = false;
        } else {
          allHospitals = allHospitals.concat(hospitals);
          pageNum++;
        }

        // Random delay to avoid being blocked
        await this.delay(Math.random() * 2000 + 1000);

      } catch (error) {
        console.error(`Error scraping page ${pageNum}:`, error.message);
        hasMore = false;
      }
    }

    // Remove duplicates based on name
    const uniqueHospitals = allHospitals.filter((hospital, idx, arr) =>
      arr.findIndex(h => h.name === hospital.name) === idx
    );

    console.log(`Total unique hospitals found: ${uniqueHospitals.length}`);
    return uniqueHospitals;
  }

  async scrapeDoctorsByHospital(hospitalUrl, hospitalName, hospitalLocation) {
    try {
      console.log(`Scraping doctors for: ${hospitalName}`);
      
      if (!hospitalUrl || hospitalUrl === '') {
        console.log(`No URL for ${hospitalName}, skipping doctor scraping`);
        return;
      }

      await this.page.goto(hospitalUrl, { waitUntil: 'networkidle2' });
      await this.delay(2000);

      // Try to find a doctors tab or section
      const doctorsTabFound = await this.page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, div'));
        const doctorTab = tabs.find(tab => 
          /doctor|physician|specialist|staff/i.test(tab.textContent)
        );
        if (doctorTab && doctorTab.click) {
          doctorTab.click();
          return true;
        }
        return false;
      });

      if (doctorsTabFound) {
        await this.delay(2000);
      }

      // Scrape doctors from current page
      let pageNum = 1;
      let hasMoreDoctors = true;

      while (hasMoreDoctors && pageNum <= 10) { // Limit to 10 pages per hospital
        const doctors = await this.page.evaluate(() => {
          const results = [];
          
          // Multiple selectors for doctor cards
          const doctorSelectors = [
            '.doctor-card',
            '.physician-card',
            '.doctor-listing',
            '[class*="doctor"]',
            '[class*="physician"]',
            '.staff-card'
          ];

          let doctorElements = [];
          for (const selector of doctorSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              doctorElements = Array.from(elements);
              break;
            }
          }

          doctorElements.forEach(card => {
            try {
              // Extract name
              const nameSelectors = ['h3', 'h4', 'h5', '.name', '.doctor-name', '.physician-name'];
              let name = '';
              for (const selector of nameSelectors) {
                const nameEl = card.querySelector(selector);
                if (nameEl && nameEl.textContent.trim()) {
                  name = nameEl.textContent.trim();
                  break;
                }
              }

              // Extract specialization
              const specSelectors = ['.specialty', '.specialization', '.department', '.field'];
              let specialization = '';
              for (const selector of specSelectors) {
                const specEl = card.querySelector(selector);
                if (specEl && specEl.textContent.trim()) {
                  specialization = specEl.textContent.trim();
                  break;
                }
              }

              // Extract experience
              const expEl = card.querySelector('.experience, [class*="exp"], .years');
              const experience = expEl ? expEl.textContent.trim() : '';

              // Extract qualifications
              const qualEl = card.querySelector('.qualification, .qualifications, .degree');
              const qualifications = qualEl ? qualEl.textContent.trim() : '';

              // Extract profile link
              const linkEl = card.querySelector('a') || card.closest('a');
              const profileLink = linkEl ? linkEl.href : '';

              if (name && name.length > 2) {
                results.push({
                  name,
                  specialization,
                  experience,
                  qualifications,
                  profileLink
                });
              }
            } catch (err) {
              console.log('Error processing doctor card:', err.message);
            }
          });

          return results;
        });

        if (doctors.length === 0) {
          hasMoreDoctors = false;
        } else {
          // Save doctors to database
          for (const doctor of doctors) {
            await this.saveDoctorToDB({
              ...doctor,
              hospital: hospitalName,
              location: hospitalLocation
            });
          }

          // Try to navigate to next page
          const nextPageFound = await this.page.evaluate(() => {
            const nextButton = document.querySelector('.next, [class*="next"], .pagination a[href*="page"]');
            if (nextButton && nextButton.click) {
              nextButton.click();
              return true;
            }
            return false;
          });

          if (!nextPageFound) {
            hasMoreDoctors = false;
          } else {
            await this.delay(2000);
            pageNum++;
          }
        }
      }

    } catch (error) {
      console.error(`Error scraping doctors for ${hospitalName}:`, error.message);
    }
  }

  async saveDoctorToDB(doctorData) {
    try {
      // Check if doctor already exists
      const existingDoctor = await Doctor.findOne({ 
        name: doctorData.name, 
        hospital: doctorData.hospital 
      });
      
      if (!existingDoctor) {
        const doctor = new Doctor({
          ...doctorData,
          lastUpdated: new Date()
        });
        await doctor.save();
        console.log(`Saved doctor: ${doctorData.name} (${doctorData.specialization})`);
      }
    } catch (error) {
      console.error('Error saving doctor:', error.message);
    }
  }

  async saveHospitalToDB(hospitalData) {
    try {
      // Check if hospital already exists
      const existingHospital = await Hospital.findOne({ name: hospitalData.name });
      
      if (!existingHospital) {
        const hospital = new Hospital({
          ...hospitalData,
          lastUpdated: new Date()
        });
        await hospital.save();
        console.log(`Saved hospital: ${hospitalData.name}`);
      }
    } catch (error) {
      console.error('Error saving hospital:', error.message);
    }
  }

  async scrapeMainCategories() {
    try {
      console.log('Scraping main treatment categories...');
      await this.page.goto(`${this.baseUrl}`, { waitUntil: 'networkidle2' });
      
      // Wait for page to load
      await this.delay(3000);
      
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
      await this.delay(2000);

      const treatments = await this.page.evaluate(() => {
        const results = [];
        
        // Look for treatment cards with various selectors
        const treatmentElements = document.querySelectorAll('[class*="treatment"], [class*="procedure"], [class*="card"], [class*="result"]');
        
        treatmentElements.forEach(element => {
          const nameElement = element.querySelector('h1, h2, h3, h4, h5, [class*="name"], [class*="title"]');
          const priceElement = element.querySelector('[class*="price"], [class*="cost"], [class*="starting"]');
          const linkElement = element.querySelector('a') || element.closest('a');
          const descElement = element.querySelector('[class*="description"], [class*="details"], p');
          const hospitalElement = element.querySelector('[class*="hospital"], [class*="clinic"]');
          const locationElement = element.querySelector('[class*="location"], [class*="city"]');

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

          const name = nameElement ? nameElement.textContent.trim() : '';
          if (name && name.length > 2) {
            results.push({
              name: name,
              description: descElement ? descElement.textContent.trim() : '',
              minPrice,
              maxPrice,
              currency,
              hospital: hospitalElement ? hospitalElement.textContent.trim() : '',
              location: locationElement ? locationElement.textContent.trim() : '',
              link: linkElement ? linkElement.href : ''
            });
          }
        });
        
        return results;
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

  async saveTreatmentToDB(treatmentData, category) {
    try {
      const existingTreatment = await Treatment.findOne({ 
        name: treatmentData.name, 
        hospital: treatmentData.hospital 
      });
      
      if (!existingTreatment) {
        const treatment = new Treatment({
          ...treatmentData,
          category: category,
          lastUpdated: new Date()
        });
        await treatment.save();
        console.log(`Saved treatment: ${treatmentData.name}`);
      }
    } catch (error) {
      console.error('Error saving treatment:', error);
    }
  }

  async scrapeAll() {
    await connectDB();
    await this.init();

    try {
      // Scrape all hospitals with pagination
      console.log('Starting comprehensive hospital scraping...');
      const hospitals = await this.scrapeAllHospitalsWithPagination();
      console.log(`Total hospitals scraped: ${hospitals.length}`);

      // Save hospitals and scrape their doctors
      for (const hospital of hospitals) {
        await this.saveHospitalToDB(hospital);
        
        // Scrape doctors for each hospital
        if (hospital.link) {
          await this.scrapeDoctorsByHospital(hospital.link, hospital.name, hospital.location);
        }
        
        // Add delay between hospitals to avoid being blocked
        await this.delay(1000);
      }

      // Optionally scrape treatments as well
      console.log('Starting treatment scraping...');
      const categories = await this.scrapeMainCategories();
      
      for (const category of categories.slice(0, 5)) { // Limit to first 5 categories
        console.log(`Processing category: ${category.name}`);
        const treatments = await this.scrapeTreatmentsByCategory(category.link);
        
        for (const treatment of treatments.slice(0, 10)) { // Limit treatments per category
          await this.saveTreatmentToDB(treatment, category.name);
          await this.delay(500);
        }
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