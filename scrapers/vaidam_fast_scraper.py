#!/usr/bin/env python3
"""
Fast and Efficient Vaidam Website Scraper
Using requests + BeautifulSoup for speed and reliability
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
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Load environment variables - try multiple paths
load_dotenv(dotenv_path='../.env')
if not os.getenv('MONGODB_URI'):
    load_dotenv(dotenv_path='.env')
if not os.getenv('MONGODB_URI'):
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vaidam_fast_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VaidamFastScraper:
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
        """Initialize requests session with proper configuration"""
        logger.info("Initializing HTTP session...")
        
        self.session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            method_whitelist=["HEAD", "GET", "OPTIONS"],
            backoff_factor=1
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
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
        })
        
        logger.info("HTTP session initialized successfully")

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

    def random_delay(self, min_seconds=0.5, max_seconds=2):
        """Add random delay to avoid being blocked"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)

    def safe_get(self, url, max_retries=3):
        """Safely make HTTP request with retries"""
        for attempt in range(max_retries):
            try:
                # Rotate user agent
                self.session.headers['User-Agent'] = random.choice(self.user_agents)
                
                logger.info(f"Fetching: {url} (attempt {attempt + 1})")
                
                response = self.session.get(url, timeout=30)
                
                if response.status_code == 200:
                    logger.info(f"Successfully fetched: {url}")
                    return response.text
                elif response.status_code == 429:
                    # Rate limited
                    wait_time = 2 ** attempt * 5
                    logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                    time.sleep(wait_time)
                else:
                    logger.warning(f"HTTP {response.status_code} for {url}")
                    
            except Exception as e:
                logger.warning(f"Failed to fetch {url} (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    self.random_delay(2, 5)
        
        logger.error(f"Failed to fetch {url} after {max_retries} attempts")
        return None

    def get_soup(self, html):
        """Get BeautifulSoup object from HTML"""
        try:
            return BeautifulSoup(html, 'html.parser')
        except Exception as e:
            logger.error(f"Error parsing HTML: {e}")
            return None

    def discover_all_hospital_urls(self):
        """Discover ALL hospital URLs using fast strategies"""
        logger.info("Starting fast hospital URL discovery...")
        hospital_urls = set()
        
        # Strategy 1: Quick pagination check
        pagination_urls = self.scrape_hospitals_pagination_fast()
        hospital_urls.update(pagination_urls)
        logger.info(f"Found {len(pagination_urls)} hospitals from pagination")
        
        # Strategy 2: Search-based discovery (most effective)
        search_urls = self.scrape_hospitals_by_search()
        hospital_urls.update(search_urls)
        logger.info(f"Found {len(search_urls)} hospitals from search")
        
        final_urls = list(hospital_urls)
        logger.info(f"Total unique hospital URLs discovered: {len(final_urls)}")
        
        return final_urls

    def scrape_hospitals_pagination_fast(self):
        """Fast pagination scraping with early termination"""
        hospital_urls = []
        
        # Check first few pages to see if we can get data
        for page in range(1, 6):  # Only check first 5 pages
            url = f"{self.base_url}/hospitals/india?page={page}"
            
            html = self.safe_get(url)
            if not html:
                logger.warning(f"Failed to get page {page}, trying alternative approach")
                break
                
            soup = self.get_soup(html)
            if not soup:
                break
            
            # Extract hospital URLs from current page
            page_urls = self.extract_hospital_urls_from_soup(soup)
            
            if not page_urls:
                logger.info(f"No hospitals found on page {page}, stopping pagination")
                break
            
            hospital_urls.extend(page_urls)
            logger.info(f"Page {page}: Found {len(page_urls)} hospitals")
            
            self.random_delay()
        
        return hospital_urls

    def scrape_hospitals_by_search(self):
        """Search hospitals using alternative approaches"""
        hospital_urls = []
        
        # Try the main hospitals listing page
        urls_to_try = [
            f"{self.base_url}/hospitals/india",
            f"{self.base_url}/hospitals",
            f"{self.base_url}/hospital",
            f"{self.base_url}/top-hospitals",
            f"{self.base_url}/best-hospitals"
        ]
        
        for url in urls_to_try:
            html = self.safe_get(url)
            if html:
                soup = self.get_soup(html)
                if soup:
                    urls = self.extract_hospital_urls_from_soup(soup)
                    hospital_urls.extend(urls)
                    logger.info(f"Found {len(urls)} hospitals from {url}")
                    
                    # If we found hospitals, try to get more from pagination
                    if urls:
                        self.scrape_more_from_base(url, hospital_urls)
                    
                    self.random_delay()
        
        # Try major cities
        major_cities = ['delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'gurgaon']
        
        for city in major_cities:
            city_urls = [
                f"{self.base_url}/hospitals/{city}",
                f"{self.base_url}/hospitals/india/{city}",
                f"{self.base_url}/{city}/hospitals"
            ]
            
            for url in city_urls:
                html = self.safe_get(url)
                if html:
                    soup = self.get_soup(html)
                    if soup:
                        urls = self.extract_hospital_urls_from_soup(soup)
                        hospital_urls.extend(urls)
                        if urls:
                            logger.info(f"Found {len(urls)} hospitals in {city}")
                            break  # Move to next city if we found hospitals
                
                self.random_delay(0.5, 1)
        
        return list(set(hospital_urls))

    def scrape_more_from_base(self, base_url, hospital_urls):
        """Try to get more hospitals from pagination of a working URL"""
        try:
            for page in range(2, 11):  # Try pages 2-10
                if '?' in base_url:
                    url = f"{base_url}&page={page}"
                else:
                    url = f"{base_url}?page={page}"
                
                html = self.safe_get(url)
                if html:
                    soup = self.get_soup(html)
                    if soup:
                        urls = self.extract_hospital_urls_from_soup(soup)
                        if urls:
                            hospital_urls.extend(urls)
                            logger.info(f"Page {page}: Found {len(urls)} more hospitals")
                        else:
                            break  # No more hospitals, stop
                    else:
                        break
                else:
                    break
                
                self.random_delay()
                
        except Exception as e:
            logger.error(f"Error in pagination: {e}")

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
            'h1 a', 'h2 a', 'h3 a',
            '.title a', '.name a'
        ]
        
        for selector in selectors:
            try:
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
            except Exception as e:
                logger.warning(f"Error with selector {selector}: {e}")
        
        # Also look for URLs in JavaScript or data attributes
        try:
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string:
                    # Find hospital URLs in JavaScript
                    url_matches = re.findall(r'/hospitals?/[a-zA-Z0-9\-_/]+', script.string)
                    for match in url_matches:
                        full_url = self.base_url + match
                        if self.is_valid_hospital_url(full_url):
                            urls.append(full_url)
        except Exception as e:
            logger.warning(f"Error extracting from scripts: {e}")
        
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
            r'/hospitals?/india/[^/]+/?$',
            r'/hospitals?/[a-zA-Z\-]+/[^/]+/?$'
        ]
        
        for pattern in valid_patterns:
            if re.search(pattern, url):
                return True
        
        return False

    def scrape_hospital_details(self, hospital_url):
        """Scrape detailed information for a single hospital"""
        try:
            logger.info(f"Scraping hospital: {hospital_url}")
            
            html = self.safe_get(hospital_url)
            if not html:
                return None
            
            soup = self.get_soup(html)
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
            try:
                element = soup.select_one(selector)
                if element:
                    text = element.get_text(strip=True)
                    if text and len(text) > 3:
                        # Clean up common suffixes
                        text = re.sub(r'\s*-\s*Vaidam.*', '', text)
                        text = re.sub(r'\s*\|\s*Vaidam.*', '', text)
                        text = re.sub(r'\s*-\s*India.*', '', text)
                        return text.strip()
            except Exception as e:
                logger.warning(f"Error with selector {selector}: {e}")
        
        return ""

    def extract_hospital_location(self, soup):
        """Extract hospital location"""
        selectors = [
            '.location', '.address', '.city', '.place',
            '[class*="location"]', '[class*="address"]', '[class*="city"]'
        ]
        
        for selector in selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    text = element.get_text(strip=True)
                    if text and len(text) > 2:
                        return text
            except Exception as e:
                logger.warning(f"Error with selector {selector}: {e}")
        
        # Look in text content
        try:
            text = soup.get_text()
            location_match = re.search(r'Location:\s*([^,\n]+)', text, re.IGNORECASE)
            if location_match:
                return location_match.group(1).strip()
        except Exception as e:
            logger.warning(f"Error extracting location from text: {e}")
        
        return ""

    def extract_hospital_city(self, soup):
        """Extract hospital city"""
        cities = [
            'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad',
            'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur',
            'nagpur', 'indore', 'gurgaon', 'noida', 'ghaziabad', 'thane'
        ]
        
        try:
            text = soup.get_text().lower()
            for city in cities:
                if city in text:
                    return city.title()
        except Exception as e:
            logger.warning(f"Error extracting city: {e}")
        
        return ""

    def extract_hospital_state(self, soup):
        """Extract hospital state"""
        states = [
            'maharashtra', 'delhi', 'karnataka', 'tamil nadu', 'west bengal',
            'telangana', 'gujarat', 'rajasthan', 'uttar pradesh', 'haryana',
            'andhra pradesh', 'kerala', 'punjab', 'madhya pradesh', 'odisha'
        ]
        
        try:
            text = soup.get_text().lower()
            for state in states:
                if state in text:
                    return state.title()
        except Exception as e:
            logger.warning(f"Error extracting state: {e}")
        
        return ""

    def extract_hospital_address(self, soup):
        """Extract full hospital address"""
        selectors = [
            '.full-address', '.complete-address', '.address-details',
            '[class*="full-address"]', '[class*="complete-address"]'
        ]
        
        for selector in selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    text = element.get_text(strip=True)
                    if len(text) > 10:
                        return text
            except Exception as e:
                logger.warning(f"Error with selector {selector}: {e}")
        
        return ""

    def extract_hospital_phone(self, soup):
        """Extract hospital phone number"""
        try:
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
        except Exception as e:
            logger.warning(f"Error extracting phone: {e}")
        
        return ""

    def extract_hospital_email(self, soup):
        """Extract hospital email"""
        try:
            text = soup.get_text()
            email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
            if email_match:
                return email_match.group(0)
        except Exception as e:
            logger.warning(f"Error extracting email: {e}")
        
        return ""

    def extract_hospital_website(self, soup):
        """Extract hospital website"""
        try:
            links = soup.find_all('a', href=True)
            for link in links:
                href = link['href']
                if 'http' in href and 'vaidam' not in href.lower():
                    if any(word in href.lower() for word in ['hospital', 'medical', 'health', 'care']):
                        return href
        except Exception as e:
            logger.warning(f"Error extracting website: {e}")
        
        return ""

    def extract_hospital_specialties(self, soup):
        """Extract hospital specialties"""
        specialties = []
        
        try:
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
        except Exception as e:
            logger.warning(f"Error extracting specialties: {e}")
        
        return specialties

    def extract_hospital_services(self, soup):
        """Extract hospital services"""
        services = []
        
        try:
            service_keywords = [
                'emergency', 'icu', 'operation theatre', 'pharmacy', 'laboratory',
                'radiology', 'pathology', 'blood bank', 'dialysis', 'physiotherapy',
                'ambulance', 'cafeteria', 'parking', '24x7', '24/7'
            ]
            
            text = soup.get_text().lower()
            for keyword in service_keywords:
                if keyword in text:
                    services.append(keyword.title())
        except Exception as e:
            logger.warning(f"Error extracting services: {e}")
        
        return services

    def extract_hospital_facilities(self, soup):
        """Extract hospital facilities"""
        facilities = []
        
        try:
            facility_keywords = [
                'wifi', 'ac', 'lift', 'elevator', 'wheelchair', 'ramp',
                'chapel', 'mosque', 'temple', 'atm', 'bank', 'guest house'
            ]
            
            text = soup.get_text().lower()
            for keyword in facility_keywords:
                if keyword in text:
                    facilities.append(keyword.title())
        except Exception as e:
            logger.warning(f"Error extracting facilities: {e}")
        
        return facilities

    def extract_hospital_description(self, soup):
        """Extract hospital description"""
        try:
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
        except Exception as e:
            logger.warning(f"Error extracting description: {e}")
        
        return ""

    def extract_hospital_rating(self, soup):
        """Extract hospital rating"""
        try:
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
        except Exception as e:
            logger.warning(f"Error extracting rating: {e}")
        
        return 0.0

    def extract_hospital_established(self, soup):
        """Extract hospital establishment year"""
        try:
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
        except Exception as e:
            logger.warning(f"Error extracting establishment year: {e}")
        
        return ""

    def extract_hospital_beds(self, soup):
        """Extract number of beds"""
        try:
            text = soup.get_text()
            beds_match = re.search(r'(\d+)\s*beds?', text, re.IGNORECASE)
            if beds_match:
                return int(beds_match.group(1))
        except Exception as e:
            logger.warning(f"Error extracting bed count: {e}")
        
        return 0

    def extract_hospital_accreditations(self, soup):
        """Extract hospital accreditations"""
        accreditations = []
        
        try:
            accred_keywords = [
                'nabh', 'nabl', 'jci', 'iso', 'nqas', 'qci', 'accredited'
            ]
            
            text = soup.get_text().lower()
            for keyword in accred_keywords:
                if keyword in text:
                    accreditations.append(keyword.upper())
        except Exception as e:
            logger.warning(f"Error extracting accreditations: {e}")
        
        return accreditations

    def extract_hospital_awards(self, soup):
        """Extract hospital awards"""
        awards = []
        
        try:
            text = soup.get_text().lower()
            
            if 'award' in text or 'recognition' in text:
                # Look for award sections
                award_sections = soup.find_all(['div', 'section'], string=re.compile(r'award|recognition', re.I))
                for section in award_sections:
                    award_text = section.get_text(strip=True)
                    if len(award_text) > 10:
                        awards.append(award_text)
        except Exception as e:
            logger.warning(f"Error extracting awards: {e}")
        
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
                html = self.safe_get(url)
                if html:
                    soup = self.get_soup(html)
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
        
        try:
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
        except Exception as e:
            logger.error(f"Error extracting doctors: {e}")
        
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
            
            logger.info("All data saved successfully to MongoDB")
            
        except Exception as e:
            logger.error(f"Error saving to MongoDB: {e}")

    def export_to_csv(self):
        """Export scraped data to CSV files"""
        try:
            if self.scraped_data['hospitals']:
                df = pd.DataFrame(self.scraped_data['hospitals'])
                df.to_csv('vaidam_hospitals_fast.csv', index=False)
                logger.info(f"Exported {len(self.scraped_data['hospitals'])} hospitals to CSV")
            
            if self.scraped_data['doctors']:
                df = pd.DataFrame(self.scraped_data['doctors'])
                df.to_csv('vaidam_doctors_fast.csv', index=False)
                logger.info(f"Exported {len(self.scraped_data['doctors'])} doctors to CSV")
            
        except Exception as e:
            logger.error(f"Error exporting to CSV: {e}")

    def run_complete_scrape(self):
        """Run the complete scraping process"""
        start_time = time.time()
        
        try:
            logger.info("=== Starting FAST Vaidam Website Scraping ===")
            
            # Initialize
            self.init_session()
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
                    
                    self.random_delay()
                    
                except Exception as e:
                    logger.error(f"Error processing hospital {url}: {e}")
                    continue
            
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
            logger.info(f"Data saved to MongoDB and exported to CSV files")
            
        except Exception as e:
            logger.error(f"Critical error in scraping process: {e}")
        
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        try:
            if self.session:
                self.session.close()
            
            if self.mongo_client:
                self.mongo_client.close()
            
            logger.info("Cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

def main():
    """Main function to run the scraper"""
    scraper = VaidamFastScraper()
    scraper.run_complete_scrape()

if __name__ == "__main__":
    main()
