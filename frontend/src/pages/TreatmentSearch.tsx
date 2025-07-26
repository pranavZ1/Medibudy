import React, { useState, useEffect } from 'react';
import { treatmentsAPI } from '../services/api';
import { Search, Filter, MapPin, DollarSign, Clock, Star } from 'lucide-react';

interface Treatment {
  _id: string;
  name: string;
  category: string;
  description: string;
  procedures: string[];
  averageCost: {
    min: number;
    max: number;
    currency: string;
  };
  duration: string;
  successRate: number;
  riskFactors: string[];
  ageGroups: string[];
  location: string;
}

const TreatmentSearch: React.FC = () => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCategories();
    fetchTreatments();
  }, []);

  useEffect(() => {
    fetchTreatments();
  }, [searchQuery, selectedCategory, priceRange, currentPage]);

  const fetchCategories = async () => {
    try {
      const response = await treatmentsAPI.getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchTreatments = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: 12
      };

      if (searchQuery) params.query = searchQuery;
      if (selectedCategory) params.category = selectedCategory;
      if (priceRange.min || priceRange.max) {
        params.priceRange = {
          min: priceRange.min ? parseInt(priceRange.min) : 0,
          max: priceRange.max ? parseInt(priceRange.max) : 1000000
        };
      }

      const response = await treatmentsAPI.search(params);
      setTreatments(response.data.treatments);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch treatments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTreatments();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Treatment Search</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Find comprehensive information about medical treatments, procedures, and their costs.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search treatments, conditions, procedures..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
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

          {/* Price Range */}
          <div className="flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">Price Range:</span>
            <input
              type="number"
              placeholder="Min"
              className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={priceRange.min}
              onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
            />
            <span className="text-gray-400">to</span>
            <input
              type="number"
              placeholder="Max"
              className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={priceRange.max}
              onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
            />
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
              Showing {treatments.length} treatment{treatments.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Treatment Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {treatments.map((treatment) => (
              <div key={treatment._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{treatment.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {treatment.category}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">{treatment.description}</p>
                  </div>

                  {/* Cost */}
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {formatCurrency(treatment.averageCost.min)} - {formatCurrency(treatment.averageCost.max)}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">{treatment.duration}</span>
                  </div>

                  {/* Success Rate */}
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-600">{treatment.successRate}% success rate</span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-600">{treatment.location}</span>
                  </div>

                  {/* Procedures */}
                  {treatment.procedures.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Key Procedures:</p>
                      <div className="flex flex-wrap gap-1">
                        {treatment.procedures.slice(0, 3).map((procedure, index) => (
                          <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {procedure}
                          </span>
                        ))}
                        {treatment.procedures.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{treatment.procedures.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Age Groups */}
                  {treatment.ageGroups.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Suitable for:</p>
                      <p className="text-xs text-gray-600">{treatment.ageGroups.join(', ')}</p>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {treatment.riskFactors.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Risk Factors:</p>
                      <div className="flex flex-wrap gap-1">
                        {treatment.riskFactors.slice(0, 2).map((risk, index) => (
                          <span key={index} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            {risk}
                          </span>
                        ))}
                        {treatment.riskFactors.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{treatment.riskFactors.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 border rounded-md ${
                        currentPage === page
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}

          {/* No Results */}
          {treatments.length === 0 && !loading && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No treatments found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TreatmentSearch;
