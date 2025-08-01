const mongoose = require('mongoose');
const Hospital = require('./backend/models/Hospital');
require('dotenv').config();

async function cleanExistingHospitalData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medibudy');
    console.log('Connected to MongoDB');

    // Get all hospitals
    const hospitals = await Hospital.find({});
    console.log(`Found ${hospitals.length} hospitals to clean`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const hospital of hospitals) {
      try {
        let needsUpdate = false;
        const updates = {};

        // Clean location city if it starts with "Location:"
        if (hospital.location && hospital.location.city && hospital.location.city.startsWith('Location:')) {
          const cleanCity = hospital.location.city.replace(/^Location:\s*/i, '').trim();
          const parts = cleanCity.split(',').map(p => p.trim());
          
          if (parts.length >= 2) {
            updates['location.country'] = parts[0] || 'India';
            updates['location.city'] = parts[1] || '';
            updates['location.state'] = parts[2] || '';
          } else {
            updates['location.city'] = cleanCity;
          }
          needsUpdate = true;
        }

        // Clean description if it contains "Number of Beds:" or "Established in:"
        if (hospital.description) {
          let cleanDescription = hospital.description;
          
          // Extract and clean established year info
          const establishedMatch = cleanDescription.match(/Established in:\s*(\d{4})/i);
          if (establishedMatch) {
            cleanDescription = cleanDescription.replace(/Established in:\s*\d{4}\.?\s*/i, '').trim();
            // Prepend the cleaned established year info
            cleanDescription = `Established in ${establishedMatch[1]}. ${cleanDescription}`;
            needsUpdate = true;
          }

          // Remove "Number of Beds:" references from description if they exist
          const bedMatch = cleanDescription.match(/Number of Beds:\s*(\d+)/i);
          if (bedMatch) {
            cleanDescription = cleanDescription.replace(/Number of Beds:\s*\d+\.?\s*/i, '').trim();
            // Update bed count in facilities if not already set correctly
            if (!hospital.facilities || hospital.facilities.bedCount === 0) {
              updates['facilities.bedCount'] = parseInt(bedMatch[1]);
            }
            needsUpdate = true;
          }

          if (needsUpdate) {
            updates.description = cleanDescription;
          }
        }

        if (needsUpdate) {
          await Hospital.findByIdAndUpdate(hospital._id, updates);
          updatedCount++;
          console.log(`✓ Updated: ${hospital.name}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`✗ Error updating hospital ${hospital.name}:`, error.message);
      }
    }

    console.log(`\nCleanup completed:`);
    console.log(`✓ Successfully updated: ${updatedCount} hospitals`);
    console.log(`✗ Errors: ${errorCount}`);
    console.log(`- Unchanged: ${hospitals.length - updatedCount - errorCount} hospitals`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
if (require.main === module) {
  cleanExistingHospitalData().catch(console.error);
}

module.exports = { cleanExistingHospitalData };
