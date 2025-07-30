import React, { useState, useEffect, useCallback } from 'react';
import { hospitalsAPI } from '../services/api';
import { MapPin, Star, Phone, Clock, Shield, Navigation } from 'lucide-react';

interface Hospital {
  _id: string;
  name: string;
  address: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  contact: {
    phone: string;
    email?: string;
    website?: string;
  };
  specializations: string[];
  facilities: string[];
  ratings: {
    overall: number;
    cleanliness: number;
    staff: number;
    facilities: number;
  };
  accreditations: string[];
  emergencyServices: boolean;
  operatingHours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  distance?: number;
}

const HospitalFinder: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [searchRadius, setSearchRadius] = useState(10);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState('');

  const specializations = [
    'Cardiology', 'Neurology', 'Orthopedics', 'Oncology', 'Pediatrics',
    'Dermatology', 'Gastroenterology', 'Ophthalmology', 'Urology', 'ENT',
    'Psychiatry', 'Emergency Medicine', 'General Surgery', 'Internal Medicine'
  ];

  const fetchNearbyHospitals = useCallback(async (coordinates: [number, number]) => {
    setLoading(true);
    try {
      const response = await hospitalsAPI.getNearby(coordinates, searchRadius);
      setHospitals(response.data.hospitals);
    } catch (error) {
      console.error('Failed to fetch nearby hospitals:', error);
    } finally {
      setLoading(false);
    }
  }, [searchRadius]);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          setUserLocation(coords);
          fetchNearbyHospitals(coords);
          setLoading(false);
        },
        (error) => {
          setLocationError('Unable to get your location. Please search manually.');
          setLoading(false);
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
    }
  }, [fetchNearbyHospitals]);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  const searchHospitals = async () => {
    setLoading(true);
    try {
      const params: any = {
        rating: minRating,
        radius: searchRadius
      };

      if (searchLocation) params.location = searchLocation;
      if (selectedSpecialization) params.specialization = selectedSpecialization;

      const response = await hospitalsAPI.search(params);
      setHospitals(response.data.hospitals);
    } catch (error) {
      console.error('Failed to search hospitals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchHospitals();
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const formatDistance = (distance: number) => {
    return distance < 1 
      ? `${Math.round(distance * 1000)}m` 
      : `${distance.toFixed(1)}km`;
  };

  const openDirections = (hospital: Hospital) => {
    const [lng, lat] = hospital.location.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Hospital Finder</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Find hospitals and medical facilities near you with detailed information about services and ratings.
        </p>
      </div>

      {/* Location Error */}
      {locationError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-800">{locationError}</span>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Location Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter location (city, area, pincode)"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Specialization */}
            <div>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Rating */}
            <div>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
              >
                <option value={0}>Any Rating</option>
                <option value={3}>3+ Stars</option>
                <option value={4}>4+ Stars</option>
                <option value={4.5}>4.5+ Stars</option>
              </select>
            </div>

            {/* Search Button */}
            <div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          {/* Radius Slider */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Search Radius:</span>
            <input
              type="range"
              min="1"
              max="50"
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm text-gray-600 w-16">{searchRadius} km</span>
            {userLocation && (
              <button
                type="button"
                onClick={() => fetchNearbyHospitals(userLocation)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Use my location
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Results Count */}
          <div className="flex justify-between items-center">
            <p className="text-gray-600">
              Found {hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Hospital Cards */}
          <div className="space-y-6">
            {hospitals.map((hospital) => (
              <div key={hospital._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Info */}
                  <div className="lg:col-span-2 space-y-4">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{hospital.name}</h3>
                        {hospital.distance && (
                          <span className="text-sm text-gray-500 mt-1 sm:mt-0">
                            {formatDistance(hospital.distance)} away
                          </span>
                        )}
                      </div>
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <p className="text-gray-600 text-sm">{hospital.address}</p>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        {renderStars(hospital.ratings.overall)}
                      </div>
                      <span className="text-sm text-gray-600">
                        {hospital.ratings.overall.toFixed(1)} overall rating
                      </span>
                    </div>

                    {/* Specializations */}
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Specializations:</p>
                      <div className="flex flex-wrap gap-2">
                        {hospital.specializations.slice(0, 6).map((spec, index) => (
                          <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {spec}
                          </span>
                        ))}
                        {hospital.specializations.length > 6 && (
                          <span className="text-xs text-gray-500">
                            +{hospital.specializations.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Facilities */}
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Facilities:</p>
                      <div className="flex flex-wrap gap-2">
                        {hospital.facilities.slice(0, 4).map((facility, index) => (
                          <span key={index} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {facility}
                          </span>
                        ))}
                        {hospital.facilities.length > 4 && (
                          <span className="text-xs text-gray-500">
                            +{hospital.facilities.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Accreditations */}
                    {hospital.accreditations.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600">
                          Accredited by {hospital.accreditations.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact & Actions */}
                  <div className="space-y-4">
                    {/* Emergency Services */}
                    {hospital.emergencyServices && (
                      <div className="flex items-center space-x-2 text-red-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">24/7 Emergency Services</span>
                      </div>
                    )}

                    {/* Contact */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`tel:${hospital.contact.phone}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {hospital.contact.phone}
                        </a>
                      </div>
                      {hospital.contact.website && (
                        <div>
                          <a
                            href={hospital.contact.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Visit Website
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Detailed Ratings */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Detailed Ratings:</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cleanliness:</span>
                          <span>{hospital.ratings.cleanliness.toFixed(1)}/5</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Staff:</span>
                          <span>{hospital.ratings.staff.toFixed(1)}/5</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Facilities:</span>
                          <span>{hospital.ratings.facilities.toFixed(1)}/5</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <button
                        onClick={() => openDirections(hospital)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Navigation className="h-4 w-4" />
                        <span>Get Directions</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* No Results */}
          {hospitals.length === 0 && !loading && (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hospitals found</h3>
              <p className="text-gray-600">Try expanding your search radius or changing the filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalFinder;
