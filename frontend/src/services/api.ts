import axios from 'axios';

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // If explicitly set via environment variable, use that
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production (on Netlify), use Railway backend
  if (process.env.NODE_ENV === 'production') {
    return 'https://medibudy-backend-production.up.railway.app/api';
  }
  
  // For local development
  return 'http://localhost:5001/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (userData: {
    name: string;
    email: string;
    password: string;
    age?: number;
    gender?: string;
    location?: {
      type: string;
      coordinates: [number, number];
      address: string;
    };
  }) => api.post('/auth/register', userData),
  
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
};

// AI API
export const aiAPI = {
  analyzeSymptoms: (symptoms: string[], additionalInfo?: string) =>
    api.post('/ai/analyze-symptoms-simple', { symptoms, additionalInfo }),
  
  recommendTreatments: (condition: string, location?: string) =>
    api.post('/ai/recommend-treatments', { condition, location }),
  
  findHospitals: (treatmentType: string, location: string, radius?: number) =>
    api.post('/ai/find-hospitals', { treatmentType, location, radius }),
  
  analyzeReport: (reportText: string, reportType?: string) =>
    api.post('/ai/analyze-report', { reportText, reportType }),
};

// Treatments API
export const treatmentsAPI = {
  search: (params: {
    query?: string;
    category?: string;
    priceRange?: { min: number; max: number };
    location?: string;
    page?: number;
    limit?: number;
  }) => api.get('/treatments/search', { params }),
  
  getById: (id: string) => api.get(`/treatments/${id}`),
  
  getCategories: () => api.get('/treatments/categories'),
};

// Hospitals API
export const hospitalsAPI = {
  search: (params: {
    location?: string;
    specialization?: string;
    rating?: number;
    radius?: number;
    page?: number;
    limit?: number;
  }) => api.get('/hospitals/search', { params }),
  
  getById: (id: string) => api.get(`/hospitals/${id}`),
  
  getNearby: (coordinates: [number, number], radius: number = 10) =>
    api.get('/hospitals/nearby', { 
      params: { 
        longitude: coordinates[0], 
        latitude: coordinates[1], 
        radius 
      } 
    }),
};

// Location API
export const locationAPI = {
  getUserLocation: () => api.get('/location/user'),
  
  updateUserLocation: (location: {
    type: string;
    coordinates: [number, number];
    address: string;
  }) => api.put('/location/user', { location }),
};

export default api;
