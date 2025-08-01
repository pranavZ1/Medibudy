import pandas as pd
import pymongo
import re
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def analyze_excel_data():
    """Analyze the Excel file structure and data"""
    print("=== EXCEL DATA ANALYSIS ===")
    
    # Read the Excel file
    df = pd.read_excel('Best Hospitals in India - .xlsx')
    
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print("\nColumn names:")
    for i, col in enumerate(df.columns):
        print(f"  {i+1}. {col}")
    
    print("\nData types:")
    print(df.dtypes)
    
    print("\nFirst 3 rows:")
    print(df.head(3).to_string())
    
    print("\nSample data analysis:")
    
    # Analyze Location column
    print("\n--- Location Analysis ---")
    location_samples = df['Location'].head(5).tolist()
    for loc in location_samples:
        print(f"Raw: {loc}")
        cleaned = clean_location(str(loc))
        print(f"Cleaned: {cleaned}")
        print()
    
    # Analyze Rating column
    print("--- Rating Analysis ---")
    rating_samples = df['Rating'].head(5).tolist()
    for rating in rating_samples:
        print(f"Raw: {rating}")
        parsed = parse_rating(str(rating))
        print(f"Parsed: {parsed}")
        print()
    
    # Analyze Established Year column
    print("--- Established Year Analysis ---")
    year_samples = df['Established Year'].head(5).tolist()
    for year in year_samples:
        print(f"Raw: {year}")
        parsed = parse_established_year(str(year))
        print(f"Parsed: {parsed}")
        print()
    
    # Analyze Number of Beds column
    print("--- Bed Count Analysis ---")
    bed_samples = df['Number of Beds'].head(5).tolist()
    for beds in bed_samples:
        print(f"Raw: {beds}")
        parsed = parse_bed_count(str(beds))
        print(f"Parsed: {parsed}")
        print()
    
    return df

def clean_location(location_str):
    """Clean and parse location string"""
    if pd.isna(location_str) or location_str == 'nan':
        return {'city': '', 'state': '', 'country': 'India'}
    
    # Remove "Location:" prefix
    clean_location = re.sub(r'^Location:\s*', '', str(location_str), flags=re.IGNORECASE).strip()
    
    # Split by comma
    parts = [part.strip() for part in clean_location.split(',')]
    
    if len(parts) >= 2:
        return {
            'country': parts[0] or 'India',
            'city': parts[1] or '',
            'state': parts[2] if len(parts) > 2 else ''
        }
    
    return {'city': clean_location, 'state': '', 'country': 'India'}

def parse_rating(rating_str):
    """Parse rating string like '4.3 (86 Ratings)'"""
    if pd.isna(rating_str) or rating_str == 'nan':
        return {'rating': 0, 'total_reviews': 0}
    
    # Extract rating number
    rating_match = re.search(r'(\d+\.?\d*)', str(rating_str))
    # Extract review count
    reviews_match = re.search(r'\((\d+)\s*Ratings?\)', str(rating_str), re.IGNORECASE)
    
    return {
        'rating': float(rating_match.group(1)) if rating_match else 0,
        'total_reviews': int(reviews_match.group(1)) if reviews_match else 0
    }

def parse_established_year(year_str):
    """Parse established year string like 'Established in: 1995'"""
    if pd.isna(year_str) or year_str == 'nan':
        return None
    
    # Remove prefix and extract year
    clean_year = re.sub(r'^Established in:\s*', '', str(year_str), flags=re.IGNORECASE).strip()
    year_match = re.search(r'(\d{4})', clean_year)
    
    return int(year_match.group(1)) if year_match else None

def parse_bed_count(bed_str):
    """Parse bed count string like 'Number of Beds: 710'"""
    if pd.isna(bed_str) or bed_str == 'nan':
        return 0
    
    # Remove prefix and extract number
    clean_bed = re.sub(r'^Number of Beds:\s*', '', str(bed_str), flags=re.IGNORECASE).strip()
    bed_match = re.search(r'(\d+)', clean_bed)
    
    return int(bed_match.group(1)) if bed_match else 0

def parse_specialty(specialty_str):
    """Parse specialty string"""
    if pd.isna(specialty_str) or specialty_str == 'nan':
        return []
    
    # Split by common delimiters and clean
    specialties = re.split(r'[,;|]', str(specialty_str))
    
    return [{'name': spec.strip(), 'description': '', 'certifications': []} 
            for spec in specialties if spec.strip()]

def determine_hospital_type(specialty_str):
    """Determine hospital type from specialty"""
    if pd.isna(specialty_str):
        return 'private'
    
    specialty_lower = str(specialty_str).lower()
    if 'government' in specialty_lower or 'govt' in specialty_lower:
        return 'government'
    elif 'trust' in specialty_lower:
        return 'trust'
    elif 'charitable' in specialty_lower or 'charity' in specialty_lower:
        return 'charitable'
    else:
        return 'private'

