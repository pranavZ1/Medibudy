#!/usr/bin/env python3
"""
Lightning Fast Vaidam Website Scraper
Using only requests + BeautifulSoup for maximum speed and efficiency
Scrapes ALL hospitals, doctors, and treatments from Vaidam website
NO SELENIUM - NO TIMEOUTS - JUST SPEED!
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
        logging.FileHandler('vaidam_lightning_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VaidamLightningScraper:
    def __init__(self):
        self.base_url = "https://www.vaidam.com"
        self.session = None
        self.mongo_client = None
        self.db = None
        
        # Collections to store scraped data
        self.scraped_data = {
            'hospitals': [],
            'doctors': [],
            'treatments': []
        }
        
        # Progress tracking
        self.progress = {
            'hospitals_scraped': 0,
            'doctors_scraped': 0,
            'treatments_scraped': 0,
            'total_pages_processed': 0
        }
        
        # User agents for rotation
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15"
        ]

    def init_session(self):
        """Initialize requests session with retry strategy"""
        logger.info("⚡ Initializing Lightning Fast HTTP session...")
        
        self.session = requests.Session()
        
        # Retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set headers
        self.session.headers.update({
            'User-Agent': random.choice(self.user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        })
        
        logger.info("✅ Lightning HTTP session initialized successfully")

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

    def safe_get(self, url, timeout=10):
        """Lightning fast HTTP request"""
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
                time.sleep(2)
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
            return BeautifulSoup(html, 'lxml')  # lxml is faster than html.parser
        except Exception as e:
            logger.error(f"❌ Error parsing HTML: {e}")
            return None

    def discover_hospital_urls_lightning(self):
        """Comprehensive hospital URL discovery for ALL hospitals in India"""
        logger.info("🇮🇳 Starting comprehensive hospital URL discovery for ALL INDIA hospitals...")
        hospital_urls = set()
        
        # Comprehensive list of all major Indian cities
        indian_cities = [
            'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 
            'pune', 'ahmedabad', 'jaipur', 'gurgaon', 'noida', 'lucknow',
            'kochi', 'coimbatore', 'indore', 'bhopal', 'nagpur', 'visakhapatnam',
            'vadodara', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut',
            'rajkot', 'kalyan-dombivali', 'vasai-virar', 'varanasi', 'srinagar',
            'aurangabad', 'dhanbad', 'amritsar', 'navi-mumbai', 'allahabad',
            'howrah', 'gwalior', 'jabalpur', 'coimbatore', 'vijayawada',
            'jodhpur', 'madurai', 'raipur', 'kota', 'chandigarh', 'guwahati',
            'solapur', 'hubli-dharwad', 'tiruchirappalli', 'bareilly', 'mysore',
            'tiruppur', 'ghaziabad', 'jalandhar', 'bhubaneswar', 'salem',
            'mira-bhayandar', 'thiruvananthapuram', 'bhiwandi', 'saharanpur',
            'gorakhpur', 'guntur', 'bikaner', 'amravati', 'noida', 'jamshedpur',
            'bhilai', 'warangal', 'cuttack', 'firozabad', 'kochi', 'bhavnagar',
            'dehradun', 'durgapur', 'asansol', 'nanded', 'kolhapur', 'ajmer'
        ]
        
        # All medical specialties available in India
        specialties = [
            'cardiology-and-cardiac-surgery',
            'cosmetic-and-plastic-surgery', 
            'gynecology',
            'hematology',
            'ivf-and-infertility',
            'neurology-and-neurosurgery',
            'oncology-and-oncosurgery',
            'orthopedics',
            'spine-surgery',
            'gastroenterology',
            'urology',
            'pediatrics-and-pediatric-surgery',
            'dermatology',
            'ophthalmology',
            'ent',
            'pulmonology',
            'endocrinology',
            'nephrology',
            'general-surgery',
            'emergency-medicine',
            'internal-medicine'
        ]
        
        # Strategy 1: City-wise hospital discovery
        logger.info(f"🏙️ Discovering hospitals in {len(indian_cities)} Indian cities...")
        for city in indian_cities:
            city_url = f"{self.base_url}/hospitals/india/{city}"
            urls = self.scrape_hospital_listing_lightning(city_url, max_pages=10)
            hospital_urls.update(urls)
            logger.info(f"🏙️ {city.title()}: Found {len(urls)} hospitals")
            self.random_delay(0.2, 0.4)
        
        # Strategy 2: Specialty + City combinations for comprehensive coverage
        logger.info(f"🏥 Discovering hospitals by specialty-city combinations...")
        for specialty in specialties[:10]:  # Limit to top 10 specialties for speed
            for city in indian_cities[:20]:  # Top 20 cities for each specialty
                specialty_city_url = f"{self.base_url}/hospitals/{specialty}/india/{city}"
                urls = self.scrape_hospital_listing_lightning(specialty_city_url, max_pages=5)
                hospital_urls.update(urls)
                if urls:
                    logger.info(f"🔬 {specialty} in {city.title()}: Found {len(urls)} hospitals")
                self.random_delay(0.1, 0.3)
        
        # Strategy 3: General India-wide specialty searches
        logger.info(f"🇮🇳 Discovering hospitals by India-wide specialties...")
        for specialty in specialties:
            specialty_url = f"{self.base_url}/hospitals/{specialty}/india"
            urls = self.scrape_hospital_listing_lightning(specialty_url, max_pages=20)
            hospital_urls.update(urls)
            logger.info(f"🔬 {specialty} India-wide: Found {len(urls)} hospitals")
            self.random_delay(0.3, 0.6)
        
        final_urls = list(hospital_urls)
        logger.info(f"🎯 TOTAL unique hospital URLs discovered: {len(final_urls)}")
        
        return final_urls

    def scrape_hospital_listing_lightning(self, listing_url, max_pages=5):
        """Lightning fast listing page scraping"""
        hospital_urls = []
        
        try:
            logger.info(f"⚡ Scraping listing: {listing_url}")
            
            # Scrape first page
            html = self.safe_get(listing_url)
            if html:
                soup = self.get_soup(html)
                if soup:
                    urls = self.extract_hospital_urls_lightning(soup)
                    hospital_urls.extend(urls)
                    logger.info(f"📄 Page 1: Found {len(urls)} hospitals")
            
            # Limited pagination for speed
            for page in range(2, max_pages + 1):
                page_url = f"{listing_url}?page={page}"
                page_html = self.safe_get(page_url)
                
                if not page_html:
                    break
                
                page_soup = self.get_soup(page_html)
                if not page_soup:
                    break
                
                page_urls = self.extract_hospital_urls_lightning(page_soup)
                if not page_urls:
                    logger.info(f"📄 No more hospitals found at page {page}, stopping")
                    break
                
                hospital_urls.extend(page_urls)
                logger.info(f"📄 Page {page}: Found {len(page_urls)} hospitals")
                
                self.random_delay(0.2, 0.4)
            
            logger.info(f"✅ Total from {listing_url}: {len(hospital_urls)} hospitals")
            
        except Exception as e:
            logger.error(f"❌ Error scraping {listing_url}: {e}")
        
        return hospital_urls

    def extract_hospital_urls_lightning(self, soup):
        """Enhanced URL extraction to find individual hospital pages"""
        urls = []
        
        # Look for hospital cards/items in listings
        hospital_selectors = [
            # Common hospital listing patterns
            '.hospital-card a[href]',
            '.hospital-item a[href]', 
            '.listing-item a[href]',
            '.card-body a[href]',
            '.hospital-info a[href]',
            
            # Generic card patterns that might contain hospital links
            '.card a[href*="/hospital"]',
            '.item a[href*="/hospital"]',
            '.listing a[href*="/hospital"]',
            
            # Direct hospital URL patterns
            'a[href*="/hospitals/"][href*="/hospital-"]',
            'a[href*="/hospital/"]',
            'a[href*="hospital"][href*=".html"]',
            
            # Link patterns with hospital-related text
            'a[title*="Hospital"]',
            'a[title*="hospital"]',
            'a[title*="Medical"]',
            'a[title*="Healthcare"]',
            
            # Any links inside containers with hospital-related classes
            '[class*="hospital"] a[href]',
            '[class*="medical"] a[href]',
            '[class*="healthcare"] a[href]'
        ]
        
        for selector in hospital_selectors:
            try:
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
                        
                        if self.is_valid_hospital_url_lightning(full_url):
                            urls.append(full_url)
            except Exception as e:
                continue
        
        # Also extract from hospital name links in text
        hospital_name_links = soup.find_all('a', href=True)
        for link in hospital_name_links:
            href = link.get('href', '')
            link_text = link.get_text(strip=True).lower()
            
            # Look for hospital-related keywords in link text
            hospital_keywords = ['hospital', 'medical', 'healthcare', 'clinic', 'centre', 'center']
            if any(keyword in link_text for keyword in hospital_keywords):
                if href.startswith('/'):
                    full_url = self.base_url + href
                    if self.is_valid_hospital_url_lightning(full_url):
                        urls.append(full_url)
        
        return list(set(urls))  # Remove duplicates

    def is_valid_hospital_url_lightning(self, url):
        """Enhanced URL validation for individual hospital pages"""
        # Patterns that indicate individual hospital pages
        valid_patterns = [
            r'/hospitals?/[^/]+/hospital-[^/]+',      # /hospitals/city/hospital-name
            r'/hospitals?/[^/]+\.html',               # /hospitals/name.html  
            r'/hospital/[^/]+',                       # /hospital/name
            r'/hospitals/[^/]+/[^/]+/[^/]+/[^/]+',   # /hospitals/specialty/country/city/hospital
            r'/hospitals/.*hospital.*\.html',         # Any hospital-specific HTML page
            r'/hospital-details/',                    # Hospital details pages
            r'/hospital_details/',                    # Alternative hospital details pages
            r'/hospitals/.+/.+/.+',                   # Deep hospital URLs
        ]
        
        # Check if URL matches any valid pattern
        for pattern in valid_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                # Additional check: exclude obvious listing pages
                if not re.search(r'page=|search|filter|list|index', url, re.IGNORECASE):
                    return True
        
        # Exclude definite listing/category pages
        exclude_patterns = [
            r'/hospitals?/?$',                        # Just /hospitals or /hospitals/
            r'/hospitals?/[^/]+/?$',                  # /hospitals/country or /hospitals/specialty
            r'/hospitals?/[^/]+/[^/]+/?$',           # /hospitals/specialty/country (without specific hospital)
            r'page=\d+',                             # Pagination URLs
            r'search',                               # Search URLs
            r'filter',                               # Filter URLs
            r'category',                             # Category pages
            r'listing',                              # Listing pages
        ]
        
        for pattern in exclude_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return False
        
        # If URL contains hospital-related keywords and isn't excluded, consider it valid
        hospital_keywords = ['hospital', 'medical', 'healthcare', 'clinic']
        for keyword in hospital_keywords:
            if keyword in url.lower() and len(url.split('/')) > 4:  # Deep enough URL
                return True
        
        return False

    def scrape_hospital_details_lightning(self, hospital_url):
        """Comprehensive hospital detail scraping for individual hospitals"""
        try:
            html = self.safe_get(hospital_url)
            if not html:
                return None
            
            soup = self.get_soup(html)
            if not soup:
                return None
            
            # Extract hospital name - enhanced approach
            name = self.extract_name_lightning(soup)
            if not name or len(name) < 3 or 'hospitals' in name.lower():
                return None  # Skip generic listing pages
            
            # Comprehensive hospital data extraction
            hospital_data = {
                'name': name,
                'url': hospital_url,
                'address': self.extract_address_lightning(soup),
                'city': self.extract_city_lightning(soup),
                'state': self.extract_state_lightning(soup),
                'country': 'India',
                'phone': self.extract_phone_lightning(soup),
                'email': self.extract_email_lightning(soup),
                'website': self.extract_website_lightning(soup),
                'description': self.extract_description_lightning(soup),
                'specialties': self.extract_specialties_lightning(soup),
                'services': self.extract_services_lightning(soup),
                'facilities': self.extract_facilities_lightning(soup),
                'accreditations': self.extract_accreditations_lightning(soup),
                'bed_count': self.extract_bed_count_lightning(soup),
                'established_year': self.extract_established_year_lightning(soup),
                'rating': self.extract_rating_lightning(soup),
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            self.progress['hospitals_scraped'] += 1
            return hospital_data
                
        except Exception as e:
            logger.error(f"❌ Error scraping {hospital_url}: {e}")
            return None

    def extract_name_lightning(self, soup):
        """Enhanced hospital name extraction"""
        # Try multiple strategies to get the actual hospital name
        
        # Strategy 1: Look for specific hospital name selectors
        name_selectors = [
            'h1.hospital-name',
            '.hospital-title h1',
            '.hospital-header h1',
            'h1[class*="hospital"]',
            '.page-title h1',
            '.main-title h1'
        ]
        
        for selector in name_selectors:
            element = soup.select_one(selector)
            if element:
                name = element.get_text(strip=True)
                if len(name) > 3 and not any(word in name.lower() for word in ['hospitals', 'best', 'top']):
                    return self.clean_hospital_name(name)
        
        # Strategy 2: Try title tag with better cleaning
        title = soup.find('title')
        if title:
            title_text = title.get_text()
            # Remove common website suffixes
            cleaned_title = re.sub(r'\s*[-|]\s*(Vaidam|Best|Top|Hospitals?).*', '', title_text, flags=re.IGNORECASE)
            cleaned_title = re.sub(r'^(Best|Top|Leading)\s+', '', cleaned_title, flags=re.IGNORECASE)
            
            # Extract hospital name from patterns like "Apollo Hospital, Delhi"
            hospital_match = re.search(r'([A-Za-z\s&]+(?:Hospital|Medical|Healthcare|Clinic|Centre|Center))', cleaned_title)
            if hospital_match:
                return self.clean_hospital_name(hospital_match.group(1))
            
            if len(cleaned_title) > 3 and 'hospitals' not in cleaned_title.lower():
                return self.clean_hospital_name(cleaned_title)
        
        # Strategy 3: Look for h1 tags
        h1_tags = soup.find_all('h1')
        for h1 in h1_tags:
            text = h1.get_text(strip=True)
            if len(text) > 3 and not any(word in text.lower() for word in ['best', 'top', 'hospitals']):
                return self.clean_hospital_name(text)
        
        return ""
    
    def clean_hospital_name(self, name):
        """Clean and standardize hospital names"""
        if not name:
            return ""
        
        # Remove common prefixes and suffixes
        name = re.sub(r'^(Best|Top|Leading|#\d+)\s+', '', name, flags=re.IGNORECASE)
        name = re.sub(r'\s+(in|at|for)\s+[A-Za-z\s]+$', '', name, flags=re.IGNORECASE)
        name = re.sub(r'\s*-\s*(Best|Top|Leading).*', '', name, flags=re.IGNORECASE)
        
        return name.strip()

    def extract_address_lightning(self, soup):
        """Extract hospital address"""
        address_selectors = [
            '.hospital-address',
            '.address',
            '[class*="address"]',
            '.contact-info .address',
            '.location-info'
        ]
        
        for selector in address_selectors:
            element = soup.select_one(selector)
            if element:
                address = element.get_text(strip=True)
                if len(address) > 10:
                    return address
        
        # Look for address patterns in text
        text = soup.get_text()
        address_patterns = [
            r'Address:\s*([^\n]{20,100})',
            r'Location:\s*([^\n]{20,100})',
            r'(?:Address|Location):\s*([^,\n]{10,80}(?:,\s*[^,\n]{5,30})*)'
        ]
        
        for pattern in address_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return ""

    def extract_state_lightning(self, soup):
        """Extract hospital state"""
        indian_states = [
            'maharashtra', 'karnataka', 'tamil nadu', 'delhi', 'west bengal',
            'gujarat', 'rajasthan', 'uttar pradesh', 'haryana', 'kerala',
            'telangana', 'andhra pradesh', 'madhya pradesh', 'bihar',
            'odisha', 'punjab', 'jharkhand', 'assam', 'chhattisgarh'
        ]
        
        text = soup.get_text().lower()
        for state in indian_states:
            if state in text:
                return state.title()
        
        return ""

    def extract_email_lightning(self, soup):
        """Extract hospital email"""
        text = soup.get_text()
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_match = re.search(email_pattern, text)
        return email_match.group(0) if email_match else ""

    def extract_website_lightning(self, soup):
        """Extract hospital website"""
        # Look for website links
        website_selectors = [
            'a[href*="http"][href*="www"]',
            '.website a',
            '.hospital-website a'
        ]
        
        for selector in website_selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get('href', '')
                if 'vaidam' not in href.lower() and 'http' in href:
                    return href
        
        return ""

    def extract_description_lightning(self, soup):
        """Extract hospital description"""
        description_selectors = [
            '.hospital-description',
            '.about-hospital',
            '.hospital-overview',
            '.description',
            '.about'
        ]
        
        for selector in description_selectors:
            element = soup.select_one(selector)
            if element:
                desc = element.get_text(strip=True)
                if len(desc) > 50:
                    return desc[:500]  # Limit to 500 characters
        
        return ""

    def extract_services_lightning(self, soup):
        """Extract hospital services"""
        services = []
        service_keywords = [
            'emergency', 'icu', 'operation theater', 'pharmacy', 'laboratory',
            'radiology', 'pathology', 'physiotherapy', 'ambulance', 'blood bank'
        ]
        
        text = soup.get_text().lower()
        for service in service_keywords:
            if service in text:
                services.append(service.title())
        
        return services

    def extract_facilities_lightning(self, soup):
        """Extract hospital facilities"""
        facilities = []
        facility_keywords = [
            'parking', 'cafeteria', 'wifi', 'ac', 'lift', 'wheelchair access',
            'waiting area', 'reception', 'security'
        ]
        
        text = soup.get_text().lower()
        for facility in facility_keywords:
            if facility in text:
                facilities.append(facility.title())
        
        return facilities

    def extract_accreditations_lightning(self, soup):
        """Extract hospital accreditations"""
        accreditations = []
        accreditation_keywords = [
            'nabh', 'jci', 'iso', 'nabl', 'green ohr'
        ]
        
        text = soup.get_text().lower()
        for accred in accreditation_keywords:
            if accred in text:
                accreditations.append(accred.upper())
        
        return accreditations

    def extract_bed_count_lightning(self, soup):
        """Extract hospital bed count"""
        text = soup.get_text()
        bed_patterns = [
            r'(\d+)\s*beds?',
            r'bed\s*capacity:\s*(\d+)',
            r'(\d+)\s*bed\s*hospital'
        ]
        
        for pattern in bed_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return 0

    def extract_established_year_lightning(self, soup):
        """Extract hospital establishment year"""
        text = soup.get_text()
        year_patterns = [
            r'established\s*(?:in\s*)?(\d{4})',
            r'founded\s*(?:in\s*)?(\d{4})',
            r'since\s*(\d{4})'
        ]
        
        for pattern in year_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                year = int(match.group(1))
                if 1900 <= year <= 2025:
                    return year
        
        return 0

    def extract_rating_lightning(self, soup):
        """Extract hospital rating"""
        rating_selectors = [
            '.rating',
            '.star-rating',
            '[class*="rating"]'
        ]
        
        for selector in rating_selectors:
            element = soup.select_one(selector)
            if element:
                rating_text = element.get_text()
                rating_match = re.search(r'(\d+(?:\.\d+)?)', rating_text)
                if rating_match:
                    return float(rating_match.group(1))
        
        return 0.0

    def extract_location_lightning(self, soup):
        """Legacy method for backward compatibility"""
        return self.extract_address_lightning(soup)

    def extract_city_lightning(self, soup):
        """Enhanced city extraction"""
        # Comprehensive list of Indian cities
        indian_cities = [
            'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad',
            'pune', 'ahmedabad', 'jaipur', 'gurgaon', 'gurugram', 'noida', 'lucknow',
            'kochi', 'coimbatore', 'indore', 'bhopal', 'nagpur', 'visakhapatnam',
            'vadodara', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut',
            'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar',
            'navi mumbai', 'allahabad', 'prayagraj', 'howrah', 'gwalior', 'jabalpur',
            'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'chandigarh',
            'guwahati', 'solapur', 'tiruchirappalli', 'bareilly', 'mysore',
            'tiruppur', 'ghaziabad', 'jalandhar', 'bhubaneswar', 'salem',
            'thiruvananthapuram', 'saharanpur', 'gorakhpur', 'guntur', 'bikaner',
            'amravati', 'jamshedpur', 'bhilai', 'warangal', 'cuttack', 'firozabad',
            'bhavnagar', 'dehradun', 'durgapur', 'asansol', 'nanded', 'kolhapur',
            'ajmer', 'akola', 'latur', 'dharwad', 'korba', 'bhiwandi'
        ]
        
        text = soup.get_text().lower()
        
        # Look for city in URL first (most accurate)
        url = soup.find('link', {'rel': 'canonical'})
        if url:
            url_text = url.get('href', '').lower()
            for city in indian_cities:
                if city.replace(' ', '-') in url_text or city.replace(' ', '') in url_text:
                    return city.title()
        
        # Look for city in text content
        for city in indian_cities:
            # Check for exact matches and common variations
            city_patterns = [
                rf'\b{city}\b',
                rf'\b{city.replace(" ", "")}\b',
                rf'\b{city.replace(" ", "-")}\b'
            ]
            
            for pattern in city_patterns:
                if re.search(pattern, text):
                    return city.title()
        
        return ""

    def extract_specialties_lightning(self, soup):
        """Comprehensive specialty extraction"""
        specialties = []
        
        # Comprehensive specialty mapping
        specialty_keywords = {
            'Cardiology': ['cardiology', 'cardiac', 'heart', 'cardiovascular', 'coronary'],
            'Oncology': ['oncology', 'cancer', 'tumor', 'chemotherapy', 'radiation', 'oncological'],
            'Neurology': ['neurology', 'neurological', 'brain', 'nervous system', 'neurologist'],
            'Neurosurgery': ['neurosurgery', 'brain surgery', 'neurological surgery', 'neurosurgeon'],
            'Orthopedics': ['orthopedic', 'orthopedics', 'bone', 'joint', 'fracture', 'sports medicine', 'orthopedist'],
            'Gastroenterology': ['gastroenterology', 'gastro', 'liver', 'stomach', 'digestive', 'gastroenterologist'],
            'Urology': ['urology', 'kidney', 'bladder', 'prostate', 'urinary', 'urologist'],
            'Gynecology': ['gynecology', 'women', 'obstetrics', 'pregnancy', 'delivery', 'gynecologist'],
            'Pediatrics': ['pediatrics', 'children', 'child', 'newborn', 'infant', 'pediatrician'],
            'Dermatology': ['dermatology', 'skin', 'hair', 'cosmetic', 'dermatologist'],
            'Psychiatry': ['psychiatry', 'mental', 'psychology', 'behavioral', 'psychiatrist'],
            'Radiology': ['radiology', 'imaging', 'x-ray', 'ct scan', 'mri', 'radiologist'],
            'Anesthesiology': ['anesthesia', 'anesthesiology', 'pain management', 'anesthesiologist'],
            'Pathology': ['pathology', 'laboratory', 'diagnosis', 'biopsy', 'pathologist'],
            'Ophthalmology': ['ophthalmology', 'eye', 'vision', 'retina', 'cataract', 'ophthalmologist'],
            'ENT': ['ent', 'ear', 'nose', 'throat', 'hearing', 'otolaryngology'],
            'Pulmonology': ['pulmonology', 'lung', 'respiratory', 'chest', 'pulmonologist'],
            'Endocrinology': ['endocrinology', 'diabetes', 'thyroid', 'hormone', 'endocrinologist'],
            'Rheumatology': ['rheumatology', 'arthritis', 'autoimmune', 'joint pain', 'rheumatologist'],
            'Nephrology': ['nephrology', 'kidney', 'dialysis', 'renal', 'nephrologist'],
            'Plastic Surgery': ['plastic surgery', 'cosmetic surgery', 'aesthetic', 'reconstruction'],
            'General Surgery': ['general surgery', 'surgery', 'laparoscopic', 'minimally invasive'],
            'Emergency Medicine': ['emergency', 'trauma', 'critical care', 'intensive care'],
            'Internal Medicine': ['internal medicine', 'internist', 'general medicine'],
            'Hematology': ['hematology', 'blood', 'leukemia', 'lymphoma', 'hematologist'],
            'Spine Surgery': ['spine surgery', 'spinal', 'back surgery', 'vertebral'],
            'IVF': ['ivf', 'infertility', 'fertility', 'reproductive medicine'],
            'Dental': ['dental', 'dentistry', 'oral', 'teeth', 'dentist'],
            'Physiotherapy': ['physiotherapy', 'physical therapy', 'rehabilitation', 'physiotherapist']
        }
        
        text = soup.get_text().lower()
        
        for specialty, keywords in specialty_keywords.items():
            if any(keyword in text for keyword in keywords):
                specialties.append(specialty)
        
        return specialties

    def extract_phone_lightning(self, soup):
        """Enhanced phone number extraction"""
        text = soup.get_text()
        
        # Phone number patterns for India
        phone_patterns = [
            r'\+91[\s-]?(\d{10})',                    # +91 followed by 10 digits
            r'(\+91[\s-]?\d{5}[\s-]?\d{5})',         # +91 with space/dash in middle
            r'\b(\d{10})\b',                          # 10 digit number
            r'\b(\d{4}[\s-]\d{3}[\s-]\d{3})\b',      # With dashes/spaces
            r'phone:?\s*(\+91[\s-]?\d{10})',          # Phone: +91...
            r'tel:?\s*(\+91[\s-]?\d{10})',           # Tel: +91...
            r'mobile:?\s*(\+91[\s-]?\d{10})',        # Mobile: +91...
        ]
        
        for pattern in phone_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                phone = match.group(1) if match.lastindex else match.group(0)
                # Clean the phone number
                phone = re.sub(r'[^\d+]', '', phone)
                if len(phone) >= 10:
                    return phone
        
        return ""

    def extract_doctors_lightning(self, soup, hospital_data):
        """Enhanced doctor extraction with comprehensive specialization detection"""
        doctors = []
        text = soup.get_text()
        
        # Enhanced regex to find doctor names with better pattern matching
        doctor_patterns = [
            r'dr\.?\s+([a-z][a-z\s\.]{3,40})',  # Dr. Name or Dr Name
            r'doctor\s+([a-z][a-z\s\.]{3,40})',  # Doctor Name
            r'prof\.?\s+dr\.?\s+([a-z][a-z\s\.]{3,40})',  # Prof. Dr. Name
            r'consultant\s+([a-z][a-z\s\.]{3,40})',  # Consultant Name
        ]
        
        doctor_names = set()
        for pattern in doctor_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                name = match.strip()
                if len(name) > 3 and name.lower() not in ['more', 'all', 'list', 'team', 'staff', 'about', 'contact']:
                    doctor_names.add(name.title())
        
        # Comprehensive specialization mapping
        specializations = {
            'cardiologist': ['cardiology', 'cardiac', 'heart', 'cardiovascular'],
            'oncologist': ['oncology', 'cancer', 'tumor', 'chemotherapy', 'radiation'],
            'neurologist': ['neurology', 'neuro', 'brain', 'nervous', 'neurological'],
            'neurosurgeon': ['neurosurgery', 'brain surgery', 'spine surgery', 'neurological surgery'],
            'orthopedic surgeon': ['orthopedic', 'orthopedics', 'bone', 'joint', 'fracture', 'sports medicine'],
            'gastroenterologist': ['gastroenterology', 'gastro', 'liver', 'stomach', 'digestive'],
            'urologist': ['urology', 'kidney', 'bladder', 'prostate', 'urinary'],
            'gynecologist': ['gynecology', 'women', 'obstetrics', 'pregnancy', 'delivery'],
            'pediatrician': ['pediatrics', 'children', 'child', 'newborn', 'infant'],
            'dermatologist': ['dermatology', 'skin', 'hair', 'cosmetic'],
            'psychiatrist': ['psychiatry', 'mental', 'psychology', 'behavioral'],
            'radiologist': ['radiology', 'imaging', 'x-ray', 'ct scan', 'mri'],
            'anesthesiologist': ['anesthesia', 'anesthesiology', 'pain management'],
            'pathologist': ['pathology', 'laboratory', 'diagnosis', 'biopsy'],
            'ophthalmologist': ['ophthalmology', 'eye', 'vision', 'retina', 'cataract'],
            'ent specialist': ['ent', 'ear', 'nose', 'throat', 'hearing'],
            'pulmonologist': ['pulmonology', 'lung', 'respiratory', 'chest'],
            'endocrinologist': ['endocrinology', 'diabetes', 'thyroid', 'hormone'],
            'rheumatologist': ['rheumatology', 'arthritis', 'autoimmune', 'joint pain'],
            'nephrologist': ['nephrology', 'kidney', 'dialysis', 'renal'],
            'plastic surgeon': ['plastic surgery', 'cosmetic surgery', 'aesthetic', 'reconstruction'],
            'general surgeon': ['general surgery', 'surgery', 'laparoscopic', 'minimally invasive'],
            'emergency physician': ['emergency', 'trauma', 'critical care', 'intensive care'],
            'family physician': ['family medicine', 'general practice', 'primary care'],
            'internal medicine': ['internal medicine', 'internist', 'general medicine']
        }
        
        # Extract specializations for each doctor
        text_lower = text.lower()
        
        for name in list(doctor_names)[:20]:  # Limit to 20 doctors per hospital for performance
            # Find the best matching specialization
            doctor_specialization = ""
            max_matches = 0
            
            for specialization, keywords in specializations.items():
                matches = sum(1 for keyword in keywords if keyword in text_lower)
                if matches > max_matches:
                    max_matches = matches
                    doctor_specialization = specialization
            
            # Extract experience if mentioned near the doctor's name
            experience = ""
            name_pattern = name.replace(' ', r'\s+')
            experience_pattern = rf'{name_pattern}.{{0,200}}?(\d+)\+?\s*years?\s*(?:of\s*)?experience'
            exp_match = re.search(experience_pattern, text, re.IGNORECASE)
            if exp_match:
                experience = f"{exp_match.group(1)} years"
            
            # Extract qualifications
            qualifications = []
            qualification_patterns = [
                r'MBBS', r'MD', r'MS', r'DM', r'MCh', r'FRCS', r'MRCP', 
                r'PhD', r'Fellowship', r'FACS', r'FICS', r'DNB'
            ]
            
            for qual_pattern in qualification_patterns:
                if re.search(qual_pattern, text, re.IGNORECASE):
                    qualifications.append(qual_pattern)
            
            doctor_data = {
                'name': f"Dr. {name}",
                'specialization': doctor_specialization,
                'experience': experience,
                'qualifications': ', '.join(qualifications) if qualifications else "",
                'hospital_name': hospital_data['name'],
                'hospital_city': hospital_data['city'],
                'hospital_url': hospital_data['url'],
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            doctors.append(doctor_data)
        
        return doctors

    def save_to_mongodb_lightning(self):
        """Lightning fast MongoDB save"""
        try:
            if self.scraped_data['hospitals']:
                # Bulk operations for speed
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
                    self.db.hospitals.bulk_write(hospital_ops)
                    logger.info(f"⚡ Saved {len(hospital_ops)} hospitals to MongoDB")
            
            if self.scraped_data['doctors']:
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
                    self.db.doctors.bulk_write(doctor_ops)
                    logger.info(f"⚡ Saved {len(doctor_ops)} doctors to MongoDB")
            
        except Exception as e:
            logger.error(f"❌ Error saving to MongoDB: {e}")

    def export_to_csv_lightning(self):
        """Lightning fast CSV export"""
        try:
            if self.scraped_data['hospitals']:
                df = pd.DataFrame(self.scraped_data['hospitals'])
                df.to_csv('vaidam_hospitals_lightning.csv', index=False)
                logger.info(f"⚡ Exported {len(self.scraped_data['hospitals'])} hospitals to CSV")
            
            if self.scraped_data['doctors']:
                df = pd.DataFrame(self.scraped_data['doctors'])
                df.to_csv('vaidam_doctors_lightning.csv', index=False)
                logger.info(f"⚡ Exported {len(self.scraped_data['doctors'])} doctors to CSV")
            
        except Exception as e:
            logger.error(f"❌ Error exporting to CSV: {e}")

    def run_lightning_scrape(self):
        """Run the lightning fast scraping process"""
        start_time = time.time()
        
        try:
            logger.info("⚡⚡⚡ STARTING LIGHTNING FAST VAIDAM SCRAPING ⚡⚡⚡")
            
            # Initialize
            self.init_session()
            self.init_mongodb()
            
            # Discover hospital URLs
            hospital_urls = self.discover_hospital_urls_lightning()
            
            if not hospital_urls:
                logger.error("❌ No hospital URLs found. Exiting...")
                return
            
            logger.info(f"⚡ Found {len(hospital_urls)} hospital URLs to scrape")
            
            # Lightning fast scraping
            for i, url in enumerate(hospital_urls, 1):
                try:
                    # Scrape hospital details
                    hospital_data = self.scrape_hospital_details_lightning(url)
                    
                    if hospital_data:
                        self.scraped_data['hospitals'].append(hospital_data)
                        
                        # Try to get doctors from the same page
                        html = self.safe_get(url)
                        if html:
                            soup = self.get_soup(html)
                            if soup:
                                doctors = self.extract_doctors_lightning(soup, hospital_data)
                                self.scraped_data['doctors'].extend(doctors)
                        
                        logger.info(f"⚡ {i}/{len(hospital_urls)}: {hospital_data['name']}")
                    
                    # Save progress every 50 hospitals
                    if i % 50 == 0:
                        logger.info(f"💾 Progress: {i}/{len(hospital_urls)} hospitals processed")
                        logger.info(f"📊 Hospitals: {len(self.scraped_data['hospitals'])}, Doctors: {len(self.scraped_data['doctors'])}")
                        self.save_to_mongodb_lightning()
                        
                        # Clear data to save memory
                        self.scraped_data['hospitals'] = []
                        self.scraped_data['doctors'] = []
                    
                    self.random_delay(0.1, 0.3)
                    
                except Exception as e:
                    logger.error(f"❌ Error processing {url}: {e}")
                    continue
            
            # Final save
            self.save_to_mongodb_lightning()
            self.export_to_csv_lightning()
            
            # Results
            end_time = time.time()
            duration = (end_time - start_time) / 60
            
            logger.info("⚡⚡⚡ LIGHTNING SCRAPING COMPLETED! ⚡⚡⚡")
            logger.info(f"⏱️  Total Time: {duration:.2f} minutes")
            logger.info(f"🏥 Hospitals Scraped: {self.progress['hospitals_scraped']}")
            logger.info(f"👨‍⚕️ Doctors Found: {len(self.scraped_data['doctors'])}")
            
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
    scraper = VaidamLightningScraper()
    scraper.run_lightning_scrape()

if __name__ == "__main__":
    main()
