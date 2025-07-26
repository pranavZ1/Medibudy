const express = require('express');
const Treatment = require('../models/Treatment');
const router = express.Router();

// Get all treatments
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      department, 
      search, 
      minPrice, 
      maxPrice, 
      urgency,
      page = 1, 
      limit = 20 
    } = req.query;

    let query = { isActive: true };

    // Build search query
    if (category) {
      query.category = new RegExp(category, 'i');
    }

    if (department) {
      query.department = new RegExp(department, 'i');
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (minPrice || maxPrice) {
      query['pricing.minPrice'] = {};
      if (minPrice) query['pricing.minPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.maxPrice'] = { $lte: parseFloat(maxPrice) };
    }

    if (urgency) {
      query.urgencyLevel = urgency;
    }

    const treatments = await Treatment.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Treatment.countDocuments(query);

    res.json({
      treatments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching treatments:', error);
    res.status(500).json({ error: 'Failed to fetch treatments' });
  }
});

// Get treatment by ID
router.get('/:id', async (req, res) => {
  try {
    const treatment = await Treatment.findById(req.params.id);
    
    if (!treatment) {
      return res.status(404).json({ error: 'Treatment not found' });
    }

    res.json({ treatment });
  } catch (error) {
    console.error('Error fetching treatment:', error);
    res.status(500).json({ error: 'Failed to fetch treatment' });
  }
});

// Get treatments by symptoms
router.post('/by-symptoms', async (req, res) => {
  try {
    const { symptoms } = req.body;
    
    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({ error: 'Symptoms array is required' });
    }

    // Create search query for symptoms
    const symptomQuery = symptoms.map(symptom => 
      new RegExp(symptom.toLowerCase(), 'i')
    );

    const treatments = await Treatment.find({
      isActive: true,
      symptoms: { $in: symptomQuery }
    }).sort({ createdAt: -1 });

    res.json({ treatments });
  } catch (error) {
    console.error('Error fetching treatments by symptoms:', error);
    res.status(500).json({ error: 'Failed to fetch treatments' });
  }
});

// Get treatment categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Treatment.distinct('category', { isActive: true });
    res.json({ categories: categories.filter(cat => cat) });
  } catch (error) {
    console.error('Error fetching treatment categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch treatment categories',
      message: error.message 
    });
  }
});

// Get treatments by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const treatments = await Treatment.find({
      category: new RegExp(category, 'i'),
      isActive: true
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await Treatment.countDocuments({
      category: new RegExp(category, 'i'),
      isActive: true
    });

    res.json({
      treatments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      category
    });
  } catch (error) {
    console.error('Error fetching treatments by category:', error);
    res.status(500).json({ error: 'Failed to fetch treatments' });
  }
});

// Get treatments by department
router.get('/department/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const treatments = await Treatment.find({
      department: new RegExp(department, 'i'),
      isActive: true
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await Treatment.countDocuments({
      department: new RegExp(department, 'i'),
      isActive: true
    });

    res.json({
      treatments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      department
    });
  } catch (error) {
    console.error('Error fetching treatments by department:', error);
    res.status(500).json({ error: 'Failed to fetch treatments' });
  }
});

// Search treatments
router.get('/search', async (req, res) => {
  try {
    const { 
      query, 
      category, 
      priceRange,
      location,
      page = 1, 
      limit = 20 
    } = req.query;

    let searchFilter = { isActive: true };
    let sortOptions = {};

    // Text search
    if (query) {
      searchFilter.$text = { $search: query };
      sortOptions.score = { $meta: 'textScore' };
    }

    // Category filter
    if (category) {
      searchFilter.category = { $regex: category, $options: 'i' };
    }

    // Price range filter
    if (priceRange) {
      const { min, max } = typeof priceRange === 'string' ? JSON.parse(priceRange) : priceRange;
      if (min !== undefined) searchFilter['averageCost.min'] = { $gte: min };
      if (max !== undefined) searchFilter['averageCost.max'] = { $lte: max };
    }

    // Location filter
    if (location) {
      searchFilter.location = { $regex: location, $options: 'i' };
    }

    const treatments = await Treatment.find(searchFilter, query ? { score: { $meta: 'textScore' } } : {})
    .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await Treatment.countDocuments(searchFilter);

    res.json({
      treatments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error searching treatments:', error);
    res.status(500).json({ error: 'Failed to search treatments' });
  }
});

module.exports = router;
