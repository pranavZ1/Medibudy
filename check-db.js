const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medibudy');
    console.log('Connected to MongoDB');

    // Get database name
    const db = mongoose.connection.db;
    console.log('Database name:', db.databaseName);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // Check hospitals collection specifically
    if (collections.find(c => c.name === 'hospitals')) {
      const Hospital = require('./backend/models/Hospital');
      const count = await Hospital.countDocuments({});
      console.log(`\nHospitals collection contains ${count} documents`);

      if (count > 0) {
        const sampleHospital = await Hospital.findOne({});
        console.log('\nSample hospital data:');
        console.log(JSON.stringify(sampleHospital, null, 2));
      }
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkDatabase().catch(console.error);
