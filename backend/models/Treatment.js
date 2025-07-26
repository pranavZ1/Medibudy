const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  subcategory: String,
  description: {
    type: String,
    required: true
  },
  symptoms: [String],
  procedures: [{
    name: String,
    description: String,
    duration: String,
    complexity: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    isMinimallyInvasive: Boolean
  }],
  pricing: {
    minPrice: Number,
    maxPrice: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    factors: [String] // Factors affecting price
  },
  duration: {
    procedure: String,
    hospital: String,
    recovery: String
  },
  requirements: {
    preOperative: [String],
    postOperative: [String],
    restrictions: [String]
  },
  risks: [String],
  successRate: Number,
  alternativeTreatments: [String],
  urgencyLevel: {
    type: String,
    enum: ['emergency', 'urgent', 'routine', 'elective']
  },
  ageGroup: {
    min: Number,
    max: Number
  },
  contraindications: [String],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

treatmentSchema.index({ name: 'text', description: 'text', symptoms: 'text' });
treatmentSchema.index({ category: 1, department: 1 });
treatmentSchema.index({ 'pricing.minPrice': 1 });

module.exports = mongoose.model('Treatment', treatmentSchema);
