const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Enhanced MongoDB connection with better error handling
const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    };
    
    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Enhanced schemas with additional fields
const treatmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: String,
  description: String,
  minPrice: Number,
  maxPrice: Number,
  currency: { type: String, default: 'USD' },
  hospital: String,
  location: String,
  country: { type: String, default: 'India' },
  procedure: String,
  category: String,
  subcategory: String,
  duration: String,
  recovery: String,
  successRate: String,
  details: Object,
  link: String,
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  city: String,
  country: { type: String, default: 'India' },
  specialties: [String],
  rating: { type: Number, min: 0, max: 5 },
  accreditation: [String],
  description: String,
  contact: {
    phone: String,
    email: String,
    website: String
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  treatments: [String],
  established: String,
  beds: Number,
  address: String,
  link: String,
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialization: String,
  hospital: String,
  location: String,
  experience: String,
  qualifications: String,
  education: String,
  awards: [String],
  languages: [String],
  consultationFee: String,
  availability: String,
  profileLink: String,
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better performance
treatmentSchema.index({ name: 1, hospital: 1 });
hospitalSchema.index({ name: 1 });
doctorSchema.index({ name: 1, hospital: 1 });

const Treatment = mongoose.model('Treatment', treatmentSchema);
const Hospital = mongoose.model('Hospital', hospitalSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);

class EnhancedVaidamScraper {
  constructor() {
    this.baseUrl = 'https://www.vaidam.com';
    this.browser = null;
    this.context = null;
    this.maxConcurrency = 5;
    this.requestDelay = { min: 1000, max: 3000 };
    this.maxRetries = 3;
    this.timeout = 60000;
    
    // User agents for rotation
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
    ];
    
    // Data storage
    this.scrapedData = {
      hospitals: [],
      doctors: [],
      treatments: [],
      errors: []
    };
    
    // Progress tracking
    this.progress = {
      hospitalsProcessed: 0,
      doctorsScraped: 0,
      treatmentsScraped: 0,
      totalHospitals: 0
    };
  }

  // Enhanced initialization with stealth techniques
  async init() {
    console.log('Initializing enhanced scraper...');
    
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1920,1080'
      ]
    });

    // Create browser context with stealth settings
    this.context = await this.browser.createIncognitoBrowserContext();
    
    // Set up stealth measures
    await this.setupStealthMeasures();
    
    console.log('Browser initialized successfully');
  }

  async setupStealthMeasures() {
    // Override the browser context to add stealth scripts
    this.context.on('targetcreated', async (target) => {
      const page = await target.page();
      if (page) {
        await this.setupPageStealth(page);
      }
    });
  }

  async setupPageStealth(page) {
    // Remove webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock chrome object
      window.chrome = {
        runtime: {},
      };
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Set random viewport and user agent
    const userAgent = this.getRandomUserAgent();
    await page.setUserAgent(userAgent);
    await page.setViewport({ 
      width: 1366 + Math.floor(Math.random() * 200), 
      height: 768 + Math.floor(Math.random() * 200) 
    });

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async delay(ms = null) {
    const delayTime = ms || (Math.random() * (this.requestDelay.max - this.requestDelay.min) + this.requestDelay.min);
    return new Promise(resolve => setTimeout(resolve, delayTime));
  }

  async createPage() {
    const page = await this.context.newPage();
    await this.setupPageStealth(page);
    return page;
  }

  async safeNavigate(page, url, options = {}) {
    const defaultOptions = {
      waitUntil: 'networkidle2',
      timeout: this.timeout
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Navigating to: ${url} (attempt ${attempt})`);
        await page.goto(url, mergedOptions);
        
        // Random scroll to trigger lazy loading
        await this.simulateHumanBehavior(page);
        
        return true;
      } catch (error) {
        console.error(`Navigation failed (attempt ${attempt}): ${error.message}`);
        
        if (attempt === this.maxRetries) {
          this.scrapedData.errors.push({
            url,
            error: error.message,
            timestamp: new Date()
          });
          return false;
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    return false;
  }

  async simulateHumanBehavior(page) {
    try {
      // Random scroll pattern
      await page.evaluate(() => {
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const scrollSteps = Math.floor(scrollHeight / viewportHeight) + 1;
        
        let currentStep = 0;
        const scrollInterval = setInterval(() => {
          if (currentStep < scrollSteps) {
            window.scrollTo(0, currentStep * viewportHeight);
            currentStep++;
          } else {
            clearInterval(scrollInterval);
          }
        }, 200 + Math.random() * 300);
      });
      
      await this.delay(2000);
      
      // Random mouse movements
      await page.mouse.move(
        Math.random() * 800,
        Math.random() * 600
      );
      
    } catch (error) {
      console.error('Error simulating human behavior:', error.message);
    }
  }

  // Enhanced hospital discovery with multiple strategies
  async discoverAllHospitalUrls() {
    console.log('Starting comprehensive hospital URL discovery...');
    const hospitalUrls = new Set();
    
    // Strategy 1: Pagination-based discovery
    const paginationUrls = await this.discoverHospitalsPagination();
    paginationUrls.forEach(url => hospitalUrls.add(url));
    
    // Strategy 2: Location-based discovery
    const locationUrls = await this.discoverHospitalsByLocation();
    locationUrls.forEach(url => hospitalUrls.add(url));
    
    // Strategy 3: Specialty-based discovery
    const specialtyUrls = await this.discoverHospitalsBySpecialty();
    specialtyUrls.forEach(url => hospitalUrls.add(url));
    
    // Strategy 4: Sitemap parsing
    const sitemapUrls = await this.discoverHospitalsFromSitemap();
    sitemapUrls.forEach(url => hospitalUrls.add(url));
    
    const finalUrls = Array.from(hospitalUrls);
    console.log(`Total unique hospital URLs discovered: ${finalUrls.length}`);
    
    return finalUrls;
  }

  async discoverHospitalsPagination() {
    const page = await this.createPage();
    const hospitalUrls = [];
    
    try {
      let pageNum = 1;
      let hasMore = true;
      const maxPages = 200; // Increased limit
      
      while (hasMore && pageNum <= maxPages) {
        const url = `${this.baseUrl}/hospitals/india?page=${pageNum}`;
        
        if (await this.safeNavigate(page, url)) {
          const urls = await this.extractHospitalUrlsFromPage(page);
          
          if (urls.length === 0) {
            console.log(`No hospitals found on page ${pageNum}, stopping pagination`);
            hasMore = false;
          } else {
            hospitalUrls.push(...urls);
            console.log(`Page ${pageNum}: Found ${urls.length} hospitals`);
            pageNum++;
            
            // Check for next page button
            const hasNextPage = await page.evaluate(() => {
              const nextButton = document.querySelector('a[rel="next"], .pagination .next:not(.disabled), a:contains("Next")');
              return !!nextButton;
            });
            
            if (!hasNextPage) {
              console.log('No next page button found, stopping pagination');
              hasMore = false;
            }
          }
        } else {
          console.error(`Failed to load page ${pageNum}`);
          break;
        }
        
        await this.delay();
      }
      
    } catch (error) {
      console.error('Error in pagination discovery:', error);
    } finally {
      await page.close();
    }
    
    console.log(`Pagination discovery completed: ${hospitalUrls.length} URLs`);
    return hospitalUrls;
  }

  async discoverHospitalsByLocation() {
    const page = await this.createPage();
    const hospitalUrls = [];
    
    try {
      // Major Indian cities and states
      const locations = [
        'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad',
        'pune', 'gurgaon', 'noida', 'ahmedabad', 'jaipur', 'lucknow',
        'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam',
        'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik',
        'faridabad', 'meerut', 'rajkot', 'kalyan-dombivali', 'vasai-virar',
        'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar',
        'navi-mumbai', 'allahabad', 'ranchi', 'howrah', 'coimbatore',
        'jabalpur', 'gwalior', 'vijayawada', 'jodhpur', 'madurai',
        'raipur', 'kota', 'chandigarh', 'guwahati', 'solapur'
      ];
      
      for (const location of locations) {
        try {
          const url = `${this.baseUrl}/hospitals/india?location=${location}`;
          
          if (await this.safeNavigate(page, url)) {
            const urls = await this.extractHospitalUrlsFromPage(page);
            hospitalUrls.push(...urls);
            console.log(`${location}: Found ${urls.length} hospitals`);
          }
          
          await this.delay();
        } catch (error) {
          console.error(`Error scraping location ${location}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Error in location-based discovery:', error);
    } finally {
      await page.close();
    }
    
    console.log(`Location discovery completed: ${hospitalUrls.length} URLs`);
    return hospitalUrls;
  }

  async discoverHospitalsBySpecialty() {
    const page = await this.createPage();
    const hospitalUrls = [];
    
    try {
      const specialties = [
        'cardiology', 'oncology', 'orthopedics', 'neurology', 'gastroenterology',
        'urology', 'dermatology', 'gynecology', 'pediatrics', 'surgery',
        'psychiatry', 'radiology', 'anesthesiology', 'pathology', 'ent',
        'ophthalmology', 'pulmonology', 'nephrology', 'endocrinology',
        'rheumatology', 'plastic-surgery', 'dental', 'fertility'
      ];
      
      for (const specialty of specialties) {
        try {
          const url = `${this.baseUrl}/hospitals/india?specialty=${specialty}`;
          
          if (await this.safeNavigate(page, url)) {
            const urls = await this.extractHospitalUrlsFromPage(page);
            hospitalUrls.push(...urls);
            console.log(`${specialty}: Found ${urls.length} hospitals`);
          }
          
          await this.delay();
        } catch (error) {
          console.error(`Error scraping specialty ${specialty}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Error in specialty-based discovery:', error);
    } finally {
      await page.close();
    }
    
    console.log(`Specialty discovery completed: ${hospitalUrls.length} URLs`);
    return hospitalUrls;
  }

  async discoverHospitalsFromSitemap() {
    const page = await this.createPage();
    const hospitalUrls = [];
    
    try {
      const sitemapUrls = [
        `${this.baseUrl}/sitemap.xml`,
        `${this.baseUrl}/sitemap_index.xml`,
        `${this.baseUrl}/hospitals-sitemap.xml`
      ];
      
      for (const sitemapUrl of sitemapUrls) {
        try {
          if (await this.safeNavigate(page, sitemapUrl)) {
            const content = await page.content();
            const urls = this.extractHospitalUrlsFromSitemap(content);
            hospitalUrls.push(...urls);
            console.log(`Sitemap ${sitemapUrl}: Found ${urls.length} hospital URLs`);
          }
        } catch (error) {
          console.error(`Error parsing sitemap ${sitemapUrl}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Error in sitemap discovery:', error);
    } finally {
      await page.close();
    }
    
    console.log(`Sitemap discovery completed: ${hospitalUrls.length} URLs`);
    return hospitalUrls;
  }

  async extractHospitalUrlsFromPage(page) {
    return await page.evaluate((baseUrl) => {
      const urls = [];
      const selectors = [
        'a[href*="/hospitals/"]',
        'a[href*="/hospital/"]',
        'a[href*="/hospital-detail/"]',
        '.hospital-card a',
        '.hospital-item a',
        '.listing-item a',
        '.card a',
        '.result a'
      ];
      
      // Extract URLs using selectors
      selectors.forEach(selector => {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.includes('hospital')) {
            const fullUrl = href.startsWith('http') ? href : baseUrl + href;
            if (fullUrl.match(/\/hospitals?\/[^\/]+\/?$/)) {
              urls.push(fullUrl);
            }
          }
        });
      });
      
      // Look for URLs in script tags
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.textContent) {
          const urlMatches = script.textContent.match(/\/hospitals?\/[a-zA-Z0-9\-_]+/g);
          if (urlMatches) {
            urlMatches.forEach(match => {
              const fullUrl = baseUrl + match;
              if (fullUrl.match(/\/hospitals?\/[^\/]+\/?$/)) {
                urls.push(fullUrl);
              }
            });
          }
        }
      });
      
      return [...new Set(urls)];
    }, this.baseUrl);
  }

  extractHospitalUrlsFromSitemap(content) {
    const urls = [];
    const cheerio = require('cheerio');
    const $ = cheerio.load(content, { xmlMode: true });
    
    $('loc').each((i, elem) => {
      const url = $(elem).text();
      if (url && url.includes('/hospital') && url.match(/\/hospitals?\/[^\/]+\/?$/)) {
        urls.push(url);
      }
    });
    
    return urls;
  }

  // Enhanced hospital scraping with comprehensive data extraction
  async scrapeHospitalDetails(hospitalUrl) {
    const page = await this.createPage();
    
    try {
      console.log(`Scraping hospital: ${hospitalUrl}`);
      
      if (!await this.safeNavigate(page, hospitalUrl)) {
        return null;
      }
      
      // Extract comprehensive hospital data
      const hospitalData = await page.evaluate(() => {
        const data = {};
        
        // Extract name using multiple strategies
        data.name = this.extractHospitalName();
        data.location = this.extractHospitalLocation();
        data.city = this.extractHospitalCity();
        data.specialties = this.extractHospitalSpecialties();
        data.rating = this.extractHospitalRating();
        data.description = this.extractHospitalDescription();
        data.contact = this.extractHospitalContact();
        data.established = this.extractHospitalEstablished();
        data.beds = this.extractHospitalBeds();
        data.address = this.extractHospitalAddress();
        data.accreditation = this.extractHospitalAccreditation();
        
        return data;
      });
      
      // Add the URL to the data
      hospitalData.link = hospitalUrl;
      
      if (!hospitalData.name || hospitalData.name.length < 3) {
        console.log(`Invalid hospital name for ${hospitalUrl}`);
        return null;
      }
      
      console.log(`Successfully scraped: ${hospitalData.name}`);
      return hospitalData;
      
    } catch (error) {
      console.error(`Error scraping hospital ${hospitalUrl}:`, error.message);
      this.scrapedData.errors.push({
        url: hospitalUrl,
        error: error.message,
        type: 'hospital',
        timestamp: new Date()
      });
      return null;
    } finally {
      await page.close();
    }
  }

  // Enhanced concurrent processing
  async processHospitalsConcurrently(hospitalUrls) {
    console.log(`Processing ${hospitalUrls.length} hospitals with concurrency: ${this.maxConcurrency}`);
    
    this.progress.totalHospitals = hospitalUrls.length;
    
    // Process in batches to avoid overwhelming the server
    const batchSize = this.maxConcurrency;
    const totalBatches = Math.ceil(hospitalUrls.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, hospitalUrls.length);
      const batch = hospitalUrls.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} hospitals)`);
      
      // Process batch concurrently
      const promises = batch.map(url => this.processHospitalWithDoctors(url));
      const results = await Promise.allSettled(promises);
      
      // Log batch results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`Batch ${batchIndex + 1} completed: ${successful}/${batch.length} successful`);
      
      // Longer delay between batches
      if (batchIndex < totalBatches - 1) {
        await this.delay(5000);
      }
    }
  }

  async processHospitalWithDoctors(hospitalUrl) {
    try {
      // Scrape hospital details
      const hospital = await this.scrapeHospitalDetails(hospitalUrl);
      
      if (hospital) {
        this.scrapedData.hospitals.push(hospital);
        this.progress.hospitalsProcessed++;
        
        // Scrape doctors for this hospital
        const doctors = await this.scrapeDoctorsForHospital(hospital);
        this.scrapedData.doctors.push(...doctors);
        this.progress.doctorsScraped += doctors.length;
        
        console.log(`Progress: ${this.progress.hospitalsProcessed}/${this.progress.totalHospitals} hospitals, ${this.progress.doctorsScraped} doctors total`);
        
        return hospital;
      }
      
      return null;
    } catch (error) {
      console.error(`Error processing hospital ${hospitalUrl}:`, error.message);
      return null;
    }
  }

  // Enhanced doctor scraping
  async scrapeDoctorsForHospital(hospital) {
    const page = await this.createPage();
    const doctors = [];
    
    try {
      console.log(`Scraping doctors for: ${hospital.name}`);
      
      // Try multiple URL patterns for doctors
      const doctorUrls = [
        `${hospital.link}/doctors`,
        `${hospital.link}/team`,
        `${hospital.link}/staff`,
        `${hospital.link}/physicians`,
        hospital.link // Sometimes doctors are on main page
      ];
      
      let doctorContent = null;
      
      for (const url of doctorUrls) {
        if (await this.safeNavigate(page, url)) {
          // Check if page has doctor information
          const hasDoctors = await page.evaluate(() => {
            const text = document.body.textContent.toLowerCase();
            return text.includes('doctor') || text.includes('physician') || 
                   text.includes('dr.') || text.includes('specialist');
          });
          
          if (hasDoctors) {
            doctorContent = await page.content();
            break;
          }
        }
      }
      
      if (!doctorContent) {
        console.log(`No doctor content found for ${hospital.name}`);
        return doctors;
      }
      
      // Extract doctor information
      const doctorData = await page.evaluate((hospitalName, hospitalLocation) => {
        const doctors = [];
        
        // Multiple strategies to find doctor elements
        const selectors = [
          '[class*="doctor"]',
          '[class*="physician"]',
          '[class*="staff"]',
          '[class*="team"]',
          '[class*="profile"]',
          '.member'
        ];
        
        let doctorElements = [];
        
        // Try selectors
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            doctorElements = Array.from(elements);
            break;
          }
        }
        
        // Fallback: text-based search
        if (doctorElements.length === 0) {
          const allElements = document.querySelectorAll('div, section, article');
          doctorElements = Array.from(allElements).filter(el => {
            const text = el.textContent || '';
            return text.match(/dr\.?\s+[a-z\s]{3,}/i) && text.length > 20 && text.length < 1000;
          });
        }
        
        doctorElements.forEach(element => {
          const doctor = this.extractDoctorData(element, hospitalName, hospitalLocation);
          if (doctor && doctor.name) {
            doctors.push(doctor);
          }
        });
        
        return doctors;
      }, hospital.name, hospital.location);
      
      doctors.push(...doctorData);
      console.log(`Found ${doctors.length} doctors for ${hospital.name}`);
      
    } catch (error) {
      console.error(`Error scraping doctors for ${hospital.name}:`, error.message);
    } finally {
      await page.close();
    }
    
    return doctors;
  }

  // Enhanced data saving with batch operations
  async saveAllDataToDB() {
    try {
      console.log('Saving data to MongoDB...');
      
      // Save hospitals in batches
      if (this.scrapedData.hospitals.length > 0) {
        const hospitalBatches = this.chunkArray(this.scrapedData.hospitals, 100);
        let savedHospitals = 0;
        
        for (const batch of hospitalBatches) {
          try {
            const operations = batch.map(hospital => ({
              updateOne: {
                filter: { name: hospital.name },
                update: { $set: { ...hospital, lastUpdated: new Date() } },
                upsert: true
              }
            }));
            
            await Hospital.bulkWrite(operations);
            savedHospitals += batch.length;
            console.log(`Saved ${savedHospitals}/${this.scrapedData.hospitals.length} hospitals`);
          } catch (error) {
            console.error('Error saving hospital batch:', error.message);
          }
        }
      }
      
      // Save doctors in batches
      if (this.scrapedData.doctors.length > 0) {
        const doctorBatches = this.chunkArray(this.scrapedData.doctors, 100);
        let savedDoctors = 0;
        
        for (const batch of doctorBatches) {
          try {
            const operations = batch.map(doctor => ({
              updateOne: {
                filter: { name: doctor.name, hospital: doctor.hospital },
                update: { $set: { ...doctor, lastUpdated: new Date() } },
                upsert: true
              }
            }));
            
            await Doctor.bulkWrite(operations);
            savedDoctors += batch.length;
            console.log(`Saved ${savedDoctors}/${this.scrapedData.doctors.length} doctors`);
          } catch (error) {
            console.error('Error saving doctor batch:', error.message);
          }
        }
      }
      
      // Save treatments in batches
      if (this.scrapedData.treatments.length > 0) {
        const treatmentBatches = this.chunkArray(this.scrapedData.treatments, 100);
        let savedTreatments = 0;
        
        for (const batch of treatmentBatches) {
          try {
            const operations = batch.map(treatment => ({
              updateOne: {
                filter: { name: treatment.name, hospital: treatment.hospital },
                update: { $set: { ...treatment, lastUpdated: new Date() } },
                upsert: true
              }
            }));
            
            await Treatment.bulkWrite(operations);
            savedTreatments += batch.length;
            console.log(`Saved ${savedTreatments}/${this.scrapedData.treatments.length} treatments`);
          } catch (error) {
            console.error('Error saving treatment batch:', error.message);
          }
        }
      }
      
      console.log('All data saved successfully to MongoDB');
      
    } catch (error) {
      console.error('Error saving data to MongoDB:', error);
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Enhanced error handling and reporting
  async generateReport() {
    const report = {
      timestamp: new Date(),
      summary: {
        hospitalsScraped: this.scrapedData.hospitals.length,
        doctorsScraped: this.scrapedData.doctors.length,
        treatmentsScraped: this.scrapedData.treatments.length,
        errorsEncountered: this.scrapedData.errors.length
      },
      hospitalsByCity: {},
      doctorsBySpecialty: {},
      errors: this.scrapedData.errors
    };
    
    // Analyze hospitals by city
    this.scrapedData.hospitals.forEach(hospital => {
      const city = hospital.city || 'Unknown';
      report.hospitalsByCity[city] = (report.hospitalsByCity[city] || 0) + 1;
    });
    
    // Analyze doctors by specialty
    this.scrapedData.doctors.forEach(doctor => {
      const specialty = doctor.specialization || 'General';
      report.doctorsBySpecialty[specialty] = (report.doctorsBySpecialty[specialty] || 0) + 1;
    });
    
    // Save report to file
    await fs.writeFile(
      path.join(__dirname, 'scraping_report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('Scraping Report:');
    console.log('================');
    console.log(`Hospitals: ${report.summary.hospitalsScraped}`);
    console.log(`Doctors: ${report.summary.doctorsScraped}`);
    console.log(`Treatments: ${report.summary.treatmentsScraped}`);
    console.log(`Errors: ${report.summary.errorsEncountered}`);
    console.log('Report saved to scraping_report.json');
    
    return report;
  }

  // Main execution method
  async scrapeAll() {
    const startTime = Date.now();
    
    try {
      console.log('Starting comprehensive Vaidam scraping...');
      
      // Initialize
      await connectDB();
      await this.init();
      
      // Discover all hospital URLs
      const hospitalUrls = await this.discoverAllHospitalUrls();
      
      if (hospitalUrls.length === 0) {
        console.log('No hospital URLs found. Exiting...');
        return;
      }
      
      console.log(`Found ${hospitalUrls.length} unique hospital URLs`);
      
      // Process hospitals and doctors concurrently
      await this.processHospitalsConcurrently(hospitalUrls);
      
      // Scrape treatments (optional - can be run separately)
      console.log('Starting treatment scraping...');
      const treatments = await this.scrapeTreatments();
      this.scrapedData.treatments = treatments;
      
      // Save all data to database
      await this.saveAllDataToDB();
      
      // Generate comprehensive report
      await this.generateReport();
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000 / 60);
      
      console.log(`\nScraping completed successfully in ${duration} minutes!`);
      console.log(`Final Results:`);
      console.log(`- Hospitals: ${this.scrapedData.hospitals.length}`);
      console.log(`- Doctors: ${this.scrapedData.doctors.length}`);
      console.log(`- Treatments: ${this.scrapedData.treatments.length}`);
      console.log(`- Errors: ${this.scrapedData.errors.length}`);
      
    } catch (error) {
      console.error('Critical error in scraping process:', error);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

module.exports = EnhancedVaidamScraper;

// Run if this file is executed directly
if (require.main === module) {
  require('dotenv').config({ path: '../.env' });
  
  const scraper = new EnhancedVaidamScraper();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Gracefully shutting down...');
    await scraper.cleanup();
    process.exit(0);
  });
  
  scraper.scrapeAll()
    .then(() => {
      console.log('Scraping process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping process failed:', error);
      process.exit(1);
    });
}
