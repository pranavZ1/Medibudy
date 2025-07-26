const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async analyzeSymptoms(symptoms, userInfo = {}) {
    try {
      const prompt = this.buildSymptomsAnalysisPrompt(symptoms, userInfo);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return this.parseSymptomsAnalysis(response.text());
    } catch (error) {
      console.error('Error analyzing symptoms:', error);
      throw new Error('Failed to analyze symptoms');
    }
  }

  async recommendTreatments(diagnosis, symptoms, userInfo = {}) {
    try {
      const prompt = this.buildTreatmentRecommendationPrompt(diagnosis, symptoms, userInfo);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return this.parseTreatmentRecommendations(response.text());
    } catch (error) {
      console.error('Error recommending treatments:', error);
      throw new Error('Failed to recommend treatments');
    }
  }

  async analyzeMedicalReport(reportText, reportType) {
    try {
      const prompt = this.buildReportAnalysisPrompt(reportText, reportType);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return this.parseReportAnalysis(response.text());
    } catch (error) {
      console.error('Error analyzing medical report:', error);
      throw new Error('Failed to analyze medical report');
    }
  }

  async suggestSurgeryOptions(condition, patientProfile) {
    try {
      const prompt = this.buildSurgeryOptionsPrompt(condition, patientProfile);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return this.parseSurgeryOptions(response.text());
    } catch (error) {
      console.error('Error suggesting surgery options:', error);
      throw new Error('Failed to suggest surgery options');
    }
  }

  buildSymptomsAnalysisPrompt(symptoms, userInfo) {
    const additionalInfo = userInfo.additionalInfo || '';
    
    // Handle both string array and object array formats
    const symptomsText = Array.isArray(symptoms) 
      ? symptoms.map(s => typeof s === 'string' ? `- ${s}` : `- ${s.symptom}: Severity ${s.severity}/10, Duration: ${s.duration}, Frequency: ${s.frequency}`).join('\n')
      : `- ${symptoms}`;
    
    return `
You are an expert medical AI assistant specializing in symptom analysis. Based on the provided symptoms, give a comprehensive medical assessment.

Symptoms reported:
${symptomsText}

Additional Information: ${additionalInfo}

CRITICAL INSTRUCTIONS:
1. This analysis is for educational and informational purposes only
2. Always emphasize the need for professional medical consultation
3. Provide probability scores as percentages (0-100)
4. Consider common conditions first, then rare conditions
5. Assess urgency level carefully

Please provide your analysis in the following JSON format (ensure valid JSON syntax):
{
  "possibleConditions": [
    {
      "condition": "Most likely condition name",
      "probability": 75,
      "description": "Detailed explanation of why this condition matches the symptoms"
    },
    {
      "condition": "Second most likely condition",
      "probability": 60,
      "description": "Explanation for this potential condition"
    },
    {
      "condition": "Third possibility",
      "probability": 40,
      "description": "Why this condition is also possible"
    }
  ],
  "recommendations": [
    "Consult a healthcare professional for proper diagnosis",
    "Monitor symptoms and note any changes",
    "Keep a symptom diary with timing and triggers",
    "Seek immediate medical attention if symptoms worsen",
    "Consider scheduling an appointment with appropriate specialist"
  ],
  "urgencyLevel": "low",
  "disclaimer": "This AI analysis is for informational purposes only and should not replace professional medical advice. Please consult with a qualified healthcare provider for proper diagnosis and treatment."
}

Base urgency levels on these criteria:
- "low": Common, non-life-threatening symptoms that can wait for routine medical care
- "medium": Symptoms that should be evaluated within 24-48 hours
- "high": Symptoms requiring prompt medical attention within hours
- "emergency": Life-threatening symptoms requiring immediate emergency care`;
  }

  buildTreatmentRecommendationPrompt(diagnosis, symptoms, userInfo) {
    return `
You are a medical AI assistant. Based on the diagnosis and symptoms, recommend appropriate treatments.

Diagnosis: ${diagnosis}
Symptoms: ${symptoms.map(s => s.symptom).join(', ')}
Patient Age: ${userInfo.age || 'Not specified'}
Medical History: ${userInfo.medicalHistory ? userInfo.medicalHistory.join(', ') : 'None specified'}

IMPORTANT: This is for educational purposes only and should not replace professional medical advice.

Please provide treatment recommendations in the following JSON format:
{
  "primaryTreatments": [
    {
      "treatment": "treatment name",
      "description": "brief description",
      "effectiveness": 0.0-1.0,
      "duration": "estimated duration",
      "sideEffects": ["side effect 1", "side effect 2"],
      "cost": "low|medium|high"
    }
  ],
  "alternativeTreatments": [
    {
      "treatment": "alternative treatment",
      "description": "brief description",
      "effectiveness": 0.0-1.0
    }
  ],
  "lifestyle": ["lifestyle recommendation 1", "lifestyle recommendation 2"],
  "warning": "Please consult a healthcare professional before starting any treatment"
}`;
  }

  buildReportAnalysisPrompt(reportText, reportType) {
    return `
You are a medical AI assistant. Analyze the following medical report and provide insights.

Report Type: ${reportType}
Report Content:
${reportText}

IMPORTANT: This analysis is for educational purposes only and should not replace professional medical interpretation.

Please provide analysis in the following JSON format:
{
  "summary": "brief summary of findings",
  "keyFindings": ["finding 1", "finding 2"],
  "abnormalValues": [
    {
      "parameter": "parameter name",
      "value": "reported value",
      "normalRange": "normal range",
      "significance": "clinical significance"
    }
  ],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "urgency": "low|medium|high|emergency",
  "warning": "Please discuss these results with your healthcare provider"
}`;
  }

  buildSurgeryOptionsPrompt(condition, patientProfile) {
    return `
You are a medical AI assistant. Suggest surgery options for the given condition.

Condition: ${condition}
Patient Age: ${patientProfile.age || 'Not specified'}
Medical History: ${patientProfile.medicalHistory ? patientProfile.medicalHistory.join(', ') : 'None specified'}
Current Medications: ${patientProfile.medications ? patientProfile.medications.join(', ') : 'None specified'}

IMPORTANT: This is for educational purposes only and should not replace professional medical advice.

Please provide surgery options in the following JSON format:
{
  "surgeryOptions": [
    {
      "name": "surgery name",
      "type": "minimally invasive|open surgery|robotic",
      "description": "brief description",
      "successRate": 0.0-1.0,
      "recoveryTime": "estimated recovery time",
      "complications": ["complication 1", "complication 2"],
      "suitability": 0.0-1.0,
      "cost": "low|medium|high"
    }
  ],
  "nonSurgicalAlternatives": [
    {
      "treatment": "treatment name",
      "description": "brief description",
      "effectiveness": 0.0-1.0
    }
  ],
  "preOperativeRequirements": ["requirement 1", "requirement 2"],
  "warning": "Please consult with a qualified surgeon for proper evaluation"
}`;
  }

  parseSymptomsAnalysis(responseText) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing symptoms analysis:', error);
      return this.getDefaultSymptomsAnalysis();
    }
  }

  parseTreatmentRecommendations(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing treatment recommendations:', error);
      return this.getDefaultTreatmentRecommendations();
    }
  }

  parseReportAnalysis(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing report analysis:', error);
      return this.getDefaultReportAnalysis();
    }
  }

  parseSurgeryOptions(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing surgery options:', error);
      return this.getDefaultSurgeryOptions();
    }
  }

  getDefaultSymptomsAnalysis() {
    return {
      possibleConditions: [
        {
          condition: "General Medical Condition",
          probability: 50,
          description: "AI analysis temporarily unavailable. Please consult a healthcare professional for proper evaluation."
        }
      ],
      recommendations: [
        'Consult a healthcare professional for proper diagnosis',
        'Monitor your symptoms closely',
        'Seek medical attention if symptoms worsen',
        'Keep a record of when symptoms occur'
      ],
      urgencyLevel: 'medium',
      disclaimer: 'AI analysis unavailable. Please consult a healthcare professional for proper diagnosis and treatment.'
    };
  }

  getDefaultTreatmentRecommendations() {
    return {
      primaryTreatments: [],
      alternativeTreatments: [],
      lifestyle: ['Maintain a healthy diet', 'Exercise regularly', 'Get adequate sleep'],
      warning: 'Treatment recommendations unavailable. Please consult a healthcare professional.'
    };
  }

  getDefaultReportAnalysis() {
    return {
      summary: 'Report analysis unavailable',
      keyFindings: [],
      abnormalValues: [],
      recommendations: ['Consult with your healthcare provider'],
      urgency: 'medium',
      warning: 'Please discuss these results with your healthcare provider'
    };
  }

  getDefaultSurgeryOptions() {
    return {
      surgeryOptions: [],
      nonSurgicalAlternatives: [],
      preOperativeRequirements: [],
      warning: 'Surgery options unavailable. Please consult with a qualified surgeon.'
    };
  }
}

module.exports = AIService;
