import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, User, LogOut, Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{ backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <Heart style={{ height: '32px', width: '32px', color: '#3b82f6', marginRight: '8px' }} />
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>MediBuddy</span>
          </Link>

          {/* Desktop Navigation */}
          <div style={{ display: isMenuOpen ? 'flex' : 'none', alignItems: 'center', gap: '32px' }} className="hidden md:flex">
            <Link to="/dashboard" style={{ color: '#374151', textDecoration: 'none', transition: 'color 0.2s' }}>
              Dashboard
            </Link>
            <Link to="/symptom-checker" style={{ color: '#374151', textDecoration: 'none', transition: 'color 0.2s' }}>
              Symptom Checker
            </Link>
            <Link to="/treatments" style={{ color: '#374151', textDecoration: 'none', transition: 'color 0.2s' }}>
              Treatments
            </Link>
            <Link to="/hospitals" style={{ color: '#374151', textDecoration: 'none', transition: 'color 0.2s' }}>
              Hospitals
            </Link>
            <Link to="/report-analysis" style={{ color: '#374151', textDecoration: 'none', transition: 'color 0.2s' }}>
              Report Analysis
            </Link>
          </div>

          {/* Mobile menu button */}
          <div style={{ display: 'block' }} className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{ 
                color: '#374151', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            {user ? (
              <div className="flex flex-col space-y-4">
                <div className="flex items-center space-x-2 text-gray-700">
                  <User className="h-5 w-5" />
                  <span>{user.name}</span>
                </div>
                <Link 
                  to="/dashboard" 
                  className="text-gray-700 hover:text-primary-500 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/symptom-checker" 
                  className="text-gray-700 hover:text-primary-500 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Symptom Checker
                </Link>
                <Link 
                  to="/treatments" 
                  className="text-gray-700 hover:text-primary-500 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Treatments
                </Link>
                <Link 
                  to="/hospitals" 
                  className="text-gray-700 hover:text-primary-500 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Hospitals
                </Link>
                <Link 
                  to="/report-analysis" 
                  className="text-gray-700 hover:text-primary-500 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Report Analysis
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center space-x-1 text-red-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                <Link 
                  to="/login" 
                  className="text-gray-700 hover:text-primary-500 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
