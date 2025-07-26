import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SymptomChecker from './pages/SymptomChecker';
import TreatmentSearch from './pages/TreatmentSearch';
import HospitalFinder from './pages/HospitalFinder';
import ReportAnalysis from './pages/ReportAnalysis';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
          <Navbar />
          <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/symptom-checker" element={<SymptomChecker />} />
              <Route path="/treatments" element={<TreatmentSearch />} />
              <Route path="/hospitals" element={<HospitalFinder />} />
              <Route path="/report-analysis" element={<ReportAnalysis />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
