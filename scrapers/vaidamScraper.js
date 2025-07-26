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

// Doctor Schema
const doctorSchema = new mongoose.Schema({
  name: String,
  specialty: String,
  qualifications: [String],
  experience: String,
  hospital: String,
  location: String,
  city: String,
  country: String,
  rating: Number,
  consultationFee: Number,
  languages: [String],
  description: String,
  profileUrl: String,
  lastUpdated: { type: Date, default: Date.now }
});

const Doctor = mongoose.model('Doctor', doctorSchema);

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
      await new Promise(resolve => setTimeout(resolve, 3000));
      
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
      await new Promise(resolve => setTimeout(resolve, 2000));

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

  async scrapeHospitalsByCity(city) {
    try {
      console.log(`Scraping hospitals in ${city}...`);
      
      // Try different URL patterns for city-specific hospitals
      const cityUrls = [
        `${this.baseUrl}/hospitals/${city.toLowerCase()}`,
        `${this.baseUrl}/hospitals/india/${city.toLowerCase()}`,
        `${this.baseUrl}/search?location=${city}&type=hospitals`,
        `${this.baseUrl}/hospitals?city=${city}`,
        `${this.baseUrl}/${city.toLowerCase()}/hospitals`
      ];
      
      let hospitals = [];
      
      for (const url of cityUrls) {
        try {
          console.log(`Trying URL: ${url}`);
          await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const pageHospitals = await this.page.evaluate((currentCity) => {
            const results = [];
            
            // Look for hospital cards and listings
            const hospitalSelectors = [
              '.hospital-card',
              '.clinic-card', 
              '.listing-card',
              '[data-testid*="hospital"]',
              '[class*="hospital-item"]',
              '[class*="clinic-item"]',
              '.card',
              '.result-item'
            ];
            
            let hospitalElements = [];
            for (const selector of hospitalSelectors) {
              const elements = document.querySelectorAll(selector);
              hospitalElements = hospitalElements.concat(Array.from(elements));
            }
            
            // Remove duplicates
            hospitalElements = hospitalElements.filter((el, index, arr) => arr.indexOf(el) === index);
            
            hospitalElements.forEach(element => {
              try {
                // Extract hospital name with multiple approaches
                let name = '';
                const nameSelectors = [
                  'h1', 'h2', 'h3', 'h4', 'h5',
                  '.hospital-name', '.clinic-name',
                  '.name', '.title',
                  '[data-testid*="name"]',
                  '.listing-title'
                ];
                
                for (const selector of nameSelectors) {
                  const nameEl = element.querySelector(selector);
                  if (nameEl && nameEl.textContent.trim()) {
                    name = nameEl.textContent.trim();
                    break;
                  }
                }
                
                // Extract location with multiple approaches
                let location = '';
                const locationSelectors = [
                  '.location', '.address', '.city',
                  '[class*="location"]', '[class*="address"]',
                  '[data-testid*="location"]',
                  '.area', '.locality'
                ];
                
                for (const selector of locationSelectors) {
                  const locEl = element.querySelector(selector);
                  if (locEl && locEl.textContent.trim()) {
                    location = locEl.textContent.trim();
                    break;
                  }
                }
                
                // If no specific location found, use the current city
                if (!location) {
                  location = currentCity + ', India';
                }
                
                // Extract rating
                let rating = 0;
                const ratingSelectors = ['.rating', '.stars', '.score', '[class*="rating"]'];
                for (const selector of ratingSelectors) {
                  const ratingEl = element.querySelector(selector);
                  if (ratingEl) {
                    const ratingText = ratingEl.textContent;
                    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                    if (ratingMatch) {
                      rating = parseFloat(ratingMatch[1]);
                      break;
                    }
                  }
                }
                
                // Extract specialties
                const specialties = [];
                const specialtySelectors = [
                  '.specialty', '.specialization', '.department',
                  '[class*="specialty"]', '[class*="department"]'
                ];
                
                for (const selector of specialtySelectors) {
                  const specElements = element.querySelectorAll(selector);
                  specElements.forEach(el => {
                    const spec = el.textContent.trim();
                    if (spec && !specialties.includes(spec)) {
                      specialties.push(spec);
                    }
                  });
                }
                
                // Extract link
                let link = '';
                const linkEl = element.querySelector('a') || element.closest('a');
                if (linkEl) {
                  link = linkEl.href;
                }
                
                // Extract description
                let description = '';
                const descSelectors = ['.description', '.details', 'p', '.summary'];
                for (const selector of descSelectors) {
                  const descEl = element.querySelector(selector);
                  if (descEl && descEl.textContent.trim()) {
                    description = descEl.textContent.trim();
                    break;
                  }
                }
                
                // Only add if we have a valid hospital name
                if (name && name.length > 3 && 
                    !name.toLowerCase().includes('advertisement') &&
                    !name.toLowerCase().includes('sponsored') &&
                    name.match(/[a-zA-Z]/)) {
                  results.push({
                    name: name,
                    location: location,
                    city: currentCity,
                    country: 'India',
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
          }, city);
          
          console.log(`Found ${pageHospitals.length} hospitals on ${url}`);
          hospitals = hospitals.concat(pageHospitals);
          
          // If we found hospitals, continue to try more URLs for comprehensive data
          
        } catch (error) {
          console.log(`Error with URL ${url}:`, error.message);
          continue;
        }
      }
      
      // Remove duplicates based on name
      const uniqueHospitals = hospitals.filter((hospital, index, arr) => 
        arr.findIndex(h => h.name.toLowerCase() === hospital.name.toLowerCase()) === index
      );
      
      console.log(`Found ${uniqueHospitals.length} unique hospitals in ${city}`);
      return uniqueHospitals;
      
    } catch (error) {
      console.error(`Error scraping hospitals in ${city}:`, error);
      return [];
    }
  }

  async scrapeDoctorsByHospital(hospitalUrl, hospitalName, city) {
    try {
      console.log(`Scraping doctors from ${hospitalName}...`);
      
      if (!hospitalUrl) return [];
      
      await this.page.goto(hospitalUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const doctors = await this.page.evaluate((hName, hCity) => {
        const results = [];
        
        // Look for doctor listings
        const doctorSelectors = [
          '.doctor-card',
          '.physician-card',
          '.doctor-item',
          '.staff-member',
          '[class*="doctor"]',
          '[class*="physician"]',
          '.team-member'
        ];
        
        let doctorElements = [];
        for (const selector of doctorSelectors) {
          const elements = document.querySelectorAll(selector);
          doctorElements = doctorElements.concat(Array.from(elements));
        }
        
        doctorElements.forEach(element => {
          try {
            // Extract doctor name
            let name = '';
            const nameSelectors = ['h1', 'h2', 'h3', 'h4', '.name', '.doctor-name', '.title'];
            for (const selector of nameSelectors) {
              const nameEl = element.querySelector(selector);
              if (nameEl && nameEl.textContent.trim()) {
                name = nameEl.textContent.trim();
                break;
              }
            }
            
            // Extract specialty
            let specialty = '';
            const specSelectors = ['.specialty', '.specialization', '.department', '.field'];
            for (const selector of specSelectors) {
              const specEl = element.querySelector(selector);
              if (specEl && specEl.textContent.trim()) {
                specialty = specEl.textContent.trim();
                break;
              }
            }
            
            // Extract qualifications
            const qualifications = [];
            const qualSelectors = ['.qualification', '.degree', '.education'];
            for (const selector of qualSelectors) {
              const qualElements = element.querySelectorAll(selector);
              qualElements.forEach(el => {
                const qual = el.textContent.trim();
                if (qual && !qualifications.includes(qual)) {
                  qualifications.push(qual);
                }
              });
            }
            
            // Extract experience
            let experience = '';
            const expSelectors = ['.experience', '.years', '.exp'];
            for (const selector of expSelectors) {
              const expEl = element.querySelector(selector);
              if (expEl && expEl.textContent.trim()) {
                experience = expEl.textContent.trim();
                break;
              }
            }
            
            // Extract profile URL
            let profileUrl = '';
            const linkEl = element.querySelector('a') || element.closest('a');
            if (linkEl) {
              profileUrl = linkEl.href;
            }
            
            if (name && name.length > 2) {
              results.push({
                name: name,
                specialty: specialty,
                qualifications: qualifications,
                experience: experience,
                hospital: hName,
                location: hCity + ', India',
                city: hCity,
                country: 'India',
                profileUrl: profileUrl
              });
            }
          } catch (err) {
            console.log('Error processing doctor element:', err.message);
          }
        });
        
        return results;
      }, hospitalName, city);
      
      console.log(`Found ${doctors.length} doctors at ${hospitalName}`);
      return doctors;
      
    } catch (error) {
      console.error(`Error scraping doctors from ${hospitalName}:`, error);
      return [];
    }
  }

  async saveDoctorToDB(doctorData) {
    try {
      const doctor = new Doctor({
        ...doctorData,
        lastUpdated: new Date()
      });
      await doctor.save();
      console.log(`Saved doctor: ${doctorData.name}`);
    } catch (error) {
      console.error('Error saving doctor:', error);
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
          await new Promise(resolve => setTimeout(resolve, 3000));
          
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
      const existingTreatment = await Treatment.findOne({ name: treatmentData.name });
      
      if (!existingTreatment) {
        const treatment = new Treatment({
          ...treatmentData,
          category: category,
          lastUpdated: new Date()
        });
        await treatment.save();
        console.log(`✓ Saved treatment: ${treatmentData.name}`);
      } else {
        console.log(`- Treatment already exists: ${treatmentData.name}`);
      }
    } catch (error) {
      console.error(`Error saving treatment ${treatmentData.name}:`, error.message);
    }
  }

  async saveHospitalToDB(hospitalData) {
    try {
      const existingHospital = await Hospital.findOne({ name: hospitalData.name });
      
      if (!existingHospital) {
        const hospital = new Hospital({
          ...hospitalData,
          lastUpdated: new Date()
        });
        await hospital.save();
        console.log(`✓ Saved hospital: ${hospitalData.name}`);
      } else {
        console.log(`- Hospital already exists: ${hospitalData.name}`);
      }
    } catch (error) {
      console.error(`Error saving hospital ${hospitalData.name}:`, error.message);
    }
  }

  async saveDoctorToDB(doctorData) {
    try {
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
        console.log(`✓ Saved doctor: ${doctorData.name} at ${doctorData.hospital}`);
      } else {
        console.log(`- Doctor already exists: ${doctorData.name} at ${doctorData.hospital}`);
      }
    } catch (error) {
      console.error(`Error saving doctor ${doctorData.name}:`, error.message);
    }
  }

  async scrapeAll() {
    await connectDB();
    await this.init();

    try {
      // Define major Indian cities for hospital scraping
      const indianCities = [
        'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 
        'Pune', 'Kolkata', 'Ahmedabad', 'Gurgaon', 'Noida'
      ];
      
      let allHospitals = [];
      let allDoctors = [];
      
      // Scrape hospitals from each major city
      for (const city of indianCities.slice(0, 5)) { // Limit to first 5 cities for now
        console.log(`\n=== Scraping ${city} ===`);
        
        const cityHospitals = await this.scrapeHospitalsByCity(city);
        
        // Save hospitals to database
        for (const hospital of cityHospitals.slice(0, 20)) { // Limit to 20 hospitals per city
          await this.saveHospitalToDB(hospital);
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Try to scrape doctors from this hospital
          if (hospital.link) {
            const doctors = await this.scrapeDoctorsByHospital(hospital.link, hospital.name, city);
            
            // Save doctors to database
            for (const doctor of doctors.slice(0, 10)) { // Limit to 10 doctors per hospital
              await this.saveDoctorToDB(doctor);
              allDoctors.push(doctor);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
        
        allHospitals = allHospitals.concat(cityHospitals);
        
        // Add delay between cities to avoid being blocked
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`\n=== SCRAPING SUMMARY ===`);
      console.log(`Total hospitals found: ${allHospitals.length}`);
      console.log(`Total doctors found: ${allDoctors.length}`);
      
      // Try to scrape some treatment categories as well
      const categories = await this.scrapeMainCategories();
      
      for (const category of categories.slice(0, 2)) { // Limit to first 2 categories
        console.log(`Processing category: ${category.name}`);
        
        const treatments = await this.scrapeTreatmentsByCategory(category.link);
        
        for (const treatment of treatments.slice(0, 5)) { // Limit treatments per category
          await this.saveTreatmentToDB(treatment, category.name);
          await new Promise(resolve => setTimeout(resolve, 500));
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
  require('dotenv').config({ path: '/Users/meherpranav/Desktop/MediBudy/.env' });
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
