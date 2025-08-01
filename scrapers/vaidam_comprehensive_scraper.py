#!/usr/bin/env python3
"""
Comprehensive Vaidam Website Scraper
This scraper uses multiple strategies to extract all hospitals, doctors, and treatments
from the Vaidam website with robust error handling and anti-detection measures.
"""

import asyncio
import aiohttp
import json
import time
import random
import re
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from urllib.parse import urljoin, urlparse
import logging
from bs4 import BeautifulSoup
import pandas as pd
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright, Browser, Page
import asyncio
import requests
from concurrent.futures import ThreadPoolExecutor
import threading

# Load environment variables
load_dotenv(dotenv_path='../.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vaidam_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class Hospital:
    name: str
    location: str = ""
    city: str = ""
    country: str = "India"
    specialties: List[str] = None
    rating: float = 0.0
    accreditation: List[str] = None
    description: str = ""
    contact: Dict = None
    coordinates: Dict = None
    treatments: List[str] = None
    established: str = ""
    beds: int = 0
    website: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    link: str = ""

@dataclass
class Doctor:
    name: str
    specialization: str = ""
    hospital: str = ""
    location: str = ""
    experience: str = ""
    qualifications: str = ""
    profile_link: str = ""
    education: str = ""
    awards: List[str] = None
    languages: List[str] = None
    consultation_fee: str = ""
    availability: str = ""

@dataclass
class Treatment:
    name: str
    department: str = ""
    description: str = ""
    min_price: float = 0.0
    max_price: float = 0.0
    currency: str = "USD"
    hospital: str = ""
    location: str = ""
    country: str = "India"
    procedure: str = ""
    category: str = ""
    subcategory: str = ""
    duration: str = ""
    recovery: str = ""
    success_rate: str = ""
    link: str = ""

class VaidamComprehensiveScraper:
    def __init__(self):
        self.base_url = "https://www.vaidam.com"
        self.session = None
        self.browser = None
        self.mongo_client = None
        self.db = None
        
        # Rate limiting
        self.request_delay = (1, 3)  # Random delay between requests
        self.max_retries = 3
        self.timeout = 30
        
        # User agents for rotation
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15"
        ]
        
        # Collections to store scraped data
        self.hospitals = []
        self.doctors = []
        self.treatments = []

    async def init_browser(self):
        """Initialize Playwright browser with stealth settings"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,  # Set to True for production
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--disable-extensions',
                '--disable-default-apps',
                '--user-agent=' + random.choice(self.user_agents)
            ]
        )
        
        # Create context with stealth settings
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent=random.choice(self.user_agents),
            extra_http_headers={
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        )
        
        # Add stealth script
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            window.chrome = {
                runtime: {},
            };
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
        """)

    async def init_mongo(self):
        """Initialize MongoDB connection"""
        try:
            mongodb_uri = os.getenv('MONGODB_URI')
            if not mongodb_uri:
                raise ValueError("MONGODB_URI not found in environment variables")
            
            self.mongo_client = AsyncIOMotorClient(mongodb_uri)
            self.db = self.mongo_client.medibudy
            
            # Test connection
            await self.mongo_client.admin.command('ping')
            logger.info("Connected to MongoDB successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def create_session(self):
        """Create aiohttp session with proper headers"""
        connector = aiohttp.TCPConnector(limit=10, limit_per_host=5)
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': random.choice(self.user_agents),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        )

    async def safe_request(self, url: str, method: str = 'GET', **kwargs) -> Optional[str]:
        """Make safe HTTP request with retries and error handling"""
        for attempt in range(self.max_retries):
            try:
                # Random delay between requests
                await asyncio.sleep(random.uniform(*self.request_delay))
                
                async with self.session.request(method, url, **kwargs) as response:
                    if response.status == 200:
                        content = await response.text()
                        logger.info(f"Successfully fetched: {url}")
                        return content
                    elif response.status == 429:
                        # Rate limited, wait longer
                        wait_time = 2 ** attempt * 5
                        logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.warning(f"HTTP {response.status} for {url}")
                        
            except Exception as e:
                logger.error(f"Request failed (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
        
        return None

    async def scrape_with_playwright(self, url: str, wait_for: str = None) -> Optional[str]:
        """Use Playwright for JavaScript-heavy pages"""
        try:
            page = await self.context.new_page()
            
            # Set random user agent for this page
            await page.set_extra_http_headers({
                'User-Agent': random.choice(self.user_agents)
            })
            
            # Navigate to page
            await page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Wait for specific element if provided
            if wait_for:
                try:
                    await page.wait_for_selector(wait_for, timeout=10000)
                except:
                    pass
            
            # Random scroll to trigger lazy loading
            await page.evaluate("""
                window.scrollTo(0, document.body.scrollHeight / 4);
                setTimeout(() => window.scrollTo(0, document.body.scrollHeight / 2), 1000);
                setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 2000);
            """)
            
            await asyncio.sleep(3)
            
            # Get page content
            content = await page.content()
            await page.close()
            
            logger.info(f"Successfully scraped with Playwright: {url}")
            return content
            
        except Exception as e:
            logger.error(f"Playwright scraping failed for {url}: {e}")
            return None

    async def discover_hospital_urls(self) -> List[str]:
        """Discover all hospital URLs using multiple strategies"""
        hospital_urls = set()
        
        # Strategy 1: Pagination-based discovery
        logger.info("Discovering hospitals through pagination...")
        page_num = 1
        max_pages = 100  # Reasonable limit
        
        while page_num <= max_pages:
            url = f"{self.base_url}/hospitals/india?page={page_num}"
            logger.info(f"Scraping hospital page {page_num}")
            
            content = await self.scrape_with_playwright(url)
            if not content:
                content = await self.safe_request(url)
            
            if not content:
                logger.warning(f"Failed to get content for page {page_num}")
                break
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Find hospital links
            page_hospital_urls = self.extract_hospital_links_from_page(soup)
            
            if not page_hospital_urls:
                logger.info(f"No hospitals found on page {page_num}, stopping pagination")
                break
            
            hospital_urls.update(page_hospital_urls)
            logger.info(f"Found {len(page_hospital_urls)} hospitals on page {page_num}")
            
            page_num += 1
            
            # Check if there's a next page
            if not self.has_next_page(soup):
                break
        
        # Strategy 2: Sitemap parsing
        logger.info("Checking sitemap for additional hospital URLs...")
        sitemap_urls = await self.extract_from_sitemap()
        hospital_urls.update(sitemap_urls)
        
        # Strategy 3: Search-based discovery
        logger.info("Discovering hospitals through search...")
        search_urls = await self.discover_through_search()
        hospital_urls.update(search_urls)
        
        logger.info(f"Total unique hospital URLs discovered: {len(hospital_urls)}")
        return list(hospital_urls)

    def extract_hospital_links_from_page(self, soup: BeautifulSoup) -> List[str]:
        """Extract hospital links from a page"""
        hospital_urls = []
        
        # Multiple selectors to find hospital links
        selectors = [
            'a[href*="/hospitals/"]',
            'a[href*="/hospital/"]',
            'a[href*="/hospital-detail/"]',
            '.hospital-card a',
            '.hospital-item a',
            '.listing-item a',
        ]
        
        for selector in selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get('href')
                if href:
                    full_url = urljoin(self.base_url, href)
                    if self.is_hospital_url(full_url):
                        hospital_urls.append(full_url)
        
        # Also look for data attributes or JavaScript variables
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                # Look for JSON data containing hospital URLs
                url_matches = re.findall(r'/hospitals?/[a-zA-Z0-9\-_/]+', script.string)
                for match in url_matches:
                    full_url = urljoin(self.base_url, match)
                    if self.is_hospital_url(full_url):
                        hospital_urls.append(full_url)
        
        return list(set(hospital_urls))

    def is_hospital_url(self, url: str) -> bool:
        """Check if URL is a valid hospital URL"""
        if not url.startswith(self.base_url):
            return False
        
        # Patterns that indicate a hospital detail page
        hospital_patterns = [
            r'/hospitals?/[^/]+/?$',
            r'/hospital-detail/[^/]+/?$',
            r'/hospitals?/india/[^/]+/?$',
        ]
        
        for pattern in hospital_patterns:
            if re.search(pattern, url):
                return True
        
        return False

    def has_next_page(self, soup: BeautifulSoup) -> bool:
        """Check if pagination has a next page"""
        next_selectors = [
            'a[rel="next"]',
            '.pagination .next',
            '.pagination .next:not(.disabled)',
            'a:contains("Next")',
            'a:contains("→")',
        ]
        
        for selector in next_selectors:
            if soup.select(selector):
                return True
        
        return False

    async def extract_from_sitemap(self) -> List[str]:
        """Extract hospital URLs from sitemap"""
        sitemap_urls = []
        
        try:
            sitemap_url = f"{self.base_url}/sitemap.xml"
            content = await self.safe_request(sitemap_url)
            
            if content:
                soup = BeautifulSoup(content, 'xml')
                locs = soup.find_all('loc')
                
                for loc in locs:
                    url = loc.text
                    if self.is_hospital_url(url):
                        sitemap_urls.append(url)
            
            logger.info(f"Found {len(sitemap_urls)} hospital URLs in sitemap")
            
        except Exception as e:
            logger.error(f"Failed to parse sitemap: {e}")
        
        return sitemap_urls

    async def discover_through_search(self) -> List[str]:
        """Discover hospitals through search functionality"""
        search_urls = []
        
        # Common Indian cities for hospital search
        cities = [
            'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata',
            'hyderabad', 'pune', 'gurgaon', 'noida', 'ahmedabad',
            'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
            'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara'
        ]
        
        for city in cities:
            try:
                search_url = f"{self.base_url}/hospitals/india?location={city}"
                content = await self.scrape_with_playwright(search_url)
                
                if content:
                    soup = BeautifulSoup(content, 'html.parser')
                    city_hospitals = self.extract_hospital_links_from_page(soup)
                    search_urls.extend(city_hospitals)
                    logger.info(f"Found {len(city_hospitals)} hospitals in {city}")
                
                # Rate limiting
                await asyncio.sleep(random.uniform(1, 2))
                
            except Exception as e:
                logger.error(f"Failed to search hospitals in {city}: {e}")
        
        return list(set(search_urls))

    async def scrape_hospital_details(self, hospital_url: str) -> Optional[Hospital]:
        """Scrape detailed hospital information"""
        try:
            logger.info(f"Scraping hospital: {hospital_url}")
            
            # Try Playwright first for dynamic content
            content = await self.scrape_with_playwright(hospital_url)
            if not content:
                content = await self.safe_request(hospital_url)
            
            if not content:
                logger.error(f"Failed to get content for {hospital_url}")
                return None
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extract hospital information
            hospital = Hospital(
                name=self.extract_hospital_name(soup),
                location=self.extract_hospital_location(soup),
                city=self.extract_hospital_city(soup),
                specialties=self.extract_hospital_specialties(soup),
                rating=self.extract_hospital_rating(soup),
                description=self.extract_hospital_description(soup),
                contact=self.extract_hospital_contact(soup),
                established=self.extract_hospital_established(soup),
                beds=self.extract_hospital_beds(soup),
                website=self.extract_hospital_website(soup),
                address=self.extract_hospital_address(soup),
                link=hospital_url
            )
            
            if not hospital.name:
                logger.warning(f"No name found for hospital: {hospital_url}")
                return None
            
            logger.info(f"Successfully scraped hospital: {hospital.name}")
            return hospital
            
        except Exception as e:
            logger.error(f"Error scraping hospital {hospital_url}: {e}")
            return None

    def extract_hospital_name(self, soup: BeautifulSoup) -> str:
        """Extract hospital name from page"""
        selectors = [
            'h1',
            '.hospital-name',
            '.page-title',
            '[class*="name"]',
            'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 3:
                    # Clean up the title
                    text = re.sub(r'\s*-\s*Vaidam.*', '', text)
                    text = re.sub(r'\s*\|\s*Vaidam.*', '', text)
                    return text
        
        return ""

    def extract_hospital_location(self, soup: BeautifulSoup) -> str:
        """Extract hospital location"""
        selectors = [
            '.location',
            '.address',
            '[class*="location"]',
            '[class*="address"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 2:
                    return text
        
        # Look in text content for location patterns
        text_content = soup.get_text()
        location_match = re.search(r'Location:\s*([^,\n]+)', text_content, re.IGNORECASE)
        if location_match:
            return location_match.group(1).strip()
        
        return ""

    def extract_hospital_city(self, soup: BeautifulSoup) -> str:
        """Extract hospital city"""
        # Common Indian cities
        cities = [
            'new delhi', 'delhi', 'mumbai', 'bangalore', 'chennai',
            'kolkata', 'hyderabad', 'pune', 'gurgaon', 'noida'
        ]
        
        text_content = soup.get_text().lower()
        for city in cities:
            if city in text_content:
                return city.title()
        
        return ""

    def extract_hospital_specialties(self, soup: BeautifulSoup) -> List[str]:
        """Extract hospital specialties"""
        specialties = []
        
        # Look for specialty sections
        specialty_sections = soup.find_all(['div', 'section'], class_=re.compile(r'specialty|specialties|department', re.I))
        
        for section in specialty_sections:
            items = section.find_all(['li', 'a', 'span'])
            for item in items:
                text = item.get_text(strip=True)
                if text and len(text) > 3:
                    specialties.append(text)
        
        # Common medical specialties to look for in text
        common_specialties = [
            'cardiology', 'oncology', 'orthopedics', 'neurology',
            'gastroenterology', 'urology', 'dermatology', 'gynecology',
            'pediatrics', 'surgery', 'psychiatry', 'radiology'
        ]
        
        text_content = soup.get_text().lower()
        for specialty in common_specialties:
            if specialty in text_content:
                specialties.append(specialty.title())
        
        return list(set(specialties))

    def extract_hospital_rating(self, soup: BeautifulSoup) -> float:
        """Extract hospital rating"""
        rating_selectors = [
            '.rating',
            '.score',
            '[class*="rating"]',
            '[class*="score"]'
        ]
        
        for selector in rating_selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                rating_match = re.search(r'(\d+\.?\d*)', text)
                if rating_match:
                    return float(rating_match.group(1))
        
        return 0.0

    def extract_hospital_description(self, soup: BeautifulSoup) -> str:
        """Extract hospital description"""
        desc_selectors = [
            '.description',
            '.about',
            '.overview',
            '[class*="description"]',
            '[class*="about"]'
        ]
        
        for selector in desc_selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 50:
                    return text
        
        # Look for paragraphs with substantial content
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) > 100 and 'hospital' in text.lower():
                return text
        
        return ""

    def extract_hospital_contact(self, soup: BeautifulSoup) -> Dict:
        """Extract hospital contact information"""
        contact = {}
        
        text_content = soup.get_text()
        
        # Phone number
        phone_match = re.search(r'(\+91[\s-]?\d{10}|\d{10})', text_content)
        if phone_match:
            contact['phone'] = phone_match.group(1)
        
        # Email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text_content)
        if email_match:
            contact['email'] = email_match.group(0)
        
        return contact

    def extract_hospital_established(self, soup: BeautifulSoup) -> str:
        """Extract hospital establishment year"""
        text_content = soup.get_text()
        established_match = re.search(r'established.{0,20}(\d{4})|founded.{0,20}(\d{4})', text_content, re.IGNORECASE)
        if established_match:
            return established_match.group(1) or established_match.group(2)
        return ""

    def extract_hospital_beds(self, soup: BeautifulSoup) -> int:
        """Extract number of beds"""
        text_content = soup.get_text()
        beds_match = re.search(r'(\d+)\s*beds?', text_content, re.IGNORECASE)
        if beds_match:
            return int(beds_match.group(1))
        return 0

    def extract_hospital_website(self, soup: BeautifulSoup) -> str:
        """Extract hospital website"""
        website_links = soup.find_all('a', href=re.compile(r'https?://(?!.*vaidam)'))
        for link in website_links:
            href = link.get('href')
            if href and 'hospital' in href.lower():
                return href
        return ""

    def extract_hospital_address(self, soup: BeautifulSoup) -> str:
        """Extract full hospital address"""
        address_selectors = [
            '.address',
            '.full-address',
            '[class*="address"]'
        ]
        
        for selector in address_selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 10:
                    return text
        
        return ""

    async def scrape_doctors_for_hospital(self, hospital: Hospital) -> List[Doctor]:
        """Scrape doctors for a specific hospital"""
        doctors = []
        
        try:
            # Try to find doctors page for the hospital
            doctors_url = f"{hospital.link}/doctors"
            
            content = await self.scrape_with_playwright(doctors_url)
            if not content:
                # Try alternative URL patterns
                alt_urls = [
                    f"{hospital.link}/team",
                    f"{hospital.link}/staff",
                    f"{hospital.link}/physicians",
                    hospital.link  # Sometimes doctors are on the main page
                ]
                
                for url in alt_urls:
                    content = await self.scrape_with_playwright(url)
                    if content:
                        break
            
            if not content:
                logger.warning(f"No doctor content found for {hospital.name}")
                return doctors
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extract doctor information
            doctor_elements = self.find_doctor_elements(soup)
            
            for element in doctor_elements:
                doctor = self.extract_doctor_info(element, hospital)
                if doctor and doctor.name:
                    doctors.append(doctor)
            
            logger.info(f"Found {len(doctors)} doctors for {hospital.name}")
            
        except Exception as e:
            logger.error(f"Error scraping doctors for {hospital.name}: {e}")
        
        return doctors

    def find_doctor_elements(self, soup: BeautifulSoup) -> List:
        """Find elements containing doctor information"""
        doctor_elements = []
        
        # Multiple strategies to find doctor elements
        selectors = [
            '[class*="doctor"]',
            '[class*="physician"]',
            '[class*="staff"]',
            '[class*="team-member"]',
            '.profile',
            '.member'
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                doctor_elements.extend(elements)
        
        # If no specific selectors work, look for patterns
        if not doctor_elements:
            all_elements = soup.find_all(['div', 'section', 'article'])
            for element in all_elements:
                text = element.get_text()
                if re.search(r'dr\.?\s+[a-z\s]+', text, re.IGNORECASE) and len(text) < 1000:
                    doctor_elements.append(element)
        
        return doctor_elements

    def extract_doctor_info(self, element, hospital: Hospital) -> Optional[Doctor]:
        """Extract doctor information from element"""
        try:
            text = element.get_text()
            
            # Extract name
            name_match = re.search(r'dr\.?\s+([a-z\s\.]+)', text, re.IGNORECASE)
            if not name_match:
                return None
            
            name = name_match.group(1).strip()
            
            # Extract specialization
            specializations = [
                'cardiologist', 'oncologist', 'orthopedic', 'neurologist',
                'gastroenterologist', 'urologist', 'dermatologist', 'gynecologist',
                'pediatrician', 'surgeon', 'psychiatrist', 'radiologist'
            ]
            
            specialization = ""
            text_lower = text.lower()
            for spec in specializations:
                if spec in text_lower:
                    specialization = spec.title()
                    break
            
            # Extract experience
            experience = ""
            exp_match = re.search(r'(\d+)\+?\s*years?\s*(?:of\s*)?experience', text, re.IGNORECASE)
            if exp_match:
                experience = f"{exp_match.group(1)} years"
            
            # Extract qualifications
            qualifications = ""
            qual_patterns = [
                r'(MBBS[^.]*\.)',
                r'(MD[^.]*\.)',
                r'(MS[^.]*\.)',
                r'(DM[^.]*\.)',
                r'(MCh[^.]*\.)'
            ]
            
            quals = []
            for pattern in qual_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                quals.extend(matches)
            
            if quals:
                qualifications = ', '.join(quals)
            
            # Extract profile link
            profile_link = ""
            link_elem = element.find('a')
            if link_elem and link_elem.get('href'):
                profile_link = urljoin(self.base_url, link_elem.get('href'))
            
            doctor = Doctor(
                name=name,
                specialization=specialization,
                hospital=hospital.name,
                location=hospital.location,
                experience=experience,
                qualifications=qualifications,
                profile_link=profile_link
            )
            
            return doctor
            
        except Exception as e:
            logger.error(f"Error extracting doctor info: {e}")
            return None

    async def scrape_treatments(self) -> List[Treatment]:
        """Scrape treatment information"""
        treatments = []
        
        try:
            # Discover treatment categories
            categories = await self.discover_treatment_categories()
            
            for category in categories:
                category_treatments = await self.scrape_treatments_by_category(category)
                treatments.extend(category_treatments)
                
                # Rate limiting
                await asyncio.sleep(random.uniform(1, 2))
            
            logger.info(f"Total treatments scraped: {len(treatments)}")
            
        except Exception as e:
            logger.error(f"Error scraping treatments: {e}")
        
        return treatments

    async def discover_treatment_categories(self) -> List[Dict]:
        """Discover treatment categories"""
        categories = []
        
        try:
            treatments_url = f"{self.base_url}/treatments"
            content = await self.scrape_with_playwright(treatments_url)
            
            if content:
                soup = BeautifulSoup(content, 'html.parser')
                
                # Look for category links
                category_links = soup.find_all('a', href=re.compile(r'/treatments/'))
                
                for link in category_links:
                    href = link.get('href')
                    text = link.get_text(strip=True)
                    
                    if href and text and len(text) > 2:
                        categories.append({
                            'name': text,
                            'url': urljoin(self.base_url, href)
                        })
            
            # Add some common categories manually if none found
            if not categories:
                common_categories = [
                    'cardiology', 'oncology', 'orthopedics', 'neurology',
                    'gastroenterology', 'urology', 'dermatology', 'plastic-surgery'
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

    async def scrape_treatments_by_category(self, category: Dict) -> List[Treatment]:
        """Scrape treatments for a specific category"""
        treatments = []
        
        try:
            content = await self.scrape_with_playwright(category['url'])
            
            if content:
                soup = BeautifulSoup(content, 'html.parser')
                
                # Find treatment elements
                treatment_elements = soup.find_all(['div', 'article'], class_=re.compile(r'treatment|procedure|card', re.I))
                
                for element in treatment_elements:
                    treatment = self.extract_treatment_info(element, category['name'])
                    if treatment and treatment.name:
                        treatments.append(treatment)
            
            logger.info(f"Found {len(treatments)} treatments in {category['name']}")
            
        except Exception as e:
            logger.error(f"Error scraping treatments for {category['name']}: {e}")
        
        return treatments

    def extract_treatment_info(self, element, category: str) -> Optional[Treatment]:
        """Extract treatment information from element"""
        try:
            # Extract name
            name_elem = element.find(['h1', 'h2', 'h3', 'h4', 'h5'])
            if not name_elem:
                return None
            
            name = name_elem.get_text(strip=True)
            
            # Extract description
            desc_elem = element.find('p')
            description = desc_elem.get_text(strip=True) if desc_elem else ""
            
            # Extract price information
            price_text = element.get_text()
            min_price, max_price, currency = self.extract_price_info(price_text)
            
            # Extract hospital if mentioned
            hospital = ""
            hospital_elem = element.find(class_=re.compile(r'hospital', re.I))
            if hospital_elem:
                hospital = hospital_elem.get_text(strip=True)
            
            # Extract location
            location = ""
            location_elem = element.find(class_=re.compile(r'location|city', re.I))
            if location_elem:
                location = location_elem.get_text(strip=True)
            
            treatment = Treatment(
                name=name,
                description=description,
                min_price=min_price,
                max_price=max_price,
                currency=currency,
                hospital=hospital,
                location=location,
                category=category
            )
            
            return treatment
            
        except Exception as e:
            logger.error(f"Error extracting treatment info: {e}")
            return None

    def extract_price_info(self, text: str) -> tuple:
        """Extract price information from text"""
        min_price = 0.0
        max_price = 0.0
        currency = "USD"
        
        # Look for price patterns
        price_patterns = [
            r'(\$|₹|€|£)\s*(\d+(?:,\d+)*)\s*-\s*(\d+(?:,\d+)*)',
            r'(\$|₹|€|£)\s*(\d+(?:,\d+)*)',
            r'(\d+(?:,\d+)*)\s*(\$|₹|€|£)',
        ]
        
        for pattern in price_patterns:
            match = re.search(pattern, text)
            if match:
                if len(match.groups()) == 3:
                    currency_symbol = match.group(1)
                    min_price = float(match.group(2).replace(',', ''))
                    max_price = float(match.group(3).replace(',', ''))
                else:
                    currency_symbol = match.group(1) if match.group(1) in ['$', '₹', '€', '£'] else match.group(2)
                    price = match.group(2) if match.group(1) in ['$', '₹', '€', '£'] else match.group(1)
                    min_price = max_price = float(price.replace(',', ''))
                
                # Convert currency symbol to code
                currency_map = {'$': 'USD', '₹': 'INR', '€': 'EUR', '£': 'GBP'}
                currency = currency_map.get(currency_symbol, 'USD')
                break
        
        return min_price, max_price, currency

    async def save_to_mongodb(self):
        """Save all scraped data to MongoDB"""
        try:
            # Save hospitals
            if self.hospitals:
                hospital_docs = [asdict(h) for h in self.hospitals]
                await self.db.hospitals.insert_many(hospital_docs)
                logger.info(f"Saved {len(self.hospitals)} hospitals to MongoDB")
            
            # Save doctors
            if self.doctors:
                doctor_docs = [asdict(d) for d in self.doctors]
                await self.db.doctors.insert_many(doctor_docs)
                logger.info(f"Saved {len(self.doctors)} doctors to MongoDB")
            
            # Save treatments
            if self.treatments:
                treatment_docs = [asdict(t) for t in self.treatments]
                await self.db.treatments.insert_many(treatment_docs)
                logger.info(f"Saved {len(self.treatments)} treatments to MongoDB")
            
        except Exception as e:
            logger.error(f"Error saving to MongoDB: {e}")

    async def export_to_csv(self):
        """Export scraped data to CSV files"""
        try:
            if self.hospitals:
                df_hospitals = pd.DataFrame([asdict(h) for h in self.hospitals])
                df_hospitals.to_csv('vaidam_hospitals.csv', index=False)
                logger.info(f"Exported {len(self.hospitals)} hospitals to CSV")
            
            if self.doctors:
                df_doctors = pd.DataFrame([asdict(d) for d in self.doctors])
                df_doctors.to_csv('vaidam_doctors.csv', index=False)
                logger.info(f"Exported {len(self.doctors)} doctors to CSV")
            
            if self.treatments:
                df_treatments = pd.DataFrame([asdict(t) for t in self.treatments])
                df_treatments.to_csv('vaidam_treatments.csv', index=False)
                logger.info(f"Exported {len(self.treatments)} treatments to CSV")
            
        except Exception as e:
            logger.error(f"Error exporting to CSV: {e}")

    async def run_comprehensive_scrape(self):
        """Run the complete scraping process"""
        try:
            logger.info("Starting comprehensive Vaidam scraping...")
            
            # Initialize
            await self.init_browser()
            await self.create_session()
            await self.init_mongo()
            
            # Discover all hospital URLs
            hospital_urls = await self.discover_hospital_urls()
            logger.info(f"Found {len(hospital_urls)} hospital URLs to scrape")
            
            # Scrape hospitals with concurrency control
            semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
            
            async def scrape_single_hospital(url):
                async with semaphore:
                    hospital = await self.scrape_hospital_details(url)
                    if hospital:
                        self.hospitals.append(hospital)
                        
                        # Scrape doctors for this hospital
                        doctors = await self.scrape_doctors_for_hospital(hospital)
                        self.doctors.extend(doctors)
                    
                    # Rate limiting
                    await asyncio.sleep(random.uniform(0.5, 1.5))
            
            # Process hospitals in batches
            batch_size = 20
            for i in range(0, len(hospital_urls), batch_size):
                batch = hospital_urls[i:i+batch_size]
                tasks = [scrape_single_hospital(url) for url in batch]
                await asyncio.gather(*tasks, return_exceptions=True)
                
                logger.info(f"Completed batch {i//batch_size + 1}/{(len(hospital_urls) + batch_size - 1)//batch_size}")
                
                # Longer pause between batches
                await asyncio.sleep(5)
            
            # Scrape treatments
            logger.info("Starting treatment scraping...")
            self.treatments = await self.scrape_treatments()
            
            # Save data
            await self.save_to_mongodb()
            await self.export_to_csv()
            
            logger.info("Comprehensive scraping completed!")
            logger.info(f"Total scraped - Hospitals: {len(self.hospitals)}, Doctors: {len(self.doctors)}, Treatments: {len(self.treatments)}")
            
        except Exception as e:
            logger.error(f"Error in comprehensive scrape: {e}")
        
        finally:
            await self.cleanup()

    async def cleanup(self):
        """Clean up resources"""
        try:
            if self.session:
                await self.session.close()
            
            if self.browser:
                await self.browser.close()
                await self.playwright.stop()
            
            if self.mongo_client:
                self.mongo_client.close()
            
            logger.info("Cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

# Main execution
async def main():
    scraper = VaidamComprehensiveScraper()
    await scraper.run_comprehensive_scrape()

if __name__ == "__main__":
    asyncio.run(main())
