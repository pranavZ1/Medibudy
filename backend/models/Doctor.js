const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: String,
    required: true,
    trim: true
  },
  specialties: [String], // Keep for backward compatibility
  designation: {
    type: String,
    trim: true
  },
  experience_years: {
    type: Number,
    default: 0
  },
  experience_text: {
    type: String,
    trim: true
  },
  experience: String, // Keep for backward compatibility
  rating: {
    value: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    total_reviews: {
      type: Number,
      default: 0
    }
  },
  // Legacy rating fields for backward compatibility
  ratingValue: Number,
  reviewCount: Number,
  location: {
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    },
    full_address: String, // Keep legacy location field for compatibility
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    }
  },
  hospital: {
    name: {
      type: String,
      trim: true
    },
    hospital_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    }
  },
  image_url: {
    type: String,
    trim: true
  },
  profileImage: String, // Keep for backward compatibility
  summary: {
    type: String,
    trim: true
  },
  about: String, // Keep for backward compatibility
  contact: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    website: {
      type: String,
      trim: true
    }
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  languages: [String],
  consultation_fee: {
    type: Number,
    default: 0
  },
  consultationFee: String, // Keep for backward compatibility
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    time_slots: [{
      start_time: String,
      end_time: String,
      available: {
        type: Boolean,
        default: true
      }
    }]
  }],
  // Legacy fields for backward compatibility
  services: [String],
  awards: [String],
  memberships: [String],
  link: String,
  is_verified: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
doctorSchema.index({ name: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ 'location.city': 1 });
doctorSchema.index({ 'hospital.hospital_id': 1 });
doctorSchema.index({ 'rating.value': -1 });
doctorSchema.index({ experience_years: -1 });

// Compound indexes
doctorSchema.index({ specialization: 1, 'location.city': 1 });
doctorSchema.index({ 'hospital.hospital_id': 1, specialization: 1 });

// Geospatial index for location-based queries
doctorSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Doctor', doctorSchema);
