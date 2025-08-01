#!/usr/bin/env python3
"""
Simple but Comprehensive Vaidam Website Scraper
Using Selenium + BeautifulSoup for maximum compatibility and simplicity
Scrapes ALL hospitals, doctors, and treatments from Vaidam website
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
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import requests

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
        logging.FileHandler('vaidam_simple_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VaidamSimpleScraper:
    def __init__(self):
        self.base_url = "https://www.vaidam.com"
        self.driver = None
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

    def init_selenium(self):
        """Initialize Selenium WebDriver with stealth options"""
        logger.info("Initializing Selenium WebDriver...")
        
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--allow-running-insecure-content')
        chrome_options.add_argument('--window-size=1920,1080')
        
        # Add user agent to avoid detection
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
        
        # Uncomment for headless mode (faster but no visual feedback)
        # chrome_options.add_argument('--headless')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        
        # Execute script to remove webdriver detection
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        logger.info("Selenium WebDriver initialized successfully")

    def init_mongodb(self):
        """Initialize MongoDB connection"""
        try:
            mongodb_uri = os.getenv('MONGODB_URI')
            
            # Debug: Print environment variable status
            logger.info(f"Environment variables loaded: MONGODB_URI={'***FOUND***' if mongodb_uri else 'NOT FOUND'}")
            
            if not mongodb_uri:
                # Try to load from different paths
                possible_paths = [
                    '../.env',
                    '.env',
                    '/Users/meherpranav/Desktop/MediBudy/.env'
                ]
                
                for path in possible_paths:
                    logger.info(f"Trying to load .env from: {path}")
                    if os.path.exists(path):
                        logger.info(f"Found .env file at: {path}")
                        load_dotenv(dotenv_path=path, override=True)
                        mongodb_uri = os.getenv('MONGODB_URI')
                        if mongodb_uri:
                            logger.info("Successfully loaded MONGODB_URI")
                            break
                
                if not mongodb_uri:
                    raise ValueError("MONGODB_URI not found in environment variables. Please check your .env file.")
            
            self.mongo_client = MongoClient(mongodb_uri)
            self.db = self.mongo_client.medibudy
            
            # Test connection
            self.mongo_client.admin.command('ping')
            logger.info("Connected to MongoDB successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def random_delay(self, min_seconds=1, max_seconds=3):
        """Add random delay to avoid being blocked"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)

    def safe_get(self, url, max_retries=3):
        """Safely navigate to URL with retries"""
        for attempt in range(max_retries):
            try:
                logger.info(f"Navigating to: {url} (attempt {attempt + 1})")
                self.driver.get(url)
                
                # Wait for page to load
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                # Random scroll to trigger lazy loading
                self.simulate_human_scroll()
                
                return True
                
            except Exception as e:
                logger.warning(f"Failed to load {url} (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    self.random_delay(2, 5)
                else:
                    logger.error(f"Failed to load {url} after {max_retries} attempts")
                    return False

    def simulate_human_scroll(self):
        """Simulate human-like scrolling to load dynamic content"""
        try:
            # Scroll down slowly to trigger lazy loading
            total_height = self.driver.execute_script("return document.body.scrollHeight")
            current_position = 0
            scroll_step = 200
            
            while current_position < total_height:
                self.driver.execute_script(f"window.scrollTo(0, {current_position});")
                current_position += scroll_step
                time.sleep(0.2)
            
            # Scroll back to top
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
        except Exception as e:
            logger.warning(f"Error during scrolling: {e}")

    def get_page_soup(self):
        """Get BeautifulSoup object from current page"""
        try:
            html = self.driver.page_source
            return BeautifulSoup(html, 'html.parser')
        except Exception as e:
            logger.error(f"Error getting page soup: {e}")
            return None

    def discover_all_hospital_urls(self):
        """Discover ALL hospital URLs using comprehensive strategies"""
        logger.info("Starting comprehensive hospital URL discovery...")
        hospital_urls = set()
        
        # Strategy 1: Pagination - Go through ALL pages
        pagination_urls = self.scrape_hospitals_pagination()
        hospital_urls.update(pagination_urls)
        logger.info(f"Found {len(pagination_urls)} hospitals from pagination")
        
        # Strategy 2: Location-based search
        location_urls = self.scrape_hospitals_by_location()
        hospital_urls.update(location_urls)
        logger.info(f"Found {len(location_urls)} hospitals from location search")
        
        # Strategy 3: Specialty-based search
        specialty_urls = self.scrape_hospitals_by_specialty()
        hospital_urls.update(specialty_urls)
        logger.info(f"Found {len(specialty_urls)} hospitals from specialty search")
        
        final_urls = list(hospital_urls)
        logger.info(f"Total unique hospital URLs discovered: {len(final_urls)}")
        
        return final_urls

    def scrape_hospitals_pagination(self):
        """Scrape hospitals through pagination - ALL pages"""
        hospital_urls = []
        page = 1
        max_pages = 500  # Very high limit to ensure we get everything
        
        while page <= max_pages:
            url = f"{self.base_url}/hospitals/india?page={page}"
            
            if not self.safe_get(url):
                break
                
            soup = self.get_page_soup()
            if not soup:
                break
            
            # Extract hospital URLs from current page
            page_urls = self.extract_hospital_urls_from_soup(soup)
            
            if not page_urls:
                logger.info(f"No hospitals found on page {page}, stopping pagination")
                break
            
            hospital_urls.extend(page_urls)
            logger.info(f"Page {page}: Found {len(page_urls)} hospitals")
            
            # Check if there's a next page
            has_next = self.has_next_page(soup)
            if not has_next:
                logger.info("No more pages found")
                break
                
            page += 1
            self.random_delay()
        
        return hospital_urls

    def scrape_hospitals_by_location(self):
        """Scrape hospitals by searching different locations"""
        hospital_urls = []
        
        # Comprehensive list of Indian cities and states
        locations = [
            # Major metros
            'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad',
            'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur',
            'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna',
            'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad',
            'meerut', 'rajkot', 'kalyan-dombivali', 'vasai-virar', 'varanasi',
            'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi-mumbai',
            'allahabad', 'ranchi', 'howrah', 'coimbatore', 'jabalpur', 'gwalior',
            'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'chandigarh',
            'guwahati', 'solapur', 'hubballi-dharwad', 'tiruchirappalli',
            'bareilly', 'mysore', 'tiruppur', 'gurgaon', 'aligarh', 'jalandhar',
            'bhubaneswar', 'salem', 'warangal', 'guntur', 'bhiwandi', 'saharanpur',
            'gorakhpur', 'bikaner', 'amravati', 'noida', 'jamshedpur', 'bhilai',
            'cuttack', 'firozabad', 'kochi', 'bhavnagar', 'dehradun', 'durgapur',
            'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer', 'akola',
            'gulbarga', 'jamnagar', 'ujjain', 'loni', 'siliguri', 'jhansi',
            'ulhasnagar', 'nellore', 'jammu', 'sangli-miraj-kupwad', 'belgaum',
            'mangalore', 'ambattur', 'tirunelveli', 'malegaon', 'gaya', 'jalgaon',
            'udaipur', 'maheshtala', 'davanagere', 'kozhikode', 'kurnool',
            'rajpur-sonarpur', 'rajahmundry', 'bokaro', 'south-dumdum',
            'bellary', 'patiala', 'gopalpur', 'agartala', 'bhagalpur', 'muzaffarnagar',
            'bhatpara', 'panihati', 'latur', 'dhule', 'rohtak', 'korba',
            'bhilwara', 'berhampur', 'muzaffarpur', 'ahmednagar', 'mathura',
            'kollam', 'avadi', 'kadapa', 'kamarhati', 'sambalpur', 'bilaspur',
            'shahjahanpur', 'satara', 'bijapur', 'rampur', 'shivamogga',
            'chandrapur', 'junagadh', 'thrissur', 'alwar', 'bardhaman',
            'kulti', 'kakinada', 'nizamabad', 'parbhani', 'tumkur',
            'khammam', 'ozhukarai', 'bihar-sharif', 'panipat', 'darbhanga',
            'bally', 'aizawl', 'dewas', 'ichalkaranji', 'karnal', 'bathinda',
            'jalna', 'eluru', 'kirari-suleman-nagar', 'barabanki', 'purnia',
            'satna', 'mau', 'sonipat', 'farrukhabad', 'sagar', 'rourkela',
            'durg', 'imphal', 'ratlam', 'hapur', 'arrah', 'anantapur',
            'karimnagar', 'etawah', 'ambernath', 'north-dumdum', 'bharatpur',
            'begusarai', 'new-delhi', 'gandhidham', 'baranagar', 'tiruvottiyur',
            'pondicherry', 'sikar', 'thoothukudi', 'rewa', 'mirzapur',
            'raichur', 'pali', 'ramagundam', 'silchar', 'orai', 'nandyal',
            'morena', 'bhiwani', 'porbandar', 'palakkad', 'anand', 'puruliya',
            'baharampur', 'barmer', 'ambala', 'shivpuri', 'eluru', 'hindupur',
            'udupi', 'kottayam', 'machilipatnam', 'shortpet', 'ballari',
            'shivamogga', 'dharwad', 'hassan', 'dindigul', 'erode'
        ]
        
        for location in locations:
            try:
                # Try multiple URL patterns for location search
                search_urls = [
                    f"{self.base_url}/hospitals/india?location={location}",
                    f"{self.base_url}/hospitals/{location}",
                    f"{self.base_url}/hospitals/india/{location}"
                ]
                
                for search_url in search_urls:
                    if self.safe_get(search_url):
                        soup = self.get_page_soup()
                        if soup:
                            urls = self.extract_hospital_urls_from_soup(soup)
                            hospital_urls.extend(urls)
                            if urls:
                                logger.info(f"Location {location}: Found {len(urls)} hospitals")
                                break  # If we found hospitals, no need to try other URL patterns
                
                self.random_delay(0.5, 1)
                
            except Exception as e:
                logger.error(f"Error searching location {location}: {e}")
        
        return hospital_urls

    def scrape_hospitals_by_specialty(self):
        """Scrape hospitals by medical specialties"""
        hospital_urls = []
        
        specialties = [
            'cardiology', 'cardiac-surgery', 'oncology', 'cancer-treatment',
            'orthopedics', 'joint-replacement', 'neurology', 'neurosurgery',
            'gastroenterology', 'liver-transplant', 'urology', 'kidney-transplant',
            'dermatology', 'plastic-surgery', 'cosmetic-surgery', 'gynecology',
            'obstetrics', 'fertility', 'ivf', 'pediatrics', 'neonatology',
            'psychiatry', 'psychology', 'radiology', 'pathology', 'ent',
            'ophthalmology', 'eye-surgery', 'pulmonology', 'chest-surgery',
            'nephrology', 'dialysis', 'endocrinology', 'diabetes',
            'rheumatology', 'physiotherapy', 'rehabilitation', 'emergency',
            'trauma', 'burn-treatment', 'dental', 'oral-surgery',
            'anesthesiology', 'pain-management', 'bariatric-surgery',
            'weight-loss', 'spine-surgery', 'vascular-surgery',
            'general-surgery', 'laparoscopic-surgery', 'robotic-surgery',
            'minimally-invasive-surgery', 'heart-surgery', 'bypass-surgery',
            'valve-replacement', 'bone-marrow-transplant', 'stem-cell-therapy',
            'radiation-oncology', 'chemotherapy', 'immunotherapy',
            'nuclear-medicine', 'interventional-radiology', 'critical-care',
            'intensive-care', 'nicu', 'maternity', 'delivery', 'caesarean',
            'hip-replacement', 'knee-replacement', 'sports-medicine',
            'arthroscopy', 'fracture-treatment', 'brain-surgery',
            'spinal-surgery', 'epilepsy-treatment', 'stroke-treatment',
            'liver-surgery', 'gallbladder-surgery', 'hernia-surgery',
            'appendix-surgery', 'kidney-surgery', 'prostate-surgery',
            'skin-treatment', 'hair-transplant', 'breast-surgery',
            'rhinoplasty', 'liposuction', 'tummy-tuck', 'face-lift',
            'cataract-surgery', 'lasik', 'retina-surgery', 'glaucoma-treatment',
            'hearing-aids', 'cochlear-implant', 'sinus-surgery',
            'tonsillectomy', 'lung-surgery', 'copd-treatment',
            'asthma-treatment', 'sleep-disorders', 'dialysis',
            'kidney-stones', 'thyroid-surgery', 'parathyroid-surgery',
            'adrenal-surgery', 'pituitary-surgery', 'arthritis-treatment',
            'lupus-treatment', 'fibromyalgia', 'osteoporosis',
            'physiotherapy', 'occupational-therapy', 'speech-therapy'
        ]
        
        for specialty in specialties:
            try:
                # Try multiple URL patterns for specialty search
                search_urls = [
                    f"{self.base_url}/hospitals/india?specialty={specialty}",
                    f"{self.base_url}/treatments/{specialty}/hospitals",
                    f"{self.base_url}/{specialty}/hospitals"
                ]
                
                for search_url in search_urls:
                    if self.safe_get(search_url):
                        soup = self.get_page_soup()
                        if soup:
                            urls = self.extract_hospital_urls_from_soup(soup)
                            hospital_urls.extend(urls)
                            if urls:
                                logger.info(f"Specialty {specialty}: Found {len(urls)} hospitals")
                                break
                
                self.random_delay(0.5, 1)
                
            except Exception as e:
                logger.error(f"Error searching specialty {specialty}: {e}")
        
        return hospital_urls

    def extract_hospital_urls_from_soup(self, soup):
        """Extract hospital URLs from BeautifulSoup object"""
        urls = []
        
        # Multiple strategies to find hospital links
        selectors = [
            'a[href*="/hospitals/"]',
            'a[href*="/hospital/"]',
            'a[href*="/hospital-detail/"]',
            '.hospital-card a',
            '.hospital-item a',
            '.listing-item a',
            '.card a',
            '.result a',
            'h1 a', 'h2 a', 'h3 a',  # Hospital names are often in headings
            '.title a', '.name a'
        ]
        
        for selector in selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get('href')
                if href:
                    # Convert relative URLs to absolute
                    if href.startswith('/'):
                        full_url = self.base_url + href
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        continue
                    
                    # Check if it's a valid hospital URL
                    if self.is_valid_hospital_url(full_url):
                        urls.append(full_url)
        
        # Also look for URLs in JavaScript or data attributes
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                # Find hospital URLs in JavaScript
                url_matches = re.findall(r'/hospitals?/[a-zA-Z0-9\-_/]+', script.string)
                for match in url_matches:
                    full_url = self.base_url + match
                    if self.is_valid_hospital_url(full_url):
                        urls.append(full_url)
        
        return list(set(urls))  # Remove duplicates

    def is_valid_hospital_url(self, url):
        """Check if URL is a valid hospital detail page"""
        if not url.startswith(self.base_url):
            return False
        
        # Patterns that indicate a hospital detail page
        valid_patterns = [
            r'/hospitals?/[^/]+/?$',
            r'/hospital/[^/]+/?$',
            r'/hospital-detail/[^/]+/?$',
            r'/hospitals?/india/[^/]+/?$'
        ]
        
        for pattern in valid_patterns:
            if re.search(pattern, url):
                return True
        
        return False

    def has_next_page(self, soup):
        """Check if there's a next page in pagination"""
        next_selectors = [
            'a[rel="next"]',
            '.pagination .next:not(.disabled)',
            '.next-page:not(.disabled)',
            'a:contains("Next")',
            'a:contains("→")',
            'a:contains(">")'
        ]
        
        for selector in next_selectors:
            if soup.select(selector):
                return True
        
        return False

    def scrape_hospital_details(self, hospital_url):
        """Scrape detailed information for a single hospital"""
        try:
            logger.info(f"Scraping hospital: {hospital_url}")
            
            if not self.safe_get(hospital_url):
                return None
            
            soup = self.get_page_soup()
            if not soup:
                return None
            
            # Extract hospital information
            hospital_data = {
                'name': self.extract_hospital_name(soup),
                'url': hospital_url,
                'location': self.extract_hospital_location(soup),
                'city': self.extract_hospital_city(soup),
                'state': self.extract_hospital_state(soup),
                'country': 'India',
                'address': self.extract_hospital_address(soup),
                'phone': self.extract_hospital_phone(soup),
                'email': self.extract_hospital_email(soup),
                'website': self.extract_hospital_website(soup),
                'specialties': self.extract_hospital_specialties(soup),
                'services': self.extract_hospital_services(soup),
                'facilities': self.extract_hospital_facilities(soup),
                'description': self.extract_hospital_description(soup),
                'rating': self.extract_hospital_rating(soup),
                'established_year': self.extract_hospital_established(soup),
                'bed_count': self.extract_hospital_beds(soup),
                'accreditations': self.extract_hospital_accreditations(soup),
                'awards': self.extract_hospital_awards(soup),
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # Only return if we have a valid name
            if hospital_data['name'] and len(hospital_data['name']) > 3:
                self.progress['hospitals_scraped'] += 1
                logger.info(f"Successfully scraped: {hospital_data['name']}")
                return hospital_data
            else:
                logger.warning(f"No valid name found for {hospital_url}")
                return None
                
        except Exception as e:
            logger.error(f"Error scraping hospital {hospital_url}: {e}")
            return None

    def extract_hospital_name(self, soup):
        """Extract hospital name"""
        selectors = [
            'h1', '.hospital-name', '.page-title', '.main-title',
            '.title', '.name', 'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 3:
                    # Clean up common suffixes
                    text = re.sub(r'\s*-\s*Vaidam.*', '', text)
                    text = re.sub(r'\s*\|\s*Vaidam.*', '', text)
                    text = re.sub(r'\s*-\s*India.*', '', text)
                    return text.strip()
        
        return ""

    def extract_hospital_location(self, soup):
        """Extract hospital location"""
        selectors = [
            '.location', '.address', '.city', '.place',
            '[class*="location"]', '[class*="address"]', '[class*="city"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 2:
                    return text
        
        # Look in text content
        text = soup.get_text()
        location_match = re.search(r'Location:\s*([^,\n]+)', text, re.IGNORECASE)
        if location_match:
            return location_match.group(1).strip()
        
        return ""

    def extract_hospital_city(self, soup):
        """Extract hospital city"""
        cities = [
            'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad',
            'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur',
            'nagpur', 'indore', 'gurgaon', 'noida', 'ghaziabad', 'thane'
        ]
        
        text = soup.get_text().lower()
        for city in cities:
            if city in text:
                return city.title()
        
        return ""

    def extract_hospital_state(self, soup):
        """Extract hospital state"""
        states = [
            'maharashtra', 'delhi', 'karnataka', 'tamil nadu', 'west bengal',
            'telangana', 'gujarat', 'rajasthan', 'uttar pradesh', 'haryana',
            'andhra pradesh', 'kerala', 'punjab', 'madhya pradesh', 'odisha'
        ]
        
        text = soup.get_text().lower()
        for state in states:
            if state in text:
                return state.title()
        
        return ""

    def extract_hospital_address(self, soup):
        """Extract full hospital address"""
        selectors = [
            '.full-address', '.complete-address', '.address-details',
            '[class*="full-address"]', '[class*="complete-address"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 10:
                    return text
        
        return ""

    def extract_hospital_phone(self, soup):
        """Extract hospital phone number"""
        text = soup.get_text()
        phone_patterns = [
            r'\+91[\s-]?\d{10}',
            r'(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})',
            r'(\d{10})'
        ]
        
        for pattern in phone_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        return ""

    def extract_hospital_email(self, soup):
        """Extract hospital email"""
        text = soup.get_text()
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        if email_match:
            return email_match.group(0)
        return ""

    def extract_hospital_website(self, soup):
        """Extract hospital website"""
        links = soup.find_all('a', href=True)
        for link in links:
            href = link['href']
            if 'http' in href and 'vaidam' not in href.lower():
                if any(word in href.lower() for word in ['hospital', 'medical', 'health', 'care']):
                    return href
        return ""

    def extract_hospital_specialties(self, soup):
        """Extract hospital specialties"""
        specialties = []
        
        # Look for specialty sections
        specialty_keywords = [
            'cardiology', 'oncology', 'orthopedics', 'neurology', 'gastroenterology',
            'urology', 'dermatology', 'gynecology', 'pediatrics', 'surgery',
            'psychiatry', 'radiology', 'ophthalmology', 'ent', 'pulmonology'
        ]
        
        text = soup.get_text().lower()
        for keyword in specialty_keywords:
            if keyword in text:
                specialties.append(keyword.title())
        
        return specialties

    def extract_hospital_services(self, soup):
        """Extract hospital services"""
        services = []
        service_keywords = [
            'emergency', 'icu', 'operation theatre', 'pharmacy', 'laboratory',
            'radiology', 'pathology', 'blood bank', 'dialysis', 'physiotherapy',
            'ambulance', 'cafeteria', 'parking', '24x7', '24/7'
        ]
        
        text = soup.get_text().lower()
        for keyword in service_keywords:
            if keyword in text:
                services.append(keyword.title())
        
        return services

    def extract_hospital_facilities(self, soup):
        """Extract hospital facilities"""
        facilities = []
        facility_keywords = [
            'wifi', 'ac', 'lift', 'elevator', 'wheelchair', 'ramp',
            'chapel', 'mosque', 'temple', 'atm', 'bank', 'guest house'
        ]
        
        text = soup.get_text().lower()
        for keyword in facility_keywords:
            if keyword in text:
                facilities.append(keyword.title())
        
        return facilities

    def extract_hospital_description(self, soup):
        """Extract hospital description"""
        desc_selectors = [
            '.description', '.about', '.overview', '.summary',
            '[class*="description"]', '[class*="about"]'
        ]
        
        for selector in desc_selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 50:
                    return text
        
        # Look for meaningful paragraphs
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) > 100 and 'hospital' in text.lower():
                return text
        
        return ""

    def extract_hospital_rating(self, soup):
        """Extract hospital rating"""
        text = soup.get_text()
        rating_patterns = [
            r'(\d+\.?\d*)\s*(?:out\s*of\s*5|/5|\*|stars?)',
            r'rating:?\s*(\d+\.?\d*)',
            r'(\d+\.?\d*)\s*rating'
        ]
        
        for pattern in rating_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except:
                    pass
        
        return 0.0

    def extract_hospital_established(self, soup):
        """Extract hospital establishment year"""
        text = soup.get_text()
        established_patterns = [
            r'established.{0,20}(\d{4})',
            r'founded.{0,20}(\d{4})',
            r'since.{0,20}(\d{4})'
        ]
        
        for pattern in established_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return ""

    def extract_hospital_beds(self, soup):
        """Extract number of beds"""
        text = soup.get_text()
        beds_match = re.search(r'(\d+)\s*beds?', text, re.IGNORECASE)
        if beds_match:
            return int(beds_match.group(1))
        return 0

    def extract_hospital_accreditations(self, soup):
        """Extract hospital accreditations"""
        accreditations = []
        accred_keywords = [
            'nabh', 'nabl', 'jci', 'iso', 'nqas', 'qci', 'accredited'
        ]
        
        text = soup.get_text().lower()
        for keyword in accred_keywords:
            if keyword in text:
                accreditations.append(keyword.upper())
        
        return accreditations

    def extract_hospital_awards(self, soup):
        """Extract hospital awards"""
        awards = []
        text = soup.get_text().lower()
        
        if 'award' in text or 'recognition' in text:
            # Look for award sections
            award_sections = soup.find_all(['div', 'section'], string=re.compile(r'award|recognition', re.I))
            for section in award_sections:
                award_text = section.get_text(strip=True)
                if len(award_text) > 10:
                    awards.append(award_text)
        
        return awards

    def scrape_doctors_for_hospital(self, hospital_data):
        """Scrape doctors for a specific hospital"""
        doctors = []
        
        try:
            hospital_url = hospital_data['url']
            logger.info(f"Scraping doctors for: {hospital_data['name']}")
            
            # Try different URL patterns for doctors page
            doctor_urls = [
                f"{hospital_url}/doctors",
                f"{hospital_url}/team",
                f"{hospital_url}/staff",
                f"{hospital_url}/physicians",
                hospital_url  # Sometimes doctors are on main page
            ]
            
            for url in doctor_urls:
                if self.safe_get(url):
                    soup = self.get_page_soup()
                    if soup:
                        # Check if page has doctor information
                        text = soup.get_text().lower()
                        if any(word in text for word in ['doctor', 'dr.', 'physician', 'specialist']):
                            page_doctors = self.extract_doctors_from_soup(soup, hospital_data)
                            doctors.extend(page_doctors)
                            break
            
            self.progress['doctors_scraped'] += len(doctors)
            logger.info(f"Found {len(doctors)} doctors for {hospital_data['name']}")
            
        except Exception as e:
            logger.error(f"Error scraping doctors for {hospital_data['name']}: {e}")
        
        return doctors

    def extract_doctors_from_soup(self, soup, hospital_data):
        """Extract doctor information from BeautifulSoup object"""
        doctors = []
        
        # Look for doctor elements using multiple strategies
        doctor_selectors = [
            '[class*="doctor"]', '[class*="physician"]', '[class*="staff"]',
            '[class*="team"]', '[class*="profile"]', '.member', '.card'
        ]
        
        doctor_elements = []
        for selector in doctor_selectors:
            elements = soup.select(selector)
            if elements:
                doctor_elements.extend(elements)
        
        # If no specific elements found, look for text patterns
        if not doctor_elements:
            all_divs = soup.find_all(['div', 'section', 'article'])
            for div in all_divs:
                text = div.get_text()
                if re.search(r'dr\.?\s+[a-z\s]{3,}', text, re.IGNORECASE) and len(text) < 1000:
                    doctor_elements.append(div)
        
        # Extract information from each doctor element
        for element in doctor_elements:
            doctor_data = self.extract_single_doctor_info(element, hospital_data)
            if doctor_data and doctor_data['name']:
                doctors.append(doctor_data)
        
        return doctors

    def extract_single_doctor_info(self, element, hospital_data):
        """Extract information for a single doctor"""
        try:
            text = element.get_text()
            
            # Extract doctor name
            name_match = re.search(r'dr\.?\s+([a-z\s\.]{3,50})', text, re.IGNORECASE)
            if not name_match:
                return None
            
            name = name_match.group(1).strip()
            
            # Extract specialization
            specializations = [
                'cardiologist', 'oncologist', 'orthopedic', 'neurologist',
                'gastroenterologist', 'urologist', 'dermatologist', 'gynecologist',
                'pediatrician', 'surgeon', 'psychiatrist', 'radiologist',
                'anesthesiologist', 'pathologist', 'ophthalmologist', 'ent specialist'
            ]
            
            specialization = ""
            text_lower = text.lower()
            for spec in specializations:
                if spec in text_lower:
                    specialization = spec.title()
                    break
            
            # Extract experience
            experience = ""
            exp_patterns = [
                r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
                r'experience:?\s*(\d+)\+?\s*years?'
            ]
            
            for pattern in exp_patterns:
                exp_match = re.search(pattern, text, re.IGNORECASE)
                if exp_match:
                    experience = f"{exp_match.group(1)} years"
                    break
            
            # Extract qualifications
            qualifications = []
            qual_patterns = [
                r'(MBBS)', r'(MD)', r'(MS)', r'(DM)', r'(MCh)',
                r'(FRCS)', r'(MRCP)', r'(PhD)', r'(Fellowship)'
            ]
            
            for pattern in qual_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                qualifications.extend(matches)
            
            # Extract consultation fee
            fee = ""
            fee_match = re.search(r'(?:fee|consultation):?\s*₹?(\d+)', text, re.IGNORECASE)
            if fee_match:
                fee = f"₹{fee_match.group(1)}"
            
            doctor_data = {
                'name': name,
                'specialization': specialization,
                'experience': experience,
                'qualifications': ', '.join(qualifications) if qualifications else "",
                'consultation_fee': fee,
                'hospital_name': hospital_data['name'],
                'hospital_city': hospital_data['city'],
                'hospital_state': hospital_data['state'],
                'hospital_url': hospital_data['url'],
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return doctor_data
            
        except Exception as e:
            logger.error(f"Error extracting doctor info: {e}")
            return None

    def scrape_treatments(self):
        """Scrape treatment information"""
        treatments = []
        
        try:
            logger.info("Starting treatment scraping...")
            
            # Discover treatment categories
            categories = self.discover_treatment_categories()
            
            for category in categories:
                category_treatments = self.scrape_treatments_by_category(category)
                treatments.extend(category_treatments)
                self.random_delay()
            
            self.progress['treatments_scraped'] = len(treatments)
            logger.info(f"Total treatments scraped: {len(treatments)}")
            
        except Exception as e:
            logger.error(f"Error scraping treatments: {e}")
        
        return treatments

    def discover_treatment_categories(self):
        """Discover treatment categories"""
        categories = []
        
        try:
            treatments_url = f"{self.base_url}/treatments"
            
            if self.safe_get(treatments_url):
                soup = self.get_page_soup()
                if soup:
                    # Look for category links
                    category_links = soup.find_all('a', href=re.compile(r'/treatments/'))
                    
                    for link in category_links:
                        href = link.get('href')
                        text = link.get_text(strip=True)
                        
                        if href and text and len(text) > 2:
                            full_url = urljoin(self.base_url, href)
                            categories.append({
                                'name': text,
                                'url': full_url
                            })
            
            # Add common categories if none found
            if not categories:
                common_categories = [
                    'cardiology', 'oncology', 'orthopedics', 'neurology',
                    'gastroenterology', 'urology', 'dermatology', 'plastic-surgery',
                    'fertility', 'dental', 'eye-surgery', 'cosmetic-surgery'
                ]
                
                for cat in common_categories:
                    categories.append({
                        'name': cat.title(),
                        'url': f"{self.base_url}/treatments/{cat}"
                    })
            
            logger.info(f"Found {len(categories)} treatment categories")
            
        except Exception as e:
            logger.error(f"Error discovering treatment categories: {e}")
        
        return categories

    def scrape_treatments_by_category(self, category):
        """Scrape treatments for a specific category"""
        treatments = []
        
        try:
            logger.info(f"Scraping treatments for category: {category['name']}")
            
            if self.safe_get(category['url']):
                soup = self.get_page_soup()
                if soup:
                    treatment_elements = soup.find_all(['div', 'article'], class_=re.compile(r'treatment|procedure|card', re.I))
                    
                    for element in treatment_elements:
                        treatment = self.extract_treatment_info(element, category['name'])
                        if treatment:
                            treatments.append(treatment)
            
            logger.info(f"Found {len(treatments)} treatments in {category['name']}")
            
        except Exception as e:
            logger.error(f"Error scraping treatments for {category['name']}: {e}")
        
        return treatments

    def extract_treatment_info(self, element, category):
        """Extract treatment information from element"""
        try:
            # Extract name
            name_elem = element.find(['h1', 'h2', 'h3', 'h4', 'h5'])
            if not name_elem:
                return None
            
            name = name_elem.get_text(strip=True)
            if not name or len(name) < 3:
                return None
            
            # Extract other information
            text = element.get_text()
            
            # Extract price
            price_match = re.search(r'₹\s*(\d+(?:,\d+)*)', text)
            price = price_match.group(1) if price_match else ""
            
            # Extract description
            desc_elem = element.find('p')
            description = desc_elem.get_text(strip=True) if desc_elem else ""
            
            # Extract hospital if mentioned
            hospital = ""
            if 'hospital' in text.lower():
                hospital_match = re.search(r'([A-Z][a-zA-Z\s]+Hospital)', text)
                if hospital_match:
                    hospital = hospital_match.group(1)
            
            treatment_data = {
                'name': name,
                'category': category,
                'description': description,
                'price': price,
                'hospital': hospital,
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return treatment_data
            
        except Exception as e:
            logger.error(f"Error extracting treatment info: {e}")
            return None

    def save_to_mongodb(self):
        """Save all scraped data to MongoDB"""
        try:
            logger.info("Saving data to MongoDB...")
            
            # Save hospitals
            if self.scraped_data['hospitals']:
                try:
                    # Use upsert to avoid duplicates
                    for hospital in self.scraped_data['hospitals']:
                        self.db.hospitals.update_one(
                            {'url': hospital['url']},
                            {'$set': hospital},
                            upsert=True
                        )
                    logger.info(f"Saved {len(self.scraped_data['hospitals'])} hospitals to MongoDB")
                except Exception as e:
                    logger.error(f"Error saving hospitals: {e}")
            
            # Save doctors
            if self.scraped_data['doctors']:
                try:
                    for doctor in self.scraped_data['doctors']:
                        self.db.doctors.update_one(
                            {'name': doctor['name'], 'hospital_name': doctor['hospital_name']},
                            {'$set': doctor},
                            upsert=True
                        )
                    logger.info(f"Saved {len(self.scraped_data['doctors'])} doctors to MongoDB")
                except Exception as e:
                    logger.error(f"Error saving doctors: {e}")
            
            # Save treatments
            if self.scraped_data['treatments']:
                try:
                    for treatment in self.scraped_data['treatments']:
                        self.db.treatments.update_one(
                            {'name': treatment['name'], 'category': treatment['category']},
                            {'$set': treatment},
                            upsert=True
                        )
                    logger.info(f"Saved {len(self.scraped_data['treatments'])} treatments to MongoDB")
                except Exception as e:
                    logger.error(f"Error saving treatments: {e}")
            
            logger.info("All data saved successfully to MongoDB")
            
        except Exception as e:
            logger.error(f"Error saving to MongoDB: {e}")

    def export_to_csv(self):
        """Export scraped data to CSV files"""
        try:
            if self.scraped_data['hospitals']:
                df = pd.DataFrame(self.scraped_data['hospitals'])
                df.to_csv('vaidam_hospitals_simple.csv', index=False)
                logger.info(f"Exported {len(self.scraped_data['hospitals'])} hospitals to CSV")
            
            if self.scraped_data['doctors']:
                df = pd.DataFrame(self.scraped_data['doctors'])
                df.to_csv('vaidam_doctors_simple.csv', index=False)
                logger.info(f"Exported {len(self.scraped_data['doctors'])} doctors to CSV")
            
            if self.scraped_data['treatments']:
                df = pd.DataFrame(self.scraped_data['treatments'])
                df.to_csv('vaidam_treatments_simple.csv', index=False)
                logger.info(f"Exported {len(self.scraped_data['treatments'])} treatments to CSV")
            
        except Exception as e:
            logger.error(f"Error exporting to CSV: {e}")

    def run_complete_scrape(self):
        """Run the complete scraping process"""
        start_time = time.time()
        
        try:
            logger.info("=== Starting COMPLETE Vaidam Website Scraping ===")
            
            # Initialize
            self.init_selenium()
            self.init_mongodb()
            
            # Discover ALL hospital URLs
            hospital_urls = self.discover_all_hospital_urls()
            
            if not hospital_urls:
                logger.error("No hospital URLs found. Exiting...")
                return
            
            logger.info(f"Found {len(hospital_urls)} hospital URLs to scrape")
            
            # Scrape each hospital and its doctors
            for i, url in enumerate(hospital_urls, 1):
                try:
                    logger.info(f"Processing hospital {i}/{len(hospital_urls)}")
                    
                    # Scrape hospital details
                    hospital_data = self.scrape_hospital_details(url)
                    
                    if hospital_data:
                        self.scraped_data['hospitals'].append(hospital_data)
                        
                        # Scrape doctors for this hospital
                        doctors = self.scrape_doctors_for_hospital(hospital_data)
                        self.scraped_data['doctors'].extend(doctors)
                    
                    # Save progress every 10 hospitals
                    if i % 10 == 0:
                        logger.info(f"Progress: {i}/{len(hospital_urls)} hospitals processed")
                        logger.info(f"Total scraped so far - Hospitals: {len(self.scraped_data['hospitals'])}, Doctors: {len(self.scraped_data['doctors'])}")
                        
                        # Save to database periodically
                        self.save_to_mongodb()
                    
                    self.random_delay(1, 2)
                    
                except Exception as e:
                    logger.error(f"Error processing hospital {url}: {e}")
                    continue
            
            # Scrape treatments
            logger.info("Starting treatment scraping...")
            treatments = self.scrape_treatments()
            self.scraped_data['treatments'] = treatments
            
            # Final save to database
            self.save_to_mongodb()
            
            # Export to CSV
            self.export_to_csv()
            
            # Calculate and display final results
            end_time = time.time()
            duration = (end_time - start_time) / 60  # in minutes
            
            logger.info("=== SCRAPING COMPLETED SUCCESSFULLY ===")
            logger.info(f"Total Time: {duration:.2f} minutes")
            logger.info(f"Hospitals Scraped: {len(self.scraped_data['hospitals'])}")
            logger.info(f"Doctors Scraped: {len(self.scraped_data['doctors'])}")
            logger.info(f"Treatments Scraped: {len(self.scraped_data['treatments'])}")
            logger.info(f"Data saved to MongoDB and exported to CSV files")
            
        except Exception as e:
            logger.error(f"Critical error in scraping process: {e}")
        
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
            
            if self.mongo_client:
                self.mongo_client.close()
            
            logger.info("Cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

def main():
    """Main function to run the scraper"""
    scraper = VaidamSimpleScraper()
    scraper.run_complete_scrape()

if __name__ == "__main__":
    main()
