#!/usr/bin/env python3
"""
Enhanced Hospital Data Import Script with Gemini AI Location Enhancement
Imports hospital data from Excel to MongoDB with AI-powered location enrichment
Final version with improved JSON parsing
"""

import pandas as pd
import pymongo
import json
import os
import re
import google.generativeai as genai
from dotenv import load_dotenv
from typing import Dict, Any, Optional

# Load environment variables
load_dotenv()

# Configuration
MONGODB_URI = os.getenv('MONGODB_URI')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
EXCEL_FILE = 'Best Hospitals in India - .xlsx'
DATABASE_NAME = 'test'
COLLECTION_NAME = 'hospitals'

def configure_gemini() -> bool:
    """Configure Gemini AI with API key"""
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        return True
    except Exception as e:
        print(f"❌ Failed to configure Gemini AI: {e}")
        return False

def extract_json_from_response(response_text: str) -> dict:
    """Extract JSON from Gemini response, handling markdown code blocks"""
    
    # Remove markdown code blocks if present
    cleaned_text = re.sub(r'```json\s*|\s*```', '', response_text.strip())
    
    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        # Try to find JSON-like content in the text
        json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
    
    return {}

def enhance_location_with_gemini(hospital_name: str, city: str, country: str = "India") -> Dict[str, str]:
    """
    Use Gemini AI to enhance location data with full address, state, and pincode
    """
    try:
        # Use the latest available Gemini model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        For the hospital "{hospital_name}" in {city}, {country}, provide the following information in JSON format:
        {{
            "full_address": "complete street address",
            "state": "state name",
            "pincode": "postal code",
            "area": "area/locality name"
        }}
        
        Please provide accurate, real information. If you cannot find exact information, provide reasonable estimates based on the city location.
        Only return the JSON object, no additional text.
        """
        
        response = model.generate_content(prompt)
        
        # Parse the JSON response with improved handling
        location_data = extract_json_from_response(response.text)
        
        if location_data:
            return {
                'address': location_data.get('full_address', ''),
                'state': location_data.get('state', ''),
                'pincode': location_data.get('pincode', ''),
                'area': location_data.get('area', '')
            }
        else:
            return {
                'address': '',
                'state': '',
                'pincode': '',
                'area': ''
            }
            
    except Exception as e:
        print(f"⚠️  Error enhancing location for {hospital_name}: {e}")
        return {
            'address': '',
            'state': '',
            'pincode': '',
            'area': ''
        }

def clean_location_data(location_str: str) -> Dict[str, str]:
    """Extract and clean location information"""
    if pd.isna(location_str):
        return {'country': '', 'city': '', 'state': ''}
    
    # Remove "Location:" prefix
    clean_location = re.sub(r'^Location:\s*', '', str(location_str).strip())
    
    # Split by comma and clean
    parts = [part.strip() for part in clean_location.split(',')]
    
    if len(parts) >= 2:
        return {
            'country': parts[0],
            'city': parts[1],
            'state': ''
        }
    elif len(parts) == 1:
        return {
            'country': 'India',
            'city': parts[0],
            'state': ''
        }
    else:
        return {'country': '', 'city': '', 'state': ''}

def parse_rating(rating_str: str) -> Dict[str, Any]:
    """Parse rating string to extract numeric rating and review count"""
    if pd.isna(rating_str):
        return {'rating': 0.0, 'total_reviews': 0}
    
    # Pattern: "4.3 (86 Ratings)"
    pattern = r'(\d+\.?\d*)\s*\((\d+)\s*Ratings?\)'
    match = re.search(pattern, str(rating_str))
    
    if match:
        return {
            'rating': float(match.group(1)),
            'total_reviews': int(match.group(2))
        }
    
    return {'rating': 0.0, 'total_reviews': 0}

def parse_established_year(year_str: str) -> int:
    """Extract established year from string"""
    if pd.isna(year_str):
        return 0
    
    # Remove "Established in:" prefix and extract year
    clean_year = re.sub(r'^Established in:\s*', '', str(year_str).strip())
    year_match = re.search(r'(\d{4})', clean_year)
    
    if year_match:
        return int(year_match.group(1))
    
    return 0

def parse_bed_count(bed_str: str) -> int:
    """Extract bed count from string"""
    if pd.isna(bed_str):
        return 0
    
    # Remove "Number of Beds:" prefix and extract number
    clean_beds = re.sub(r'^Number of Beds:\s*', '', str(bed_str).strip())
    bed_match = re.search(r'(\d+)', clean_beds)
    
    if bed_match:
        return int(bed_match.group(1))
    
    return 0

def transform_hospital_data(row: pd.Series, enhance_with_ai: bool = False) -> Dict[str, Any]:
    """Transform Excel row to MongoDB document format"""
    
    # Parse location
    location_data = clean_location_data(row['Location'])
    
    # Parse rating
    rating_data = parse_rating(row['Rating'])
    
    # Parse other fields
    established_year = parse_established_year(row['Established Year'])
    bed_count = parse_bed_count(row['Number of Beds'])
    
    # AI Enhancement for location data
    enhanced_location = {}
    if enhance_with_ai and location_data['city']:
        print(f"🔍 Enhancing location data for {row['Hospital Name']}...")
        enhanced_location = enhance_location_with_gemini(
            row['Hospital Name'], 
            location_data['city'], 
            location_data['country']
        )
    
    # Create hospital document
    hospital_doc = {
        'name': str(row['Hospital Name']).strip(),
        'rating': {
            'value': rating_data['rating'],
            'total_reviews': rating_data['total_reviews']
        },
        'image_url': str(row['Hospital Image URL']).strip() if pd.notna(row['Hospital Image URL']) else '',
        'established_year': established_year,
        'bed_count': bed_count,
        'specialty': str(row['Specialty']).strip() if pd.notna(row['Specialty']) else '',
        'location': {
            'country': location_data['country'],
            'city': location_data['city'],
            'state': enhanced_location.get('state', location_data['state']),
            'address': enhanced_location.get('address', ''),
            'pincode': enhanced_location.get('pincode', ''),
            'area': enhanced_location.get('area', '')
        },
        'description': str(row['Description']).strip() if pd.notna(row['Description']) else '',
        'contact': {
            'phone': '',
            'email': '',
            'website': ''
        },
        'facilities': [],
        'departments': [],
        'doctors': [],
        'is_verified': False,
        'created_at': pd.Timestamp.now(),
        'updated_at': pd.Timestamp.now()
    }
    
    return hospital_doc

def analyze_excel_data():
    """Analyze the Excel file structure and content"""
    print("=== EXCEL DATA ANALYSIS ===")
    
    # Read Excel file
    df = pd.read_excel(EXCEL_FILE)
    
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print()
    
    print("Column names:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")
    print()
    
    print("Data types:")
    print(df.dtypes)
    print()
    
    print("First 3 rows:")
    print(df.head(3))
    print()
    
    # Sample data analysis
    print("Sample data analysis:")
    print()
    
    # Location analysis
    print("--- Location Analysis ---")
    for i, location in enumerate(df['Location'].head(5)):
        cleaned = clean_location_data(location)
        print(f"Raw: {location}")
        print(f"Cleaned: {cleaned}")
        print()
    
    # Rating analysis
    print("--- Rating Analysis ---")
    for i, rating in enumerate(df['Rating'].head(5)):
        parsed = parse_rating(rating)
        print(f"Raw: {rating}")
        print(f"Parsed: {parsed}")
        print()
    
    # Established year analysis
    print("--- Established Year Analysis ---")
    for i, year in enumerate(df['Established Year'].head(5)):
        parsed = parse_established_year(year)
        print(f"Raw: {year}")
        print(f"Parsed: {parsed}")
        print()
    
    # Bed count analysis
    print("--- Bed Count Analysis ---")
    for i, beds in enumerate(df['Number of Beds'].head(5)):
        parsed = parse_bed_count(beds)
        print(f"Raw: {beds}")
        print(f"Parsed: {parsed}")
        print()
    
    return df

def get_data_statistics(df: pd.DataFrame):
    """Generate statistics about the data"""
    print("\n=== DATA STATISTICS ===")
    
    # Add clean columns for analysis
    df['clean_location'] = df['Location'].apply(clean_location_data)
    df['clean_city'] = df['clean_location'].apply(lambda x: x['city'])
    df['rating_data'] = df['Rating'].apply(parse_rating)
    df['rating_value'] = df['rating_data'].apply(lambda x: x['rating'])
    df['bed_count'] = df['Number of Beds'].apply(parse_bed_count)
    
    # City distribution
    print("Top 10 cities by hospital count:")
    print(df['clean_city'].value_counts().head(10))
    print()
    
    # Rating distribution
    print("Rating distribution:")
    print(df['rating_value'].describe())
    print()
    
    # Bed count distribution
    print("Bed count distribution:")
    print(df['bed_count'].describe())
    print()
    
    # Specialty distribution
    print("Top 10 specialties:")
    print(df['Specialty'].value_counts().head(10))
    print()

def create_fresh_import_option(collection):
    """Create a fresh import by dropping the collection first"""
    print("⚠️  WARNING: This will delete all existing hospital data!")
    while True:
        try:
            confirm = input("Are you sure you want to delete existing data and start fresh? (yes/no): ").strip().lower()
            if confirm == 'yes':
                collection.drop()
                print("✅ Existing hospital collection dropped")
                return True
            elif confirm == 'no':
                print("❌ Fresh import cancelled")
                return False
            else:
                print("Please enter 'yes' or 'no'")
        except KeyboardInterrupt:
            print("\nOperation cancelled")
            return False

def import_to_mongodb(df: pd.DataFrame, enhance_locations: bool = False, fresh_import: bool = False):
    """Import hospital data to MongoDB"""
    print("=== IMPORTING TO MONGODB ===")
    
    # Configure Gemini AI if enhancement is requested
    if enhance_locations:
        if configure_gemini():
            print("✓ Gemini AI configured successfully")
        else:
            print("❌ Failed to configure Gemini AI, proceeding without enhancement")
            enhance_locations = False
    
    # Connect to MongoDB
    client = pymongo.MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    print(f"Connected to MongoDB database: {DATABASE_NAME}")
    
    # Handle fresh import option
    if fresh_import:
        if not create_fresh_import_option(collection):
            client.close()
            return
    
    # Check existing hospitals
    existing_count = collection.count_documents({})
    print(f"Existing hospitals in database: {existing_count}")
    
    if enhance_locations:
        print("🚀 Location enhancement enabled - this will take longer but provide better data")
        print("⏱️  Processing will include API calls to enhance location data...")
    
    # Import statistics
    imported = 0
    duplicates = 0
    errors = 0
    enhanced = 0
    
    for index, row in df.iterrows():
        try:
            # Transform data
            hospital_doc = transform_hospital_data(row, enhance_with_ai=enhance_locations)
            
            if enhance_locations and hospital_doc['location']['state']:
                enhanced += 1
            
            # Check for duplicates (by name and city) unless fresh import
            if not fresh_import:
                existing = collection.find_one({
                    'name': hospital_doc['name'],
                    'location.city': hospital_doc['location']['city']
                })
                
                if existing:
                    print(f"⚠️  Duplicate: {hospital_doc['name']} in {hospital_doc['location']['city']}")
                    duplicates += 1
                    continue
            
            # Insert hospital
            collection.insert_one(hospital_doc)
            imported += 1
            
            if imported % 50 == 0:
                print(f"✅ Imported {imported} hospitals...")
                
        except Exception as e:
            print(f"❌ Error importing {row['Hospital Name']}: {e}")
            errors += 1
    
    print(f"\n=== IMPORT SUMMARY ===")
    print(f"✓ Successfully imported: {imported}")
    print(f"⚠️  Duplicates skipped: {duplicates}")
    print(f"✗ Errors: {errors}")
    if enhance_locations:
        print(f"🔍 Locations enhanced: {enhanced}")
    
    final_count = collection.count_documents({})
    print(f"📊 Total in database: {final_count}")
    
    client.close()

def main():
    """Main execution function"""
    # Analyze Excel data
    df = analyze_excel_data()
    
    # Generate statistics
    get_data_statistics(df)
    
    # Choose import option
    print("="*50)
    print("IMPORT OPTIONS:")
    print("1. Basic import (fast)")
    print("2. Enhanced import with Gemini AI location data (slower but more complete)")
    print("3. Fresh import - Delete existing data and import with Gemini AI enhancement")
    print("="*50)
    
    while True:
        try:
            choice = input("Choose import option (1, 2, or 3): ").strip()
            if choice in ['1', '2', '3']:
                break
            print("Please enter 1, 2, or 3")
        except KeyboardInterrupt:
            print("\nOperation cancelled")
            return
    
    enhance_locations = choice in ['2', '3']
    fresh_import = choice == '3'
    
    if enhance_locations and not fresh_import:
        print("\n⚠️  Enhanced import will use Gemini AI to fetch missing location details")
        print("⏱️  This will take significantly longer due to API calls")
        
        while True:
            try:
                confirm = input("Continue with enhanced import? (y/n): ").strip().lower()
                if confirm in ['y', 'yes']:
                    break
                elif confirm in ['n', 'no']:
                    print("Switching to basic import...")
                    enhance_locations = False
                    break
                print("Please enter y or n")
            except KeyboardInterrupt:
                print("\nOperation cancelled")
                return
    
    # Import to MongoDB
    import_to_mongodb(df, enhance_locations, fresh_import)

if __name__ == "__main__":
    main()
