import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Location {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
}

interface LocationContextType {
  userLocation: Location | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  isManualLocation: boolean;
  setUserLocation: (location: Location) => void;
  getCurrentLocation: () => Promise<void>;
  setManualLocation: (location: Location) => void;
  clearLocationError: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }: LocationProviderProps) => {
  const [userLocation, setUserLocationState] = useState<Location | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocationFlag] = useState(false);

  const setUserLocation = (location: Location) => {
    setUserLocationState(location);
    setIsManualLocationFlag(false);
    setLocationError(null);
    // Save to localStorage for persistence
    localStorage.setItem('userLocation', JSON.stringify(location));
  };

  const setManualLocation = (location: Location) => {
    setUserLocationState(location);
    setIsManualLocationFlag(true);
    setLocationError(null);
    // Save to localStorage for persistence
    localStorage.setItem('userLocation', JSON.stringify(location));
    localStorage.setItem('isManualLocation', 'true');
  };

  const clearLocationError = () => {
    setLocationError(null);
  };

  const getCurrentLocation = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        setLocationError(error);
        reject(new Error(error));
        return;
      }

      setIsLoadingLocation(true);
      setLocationError(null);

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            
            // Reverse geocode to get address details
            const response = await fetch('/api/location/reverse-geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                lat: latitude,
                lng: longitude
              })
            });

            if (response.ok) {
              const data = await response.json();
              const location: Location = {
                lat: latitude,
                lng: longitude,
                city: data.location.city,
                state: data.location.state,
                country: data.location.country,
                address: data.location.address
              };
              setUserLocation(location);
            } else {
              // Fallback without address details
              const location: Location = {
                lat: latitude,
                lng: longitude
              };
              setUserLocation(location);
            }
            
            setIsLoadingLocation(false);
            resolve();
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            // Still set location without address details
            const location: Location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(location);
            setIsLoadingLocation(false);
            resolve();
          }
        },
        (error) => {
          let errorMessage = 'Unable to retrieve your location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location services.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          
          setLocationError(errorMessage);
          setIsLoadingLocation(false);
          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  // Load saved location on component mount
  useEffect(() => {
    const savedLocation = localStorage.getItem('userLocation');
    const savedIsManual = localStorage.getItem('isManualLocation') === 'true';
    
    if (savedLocation) {
      try {
        const location = JSON.parse(savedLocation);
        setUserLocationState(location);
        setIsManualLocationFlag(savedIsManual);
      } catch (error) {
        console.error('Error parsing saved location:', error);
        localStorage.removeItem('userLocation');
        localStorage.removeItem('isManualLocation');
      }
    } else {
      // Try to get current location automatically
      getCurrentLocation().catch(console.error);
    }
  }, []);

  const value: LocationContextType = {
    userLocation,
    isLoadingLocation,
    locationError,
    isManualLocation,
    setUserLocation,
    getCurrentLocation,
    setManualLocation,
    clearLocationError
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
