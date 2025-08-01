#!/usr/bin/env python3
"""
Enhanced Doctors Data Import Script with Hospital Mapping
Imports doctor data from Excel to MongoDB and maps them to hospitals
"""

import pandas as pd
import pymongo
import json
import os
import re
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List
import difflib
from bson import ObjectId

# Load environment variables
load_dotenv()

# Configuration
MONGODB_URI = os.getenv('MONGODB_URI')
DOCTORS_EXCEL_FILE = 'Best Doctors in India - To.xlsx'
DATABASE_NAME = 'test'
DOCTORS_COLLECTION = 'doctors'
HOSPITALS_COLLECTION = 'hospitals'

def parse_experience(experience_str: str) -> int:
    """Extract years of experience from string"""
    if pd.isna(experience_str):
        return 0
    
    # Pattern: "28+ years of experience" or "28 years" etc.
    pattern = r'(\d+)'
    match = re.search(pattern, str(experience_str))
    
    if match:
        return int(match.group(1))
    
    return 0

def parse_designation(designation_str: str) -> str:
    """Clean designation field"""
    if pd.isna(designation_str):
        return ''
    
    # Remove "Designation:" prefix if present
    clean_designation = re.sub(r'^Designation:\s*', '', str(designation_str).strip())
    return clean_designation

def parse_location(location_str: str) -> Dict[str, str]:
    """Parse location to extract city and country"""
    if pd.isna(location_str):
        return {'city': '', 'country': '', 'state': ''}
    
    # Pattern: "New Delhi, India" or "Gurgaon, India"
    parts = [part.strip() for part in str(location_str).split(',')]
    
    if len(parts) >= 2:
        return {
            'city': parts[0],
            'country': parts[1] if parts[1] else 'India',
            'state': ''
        }
    elif len(parts) == 1:
        return {
            'city': parts[0],
            'country': 'India',
            'state': ''
        }
    else:
        return {'city': '', 'country': '', 'state': ''}

def parse_rating(rating_str: str) -> Dict[str, Any]:
    """Parse rating string to extract numeric rating and review count"""
    if pd.isna(rating_str):
        return {'rating': 0.0, 'total_reviews': 0}
    
    # Pattern: "5.0 (12 Ratings)"
    pattern = r'(\d+\.?\d*)\s*\((\d+)\s*Ratings?\)'
    match = re.search(pattern, str(rating_str))
    
    if match:
        return {
            'rating': float(match.group(1)),
            'total_reviews': int(match.group(2))
        }
    
    return {'rating': 0.0, 'total_reviews': 0}

def extract_specialization_from_summary(summary: str) -> str:
    """Extract specialization from doctor summary"""
    if pd.isna(summary):
        return ''
    
    summary_str = str(summary).lower()
    
    # Common specializations to look for
    specializations = [
        'vascular surgery', 'vascular surgeon',
        'gynecology', 'gynecologist', 'obstetrics',
        'gastroenterology', 'gastroenterologist',
        'cardiology', 'cardiologist', 'cardiac surgery',
        'neurology', 'neurologist', 'neurosurgery', 'neurosurgeon',
        'orthopedic', 'orthopedics', 'orthopedic surgery',
        'oncology', 'oncologist',
        'pediatrics', 'pediatrician',
        'dermatology', 'dermatologist',
        'psychiatry', 'psychiatrist',
        'radiology', 'radiologist',
        'anesthesia', 'anesthesiologist',
        'emergency medicine',
        'internal medicine',
        'general surgery', 'surgeon',
        'pulmonology', 'pulmonologist',
        'nephrology', 'nephrologist',
        'endocrinology', 'endocrinologist',
        'urology', 'urologist',
        'ophthalmology', 'ophthalmologist',
        'ent', 'otolaryngology'
    ]
    
    for spec in specializations:
        if spec in summary_str:
            return spec.title()
    
    return 'General Medicine'

def clean_hospital_name(hospital_name: str) -> str:
    """Clean hospital name for better matching"""
    if pd.isna(hospital_name):
        return ''
    
    # Remove common prefixes/suffixes and normalize
    clean_name = str(hospital_name).strip()
    
    # Remove common variations
    clean_name = re.sub(r',?\s*(New Delhi|Delhi|Mumbai|Bangalore|Chennai|Kolkata|Hyderabad|Pune|Gurgaon)$', '', clean_name, flags=re.IGNORECASE)
    clean_name = re.sub(r'\s+', ' ', clean_name).strip()
    
    return clean_name

