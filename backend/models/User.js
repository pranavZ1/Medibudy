const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  medicalHistory: [{
    condition: String,
    diagnosedDate: Date,
    status: {
      type: String,
      enum: ['ongoing', 'resolved', 'chronic']
    },
    medications: [String],
    notes: String
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    units: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  consultations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consultation'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('User', userSchema);
