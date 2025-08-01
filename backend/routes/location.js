const express = require('express');
const axios = require('axios');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const router = express.Router();

// Get user's current location using IP
router.get('/current', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // For development, use a default location
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('192.168')) {
      return res.json({
        location: {
          lat: 28.6139,
          lng: 77.2090,
          city: 'New Delhi',
          country: 'India',
          address: 'New Delhi, India'
        },
        message: 'Default location (development mode)'
      });
    }

    // Use IP geolocation service
    const response = await axios.get(`http://ip-api.com/json/${clientIp}`);
    const data = response.data;

    if (data.status === 'success') {
      res.json({
        location: {
          lat: data.lat,
          lng: data.lon,
          city: data.city,
          country: data.country,
          address: `${data.city}, ${data.regionName}, ${data.country}`
        }
      });
    } else {
      throw new Error('Location detection failed');
    }
  } catch (error) {
    console.error('Location detection error:', error);
    
    // Fallback to default location
    res.json({
      location: {
        lat: 28.6139,
        lng: 77.2090,
        city: 'New Delhi',
        country: 'India',
        address: 'New Delhi, India'
      },
      message: 'Using default location due to detection failure'
    });
  }
});

// Geocode address to coordinates
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Using OpenStreetMap Nominatim API (free alternative to Google Maps)
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'MediBudy-App'
      }
    });

    const data = response.data;

    if (data && data.length > 0) {
      const result = data[0];
      res.json({
        location: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.display_name,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          country: result.address?.country,
          postcode: result.address?.postcode
        }
      });
    } else {
      res.status(404).json({ error: 'Location not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Reverse geocode coordinates to address
router.post('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Using OpenStreetMap Nominatim API
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: lat,
        lon: lng,
        format: 'json',
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'MediBudy-App'
      }
    });

    const data = response.data;

    if (data) {
      res.json({
        location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address: data.display_name,
          city: data.address?.city || data.address?.town || data.address?.village,
          state: data.address?.state,
          country: data.address?.country,
          postcode: data.address?.postcode
        }
      });
    } else {
      res.status(404).json({ error: 'Address not found for coordinates' });
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Failed to reverse geocode coordinates' });
  }
});

// Search for places/addresses
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: limit,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'MediBudy-App'
      }
    });

    const data = response.data;
    
    const results = data.map(result => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name,
      city: result.address?.city || result.address?.town || result.address?.village,
      state: result.address?.state,
      country: result.address?.country,
      postcode: result.address?.postcode,
      type: result.type,
      importance: result.importance
    }));

    res.json({ results });
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({ error: 'Failed to search locations' });
  }
});