def find_matching_hospital(doctor_hospital: str, doctor_city: str, hospitals_data: List[Dict]) -> Optional[str]:
    """Find matching hospital in the hospitals collection using fuzzy matching"""
    if not doctor_hospital or not hospitals_data:
        return None
    
    clean_doctor_hospital = clean_hospital_name(doctor_hospital).lower()
    clean_doctor_city = doctor_city.lower() if doctor_city else ''
    
    best_match = None
    best_score = 0.0
    
    for hospital in hospitals_data:
        hospital_name = hospital.get('name', '').lower()
        hospital_city = hospital.get('location', {}).get('city', '').lower()
        
        # Calculate name similarity
        name_similarity = difflib.SequenceMatcher(None, clean_doctor_hospital, hospital_name).ratio()
        
        # Boost score if cities match
        city_bonus = 0.2 if clean_doctor_city and clean_doctor_city == hospital_city else 0
        
        # Boost score for exact substring matches
        substring_bonus = 0.3 if clean_doctor_hospital in hospital_name or hospital_name in clean_doctor_hospital else 0
        
        total_score = name_similarity + city_bonus + substring_bonus
        
        # Consider it a match if score is above threshold
        if total_score > best_score and total_score > 0.6:
            best_score = total_score
            best_match = hospital['_id']
    
    return best_match

def transform_doctor_data(row: pd.Series, hospital_id: Optional[str] = None) -> Dict[str, Any]:
    """Transform Excel row to MongoDB doctor document format"""
    
    # Parse fields
    location_data = parse_location(row['Location'])
    rating_data = parse_rating(row['Rating'])
    experience_years = parse_experience(row['Experience'])
    designation = parse_designation(row['Designation'])
    specialization = extract_specialization_from_summary(row['Doctor Summary'])
    
    # Create doctor document
    doctor_doc = {
        'name': str(row['Doctor Name']).strip(),
        'specialization': specialization,
        'designation': designation,
        'experience_years': experience_years,
        'experience_text': str(row['Experience']).strip() if pd.notna(row['Experience']) else '',
        'rating': {
            'value': rating_data['rating'],
            'total_reviews': rating_data['total_reviews']
        },
        'location': {
            'city': location_data['city'],
            'country': location_data['country'],
            'state': location_data['state']
        },
        'hospital': {
            'name': str(row['Hospital']).strip() if pd.notna(row['Hospital']) else '',
            'hospital_id': hospital_id  # MongoDB ObjectId reference
        },
        'image_url': str(row['Doctor Image']).strip() if pd.notna(row['Doctor Image']) else '',
        'summary': str(row['Doctor Summary']).strip() if pd.notna(row['Doctor Summary']) else '',
        'contact': {
            'phone': '',
            'email': '',
            'website': ''
        },
        'qualifications': [],
        'languages': [],
        'consultation_fee': 0,
        'availability': [],
        'is_verified': False,
        'created_at': pd.Timestamp.now(),
        'updated_at': pd.Timestamp.now()
    }
    
    return doctor_doc

