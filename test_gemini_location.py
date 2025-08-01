#!/usr/bin/env python3
"""
Test script to verify Gemini AI location enhancement
"""

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def configure_gemini() -> bool:
    """Configure Gemini AI with API key"""
    try:
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        return True
    except Exception as e:
        print(f"❌ Failed to configure Gemini AI: {e}")
        return False

def test_location_enhancement():
    """Test Gemini AI location enhancement with a sample hospital"""
    
    if not configure_gemini():
        return
    
    print("🔍 Testing Gemini AI location enhancement...")
    
    try:
        # Use the latest available Gemini model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        hospital_name = "Apollo Hospital"
        city = "Chennai"
        country = "India"
        
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
        
        print(f"📍 Enhancing location for: {hospital_name} in {city}, {country}")
        
        response = model.generate_content(prompt)
        
        print("✅ Gemini API Response:")
        print(response.text)
        
        # Try to parse the JSON response
        try:
            location_data = json.loads(response.text.strip())
            print("\n🎯 Parsed Location Data:")
            print(f"  Address: {location_data.get('full_address', 'N/A')}")
            print(f"  State: {location_data.get('state', 'N/A')}")
            print(f"  Pincode: {location_data.get('pincode', 'N/A')}")
            print(f"  Area: {location_data.get('area', 'N/A')}")
            
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON parsing failed: {e}")
            print("Raw response text:")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error during location enhancement: {e}")

if __name__ == "__main__":
    test_location_enhancement()
