const express = require('express');
const Hospital = require('../models/Hospital');
const router = express.Router();

// Get hospitals near location
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 50, specialty, page = 1, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    let query = {
      isActive: true,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      }
    };

    if (specialty) {
      query['specialties.name'] = new RegExp(specialty, 'i');
    }

    const hospitals = await Hospital.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Hospital.countDocuments(query);

    // Calculate distances
    const hospitalsWithDistance = hospitals.map(hospital => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        hospital.location.coordinates.lat,
        hospital.location.coordinates.lng
      );
      
      return {
        ...hospital.toObject(),
        distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
      };
    });

    res.json({
      hospitals: hospitalsWithDistance,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching nearby hospitals:', error);
    res.status(500).json({ error: 'Failed to fetch nearby hospitals' });
  }
});

// Get all hospitals
router.get('/', async (req, res) => {
  try {
    const { 
      city, 
      country, 
      specialty, 
      type,
      minRating,
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    let query = { isActive: true };

    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }

    if (country) {
      query['location.country'] = new RegExp(country, 'i');
    }

    if (specialty) {
      query['specialties.name'] = new RegExp(specialty, 'i');
    }

    if (type) {
      query.type = type;
    }

    if (minRating) {
      query['ratings.overall'] = { $gte: parseFloat(minRating) };
    }

    if (search) {
      query.$text = { $search: search };
    }

    const hospitals = await Hospital.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : { 'ratings.overall': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Hospital.countDocuments(query);

    res.json({
      hospitals,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get hospital by ID
router.get('/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .populate('treatmentsOffered')
      .populate('doctors');

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json({ hospital });
  } catch (error) {
    console.error('Error fetching hospital:', error);
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
});

// Get hospitals by specialty
router.get('/specialty/:specialty', async (req, res) => {
  try {
    const { specialty } = req.params;
    const { lat, lng, radius = 100, page = 1, limit = 20 } = req.query;

    let query = {
      isActive: true,
      'specialties.name': new RegExp(specialty, 'i')
    };

    // If location provided, add proximity search
    if (lat && lng) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000
        }
      };
    }

    const hospitals = await Hospital.find(query)
      .sort(lat && lng ? {} : { 'ratings.overall': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Hospital.countDocuments(query);

    // Add distance if location provided
    let hospitalsWithDistance = hospitals;
    if (lat && lng) {
      hospitalsWithDistance = hospitals.map(hospital => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          hospital.location.coordinates.lat,
          hospital.location.coordinates.lng
        );
        
        return {
          ...hospital.toObject(),
          distance: Math.round(distance * 100) / 100
        };
      });
    }

    res.json({
      hospitals: hospitalsWithDistance,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      specialty
    });
  } catch (error) {
    console.error('Error fetching hospitals by specialty:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get hospitals by treatment
router.post('/by-treatment', async (req, res) => {
  try {
    const { treatmentId, lat, lng, radius = 100, page = 1, limit = 20 } = req.body;

    let query = {
      isActive: true,
      treatmentsOffered: treatmentId
    };

    // If location provided, add proximity search
    if (lat && lng) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000
        }
      };
    }

    const hospitals = await Hospital.find(query)
      .populate('treatmentsOffered')
      .sort(lat && lng ? {} : { 'ratings.overall': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Hospital.countDocuments(query);

    // Add distance if location provided
    let hospitalsWithDistance = hospitals;
    if (lat && lng) {
      hospitalsWithDistance = hospitals.map(hospital => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          hospital.location.coordinates.lat,
          hospital.location.coordinates.lng
        );
        
        return {
          ...hospital.toObject(),
          distance: Math.round(distance * 100) / 100
        };
      });
    }

    res.json({
      hospitals: hospitalsWithDistance,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching hospitals by treatment:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get hospital specialties
router.get('/meta/specialties', async (req, res) => {
  try {
    const specialties = await Hospital.distinct('specialties.name', { isActive: true });
    const cities = await Hospital.distinct('location.city', { isActive: true });
    const countries = await Hospital.distinct('location.country', { isActive: true });
    
    res.json({ 
      specialties: specialties.sort(),
      cities: cities.sort(),
      countries: countries.sort()
    });
  } catch (error) {
    console.error('Error fetching hospital metadata:', error);
    res.status(500).json({ error: 'Failed to fetch hospital metadata' });
  }
});

// Search hospitals
router.get('/search', async (req, res) => {
  try {
    const { 
      location,
      specialization,
      rating,
      radius = 100, 
      page = 1, 
      limit = 20 
    } = req.query;

    let searchQuery = { isActive: true };

    // Location-based search
    if (location) {
      // Try to parse as coordinates first, then fallback to text search
      const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const [, lat, lng] = coordMatch;
        searchQuery['location.coordinates'] = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: radius * 1000
          }
        };
      } else {
        // Text-based location search
        searchQuery.$or = [
          { 'address': { $regex: location, $options: 'i' } },
          { 'location.city': { $regex: location, $options: 'i' } },
          { 'location.country': { $regex: location, $options: 'i' } }
        ];
      }
    }

    // Specialization filter
    if (specialization) {
      searchQuery['specializations'] = { $regex: specialization, $options: 'i' };
    }

    // Rating filter
    if (rating) {
      searchQuery['ratings.overall'] = { $gte: parseFloat(rating) };
    }

    const hospitals = await Hospital.find(searchQuery)
    .sort({ 'ratings.overall': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await Hospital.countDocuments(searchQuery);

    res.json({
      hospitals,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error searching hospitals:', error);
    res.status(500).json({ error: 'Failed to search hospitals' });
  }
});

// Helper function to calculate distance between two coordinates
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