// Get nearby cities
router.get('/nearby-cities', async (req, res) => {
  try {
    const { lat, lng, radius = 100 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // This is a simplified implementation
    // In a production app, you might want to use a more comprehensive city database
    const nearbyCities = [
      { name: 'Delhi', lat: 28.6139, lng: 77.2090, distance: 0 },
      { name: 'Gurgaon', lat: 28.4595, lng: 77.0266, distance: 20 },
      { name: 'Noida', lat: 28.5355, lng: 77.3910, distance: 25 },
      { name: 'Faridabad', lat: 28.4089, lng: 77.3178, distance: 30 },
      { name: 'Ghaziabad', lat: 28.6692, lng: 77.4538, distance: 35 }
    ];

    // Calculate actual distances and filter by radius
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const citiesWithDistance = nearbyCities.map(city => {
      const distance = calculateDistance(userLat, userLng, city.lat, city.lng);
      return { ...city, distance: Math.round(distance * 100) / 100 };
    }).filter(city => city.distance <= radius);

    res.json({ cities: citiesWithDistance });
  } catch (error) {
    console.error('Nearby cities error:', error);
    res.status(500).json({ error: 'Failed to get nearby cities' });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Simple in-memory cache for geocoding results
const geocodeCache = new Map();

// Get nearby hospitals based on user location
router.get('/nearby-hospitals', async (req, res) => {
  try {
    const { lat, lng, radius = 50, specialty, limit = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    let query = {};

    // Add specialty filter if provided
    if (specialty) {
      query['specialty'] = new RegExp(specialty, 'i');
    }

    // Find hospitals
    const hospitals = await Hospital.find(query).lean();
    
    const hospitalsWithDistance = [];
    
    for (const hospital of hospitals) {
      let distance = 0;
      
      // If hospital has coordinates, use them
      if (hospital.location && hospital.location.coordinates) {
        distance = calculateDistance(
          userLat,
          userLng,
          hospital.location.coordinates.lat || hospital.location.coordinates[1],
          hospital.location.coordinates.lng || hospital.location.coordinates[0]
        );
      } 
      // Otherwise, try to geocode the address with caching
      else if (hospital.location && (hospital.location.address || hospital.location.city)) {
        const address = hospital.location.address || 
                       `${hospital.location.city}, ${hospital.location.state}, ${hospital.location.country}`;
        
        // Check cache first
        let coords = geocodeCache.get(address);
        
        if (!coords) {
          try {
            const geocodeResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
              params: {
                q: address,
                format: 'json',
                limit: 1,
                addressdetails: 1
              },
              headers: {
                'User-Agent': 'MediBudy-App'
              }
            });

            if (geocodeResponse.data && geocodeResponse.data.length > 0) {
              coords = {
                lat: parseFloat(geocodeResponse.data[0].lat),
                lon: parseFloat(geocodeResponse.data[0].lon)
              };
              // Cache the result
              geocodeCache.set(address, coords);
            }
          } catch (geocodeError) {
            console.error('Geocoding error for hospital:', hospital.name, geocodeError.message);
            // Skip this hospital if we can't geocode it
            continue;
          }
        }
        
        if (coords) {
          distance = calculateDistance(userLat, userLng, coords.lat, coords.lon);
        }
      }
      
      // Only include hospitals within the search radius
      if (distance <= searchRadius) {
        hospitalsWithDistance.push({
          ...hospital,
          distance: Math.round(distance * 100) / 100
        });
      }
    }
    
    // Sort by distance and limit results
    hospitalsWithDistance.sort((a, b) => a.distance - b.distance);
    const limitedHospitals = hospitalsWithDistance.slice(0, parseInt(limit));

    res.json({
      hospitals: limitedHospitals,
      userLocation: { lat: userLat, lng: userLng },
      searchRadius,
      count: limitedHospitals.length
    });
  } catch (error) {
    console.error('Error fetching nearby hospitals:', error);
    res.status(500).json({ error: 'Failed to fetch nearby hospitals' });
  }
});

// Get nearby doctors based on user location
router.get('/nearby-doctors', async (req, res) => {
  try {
    const { lat, lng, radius = 50, specialization, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    let query = {};

    // Add specialty filter for hospitals if provided
    if (specialization) {
      query['doctors.specialization'] = new RegExp(specialization, 'i');
    }

    // Find hospitals first and extract doctors from them
    const hospitals = await Hospital.find(query).lean();
    
    const doctorsWithDistance = [];
    
    for (const hospital of hospitals) {
      let hospitalDistance = 0;
      
      // Calculate hospital distance with caching
      if (hospital.location && (hospital.location.address || hospital.location.city)) {
        const address = hospital.location.address || 
                       `${hospital.location.city}, ${hospital.location.state}, ${hospital.location.country}`;
        
        // Check cache first
        let coords = geocodeCache.get(address);
        
        if (!coords) {
          try {
            const geocodeResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
              params: {
                q: address,
                format: 'json',
                limit: 1,
                addressdetails: 1
              },
              headers: {
                'User-Agent': 'MediBudy-App'
              }
            });

            if (geocodeResponse.data && geocodeResponse.data.length > 0) {
              coords = {
                lat: parseFloat(geocodeResponse.data[0].lat),
                lon: parseFloat(geocodeResponse.data[0].lon)
              };
              // Cache the result
              geocodeCache.set(address, coords);
            }
          } catch (geocodeError) {
            console.error('Geocoding error for hospital:', hospital.name, geocodeError.message);
            continue;
          }
        }
        
        if (coords) {
          hospitalDistance = calculateDistance(userLat, userLng, coords.lat, coords.lon);
        }
      }
      
      // Only process hospitals within the search radius
      if (hospitalDistance <= searchRadius) {
        // Extract doctors from this hospital
        if (hospital.doctors && hospital.doctors.length > 0) {
          for (const doctor of hospital.doctors) {
            // Filter by specialization if provided
            if (!specialization || 
                (doctor.specialization && doctor.specialization.toLowerCase().includes(specialization.toLowerCase()))) {
              
              doctorsWithDistance.push({
                ...doctor,
                hospital_info: {
                  hospital_id: hospital._id,
                  hospital_name: hospital.name,
                  hospital_location: hospital.location,
                  hospital_rating: hospital.rating
                },
                distance: Math.round(hospitalDistance * 100) / 100
              });
            }
          }
        }
      }
    }
    
    // Sort by distance and limit results
    doctorsWithDistance.sort((a, b) => a.distance - b.distance);
    const limitedDoctors = doctorsWithDistance.slice(0, parseInt(limit));

    res.json({
      doctors: limitedDoctors,
      userLocation: { lat: userLat, lng: userLng },
      searchRadius,
      count: limitedDoctors.length
    });
  } catch (error) {
    console.error('Error fetching nearby doctors:', error);
    res.status(500).json({ error: 'Failed to fetch nearby doctors' });
  }
});

// Get combined nearby hospitals and doctors for symptom analysis
router.get('/nearby-healthcare', async (req, res) => {
  try {
    const { lat, lng, radius = 50, specialty, specialization, hospitalLimit = 5, doctorLimit = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    // Get nearby hospitals
    const hospitalResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/location/nearby-hospitals`, {
      params: { lat, lng, radius, specialty, limit: hospitalLimit }
    });

    // Get nearby doctors
    const doctorResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/location/nearby-doctors`, {
      params: { lat, lng, radius, specialization, limit: doctorLimit }
    });

    res.json({
      hospitals: hospitalResponse.data.hospitals || [],
      doctors: doctorResponse.data.doctors || [],
      userLocation: { lat: userLat, lng: userLng },
      searchRadius: parseFloat(radius)
    });
  } catch (error) {
    console.error('Error fetching nearby healthcare:', error);
    res.status(500).json({ error: 'Failed to fetch nearby healthcare providers' });
  }
});

module.exports = router;
