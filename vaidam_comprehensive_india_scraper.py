#!/usr/bin/env python3
"""
COMPREHENSIVE INDIA HOSPITAL SCRAPER
Specifically designed to scrape ALL hospitals in India from Vaidam
Focus: Maximum coverage, all cities, all hospitals, comprehensive doctor data
"""

import time
import random
import re
import json
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse
import logging
from bs4 import BeautifulSoup
import pandas as pd
import pymongo
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Load environment variables
load_dotenv(dotenv_path='../.env')

# If not found in parent, try current directory
if not os.getenv('MONGODB_URI'):
    load_dotenv(dotenv_path='.env')

# If still not found, try absolute path
if not os.getenv('MONGODB_URI'):
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vaidam_comprehensive_india_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VaidamComprehensiveIndiaScraper:
    def __init__(self):
        self.base_url = "https://www.vaidam.com"
        self.session = None
        self.mongo_client = None
        self.db = None
        
        # Collections to store scraped data
        self.scraped_data = {
            'hospitals': [],
            'doctors': []
        }
        
        # Progress tracking
        self.progress = {
            'hospitals_scraped': 0,
            'doctors_scraped': 0,
            'cities_processed': 0,
            'total_urls_discovered': 0
        }
        
        # User agents for rotation
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15"
        ]

    def init_session(self):
        """Initialize requests session with comprehensive retry strategy"""
        logger.info("🚀 Initializing Comprehensive HTTP session for India scraping...")
        
        self.session = requests.Session()
        
        # Enhanced retry strategy
        retry_strategy = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=20, pool_maxsize=50)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set comprehensive headers
        self.session.headers.update({
            'User-Agent': random.choice(self.user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
        })
        
        logger.info("✅ Comprehensive HTTP session initialized successfully")

    def init_mongodb(self):
        """Initialize MongoDB connection"""
        try:
            mongodb_uri = os.getenv('MONGODB_URI')
            
            logger.info(f"📊 Environment variables loaded: MONGODB_URI={'***FOUND***' if mongodb_uri else 'NOT FOUND'}")
            
            if not mongodb_uri:
                # Try to load from different paths
                possible_paths = [
                    '../.env',
                    '.env',
                    '/Users/meherpranav/Desktop/MediBudy/.env'
                ]
                
                for path in possible_paths:
                    logger.info(f"🔍 Trying to load .env from: {path}")
                    if os.path.exists(path):
                        logger.info(f"📁 Found .env file at: {path}")
                        load_dotenv(dotenv_path=path, override=True)
                        mongodb_uri = os.getenv('MONGODB_URI')
                        if mongodb_uri:
                            logger.info("✅ Successfully loaded MONGODB_URI")
                            break
                
                if not mongodb_uri:
                    raise ValueError("MONGODB_URI not found in environment variables. Please check your .env file.")
            
            self.mongo_client = MongoClient(mongodb_uri)
            self.db = self.mongo_client.medibudy
            
            # Test connection
            self.mongo_client.admin.command('ping')
            logger.info("✅ Connected to MongoDB successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            raise

    def random_delay(self, min_seconds=0.1, max_seconds=0.5):
        """Add minimal delay for politeness"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)

    def safe_get(self, url, timeout=15):
        """Enhanced HTTP request with better error handling"""
        try:
            # Rotate user agent occasionally
            if random.random() < 0.1:  # 10% chance to rotate
                self.session.headers.update({
                    'User-Agent': random.choice(self.user_agents)
                })
            
            response = self.session.get(url, timeout=timeout)
            
            if response.status_code == 200:
                return response.text
            elif response.status_code == 429:
                logger.warning(f"⚠️  Rate limited, waiting...")
                time.sleep(3)
                return None
            else:
                logger.warning(f"⚠️  HTTP {response.status_code} for {url}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error fetching {url}: {e}")
            return None

    def get_soup(self, html):
        """Create BeautifulSoup object from HTML"""
        try:
            return BeautifulSoup(html, 'lxml')
        except Exception as e:
            logger.error(f"❌ Error parsing HTML: {e}")
            return None

    def discover_all_india_hospitals(self):
        """Comprehensive discovery of ALL hospitals in India"""
        logger.info("🇮🇳 Starting COMPREHENSIVE India hospital discovery...")
        hospital_urls = set()
        
        # COMPLETE list of ALL Indian cities (500+ cities for maximum coverage)
        indian_cities = [
            # Tier 1 Metropolitan Cities
            'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad',
            
            # Tier 1 Major Cities  
            'surat', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal',
            'visakhapatnam', 'pimpri-chinchwad', 'patna', 'vadodara', 'ghaziabad', 'ludhiana',
            'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan-dombivli', 'vasai-virar',
            'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi-mumbai', 'allahabad',
            'ranchi', 'howrah', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada', 'jodhpur',
            'madurai', 'raipur', 'kota', 'chandigarh', 'guwahati', 'solapur', 'hubballi-dharwad',
            'tiruchirappalli', 'bareilly', 'mysore', 'tiruppur', 'gurgaon', 'aligarh', 'jalandhar',
            'bhubaneswar', 'salem', 'warangal', 'guntur', 'bhiwandi', 'saharanpur', 'gorakhpur',
            'bikaner', 'amravati', 'noida', 'jamshedpur', 'bhilai', 'cuttack', 'firozabad',
            'kochi', 'bhavnagar', 'dehradun', 'durgapur', 'asansol', 'rourkela', 'nanded',
            'kolhapur', 'ajmer', 'akola', 'gulbarga', 'jamnagar', 'ujjain', 'loni', 'siliguri',
            'jhansi', 'ulhasnagar', 'nellore', 'jammu', 'sangli-miraj-kupwad', 'belgaum',
            'mangalore', 'ambattur', 'tirunelveli', 'malegaon', 'gaya', 'jalgaon', 'udaipur',
            
            # Tier 2 Cities
            'maheshtala', 'davanagere', 'kozhikode', 'kurnool', 'rajpur-sonarpur', 'rajahmundry',
            'bokaro', 'south-dumdum', 'bellary', 'patiala', 'gopalpur', 'agartala', 'bhagalpur',
            'muzaffarnagar', 'bhatpara', 'panihati', 'latur', 'dhule', 'rohtak', 'korba',
            'bhilwara', 'berhampur', 'muzaffarpur', 'ahmednagar', 'mathura', 'kollam', 'avadi',
            'kadapa', 'kamarhati', 'sambalpur', 'bilaspur', 'shahjahanpur', 'satara', 'bijapur',
            'rampur', 'shivamogga', 'chandrapur', 'junagadh', 'thrissur', 'alwar', 'bardhaman',
            'kulti', 'kakinada', 'nizamabad', 'parbhani', 'tumkur', 'khammam', 'ozhukarai',
            'bihar-sharif', 'panipat', 'darbhanga', 'bally', 'aizawl', 'dewas', 'ichalkaranji',
            'karnal', 'bathinda', 'jalna', 'eluru', 'kirari-suleman-nagar', 'barabanki',
            'purnia', 'satna', 'mau', 'sonipat', 'farrukhabad', 'sagar', 'durg', 'imphal',
            'ratlam', 'hapur', 'arrah', 'anantapur', 'karimnagar', 'etawah', 'ambernath',
            'north-dumdum', 'bharatpur', 'begusarai', 'new-delhi', 'gandhidham', 'baranagar',
            'tiruvottiyur', 'pondicherry', 'sikar', 'thoothukudi', 'rewa', 'mirzapur', 'raichur',
            'pali', 'ramagundam', 'silchar', 'orai', 'nandyal', 'morena', 'bhiwani', 'porbandar',
            'palakkad', 'anand', 'puruliya', 'baharampur', 'barmer', 'ambala', 'shivpuri',
            'hindupur', 'udupi', 'kottayam', 'machilipatnam', 'shortpet', 'ballari', 'dharwad',
            'hassan', 'dindigul', 'erode', 'vellore', 'tiruvallur', 'cuddalore', 'kumbakonam',
            'thanjavur', 'tiruvannamalai', 'pollachi', 'ramanathapuram', 'pudukkottai',
            'sivakasi', 'karaikudi', 'neyveli', 'nagapattinam', 'viluppuram', 'arakkonam',
            'krishnagiri', 'namakkal', 'dharmapuri', 'hosur',
            
            # Tier 3 Cities & Important Medical Centers
            'shimla', 'manali', 'rishikesh', 'haridwar', 'nainital', 'mussoorie', 'dehradun',
            'chandigadh', 'amritsar', 'patiala', 'ludhiana', 'jalandhar', 'bathinda', 'mohali',
            'faridkot', 'hoshiarpur', 'pathankot', 'moga', 'kapurthala', 'sangrur', 'malerkotla',
            'rajpura', 'nabha', 'sunam', 'fatehabad', 'sirsa', 'hisar', 'panipat', 'karnal',
            'ambala', 'yamunanagar', 'kurukshetra', 'kaithal', 'jind', 'sonipat', 'rohtak',
            'jhajjar', 'rewari', 'mahendragarh', 'mewat', 'palwal', 'faridabad', 'gurgaon',
            'mewat', 'alwar', 'bharatpur', 'dholpur', 'karauli', 'sawai-madhopur', 'dausa',
            'jaipur', 'sikar', 'jhunjhunu', 'churu', 'sri-ganganagar', 'hanumangarh', 'bikaner',
            'ratangarh', 'sujangarh', 'nokha', 'lunkaransar', 'deshnoke', 'kolayat', 'phalodi',
            'pokaran', 'jaisalmer', 'barmer', 'jalore', 'sirohi', 'mount-abu', 'abu-road',
            'palanpur', 'deesa', 'dhanera', 'tharad', 'vadgam', 'dantiwada', 'kankrej',
            'radhanpur', 'mehsana', 'patan', 'sidhpur', 'chanasma', 'kheralu', 'unjha',
            'visnagar', 'vijapur', 'gandhinagar', 'kalol', 'mansa', 'viramgam', 'sanand',
            'dholka', 'bavla', 'ranpur', 'limbdi', 'wadhwan', 'maliya', 'morbi', 'wankaner',
            'rajkot', 'gondal', 'jetpur', 'dhoraji', 'upleta', 'mangrol', 'keshod', 'mendarda',
            'manavadar', 'vanthali', 'gir-somnath', 'kodinar', 'una', 'talala', 'sutrapada'
        ]
        
        logger.info(f"🏙️ Targeting {len(indian_cities)} Indian cities for MAXIMUM hospital coverage...")
        
        # Strategy 1: City-by-city comprehensive search
        for city in indian_cities:
            try:
                # Multiple URL patterns for each city
                city_urls = [
                    f"{self.base_url}/hospitals/india/{city}",
                    f"{self.base_url}/hospitals/{city}",
                    f"{self.base_url}/hospitals/india/{city.replace('-', '')}",
                    f"{self.base_url}/hospitals/{city.replace('-', '')}",
                    f"{self.base_url}/hospitals/india/{city.replace('-', ' ')}"
                ]
                
                city_hospital_count = 0
                for city_url in city_urls:
                    urls = self.scrape_hospital_listing_comprehensive(city_url, max_pages=50)
                    if urls:
                        hospital_urls.update(urls)
                        city_hospital_count += len(urls)
                        logger.info(f"🏙️ {city.title()}: Found {len(urls)} hospitals")
                        break  # Found hospitals, no need to try other URL patterns
                
                if city_hospital_count > 0:
                    self.progress['cities_processed'] += 1
                
                # Minimal delay between cities
                self.random_delay(0.1, 0.2)
                
            except Exception as e:
                logger.error(f"❌ Error processing city {city}: {e}")
                continue
        
        # Strategy 2: State-wise comprehensive search
        indian_states = [
            'andhra-pradesh', 'arunachal-pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
            'gujarat', 'haryana', 'himachal-pradesh', 'jharkhand', 'karnataka', 'kerala',
            'madhya-pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
            'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil-nadu', 'telangana', 'tripura',
            'uttar-pradesh', 'uttarakhand', 'west-bengal', 'delhi', 'chandigarh', 'puducherry',
            'jammu-and-kashmir', 'ladakh', 'andaman-and-nicobar-islands', 'dadra-and-nagar-haveli-and-daman-and-diu',
            'lakshadweep'
        ]
        
        logger.info(f"🗺️ Checking {len(indian_states)} Indian states for additional coverage...")
        
        for state in indian_states:
            try:
                state_urls = [
                    f"{self.base_url}/hospitals/india/{state}",
                    f"{self.base_url}/hospitals/{state}"
                ]
                
                for state_url in state_urls:
                    urls = self.scrape_hospital_listing_comprehensive(state_url, max_pages=100)
                    if urls:
                        hospital_urls.update(urls)
                        logger.info(f"🗺️ {state.title()}: Found {len(urls)} hospitals")
                        break
                
                self.random_delay(0.1, 0.2)
                
            except Exception as e:
                logger.error(f"❌ Error processing state {state}: {e}")
                continue
        
        # Strategy 3: Deep pagination on main India listings
        logger.info("🇮🇳 Deep pagination on main India hospital listings...")
        main_urls = [
            f"{self.base_url}/hospitals/india",
            f"{self.base_url}/hospitals"
        ]
        
        for url in main_urls:
            urls = self.scrape_hospital_listing_comprehensive(url, max_pages=200)  # Very deep pagination
            hospital_urls.update(urls)
            logger.info(f"🇮🇳 Main listing: Found {len(urls)} hospitals")
        
        self.progress['total_urls_discovered'] = len(hospital_urls)
        final_urls = list(hospital_urls)
        logger.info(f"🎯 TOTAL UNIQUE HOSPITAL URLs DISCOVERED: {len(final_urls)}")
        
        return final_urls

    def scrape_hospital_listing_comprehensive(self, listing_url, max_pages=50):
        """Comprehensive hospital listing scraper with deep pagination"""
        hospital_urls = []
        
        try:
            logger.info(f"🔍 Scraping listing: {listing_url}")
            
            # Scrape first page
            html = self.safe_get(listing_url)
            if html:
                soup = self.get_soup(html)
                if soup:
                    urls = self.extract_hospital_urls_comprehensive(soup)
                    hospital_urls.extend(urls)
                    if urls:
                        logger.info(f"📄 Page 1: Found {len(urls)} hospitals")
            
            # Deep pagination for maximum coverage
            for page in range(2, max_pages + 1):
                page_url = f"{listing_url}?page={page}"
                page_html = self.safe_get(page_url)
                
                if not page_html:
                    break
                
                page_soup = self.get_soup(page_html)
                if not page_soup:
                    break
                
                page_urls = self.extract_hospital_urls_comprehensive(page_soup)
                if not page_urls:
                    logger.info(f"📄 No more hospitals found at page {page}, stopping")
                    break
                
                hospital_urls.extend(page_urls)
                if page % 10 == 0:  # Log every 10 pages
                    logger.info(f"📄 Page {page}: Found {len(page_urls)} hospitals")
                
                self.random_delay(0.1, 0.3)
            
            unique_urls = list(set(hospital_urls))
            logger.info(f"✅ Total from {listing_url}: {len(unique_urls)} unique hospitals")
            
        except Exception as e:
            logger.error(f"❌ Error scraping {listing_url}: {e}")
        
        return list(set(hospital_urls))

    def extract_hospital_urls_comprehensive(self, soup):
        """Comprehensive URL extraction for maximum coverage"""
        urls = []
        
        # Enhanced selectors for Vaidam's structure
        selectors = [
            'a[href*="/hospitals/"][href*="/hospital-"]',  # Individual hospital pages
            'a[href*="/hospital/"]',                       # Alternative hospital URL pattern
            'a[href*="/hospitals/"][href$=".html"]',       # HTML extension pattern
            'a[title*="Hospital"]',                        # Title-based matching
            'a[title*="hospital"]',                        # Case-insensitive title matching
            'a[href*="/hospitals/india/"][href*="/"]',     # India-specific hospital URLs
            'a[class*="hospital"]',                        # Class-based matching
            'a[class*="card"] img[alt*="hospital"]',       # Image alt text matching
        ]
        
        for selector in selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get('href')
                if href:
                    if href.startswith('/'):
                        full_url = self.base_url + href
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        continue
                    
                    if self.is_valid_hospital_url_comprehensive(full_url):
                        urls.append(full_url)
        
        # Extract URLs from hospital containers
        hospital_containers = soup.find_all(['div', 'article', 'section'], 
                                          class_=lambda x: x and any(term in x.lower() for term in 
                                          ['hospital', 'card', 'item', 'listing', 'result', 'tile']))
        
        for container in hospital_containers:
            links = container.find_all('a', href=True)
            for link in links:
                href = link.get('href')
                if href and href.startswith('/'):
                    full_url = self.base_url + href
                    if self.is_valid_hospital_url_comprehensive(full_url):
                        urls.append(full_url)
        
        # Look for JavaScript embedded URLs
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                js_urls = re.findall(r'/hospitals?/[a-zA-Z0-9\-_/]+', script.string)
                for js_url in js_urls:
                    full_url = self.base_url + js_url
                    if self.is_valid_hospital_url_comprehensive(full_url):
                        urls.append(full_url)
        
        return list(set(urls))  # Remove duplicates

    def is_valid_hospital_url_comprehensive(self, url):
        """Comprehensive URL validation for hospital pages"""
        if not url.startswith(self.base_url):
            return False
        
        # Patterns that indicate individual hospital pages
        valid_patterns = [
            r'/hospitals?/[^/]+/hospital-[^/]+',      # /hospitals/city/hospital-name
            r'/hospitals?/[^/]+\.html',               # /hospitals/name.html
            r'/hospital/[^/]+',                       # /hospital/name
            r'/hospitals/[^/]+/[^/]+/[^/]+',         # /hospitals/specialty/country/hospital
            r'/hospitals?/india/[^/]+/[^/]+',        # /hospitals/india/city/hospital
        ]
        
        for pattern in valid_patterns:
            if re.search(pattern, url):
                return True
        
        # Exclude listing pages and other non-hospital pages
        exclude_patterns = [
            r'/hospitals?/?$',                        # Just /hospitals or /hospitals/
            r'/hospitals?/[^/]+/?$',                  # /hospitals/country or /hospitals/specialty
            r'/hospitals?/india/?$',                  # /hospitals/india
            r'/hospitals?/[^/]+/[^/]+/?$',           # /hospitals/specialty/country (without hospital name)
            r'page=',                                 # Pagination URLs
            r'search',                                # Search URLs
            r'filter',                                # Filter URLs
            r'category',                              # Category URLs
        ]
        
        for pattern in exclude_patterns:
            if re.search(pattern, url):
                return False
        
        return False

    def scrape_hospital_details_comprehensive(self, hospital_url):
        """Comprehensive hospital detail scraping"""
        try:
            html = self.safe_get(hospital_url)
            if not html:
                return None
            
            soup = self.get_soup(html)
            if not soup:
                return None
            
            # Enhanced hospital data extraction
            name = self.extract_name_comprehensive(soup)
            if not name or len(name) < 3:
                return None
            
            hospital_data = {
                'name': name,
                'url': hospital_url,
                'location': self.extract_location_comprehensive(soup),
                'city': self.extract_city_comprehensive(soup),
                'state': self.extract_state_comprehensive(soup),
                'address': self.extract_address_comprehensive(soup),
                'phone': self.extract_phone_comprehensive(soup),
                'email': self.extract_email_comprehensive(soup),
                'website': self.extract_website_comprehensive(soup),
                'specialties': self.extract_specialties_comprehensive(soup),
                'services': self.extract_services_comprehensive(soup),
                'facilities': self.extract_facilities_comprehensive(soup),
                'description': self.extract_description_comprehensive(soup),
                'rating': self.extract_rating_comprehensive(soup),
                'established_year': self.extract_established_comprehensive(soup),
                'bed_count': self.extract_beds_comprehensive(soup),
                'accreditations': self.extract_accreditations_comprehensive(soup),
                'country': 'India',
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            self.progress['hospitals_scraped'] += 1
            return hospital_data
                
        except Exception as e:
            logger.error(f"❌ Error scraping {hospital_url}: {e}")
            return None

    def extract_name_comprehensive(self, soup):
        """Comprehensive name extraction"""
        # Multiple strategies for name extraction
        selectors = [
            'h1', '.hospital-name', '.page-title', '.main-title', '.title', '.name',
            '[class*="hospital-name"]', '[class*="title"]', '[class*="name"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 3:
                    # Clean up common suffixes and prefixes
                    text = re.sub(r'\s*-\s*Vaidam.*', '', text, flags=re.IGNORECASE)
                    text = re.sub(r'\s*\|\s*Vaidam.*', '', text, flags=re.IGNORECASE)
                    text = re.sub(r'\s*-\s*India.*', '', text, flags=re.IGNORECASE)
                    text = re.sub(r'^(Top|Best|Leading)\s+', '', text, flags=re.IGNORECASE)
                    text = re.sub(r'\s+(in|for|at)\s+\w+.*$', '', text, flags=re.IGNORECASE)
                    return text.strip()
        
        # Try title tag as fallback
        title = soup.find('title')
        if title:
            text = title.get_text()
            text = re.sub(r'\s*-\s*Vaidam.*', '', text, flags=re.IGNORECASE)
            if len(text) > 3:
                return text.strip()
        
        return ""

    def extract_location_comprehensive(self, soup):
        """Comprehensive location extraction"""
        # Look for location information
        selectors = [
            '.location', '.address', '.city', '.place', '[class*="location"]', 
            '[class*="address"]', '[class*="city"]', '[class*="place"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 2:
                    return text
        
        # Look in text content for location patterns
        text = soup.get_text()
        location_patterns = [
            r'Location:\s*([^,\n]{5,50})',
            r'Address:\s*([^,\n]{5,50})',
            r'Located in\s*([^,\n]{5,50})'
        ]
        
        for pattern in location_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return ""

    def extract_city_comprehensive(self, soup):
        """Comprehensive city extraction"""
        # Major Indian cities for matching
        cities = [
            'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad',
            'surat', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal',
            'visakhapatnam', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik',
            'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad',
            'amritsar', 'allahabad', 'ranchi', 'howrah', 'coimbatore', 'jabalpur', 'gwalior',
            'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 'chandigarh',
            'tiruchirappalli', 'solapur', 'bareilly', 'mysore', 'tiruppur', 'gurgaon', 'aligarh',
            'jalandhar', 'bhubaneswar', 'salem', 'warangal', 'guntur', 'bhiwandi', 'saharanpur',
            'gorakhpur', 'bikaner', 'amravati', 'noida', 'jamshedpur', 'bhilai', 'cuttack',
            'firozabad', 'kochi', 'bhavnagar', 'dehradun', 'durgapur', 'asansol', 'rourkela'
        ]
        
        text = soup.get_text().lower()
        for city in cities:
            if city in text:
                return city.title()
        
        return ""

    def extract_state_comprehensive(self, soup):
        """Comprehensive state extraction"""
        states = [
            'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
            'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
            'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
            'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
            'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'chandigarh', 'puducherry'
        ]
        
        text = soup.get_text().lower()
        for state in states:
            if state in text:
                return state.title()
        
        return ""

    def extract_address_comprehensive(self, soup):
        """Comprehensive address extraction"""
        selectors = [
            '.full-address', '.complete-address', '.address-details', '.contact-address',
            '[class*="full-address"]', '[class*="complete-address"]', '[class*="address-details"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 10:
                    return text
        
        return ""

    def extract_phone_comprehensive(self, soup):
        """Comprehensive phone extraction"""
        text = soup.get_text()
        phone_patterns = [
            r'\+91[\s-]?\d{10}',
            r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b',
            r'\b\d{10}\b',
            r'\b\d{2,4}[-.\s]?\d{6,8}\b'
        ]
        
        for pattern in phone_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        return ""

    def extract_email_comprehensive(self, soup):
        """Comprehensive email extraction"""
        text = soup.get_text()
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        if email_match:
            return email_match.group(0)
        return ""

    def extract_website_comprehensive(self, soup):
        """Comprehensive website extraction"""
        links = soup.find_all('a', href=True)
        for link in links:
            href = link['href']
            if 'http' in href and 'vaidam' not in href.lower():
                if any(word in href.lower() for word in ['hospital', 'medical', 'health', 'care', '.in', '.com']):
                    return href
        return ""

    def extract_specialties_comprehensive(self, soup):
        """Comprehensive specialty extraction"""
        specialties = []
        
        specialty_keywords = [
            'cardiology', 'cardiac surgery', 'oncology', 'cancer treatment', 'orthopedics', 
            'orthopedic surgery', 'neurology', 'neurosurgery', 'gastroenterology', 'urology',
            'dermatology', 'plastic surgery', 'cosmetic surgery', 'gynecology', 'obstetrics',
            'pediatrics', 'psychiatry', 'radiology', 'pathology', 'ophthalmology', 'ent',
            'pulmonology', 'nephrology', 'endocrinology', 'rheumatology', 'emergency medicine',
            'general surgery', 'laparoscopic surgery', 'minimally invasive surgery', 'anesthesiology',
            'critical care', 'intensive care', 'family medicine', 'internal medicine',
            'sports medicine', 'pain management', 'rehabilitation', 'physiotherapy'
        ]
        
        text = soup.get_text().lower()
        for keyword in specialty_keywords:
            if keyword in text:
                specialties.append(keyword.title())
        
        return list(set(specialties))  # Remove duplicates

    def extract_services_comprehensive(self, soup):
        """Comprehensive service extraction"""
        services = []
        service_keywords = [
            'emergency', 'icu', 'intensive care', 'operation theatre', 'ot', 'pharmacy', 
            'laboratory', 'lab', 'radiology', 'pathology', 'blood bank', 'dialysis', 
            'physiotherapy', 'ambulance', 'cafeteria', 'parking', '24x7', '24/7',
            'diagnostic center', 'mri', 'ct scan', 'ultrasound', 'x-ray', 'mammography',
            'ecg', 'echo', 'endoscopy', 'colonoscopy', 'bronchoscopy', 'biopsy'
        ]
        
        text = soup.get_text().lower()
        for keyword in service_keywords:
            if keyword in text:
                services.append(keyword.title())
        
        return list(set(services))

    def extract_facilities_comprehensive(self, soup):
        """Comprehensive facility extraction"""
        facilities = []
        facility_keywords = [
            'wifi', 'wi-fi', 'ac', 'air conditioning', 'lift', 'elevator', 'wheelchair accessible',
            'ramp', 'chapel', 'mosque', 'temple', 'prayer room', 'atm', 'bank', 'guest house',
            'accommodation', 'international patient services', 'translation services',
            'medical tourism', 'visa assistance', 'airport pickup', 'food court', 'restaurant'
        ]
        
        text = soup.get_text().lower()
        for keyword in facility_keywords:
            if keyword in text:
                facilities.append(keyword.title())
        
        return list(set(facilities))

    def extract_description_comprehensive(self, soup):
        """Comprehensive description extraction"""
        desc_selectors = [
            '.description', '.about', '.overview', '.summary', '.intro', '.content',
            '[class*="description"]', '[class*="about"]', '[class*="overview"]'
        ]
        
        for selector in desc_selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 50:
                    return text[:500]  # Limit to 500 characters
        
        # Look for meaningful paragraphs
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) > 100 and 'hospital' in text.lower():
                return text[:500]
        
        return ""

    def extract_rating_comprehensive(self, soup):
        """Comprehensive rating extraction"""
        text = soup.get_text()
        rating_patterns = [
            r'(\d+\.?\d*)\s*(?:out\s*of\s*5|/5|\*|stars?)',
            r'rating:?\s*(\d+\.?\d*)',
            r'(\d+\.?\d*)\s*rating',
            r'score:?\s*(\d+\.?\d*)'
        ]
        
        for pattern in rating_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    rating = float(match.group(1))
                    if 0 <= rating <= 5:
                        return rating
                except:
                    pass
        
        return 0.0

    def extract_established_comprehensive(self, soup):
        """Comprehensive establishment year extraction"""
        text = soup.get_text()
        established_patterns = [
            r'established.{0,20}(\d{4})',
            r'founded.{0,20}(\d{4})',
            r'since.{0,20}(\d{4})',
            r'started.{0,20}(\d{4})'
        ]
        
        for pattern in established_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                year = int(match.group(1))
                if 1800 <= year <= 2025:  # Reasonable year range
                    return year
        
        return 0

    def extract_beds_comprehensive(self, soup):
        """Comprehensive bed count extraction"""
        text = soup.get_text()
        beds_patterns = [
            r'(\d+)\s*beds?',
            r'bed\s*capacity:?\s*(\d+)',
            r'(\d+)\s*bed\s*hospital'
        ]
        
        for pattern in beds_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                beds = int(match.group(1))
                if 10 <= beds <= 5000:  # Reasonable bed count range
                    return beds
        
        return 0

    def extract_accreditations_comprehensive(self, soup):
        """Comprehensive accreditation extraction"""
        accreditations = []
        accred_keywords = [
            'nabh', 'nabl', 'jci', 'iso 9001', 'iso 14001', 'nqas', 'qci', 'accredited',
            'certified', 'iso certified', 'quality certification'
        ]
        
        text = soup.get_text().lower()
        for keyword in accred_keywords:
            if keyword in text:
                accreditations.append(keyword.upper())
        
        return list(set(accreditations))

    def extract_doctors_comprehensive(self, soup, hospital_data):
        """Enhanced comprehensive doctor extraction with detailed specializations"""
        doctors = []
        text = soup.get_text()
        
        # Enhanced doctor name patterns
        doctor_patterns = [
            r'dr\.?\s+([a-z][a-z\s\.]{3,50})',  # Dr. Name
            r'doctor\s+([a-z][a-z\s\.]{3,50})',  # Doctor Name
            r'prof\.?\s+dr\.?\s+([a-z][a-z\s\.]{3,50})',  # Prof. Dr. Name
            r'consultant\s+([a-z][a-z\s\.]{3,50})',  # Consultant Name
            r'specialist\s+([a-z][a-z\s\.]{3,50})',  # Specialist Name
        ]
        
        doctor_names = set()
        for pattern in doctor_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                name = match.strip()
                if (len(name) > 3 and 
                    name.lower() not in ['more', 'all', 'list', 'team', 'staff', 'about', 'contact', 'view', 'see'] and
                    not re.search(r'\d', name) and  # No numbers in name
                    len(name.split()) <= 5):  # Not more than 5 words
                    doctor_names.add(name.title())
        
        # Comprehensive specialization mapping
        specializations = {
            'Cardiologist': ['cardiology', 'cardiac', 'heart', 'cardiovascular', 'coronary'],
            'Cardiac Surgeon': ['cardiac surgery', 'heart surgery', 'bypass surgery', 'valve surgery'],
            'Oncologist': ['oncology', 'cancer', 'tumor', 'chemotherapy', 'radiation oncology'],
            'Neurologist': ['neurology', 'neurological', 'brain disorders', 'epilepsy', 'stroke'],
            'Neurosurgeon': ['neurosurgery', 'brain surgery', 'spine surgery', 'neurological surgery'],
            'Orthopedic Surgeon': ['orthopedic', 'orthopedics', 'bone', 'joint', 'fracture', 'sports medicine'],
            'Gastroenterologist': ['gastroenterology', 'gastro', 'liver', 'stomach', 'digestive', 'endoscopy'],
            'Urologist': ['urology', 'kidney', 'bladder', 'prostate', 'urinary', 'nephrology'],
            'Gynecologist': ['gynecology', 'women', 'obstetrics', 'pregnancy', 'delivery', 'fertility'],
            'Pediatrician': ['pediatrics', 'children', 'child', 'newborn', 'infant', 'neonatal'],
            'Dermatologist': ['dermatology', 'skin', 'hair', 'dermatological'],
            'Plastic Surgeon': ['plastic surgery', 'cosmetic surgery', 'aesthetic', 'reconstruction'],
            'Psychiatrist': ['psychiatry', 'mental', 'psychology', 'behavioral', 'psychiatric'],
            'Radiologist': ['radiology', 'imaging', 'x-ray', 'ct scan', 'mri', 'ultrasound'],
            'Anesthesiologist': ['anesthesia', 'anesthesiology', 'pain management', 'anesthetic'],
            'Pathologist': ['pathology', 'laboratory', 'diagnosis', 'biopsy', 'histopathology'],
            'Ophthalmologist': ['ophthalmology', 'eye', 'vision', 'retina', 'cataract', 'glaucoma'],
            'ENT Specialist': ['ent', 'ear', 'nose', 'throat', 'hearing', 'otolaryngology'],
            'Pulmonologist': ['pulmonology', 'lung', 'respiratory', 'chest', 'pulmonary'],
            'Endocrinologist': ['endocrinology', 'diabetes', 'thyroid', 'hormone', 'metabolic'],
            'Rheumatologist': ['rheumatology', 'arthritis', 'autoimmune', 'joint pain', 'lupus'],
            'Nephrologist': ['nephrology', 'kidney', 'dialysis', 'renal', 'kidney disease'],
            'General Surgeon': ['general surgery', 'surgery', 'laparoscopic', 'minimally invasive'],
            'Emergency Physician': ['emergency', 'trauma', 'critical care', 'emergency medicine'],
            'Family Physician': ['family medicine', 'general practice', 'primary care', 'gp'],
            'Internal Medicine': ['internal medicine', 'internist', 'general medicine', 'physician'],
            'Dentist': ['dental', 'dentistry', 'oral', 'teeth', 'orthodontics'],
            'Physiotherapist': ['physiotherapy', 'physical therapy', 'rehabilitation', 'physio']
        }
        
        # Extract detailed information for each doctor
        text_lower = text.lower()
        
        for name in list(doctor_names)[:25]:  # Limit to 25 doctors per hospital
            # Find the best matching specialization
            doctor_specialization = "General Physician"  # Default
            max_matches = 0
            
            for specialization, keywords in specializations.items():
                matches = sum(1 for keyword in keywords if keyword in text_lower)
                if matches > max_matches:
                    max_matches = matches
                    doctor_specialization = specialization
            
            # Extract experience
            experience = ""
            name_escaped = re.escape(name)
            experience_patterns = [
                rf'{name_escaped}.{{0,300}}?(\d+)\+?\s*years?\s*(?:of\s*)?experience',
                rf'(\d+)\+?\s*years?\s*(?:of\s*)?experience.{{0,300}}?{name_escaped}',
                rf'{name_escaped}.{{0,100}}?(\d+)\s*yrs?',
            ]
            
            for pattern in experience_patterns:
                exp_match = re.search(pattern, text, re.IGNORECASE)
                if exp_match:
                    experience = f"{exp_match.group(1)} years"
                    break
            
            # Extract qualifications
            qualifications = []
            qualification_patterns = [
                r'MBBS', r'MD', r'MS', r'DM', r'MCh', r'FRCS', r'MRCP', 
                r'PhD', r'Fellowship', r'FACS', r'FICS', r'DNB', r'DOMS',
                r'DGO', r'DCH', r'DTCD', r'FCPS', r'FRCOG', r'FRCR'
            ]
            
            for qual_pattern in qualification_patterns:
                if re.search(qual_pattern, text, re.IGNORECASE):
                    qualifications.append(qual_pattern)
            
            # Extract consultation fee
            consultation_fee = ""
            fee_patterns = [
                rf'{name_escaped}.{{0,200}}?(?:fee|consultation|charges?):?\s*₹?(\d+)',
                rf'₹\s*(\d+).{{0,100}}?consultation.{{0,100}}?{name_escaped}',
                rf'charges?\s*₹?(\d+).{{0,100}}?{name_escaped}'
            ]
            
            for pattern in fee_patterns:
                fee_match = re.search(pattern, text, re.IGNORECASE)
                if fee_match:
                    consultation_fee = f"₹{fee_match.group(1)}"
                    break
            
            # Extract education
            education = ""
            education_patterns = [
                rf'{name_escaped}.{{0,300}}?(AIIMS|IIT|IIM|Harvard|Stanford|Johns Hopkins|Mayo Clinic)',
                rf'({name_escaped}).{{0,100}}?(University|College|Institute)',
            ]
            
            for pattern in education_patterns:
                edu_match = re.search(pattern, text, re.IGNORECASE)
                if edu_match:
                    education = edu_match.group(1) if len(edu_match.groups()) > 1 else edu_match.group(0)
                    break
            
            doctor_data = {
                'name': f"Dr. {name}",
                'specialization': doctor_specialization,
                'experience': experience,
                'qualifications': ', '.join(set(qualifications)) if qualifications else "",
                'consultation_fee': consultation_fee,
                'education': education,
                'hospital_name': hospital_data['name'],
                'hospital_city': hospital_data['city'],
                'hospital_state': hospital_data['state'],
                'hospital_url': hospital_data['url'],
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            doctors.append(doctor_data)
        
        return doctors

    def save_to_mongodb_comprehensive(self):
        """Comprehensive MongoDB save with bulk operations"""
        try:
            logger.info("💾 Saving comprehensive data to MongoDB...")
            
            # Save hospitals with bulk operations
            if self.scraped_data['hospitals']:
                try:
                    hospital_ops = []
                    for hospital in self.scraped_data['hospitals']:
                        hospital_ops.append(
                            pymongo.UpdateOne(
                                {'url': hospital['url']},
                                {'$set': hospital},
                                upsert=True
                            )
                        )
                    
                    if hospital_ops:
                        result = self.db.hospitals.bulk_write(hospital_ops)
                        logger.info(f"💾 Saved {len(hospital_ops)} hospitals to MongoDB (upserted: {result.upserted_count}, modified: {result.modified_count})")
                except Exception as e:
                    logger.error(f"❌ Error saving hospitals: {e}")
            
            # Save doctors with bulk operations
            if self.scraped_data['doctors']:
                try:
                    doctor_ops = []
                    for doctor in self.scraped_data['doctors']:
                        doctor_ops.append(
                            pymongo.UpdateOne(
                                {'name': doctor['name'], 'hospital_name': doctor['hospital_name']},
                                {'$set': doctor},
                                upsert=True
                            )
                        )
                    
                    if doctor_ops:
                        result = self.db.doctors.bulk_write(doctor_ops)
                        logger.info(f"💾 Saved {len(doctor_ops)} doctors to MongoDB (upserted: {result.upserted_count}, modified: {result.modified_count})")
                except Exception as e:
                    logger.error(f"❌ Error saving doctors: {e}")
            
        except Exception as e:
            logger.error(f"❌ Error saving to MongoDB: {e}")

    def export_to_csv_comprehensive(self):
        """Comprehensive CSV export"""
        try:
            if self.scraped_data['hospitals']:
                df = pd.DataFrame(self.scraped_data['hospitals'])
                df.to_csv('vaidam_comprehensive_india_hospitals.csv', index=False)
                logger.info(f"📄 Exported {len(self.scraped_data['hospitals'])} hospitals to CSV")
            
            if self.scraped_data['doctors']:
                df = pd.DataFrame(self.scraped_data['doctors'])
                df.to_csv('vaidam_comprehensive_india_doctors.csv', index=False)
                logger.info(f"📄 Exported {len(self.scraped_data['doctors'])} doctors to CSV")
            
        except Exception as e:
            logger.error(f"❌ Error exporting to CSV: {e}")

    def run_comprehensive_india_scrape(self):
        """Run the comprehensive India scraping process"""
        start_time = time.time()
        
        try:
            logger.info("🇮🇳🚀 STARTING COMPREHENSIVE INDIA HOSPITAL SCRAPING 🚀🇮🇳")
            
            # Initialize
            self.init_session()
            self.init_mongodb()
            
            # Discover ALL hospital URLs in India
            hospital_urls = self.discover_all_india_hospitals()
            
            if not hospital_urls:
                logger.error("❌ No hospital URLs found. Exiting...")
                return
            
            logger.info(f"🎯 Found {len(hospital_urls)} hospital URLs to scrape")
            
            # Comprehensive scraping of each hospital
            for i, url in enumerate(hospital_urls, 1):
                try:
                    # Scrape hospital details
                    hospital_data = self.scrape_hospital_details_comprehensive(url)
                    
                    if hospital_data:
                        self.scraped_data['hospitals'].append(hospital_data)
                        
                        # Extract doctors from the same page
                        html = self.safe_get(url)
                        if html:
                            soup = self.get_soup(html)
                            if soup:
                                doctors = self.extract_doctors_comprehensive(soup, hospital_data)
                                self.scraped_data['doctors'].extend(doctors)
                                self.progress['doctors_scraped'] += len(doctors)
                        
                        logger.info(f"✅ {i}/{len(hospital_urls)}: {hospital_data['name']} ({len(doctors) if 'doctors' in locals() else 0} doctors)")
                    
                    # Save progress every 50 hospitals
                    if i % 50 == 0:
                        logger.info(f"📊 Progress: {i}/{len(hospital_urls)} hospitals processed")
                        logger.info(f"📈 Stats: Hospitals: {len(self.scraped_data['hospitals'])}, Doctors: {len(self.scraped_data['doctors'])}")
                        self.save_to_mongodb_comprehensive()
                        
                        # Clear data to save memory
                        self.scraped_data['hospitals'] = []
                        self.scraped_data['doctors'] = []
                    
                    self.random_delay(0.2, 0.5)
                    
                except Exception as e:
                    logger.error(f"❌ Error processing {url}: {e}")
                    continue
            
            # Final save
            self.save_to_mongodb_comprehensive()
            self.export_to_csv_comprehensive()
            
            # Results
            end_time = time.time()
            duration = (end_time - start_time) / 60
            
            logger.info("🎉🇮🇳 COMPREHENSIVE INDIA SCRAPING COMPLETED! 🇮🇳🎉")
            logger.info(f"⏱️  Total Time: {duration:.2f} minutes")
            logger.info(f"🏥 Hospitals Scraped: {self.progress['hospitals_scraped']}")
            logger.info(f"👨‍⚕️ Doctors Found: {self.progress['doctors_scraped']}")
            logger.info(f"🏙️ Cities Processed: {self.progress['cities_processed']}")
            logger.info(f"🔗 URLs Discovered: {self.progress['total_urls_discovered']}")
            
        except Exception as e:
            logger.error(f"❌ Critical error: {e}")
        
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        try:
            if self.session:
                self.session.close()
            if self.mongo_client:
                self.mongo_client.close()
            logger.info("🧹 Cleanup completed")
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {e}")

def main():
    """Main function"""
    scraper = VaidamComprehensiveIndiaScraper()
    scraper.run_comprehensive_india_scrape()

if __name__ == "__main__":
    main()
