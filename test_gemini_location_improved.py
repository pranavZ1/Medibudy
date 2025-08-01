#!/usr/bin/env python3
"""
Test script to verify Gemini AI location enhancement with improved parsing
"""

import os
import json
import re
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

def test_location_enhancement():
    """Test Gemini AI location enhancement with a sample hospital"""
    
    if not configure_gemini():
        return
    
    print("🔍 Testing Gemini AI location enhancement...")
    
    try:
        # Use the latest available Gemini model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        hospital_name = "Fortis Memorial Research Institute"
        city = "Gurgaon"
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
        
        # Parse the JSON response with improved handling
        location_data = extract_json_from_response(response.text)
        
        if location_data:
            print("\n🎯 Parsed Location Data:")
            print(f"  Address: {location_data.get('full_address', 'N/A')}")
            print(f"  State: {location_data.get('state', 'N/A')}")
            print(f"  Pincode: {location_data.get('pincode', 'N/A')}")
            print(f"  Area: {location_data.get('area', 'N/A')}")
        else:
            print("⚠️  Could not parse JSON from response")
            
    except Exception as e:
        print(f"❌ Error during location enhancement: {e}")

if __name__ == "__main__":
    test_location_enhancement()
