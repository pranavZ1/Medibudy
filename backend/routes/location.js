const express = require('express');
const axios = require('axios');
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

module.exports = router;
