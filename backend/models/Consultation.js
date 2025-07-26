const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['symptom_analysis', 'treatment_selection', 'surgery_consultation'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  symptoms: [{
    symptom: String,
    severity: {
      type: Number,
      min: 1,
      max: 10
    },
    duration: String,
    frequency: String,
    triggers: [String],
    relievingFactors: [String]
  }],
  medicalHistory: {
    currentMedications: [String],
    allergies: [String],
    previousSurgeries: [String],
    chronicConditions: [String],
    familyHistory: [String]
  },
  reports: [{
    type: String,
    name: String,
    uploadDate: Date,
    fileUrl: String,
    analysis: String
  }],
  aiAnalysis: {
    possibleConditions: [{
      condition: String,
      probability: Number,
      explanation: String,
      urgency: {
        type: String,
        enum: ['low', 'medium', 'high', 'emergency']
      }
    }],
    recommendedTests: [String],
    recommendedSpecialist: String,
    urgencyLevel: String,
    confidence: Number,
    generatedAt: Date
  },
  treatmentOptions: [{
    treatment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Treatment'
    },
    suitability: Number,
    reasoning: String,
    estimatedCost: {
      min: Number,
      max: Number,
      currency: String
    }
  }],
  hospitalRecommendations: [{
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    distance: Number,
    matchScore: Number,
    reasoning: String,
    estimatedCost: {
      min: Number,
      max: Number,
      currency: String
    }
  }],
  userConsent: {
    dataProcessing: {
      type: Boolean,
      required: true
    },
    aiAnalysis: {
      type: Boolean,
      required: true
    },
    reportAnalysis: Boolean,
    communicationConsent: Boolean,
    consentDate: Date
  },
  conversationHistory: [{
    role: {
      type: String,
      enum: ['user', 'ai', 'system']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: Object
  }],
  locationContext: {
    userLocation: {
      lat: Number,
      lng: Number,
      address: String,
      city: String,
      country: String
    },
    searchRadius: {
      type: Number,
      default: 50 // kilometers
    }
  },
  notes: String
}, {
  timestamps: true
});

consultationSchema.index({ user: 1, createdAt: -1 });
consultationSchema.index({ type: 1, status: 1 });
consultationSchema.index({ 'aiAnalysis.urgencyLevel': 1 });

module.exports = mongoose.model('Consultation', consultationSchema);