def analyze_doctors_data():
    """Analyze the doctors Excel file structure and content"""
    print("=== DOCTORS DATA ANALYSIS ===")
    
    # Read Excel file
    df = pd.read_excel(DOCTORS_EXCEL_FILE)
    
    print(f"Total doctors: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print()
    
    print("Column names:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")
    print()
    
    print("Data types:")
    print(df.dtypes)
    print()
    
    print("Sample data analysis:")
    print()
    
    # Location analysis
    print("--- Location Analysis ---")
    for i, location in enumerate(df['Location'].head(5)):
        parsed = parse_location(location)
        print(f"Raw: {location}")
        print(f"Parsed: {parsed}")
        print()
    
    # Experience analysis
    print("--- Experience Analysis ---")
    for i, exp in enumerate(df['Experience'].head(5)):
        years = parse_experience(exp)
        print(f"Raw: {exp}")
        print(f"Years: {years}")
        print()
    
    # Hospital analysis
    print("--- Hospital Analysis ---")
    print("Top 10 hospitals by doctor count:")
    hospital_counts = df['Hospital'].value_counts().head(10)
    print(hospital_counts)
    print()
    
    # Specialization analysis (from summaries)
    print("--- Specialization Analysis (from summaries) ---")
    df['extracted_specialization'] = df['Doctor Summary'].apply(extract_specialization_from_summary)
    print("Top 10 specializations:")
    print(df['extracted_specialization'].value_counts().head(10))
    print()
    
    return df

def get_doctors_statistics(df: pd.DataFrame):
    """Generate statistics about the doctors data"""
    print("\n=== DOCTORS STATISTICS ===")
    
    # Add parsed columns for analysis
    df['parsed_location'] = df['Location'].apply(parse_location)
    df['city'] = df['parsed_location'].apply(lambda x: x['city'])
    df['experience_years'] = df['Experience'].apply(parse_experience)
    df['rating_data'] = df['Rating'].apply(parse_rating)
    df['rating_value'] = df['rating_data'].apply(lambda x: x['rating'])
    
    # City distribution
    print("Top 10 cities by doctor count:")
    print(df['city'].value_counts().head(10))
    print()
    
    # Experience distribution
    print("Experience distribution:")
    print(df['experience_years'].describe())
    print()
    
    # Rating distribution (only for doctors with ratings)
    ratings_available = df[df['rating_value'] > 0]
    if len(ratings_available) > 0:
        print("Rating distribution (for doctors with ratings):")
        print(ratings_available['rating_value'].describe())
        print(f"Doctors with ratings: {len(ratings_available)}/{len(df)}")
    else:
        print("No doctors have ratings available")
    print()

def import_doctors_to_mongodb(df: pd.DataFrame, map_to_hospitals: bool = True):
    """Import doctors data to MongoDB and optionally map to hospitals"""
    print("=== IMPORTING DOCTORS TO MONGODB ===")
    
    # Connect to MongoDB
    client = pymongo.MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    doctors_collection = db[DOCTORS_COLLECTION]
    hospitals_collection = db[HOSPITALS_COLLECTION]
    
    print(f"Connected to MongoDB database: {DATABASE_NAME}")
    
    # Check existing data
    existing_doctors = doctors_collection.count_documents({})
    existing_hospitals = hospitals_collection.count_documents({})
    print(f"Existing doctors in database: {existing_doctors}")
    print(f"Existing hospitals in database: {existing_hospitals}")
    
    # Load hospitals data for mapping if requested
    hospitals_data = []
    if map_to_hospitals and existing_hospitals > 0:
        print("🔍 Loading hospitals data for mapping...")
        hospitals_data = list(hospitals_collection.find({}, {'_id': 1, 'name': 1, 'location': 1}))
        print(f"Loaded {len(hospitals_data)} hospitals for mapping")
    
    # Import statistics
    imported = 0
    duplicates = 0
    errors = 0
    mapped_to_hospitals = 0
    hospital_updates = {}  # Track which hospitals to update
    
    for index, row in df.iterrows():
        try:
            # Find matching hospital if mapping is enabled
            hospital_id = None
            if map_to_hospitals and hospitals_data:
                doctor_hospital = str(row['Hospital']).strip() if pd.notna(row['Hospital']) else ''
                doctor_city = parse_location(row['Location'])['city']
                
                if doctor_hospital:
                    hospital_id = find_matching_hospital(doctor_hospital, doctor_city, hospitals_data)
                    if hospital_id:
                        mapped_to_hospitals += 1
                        # Track this hospital for updating
                        if hospital_id not in hospital_updates:
                            hospital_updates[hospital_id] = []
            
            # Transform doctor data
            doctor_doc = transform_doctor_data(row, hospital_id)
            
            # Check for duplicates (by name and hospital)
            existing = doctors_collection.find_one({
                'name': doctor_doc['name'],
                'hospital.name': doctor_doc['hospital']['name']
            })
            
            if existing:
                print(f"⚠️  Duplicate: {doctor_doc['name']} at {doctor_doc['hospital']['name']}")
                duplicates += 1
                continue
            
            # Insert doctor
            result = doctors_collection.insert_one(doctor_doc)
            
            # Add to hospital updates if mapped
            if hospital_id and hospital_id in hospital_updates:
                hospital_updates[hospital_id].append({
                    'doctor_id': result.inserted_id,
                    'name': doctor_doc['name'],
                    'specialization': doctor_doc['specialization'],
                    'designation': doctor_doc['designation'],
                    'experience_years': doctor_doc['experience_years']
                })
            
            imported += 1
            
            if imported % 50 == 0:
                print(f"✅ Imported {imported} doctors...")
                
        except Exception as e:
            print(f"❌ Error importing {row['Doctor Name']}: {e}")
            errors += 1
    
    # Update hospitals with doctor information
    if map_to_hospitals and hospital_updates:
        print(f"\n🏥 Updating {len(hospital_updates)} hospitals with doctor information...")
        hospitals_updated = 0
        
        for hospital_id, doctors_list in hospital_updates.items():
            try:
                # Update hospital document with doctors array
                hospitals_collection.update_one(
                    {'_id': ObjectId(hospital_id)},
                    {
                        '$set': {
                            'doctors': doctors_list,
                            'updated_at': pd.Timestamp.now()
                        }
                    }
                )
                hospitals_updated += 1
                
            except Exception as e:
                print(f"❌ Error updating hospital {hospital_id}: {e}")
        
        print(f"✅ Updated {hospitals_updated} hospitals with doctor information")
    
    print(f"\n=== IMPORT SUMMARY ===")
    print(f"✓ Successfully imported: {imported}")
    print(f"⚠️  Duplicates skipped: {duplicates}")
    print(f"✗ Errors: {errors}")
    if map_to_hospitals:
        print(f"🏥 Doctors mapped to hospitals: {mapped_to_hospitals}")
        print(f"🏥 Hospitals updated: {len(hospital_updates)}")
    
    final_doctors_count = doctors_collection.count_documents({})
    print(f"📊 Total doctors in database: {final_doctors_count}")
    
    client.close()

def create_fresh_doctors_import_option(collection):
    """Create a fresh import by dropping the doctors collection first"""
    print("⚠️  WARNING: This will delete all existing doctor data!")
    while True:
        try:
            confirm = input("Are you sure you want to delete existing doctor data and start fresh? (yes/no): ").strip().lower()
            if confirm == 'yes':
                collection.drop()
                print("✅ Existing doctors collection dropped")
                return True
            elif confirm == 'no':
                print("❌ Fresh import cancelled")
                return False
            else:
                print("Please enter 'yes' or 'no'")
        except KeyboardInterrupt:
            print("\nOperation cancelled")
            return False

def main():
    """Main execution function"""
    # Analyze doctors data
    df = analyze_doctors_data()
    
    # Generate statistics
    get_doctors_statistics(df)
    
    # Choose import option
    print("="*60)
    print("DOCTORS IMPORT OPTIONS:")
    print("1. Basic import (doctors only, no hospital mapping)")
    print("2. Enhanced import with hospital mapping")
    print("3. Fresh import - Delete existing doctor data and import with hospital mapping")
    print("="*60)
    
    while True:
        try:
            choice = input("Choose import option (1, 2, or 3): ").strip()
            if choice in ['1', '2', '3']:
                break
            print("Please enter 1, 2, or 3")
        except KeyboardInterrupt:
            print("\nOperation cancelled")
            return
    
    map_to_hospitals = choice in ['2', '3']
    fresh_import = choice == '3'
    
    # Handle fresh import
    if fresh_import:
        client = pymongo.MongoClient(os.getenv('MONGODB_URI'))
        db = client[DATABASE_NAME]
        doctors_collection = db[DOCTORS_COLLECTION]
        
        if not create_fresh_doctors_import_option(doctors_collection):
            client.close()
            return
        client.close()
    
    if map_to_hospitals:
        print("\n🏥 Hospital mapping enabled - doctors will be linked to their hospitals")
        print("⏱️  This will also update hospital documents with doctor information")
    
    # Import doctors to MongoDB
    import_doctors_to_mongodb(df, map_to_hospitals)

if __name__ == "__main__":
    main()
