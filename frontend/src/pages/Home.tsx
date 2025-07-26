import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Heart, 
  Search, 
  MapPin, 
  FileText, 
  Shield, 
  Clock, 
  Users,
  Stethoscope
} from 'lucide-react';

const Home: React.FC = () => {
  const features = [
    {
      icon: <Search style={{ height: '32px', width: '32px', color: '#3b82f6' }} />,
      title: "AI Symptom Checker",
      description: "Get instant AI-powered analysis of your symptoms and potential conditions."
    },
    {
      icon: <Stethoscope style={{ height: '32px', width: '32px', color: '#3b82f6' }} />,
      title: "Treatment Search",
      description: "Find the best treatments for your condition with detailed information and pricing."
    },
    {
      icon: <MapPin style={{ height: '32px', width: '32px', color: '#3b82f6' }} />,
      title: "Hospital Finder",
      description: "Locate nearby hospitals and medical facilities based on your needs."
    },
    {
      icon: <FileText style={{ height: '32px', width: '32px', color: '#3b82f6' }} />,
      title: "Report Analysis",
      description: "Upload and get AI analysis of your medical reports and test results."
    }
  ];

  const stats = [
    { icon: <Users style={{ height: '24px', width: '24px' }} />, value: "10,000+", label: "Patients Helped" },
    { icon: <Heart style={{ height: '24px', width: '24px' }} />, value: "500+", label: "Treatments Listed" },
    { icon: <MapPin style={{ height: '24px', width: '24px' }} />, value: "1,000+", label: "Hospitals" },
    { icon: <Clock style={{ height: '24px', width: '24px' }} />, value: "24/7", label: "Available" }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 style={{ 
            fontSize: '48px', 
            fontWeight: 'bold', 
            color: '#111827',
            lineHeight: '1.1'
          }}>
            Your Personal <span style={{ color: '#3b82f6' }}>Medical Assistant</span>
          </h1>
          <p style={{ 
            fontSize: '20px', 
            color: '#4b5563', 
            maxWidth: '768px', 
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Get AI-powered medical insights, find the best treatments, locate hospitals, 
            and analyze your reports - all in one comprehensive platform.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <Link 
            to="/dashboard"
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Get Started
          </Link>
          <Link 
            to="/symptom-checker"
            style={{
              backgroundColor: 'transparent',
              color: '#3b82f6',
              padding: '12px 32px',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              textDecoration: 'none',
              border: '2px solid #3b82f6',
              transition: 'all 0.2s'
            }}
          >
            Try Symptom Checker
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>
            Comprehensive Medical Solutions
          </h2>
          <p style={{ fontSize: '20px', color: '#4b5563', maxWidth: '672px', margin: '0 auto' }}>
            Everything you need for your healthcare journey in one place
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '32px' 
        }}>
          {features.map((feature, index) => (
            <div key={index} style={{ 
              backgroundColor: 'white', 
              padding: '24px', 
              borderRadius: '8px', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              transition: 'box-shadow 0.2s'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>{feature.icon}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', textAlign: 'center' }}>
                  {feature.title}
                </h3>
                <p style={{ color: '#4b5563', textAlign: 'center' }}>
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ 
        backgroundColor: '#eff6ff', 
        margin: '0 -16px', 
        padding: '64px 16px', 
        borderRadius: '8px' 
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827' }}>
            Trusted by Thousands
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '32px' 
          }}>
            {stats.map((stat, index) => (
              <div key={index} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: '#3b82f6' }}>
                  {stat.icon}
                </div>
                <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827' }}>{stat.value}</div>
                <div style={{ color: '#4b5563' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Shield style={{ height: '64px', width: '64px', color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827' }}>
            Your Privacy & Security First
          </h2>
          <p style={{ fontSize: '20px', color: '#4b5563', maxWidth: '672px', margin: '0 auto' }}>
            We use enterprise-grade security to protect your medical information. 
            Your data is encrypted and never shared without your consent.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
