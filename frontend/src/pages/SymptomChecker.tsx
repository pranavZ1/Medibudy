import React, { useState } from 'react';
import { aiAPI } from '../services/api';
import { 
  Search, 
  Plus, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Brain,
  Stethoscope,
  FileText
} from 'lucide-react';

interface AnalysisResult {
  possibleConditions: Array<{
    condition: string;
    probability: number;
    description: string;
  }>;
  recommendations: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  disclaimer: string;
}

const SymptomChecker: React.FC = () => {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  const commonSymptoms = [
    'Headache', 'Fever', 'Cough', 'Fatigue', 'Nausea', 'Dizziness',
    'Chest pain', 'Shortness of breath', 'Abdominal pain', 'Joint pain',
    'Muscle aches', 'Sore throat', 'Runny nose', 'Vomiting', 'Diarrhea'
  ];

  const addSymptom = (symptom: string) => {
    if (symptom.trim() && !symptoms.includes(symptom.trim())) {
      setSymptoms([...symptoms, symptom.trim()]);
      setCurrentSymptom('');
    }
  };

  const removeSymptom = (index: number) => {
    setSymptoms(symptoms.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (symptoms.length === 0) {
      setError('Please add at least one symptom');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await aiAPI.analyzeSymptoms(symptoms, additionalInfo);
      setResult(response.data.analysis);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze symptoms');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return { color: '#dc2626', backgroundColor: '#fef2f2', borderColor: '#fecaca' };
      case 'medium': return { color: '#d97706', backgroundColor: '#fffbeb', borderColor: '#fed7aa' };
      case 'low': return { color: '#059669', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' };
      default: return { color: '#4b5563', backgroundColor: '#f9fafb', borderColor: '#e5e7eb' };
    }
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'high': return <AlertCircle style={{ height: '20px', width: '20px' }} />;
      case 'medium': return <AlertCircle style={{ height: '20px', width: '20px' }} />;
      case 'low': return <CheckCircle style={{ height: '20px', width: '20px' }} />;
      default: return <AlertCircle style={{ height: '20px', width: '20px' }} />;
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spinner {
            animation: spin 1s linear infinite;
          }
        `}
      </style>

      {/* Header */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#dbeafe', padding: '16px', borderRadius: '50%' }}>
            <Brain style={{ height: '32px', width: '32px', color: '#2563eb' }} />
          </div>
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>AI Symptom Checker</h1>
        <p style={{ color: '#4b5563', maxWidth: '672px', margin: '0 auto' }}>
          Describe your symptoms and get AI-powered analysis to understand potential conditions. 
          This is not a substitute for professional medical advice.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
        {/* Input Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Add Your Symptoms</h2>
            
            {/* Symptom Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type a symptom..."
                  style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                  value={currentSymptom}
                  onChange={(e) => setCurrentSymptom(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addSymptom(currentSymptom);
                    }
                  }}
                />
                <button
                  onClick={() => addSymptom(currentSymptom)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <Plus style={{ height: '20px', width: '20px' }} />
                </button>
              </div>

              {/* Common Symptoms */}
              <div>
                <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Common symptoms:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {commonSymptoms.map((symptom) => (
                    <button
                      key={symptom}
                      onClick={() => addSymptom(symptom)}
                      disabled={symptoms.includes(symptom)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: symptoms.includes(symptom) ? '#e5e7eb' : '#f3f4f6',
                        color: symptoms.includes(symptom) ? '#9ca3af' : '#374151',
                        border: 'none',
                        borderRadius: '16px',
                        cursor: symptoms.includes(symptom) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Symptoms */}
              {symptoms.length > 0 && (
                <div>
                  <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Your symptoms:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {symptoms.map((symptom, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: '#eff6ff',
                          padding: '8px 12px',
                          borderRadius: '6px'
                        }}
                      >
                        <span style={{ color: '#1e40af' }}>{symptom}</span>
                        <button
                          onClick={() => removeSymptom(index)}
                          style={{
                            color: '#2563eb',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <X style={{ height: '16px', width: '16px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Information */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Additional Information (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe when symptoms started, severity, what makes them better/worse, etc."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none',
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                />
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={loading || symptoms.length === 0}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: symptoms.length === 0 || loading ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: symptoms.length === 0 || loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {loading ? (
                  <div className="spinner" style={{ 
                    width: '20px', 
                    height: '20px', 
                    border: '2px solid white', 
                    borderTop: '2px solid transparent', 
                    borderRadius: '50%'
                  }} />
                ) : (
                  <>
                    <Search style={{ height: '20px', width: '20px' }} />
                    <span>Analyze Symptoms</span>
                  </>
                )}
              </button>

              {error && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '12px', 
                  backgroundColor: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '6px', 
                  color: '#dc2626' 
                }}>
                  <AlertCircle style={{ height: '20px', width: '20px' }} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Urgency Level */}
              <div style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid',
                ...getUrgencyColor(result.urgencyLevel)
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getUrgencyIcon(result.urgencyLevel)}
                  <h3 style={{ fontWeight: '600', margin: 0 }}>
                    Urgency Level: {result.urgencyLevel.charAt(0).toUpperCase() + result.urgencyLevel.slice(1)}
                  </h3>
                </div>
              </div>

              {/* Possible Conditions */}
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Stethoscope style={{ height: '20px', width: '20px' }} />
                  <span>Possible Conditions</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {result.possibleConditions.map((condition, index) => (
                    <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ fontWeight: '500', color: '#111827', margin: 0 }}>{condition.condition}</h4>
                        <span style={{ fontSize: '12px', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px' }}>
                          {condition.probability}% match
                        </span>
                      </div>
                      <p style={{ color: '#4b5563', fontSize: '14px', margin: 0 }}>{condition.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText style={{ height: '20px', width: '20px' }} />
                  <span>Recommendations</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {result.recommendations.map((recommendation, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <CheckCircle style={{ height: '20px', width: '20px', color: '#10b981', marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ color: '#374151' }}>{recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle style={{ height: '20px', width: '20px', color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontWeight: '500', color: '#92400e', marginBottom: '4px' }}>Important Disclaimer</h4>
                    <p style={{ color: '#b45309', fontSize: '14px', margin: 0 }}>{result.disclaimer}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Brain style={{ height: '48px', width: '48px', color: '#9ca3af', margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '8px' }}>
                  Ready to Analyze
                </h3>
                <p style={{ color: '#4b5563' }}>
                  Add your symptoms and click "Analyze Symptoms" to get AI-powered insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymptomChecker;
