import React, { useState, useEffect } from 'react';
import { MapPin, Search, Navigation, X, Loader } from 'lucide-react';
import { useLocation } from '../contexts/LocationContext';

interface LocationResult {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  state?: string;
  country?: string;
}

interface LocationSelectorProps {
  onLocationSelect?: (location: any) => void;
  showModal?: boolean;
  onClose?: () => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ 
  onLocationSelect, 
  showModal = false, 
  onClose 
}) => {
  const { 
    userLocation, 
    isLoadingLocation, 
    locationError, 
    getCurrentLocation, 
    setManualLocation, 
    clearLocationError 
  } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleGetCurrentLocation = async () => {
    try {
      clearLocationError();
      await getCurrentLocation();
      if (onLocationSelect && userLocation) {
        onLocationSelect(userLocation);
      }
    } catch (error) {
      console.error('Failed to get current location:', error);
    }
  };

  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError('');

    try {
      const response = await fetch(`/api/location/search?query=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.results || []);
      } else {
        setSearchError('Failed to search locations');
      }
    } catch (error) {
      setSearchError('Failed to search locations');
      console.error('Location search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location: LocationResult) => {
    const selectedLocation = {
      lat: location.lat,
      lng: location.lng,
      city: location.city,
      state: location.state,
      country: location.country,
      address: location.address
    };

    setManualLocation(selectedLocation);
    setSearchQuery('');
    setSearchResults([]);
    
    if (onLocationSelect) {
      onLocationSelect(selectedLocation);
    }
    
    if (onClose) {
      onClose();
    }
  };

  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  useEffect(() => {
    const debouncedSearch = debounce(searchLocations, 300);
    if (searchQuery) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery]);

  const LocationContent = () => (
    <div style={{ 
      padding: '24px', 
      backgroundColor: 'white', 
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '8px',
          color: '#1f2937'
        }}>
          Select Your Location
        </h3>
        <p style={{ 
          fontSize: '14px', 
          color: '#6b7280'
        }}>
          We'll use this to find nearby hospitals and doctors
        </p>
      </div>

      {/* Current Location Button */}
      <button
        onClick={handleGetCurrentLocation}
        disabled={isLoadingLocation}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isLoadingLocation ? 'not-allowed' : 'pointer',
          opacity: isLoadingLocation ? 0.6 : 1,
          marginBottom: '16px'
        }}
      >
        {isLoadingLocation ? (
          <Loader style={{ height: '16px', width: '16px', animation: 'spin 1s linear infinite' }} />
        ) : (
          <Navigation style={{ height: '16px', width: '16px' }} />
        )}
        {isLoadingLocation ? 'Getting Location...' : 'Use Current Location'}
      </button>

      {/* Current Location Display */}
      {userLocation && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin style={{ height: '16px', width: '16px', color: '#3b82f6' }} />
            <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: '500' }}>
              Current Location
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#1e40af', marginTop: '4px', marginLeft: '24px' }}>
            {userLocation.address || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`}
          </p>
        </div>
      )}

      {/* Location Error */}
      {locationError && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <p style={{ fontSize: '14px', color: '#dc2626' }}>
            {locationError}
          </p>
        </div>
      )}

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            height: '16px', 
            width: '16px', 
            color: '#9ca3af' 
          }} />
          <input
            type="text"
            placeholder="Search for a city or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          {isSearching && (
            <Loader style={{ 
              position: 'absolute', 
              right: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              height: '16px', 
              width: '16px', 
              color: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }} />
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {searchResults.map((result, index) => (
            <button
              key={index}
              onClick={() => handleLocationSelect(result)}
              style={{
                width: '100%',
                padding: '12px',
                border: 'none',
                backgroundColor: 'white',
                borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin style={{ height: '14px', width: '14px', color: '#6b7280' }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', margin: 0 }}>
                    {result.city && result.country ? `${result.city}, ${result.country}` : result.address}
                  </p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    {result.address}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginTop: '16px'
        }}>
          <p style={{ fontSize: '14px', color: '#dc2626' }}>
            {searchError}
          </p>
        </div>
      )}
    </div>
  );

  if (showModal) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative'
        }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                zIndex: 1001
              }}
            >
              <X style={{ height: '20px', width: '20px', color: '#6b7280' }} />
            </button>
          )}
          <LocationContent />
        </div>
      </div>
    );
  }

  return <LocationContent />;
};

export default LocationSelector;