def transform_row_to_hospital(row):
    """Transform a pandas row to hospital document"""
    location_data = clean_location(row.get('Location', ''))
    rating_data = parse_rating(row.get('Rating', ''))
    established_year = parse_established_year(row.get('Established Year', ''))
    
    # Create enhanced description
    description = str(row.get('Description', '')) if not pd.isna(row.get('Description')) else ''
    if established_year:
        description = f"Established in {established_year}. {description}"
    
    hospital_doc = {
        'name': str(row.get('Hospital Name', '')),
        'description': description,
        'type': determine_hospital_type(row.get('Specialty', '')),
        
        'location': {
            'address': '',  # Not provided in Excel
            'city': location_data['city'],
            'state': location_data['state'],
            'country': location_data['country'],
            'pincode': '',
            'coordinates': {
                'lat': 0,  # Will need geocoding
                'lng': 0
            }
        },
        
        'contact': {
            'phone': [],
            'email': '',
            'website': '',
            'emergencyNumber': ''
        },
        
        'ratings': {
            'overall': rating_data['rating'],
            'totalReviews': rating_data['total_reviews'],
            'cleanliness': 0,
            'staff': 0,
            'facilities': 0,
            'treatment': 0
        },
        
        'specialties': parse_specialty(row.get('Specialty', '')),
        
        'facilities': {
            'bedCount': parse_bed_count(row.get('Number of Beds', '')),
            'icuBeds': 0,
            'emergencyServices': True,
            'ambulanceServices': True,
            'pharmacy': True,
            'laboratory': True,
            'bloodBank': False,
            'imaging': {
                'xray': False,
                'mri': False,
                'ct': False,
                'ultrasound': False,
                'mammography': False
            },
            'otherFacilities': []
        },
        
        'images': [str(row.get('Hospital Image URL', ''))] if not pd.isna(row.get('Hospital Image URL')) else [],
        
        'isActive': True,
        'verificationStatus': 'pending',
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    return hospital_doc

def connect_to_mongodb():
    """Connect to MongoDB"""
    mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/test')
    
    # Ensure we connect to the test database
    if not mongodb_uri.endswith('/test'):
        # Replace database name with 'test'
        mongodb_uri = re.sub(r'/[^/]*(\?.*)?$', r'/test\1', mongodb_uri)
    
    client = pymongo.MongoClient(mongodb_uri)
    db = client.test  # Use test database
    
    print(f"Connected to MongoDB database: {db.name}")
    return db

def import_hospitals_to_mongodb(df):
    """Import hospitals to MongoDB"""
    print("\n=== IMPORTING TO MONGODB ===")
    
    # Connect to database
    db = connect_to_mongodb()
    hospitals_collection = db.hospitals
    
    # Check existing hospitals
    existing_count = hospitals_collection.count_documents({})
    print(f"Existing hospitals in database: {existing_count}")
    
    success_count = 0
    error_count = 0
    duplicate_count = 0
    
    for index, row in df.iterrows():
        try:
            hospital_doc = transform_row_to_hospital(row)
            
            # Check if hospital already exists
            existing = hospitals_collection.find_one({
                'name': hospital_doc['name'],
                'location.city': hospital_doc['location']['city']
            })
            
            if existing:
                duplicate_count += 1
                print(f"⚠️  Duplicate: {hospital_doc['name']} in {hospital_doc['location']['city']}")
                continue
            
            # Insert hospital
            result = hospitals_collection.insert_one(hospital_doc)
            success_count += 1
            print(f"✓ Imported [{index+1}/{len(df)}]: {hospital_doc['name']}")
            
        except Exception as e:
            error_count += 1
            print(f"✗ Error importing row {index+1}: {str(e)}")
    
    print(f"\n=== IMPORT SUMMARY ===")
    print(f"✓ Successfully imported: {success_count}")
    print(f"⚠️  Duplicates skipped: {duplicate_count}")
    print(f"✗ Errors: {error_count}")
    print(f"📊 Total in database: {hospitals_collection.count_documents({})}")

def get_data_statistics(df):
    """Get statistics about the data"""
    print("\n=== DATA STATISTICS ===")
    
    # City distribution
    print("Top 10 cities by hospital count:")
    df_clean_locations = df.copy()
    df_clean_locations['clean_city'] = df_clean_locations['Location'].apply(lambda x: clean_location(x)['city'])
    city_counts = df_clean_locations['clean_city'].value_counts().head(10)
    print(city_counts)
    
    # Rating distribution
    print("\nRating distribution:")
    df_ratings = df.copy()
    df_ratings['rating_value'] = df_ratings['Rating'].apply(lambda x: parse_rating(x)['rating'])
    rating_stats = df_ratings['rating_value'].describe()
    print(rating_stats)
    
    # Bed count distribution
    print("\nBed count distribution:")
    df_beds = df.copy()
    df_beds['bed_count'] = df_beds['Number of Beds'].apply(parse_bed_count)
    bed_stats = df_beds['bed_count'].describe()
    print(bed_stats)
    
    # Specialty distribution
    print("\nTop 10 specialties:")
    specialty_counts = df['Specialty'].value_counts().head(10)
    print(specialty_counts)

def main():
    """Main function"""
    try:
        # Analyze Excel data
        df = analyze_excel_data()
        
        # Get statistics
        get_data_statistics(df)
        
        # Ask user if they want to import
        response = input("\nDo you want to import this data to MongoDB? (y/n): ")
        if response.lower() == 'y':
            import_hospitals_to_mongodb(df)
        else:
            print("Import cancelled.")
            
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
