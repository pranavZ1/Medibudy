const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  specialties: [String],
  hospital: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  experience: String,
  qualifications: [String],
  languages: [String],
  consultationFee: String,
  availability: String,
  rating: Number,
  reviewCount: Number,
  profileImage: String,
  about: String,
  services: [String],
  awards: [String],
  memberships: [String],
  link: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Doctor', doctorSchema);
