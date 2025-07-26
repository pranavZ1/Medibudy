import React, { useState } from 'react';
import { aiAPI } from '../services/api';
import { Upload, FileText, Brain, AlertCircle, CheckCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface AnalysisResult {
  summary: string;
  keyFindings: Array<{
    parameter: string;
    value: string;
    status: 'normal' | 'high' | 'low' | 'critical';
    description: string;
  }>;
  recommendations: string[];
  followUpActions: string[];
  riskFactors: string[];
  trends?: Array<{
    parameter: string;
    trend: 'improving' | 'declining' | 'stable';
    description: string;
  }>;
}

const ReportAnalysis: React.FC = () => {
  const [reportText, setReportText] = useState('');
  const [reportType, setReportType] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const reportTypes = [
    'Blood Test',
    'Urine Test',
    'X-Ray',
    'MRI',
    'CT Scan',
    'Ultrasound',
    'ECG/EKG',
    'Endoscopy',
    'Biopsy',
    'Other'
  ];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setReportText(text);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!reportText.trim()) {
      setError('Please provide report text to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await aiAPI.analyzeReport(reportText, reportType || undefined);
      setResult(response.data.analysis);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze report');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-50 border-green-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="h-4 w-4" />;
      case 'high': return <TrendingUp className="h-4 w-4" />;
      case 'low': return <TrendingDown className="h-4 w-4" />;
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="bg-purple-100 p-4 rounded-full">
            <Brain className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Medical Report Analysis</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Upload or paste your medical report text to get AI-powered analysis and insights.
          Our system can analyze various types of medical reports and provide detailed explanations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Upload or Enter Report</h2>
            
            {/* Report Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type (Optional)
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="">Select report type</option>
                {reportTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-purple-400 bg-purple-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Drag and drop a text file here, or click to select
              </p>
              <input
                type="file"
                accept=".txt,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 cursor-pointer transition-colors"
              >
                Choose File
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: TXT, DOC, DOCX
              </p>
            </div>

            {/* Text Input */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or paste report text directly:
              </label>
              <textarea
                rows={12}
                placeholder="Paste your medical report text here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !reportText.trim()}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Brain className="h-5 w-5" />
                  <span>Analyze Report</span>
                </>
              )}
            </button>

            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 mt-4">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {result ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Summary</span>
                </h3>
                <p className="text-gray-700 leading-relaxed">{result.summary}</p>
              </div>

              {/* Key Findings */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Findings</h3>
                <div className="space-y-3">
                  {result.keyFindings.map((finding, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${getStatusColor(finding.status)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(finding.status)}
                          <span className="font-medium">{finding.parameter}</span>
                        </div>
                        <span className="font-semibold">{finding.value}</span>
                      </div>
                      <p className="text-sm">{finding.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trends (if available) */}
              {result.trends && result.trends.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Trends</h3>
                  <div className="space-y-3">
                    {result.trends.map((trend, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        {getTrendIcon(trend.trend)}
                        <div>
                          <h4 className="font-medium text-gray-900">{trend.parameter}</h4>
                          <p className="text-sm text-gray-600">{trend.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
                <div className="space-y-2">
                  {result.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up Actions */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Follow-up Actions</h3>
                <div className="space-y-2">
                  {result.followUpActions.map((action, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <Activity className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Factors */}
              {result.riskFactors.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Factors</h3>
                  <div className="space-y-2">
                    {result.riskFactors.map((risk, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-1">Important Disclaimer</h4>
                    <p className="text-yellow-700 text-sm">
                      This analysis is provided for informational purposes only and should not replace 
                      professional medical advice. Always consult with your healthcare provider for 
                      proper interpretation of medical reports and treatment decisions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Ready to Analyze
                </h3>
                <p className="text-gray-600">
                  Upload or paste your medical report to get detailed AI analysis and insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportAnalysis;
