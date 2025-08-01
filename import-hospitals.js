const xlsx = require('xlsx');
const mongoose = require('mongoose');
const Hospital = require('./backend/models/Hospital');
require('dotenv').config();

async function importHospitalsFromExcel() {
  try {
    // Connect to MongoDB (using test database)
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, '/test') || 'mongodb://localhost:27017/test';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB test database');

    // Read the Excel file
    const workbook = xlsx.readFile('./Best Hospitals in India - .xlsx');
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert sheet to JSON
    const hospitalData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${hospitalData.length} hospitals in Excel file`);
    console.log('Sample data structure:', hospitalData[0]);

    // Transform and import data
    let successCount = 0;
    let errorCount = 0;

    for (const row of hospitalData) {
      try {
        // Transform Excel row to match Hospital schema
        const hospitalDoc = transformExcelRowToHospital(row);
        
        // Check if hospital already exists (by name and city)
        const existingHospital = await Hospital.findOne({
          name: hospitalDoc.name,
          'location.city': hospitalDoc.location.city
        });

        if (existingHospital) {
          console.log(`Hospital already exists: ${hospitalDoc.name} in ${hospitalDoc.location.city}`);
          continue;
        }

        // Create new hospital
        const hospital = new Hospital(hospitalDoc);
        await hospital.save();
        
        successCount++;
        console.log(`✓ Imported: ${hospitalDoc.name}`);
        
      } catch (error) {
        errorCount++;
        console.error(`✗ Error importing hospital:`, error.message);
        console.error('Row data:', row);
      }
    }

    console.log(`\nImport completed:`);
    console.log(`✓ Successfully imported: ${successCount} hospitals`);
    console.log(`✗ Errors: ${errorCount}`);

  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

function transformExcelRowToHospital(row) {
  // Transform Excel row to match the Hospital schema based on actual column structure
  const locationParts = parseLocation(row['Location'] || '');
  const ratingData = parseRating(row['Rating'] || '');
  const establishedYear = parseEstablishedYear(row['Established Year'] || '');
  
  // Create enhanced description with established year if available
  let enhancedDescription = row['Description'] || '';
  if (establishedYear) {
    enhancedDescription = `Established in ${establishedYear}. ${enhancedDescription}`;
  }
  
  return {
    name: row['Hospital Name'] || '',
    description: enhancedDescription,
    type: parseHospitalType(row['Specialty'] || 'Multi Specialty'),
    
    location: {
      address: '', // Not provided in Excel
      city: locationParts.city,
      state: locationParts.state,
      country: locationParts.country || 'India',
      pincode: '',
      coordinates: {
        lat: 0, // Will need to be geocoded later
        lng: 0
      }
    },
    
    contact: {
      phone: [],
      email: '',
      website: '',
      emergencyNumber: ''
    },
    
    ratings: {
      overall: ratingData.rating,
      totalReviews: ratingData.totalReviews,
      cleanliness: 0,
      staff: 0,
      facilities: 0,
      treatment: 0
    },
    
    specialties: parseSpecialties(row['Specialty'] || ''),
    
    facilities: {
      bedCount: parseBedCount(row['Number of Beds'] || ''),
      icuBeds: 0,
      emergencyServices: true, // Assume true for hospitals
      ambulanceServices: true,
      pharmacy: true,
      laboratory: true,
      bloodBank: false,
      imaging: {
        xray: false,
        mri: false,
        ct: false,
        ultrasound: false,
        mammography: false
      },
      otherFacilities: []
    },
    
    images: row['Hospital Image URL'] ? [row['Hospital Image URL']] : [],
    
    isActive: true,
    verificationStatus: 'pending'
  };
}

function parseHospitalType(specialty) {
  if (!specialty) return 'private';
  const lowerSpecialty = specialty.toLowerCase();
  if (lowerSpecialty.includes('government') || lowerSpecialty.includes('govt')) return 'government';
  if (lowerSpecialty.includes('trust')) return 'trust';
  if (lowerSpecialty.includes('charitable') || lowerSpecialty.includes('charity')) return 'charitable';
  return 'private';
}

function parseLocation(locationStr) {
  // Parse "Location: India, City" format and remove "Location:" prefix
  if (!locationStr) return { city: '', state: '', country: 'India' };
  
  const cleanLocation = locationStr.replace(/^Location:\s*/i, '').trim();
  const parts = cleanLocation.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    return {
      country: parts[0] || 'India',
      city: parts[1] || '',
      state: parts[2] || ''
    };
  }
  
  return { city: cleanLocation, state: '', country: 'India' };
}

function parseRating(ratingStr) {
  // Parse "4.3 (86 Ratings)" format
  if (!ratingStr) return { rating: 0, totalReviews: 0 };
  
  const ratingMatch = ratingStr.match(/(\d+\.?\d*)/);
  const reviewsMatch = ratingStr.match(/\((\d+)\s*Ratings?\)/i);
  
  return {
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
    totalReviews: reviewsMatch ? parseInt(reviewsMatch[1]) : 0
  };
}

function parseBedCount(bedStr) {
  // Parse "Number of Beds: 710" format and remove "Number of Beds:" prefix
  if (!bedStr) return 0;
  
  const cleanBedStr = bedStr.replace(/^Number of Beds:\s*/i, '').trim();
  const bedMatch = cleanBedStr.match(/(\d+)/);
  return bedMatch ? parseInt(bedMatch[1]) : 0;
}

function parseEstablishedYear(establishedStr) {
  // Parse "Established in: 1995" format and remove "Established in:" prefix
  if (!establishedStr) return null;
  
  const cleanEstablishedStr = establishedStr.replace(/^Established in:\s*/i, '').trim();
  const yearMatch = cleanEstablishedStr.match(/(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

function parsePhoneNumbers(phoneStr) {
  if (!phoneStr) return [];
  return phoneStr.toString().split(/[,;|]/).map(p => p.trim()).filter(p => p);
}

function parseSpecialties(specialtiesStr) {
  if (!specialtiesStr) return [];
  
  // Handle single specialty or comma-separated specialties
  const specialties = specialtiesStr.toString().split(/[,;|]/).map(s => s.trim()).filter(s => s);
  
  return specialties.map(specialty => ({
    name: specialty,
    description: '',
    certifications: []
  }));
}

function parseBoolean(value) {
  if (!value) return false;
  const str = value.toString().toLowerCase();
  return str === 'true' || str === 'yes' || str === '1' || str === 'available';
}

// Run the import
if (require.main === module) {
  importHospitalsFromExcel().catch(console.error);
}

module.exports = { importHospitalsFromExcel };
