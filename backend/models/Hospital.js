const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['government', 'private', 'trust', 'charitable'],
    default: 'private'
  },
  specialties: [{
    name: String,
    description: String,
    certifications: [String]
  }],
  location: {
    address: String,
    city: {
      type: String,
      required: true
    },
    state: String,
    country: {
      type: String,
      required: true
    },
    pincode: String,
    coordinates: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    }
  },
  contact: {
    phone: [String],
    email: String,
    website: String,
    emergencyNumber: String
  },
  ratings: {
    overall: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    cleanliness: Number,
    staff: Number,
    facilities: Number,
    treatment: Number,
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  accreditations: [{
    name: String,
    issuedBy: String,
    validUntil: Date,
    certificateNumber: String
  }],
  facilities: {
    bedCount: Number,
    icuBeds: Number,
    emergencyServices: Boolean,
    ambulanceServices: Boolean,
    pharmacy: Boolean,
    laboratory: Boolean,
    bloodBank: Boolean,
    imaging: {
      xray: Boolean,
      mri: Boolean,
      ct: Boolean,
      ultrasound: Boolean,
      mammography: Boolean
    },
    otherFacilities: [String]
  },
  departments: [{
    name: String,
    head: String,
    specialists: Number,
    equipments: [String]
  }],
  doctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  }],
  treatmentsOffered: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Treatment'
  }],
  pricing: {
    consultationFee: {
      min: Number,
      max: Number,
      currency: String
    },
    roomCharges: {
      general: Number,
      private: Number,
      deluxe: Number,
      suite: Number,
      currency: String
    }
  },
  operatingHours: {
    weekdays: {
      open: String,
      close: String
    },
    weekends: {
      open: String,
      close: String
    },
    emergencyAvailable: Boolean
  },
  insurance: [{
    provider: String,
    plans: [String]
  }],
  images: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

hospitalSchema.index({ 'location.coordinates': '2dsphere' });
hospitalSchema.index({ 'location.city': 1, 'location.country': 1 });
hospitalSchema.index({ specialties: 1 });
hospitalSchema.index({ 'ratings.overall': -1 });
hospitalSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Hospital', hospitalSchema);
