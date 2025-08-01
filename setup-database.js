const mongoose = require('mongoose');
const Hospital = require('./backend/models/Hospital');
const Doctor = require('./backend/models/Doctor');
require('dotenv').config();

async function setupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medibudy');
    console.log('Connected to MongoDB');

    // Check current database and collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\nCurrent database:', db.databaseName);
    console.log('Current collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // Check if hospitals collection exists and count documents
    try {
      const hospitalCount = await Hospital.countDocuments();
      console.log(`\nHospitals collection: ${hospitalCount} documents`);
    } catch (error) {
      console.log('\nHospitals collection: Not found or empty');
    }

    // Ensure doctors collection exists
    try {
      const doctorCount = await Doctor.countDocuments();
      console.log(`Doctors collection: ${doctorCount} documents`);
    } catch (error) {
      console.log('Doctors collection: Not found or empty');
      
      // Create the doctors collection by creating and removing a dummy document
      console.log('Creating doctors collection...');
      const dummyDoctor = new Doctor({
        name: 'Dummy Doctor',
        email: 'dummy@example.com',
        specializations: ['General Medicine'],
        location: {
          city: 'Test City',
          country: 'India',
          coordinates: { lat: 0, lng: 0 }
        }
      });
      
      await dummyDoctor.save();
      await Doctor.deleteOne({ name: 'Dummy Doctor' });
      console.log('✓ Doctors collection created successfully');
    }

    // List all collections after setup
    const updatedCollections = await db.listCollections().toArray();
    console.log('\nFinal collections:');
    updatedCollections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    console.log('\n✓ Database setup completed successfully');

  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };
