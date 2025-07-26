const { GoogleGenerativeAI } = require('@google/generative-ai');

class MedicalAIDoctor {
  constructor() {
    // Initialize Gemini if API key is available
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
      try {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.aiAvailable = true;
        console.log('Medical AI Doctor initialized with Gemini Pro');
      } catch (error) {
        console.warn('Gemini AI initialization failed, using advanced rule-based system:', error.message);
        this.aiAvailable = false;
      }
    } else {
      console.warn('No valid Gemini API key found, using advanced medical knowledge system');
      this.aiAvailable = false;
    }

    this.medicalKnowledge = this.initializeAdvancedMedicalKnowledge();
    this.diagnosticAlgorithms = this.initializeDiagnosticAlgorithms();
  }

  initializeAdvancedMedicalKnowledge() {
    return {
      // Comprehensive symptom database with severity levels
      symptoms: {
        'fever': {
          severity: {
            'mild': { temp: '99-100.4°F', concern: 'low' },
            'moderate': { temp: '100.5-102°F', concern: 'medium' },
            'high': { temp: '102.1-104°F', concern: 'high' },
            'severe': { temp: '>104°F', concern: 'emergency' }
          },
          associations: ['infection', 'inflammation', 'autoimmune', 'malignancy'],
          redFlags: ['rigors', 'altered consciousness', 'severe dehydration']
        },
        'headache': {
          types: {
            'tension': { prevalence: 0.4, urgency: 'low' },
            'migraine': { prevalence: 0.15, urgency: 'medium' },
            'cluster': { prevalence: 0.001, urgency: 'high' },
            'secondary': { prevalence: 0.05, urgency: 'high' }
          },
          redFlags: ['sudden severe onset', 'fever with headache', 'vision changes', 'weakness']
        },
        'chest pain': {
          types: {
            'cardiac': { urgency: 'emergency', prevalence: 0.15 },
            'pulmonary': { urgency: 'high', prevalence: 0.1 },
            'musculoskeletal': { urgency: 'low', prevalence: 0.5 },
            'gastrointestinal': { urgency: 'low', prevalence: 0.25 }
          },
          redFlags: ['radiating pain', 'shortness of breath', 'sweating', 'crushing sensation']
        },
        'shortness of breath': {
          causes: {
            'cardiac': { urgency: 'high', prevalence: 0.3 },
            'pulmonary': { urgency: 'high', prevalence: 0.4 },
            'anxiety': { urgency: 'medium', prevalence: 0.2 },
            'anemia': { urgency: 'medium', prevalence: 0.1 }
          },
          redFlags: ['at rest', 'with chest pain', 'with cyanosis']
        }
      },

      // Disease patterns with diagnostic criteria
      diseasePatterns: {
        'viral upper respiratory infection': {
          requiredSymptoms: ['fatigue'],
          commonSymptoms: ['fever', 'headache', 'sore throat', 'cough', 'nasal congestion'],
          duration: '7-10 days',
          prevalence: 0.8,
          seasonality: 'winter/spring',
          treatment: 'supportive care'
        },
        'influenza': {
          requiredSymptoms: ['fever', 'fatigue'],
          commonSymptoms: ['headache', 'muscle aches', 'cough', 'sore throat'],
          onset: 'sudden',
          duration: '7-14 days',
          prevalence: 0.1,
          seasonality: 'winter'
        },
        'covid-19': {
          requiredSymptoms: [],
          commonSymptoms: ['fever', 'cough', 'fatigue', 'loss of taste/smell', 'shortness of breath'],
          onset: 'gradual',
          duration: '7-21 days',
          prevalence: 0.05,
          complications: ['pneumonia', 'long covid']
        },
        'bacterial pneumonia': {
          requiredSymptoms: ['fever', 'cough'],
          commonSymptoms: ['shortness of breath', 'chest pain', 'fatigue'],
          onset: 'sudden',
          severity: 'high',
          treatment: 'antibiotics'
        },
        'migraine': {
          requiredSymptoms: ['headache'],
          commonSymptoms: ['nausea', 'light sensitivity', 'sound sensitivity'],
          duration: '4-72 hours',
          pattern: 'episodic',
          triggers: ['stress', 'foods', 'hormones']
        },
        'tension headache': {
          requiredSymptoms: ['headache'],
          characteristics: ['bilateral', 'band-like', 'mild-moderate'],
          duration: '30 minutes - 7 days',
          triggers: ['stress', 'poor posture', 'lack of sleep']
        }
      },

      // Risk factors and demographics
      riskFactors: {
        age: {
          'pediatric': { risks: ['RSV', 'viral infections', 'asthma'] },
          'adult': { risks: ['viral infections', 'bacterial infections', 'stress'] },
          'elderly': { risks: ['pneumonia', 'heart disease', 'complications'] }
        },
        'chronic conditions': {
          'diabetes': { risks: ['infections', 'complications'] },
          'heart disease': { risks: ['chest pain', 'shortness of breath'] },
          'asthma': { risks: ['respiratory symptoms', 'exacerbations'] }
        }
      }
    };
  }

  initializeDiagnosticAlgorithms() {
    return {
      // Fever evaluation algorithm
      feverAlgorithm: (symptoms, patientInfo) => {
        const hasFever = symptoms.includes('fever');
        if (!hasFever) return null;

        let conditions = [];
        
        // Check for associated symptoms
        if (symptoms.includes('headache') && symptoms.includes('fatigue')) {
          conditions.push({
            condition: 'Viral Syndrome',
            probability: 75,
            reasoning: 'Classic triad of fever, headache, and fatigue suggests viral etiology'
          });
        }

        if (symptoms.includes('cough') || symptoms.includes('shortness of breath')) {
          conditions.push({
            condition: 'Lower Respiratory Tract Infection',
            probability: 60,
            reasoning: 'Fever with respiratory symptoms warrants evaluation for pneumonia'
          });
        }

        return conditions;
      },

      // Headache evaluation algorithm
      headacheAlgorithm: (symptoms, patientInfo) => {
        const hasHeadache = symptoms.includes('headache');
        if (!hasHeadache) return null;

        let conditions = [];

        // Red flag assessment
        const redFlags = symptoms.filter(s => 
          ['fever', 'vision changes', 'weakness', 'confusion'].includes(s)
        );

        if (redFlags.length > 0) {
          conditions.push({
            condition: 'Secondary Headache (requires urgent evaluation)',
            probability: 80,
            reasoning: `Red flag symptoms present: ${redFlags.join(', ')}`
          });
        } else {
          conditions.push({
            condition: 'Primary Headache (Tension-type or Migraine)',
            probability: 85,
            reasoning: 'No red flag symptoms, likely benign primary headache'
          });
        }

        return conditions;
      },

      // Respiratory symptoms algorithm
      respiratoryAlgorithm: (symptoms, patientInfo) => {
        const respiratorySymptoms = symptoms.filter(s => 
          ['cough', 'shortness of breath', 'chest pain', 'sore throat'].includes(s)
        );

        if (respiratorySymptoms.length === 0) return null;

        let conditions = [];

        if (symptoms.includes('fever') && symptoms.includes('cough')) {
          conditions.push({
            condition: 'Lower Respiratory Tract Infection',
            probability: 70,
            reasoning: 'Fever and cough suggest lower respiratory infection'
          });
        }

        if (symptoms.includes('sore throat') && !symptoms.includes('fever')) {
          conditions.push({
            condition: 'Viral Upper Respiratory Infection',
            probability: 80,
            reasoning: 'Sore throat without fever typical of viral URI'
          });
        }

        return conditions;
      }
    };
  }

  async analyzeSymptoms(symptoms, userInfo = {}) {
    try {
      console.log('Medical AI Doctor analyzing symptoms:', symptoms);

      // First try AI analysis if available
      if (this.aiAvailable) {
        try {
          return await this.aiAnalysis(symptoms, userInfo);
        } catch (error) {
          console.warn('AI analysis failed, using medical knowledge system:', error.message);
        }
      }

      // Advanced medical knowledge analysis
      return this.advancedMedicalAnalysis(symptoms, userInfo);
    } catch (error) {
      console.error('Error in Medical AI Doctor analysis:', error);
      return this.getComprehensiveDefaultAnalysis();
    }
  }

  async aiAnalysis(symptoms, userInfo) {
    const prompt = this.buildMedicalDoctorPrompt(symptoms, userInfo);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.parseMedicalAnalysis(response.text());
  }

  advancedMedicalAnalysis(symptoms, userInfo) {
    const normalizedSymptoms = symptoms.map(s => 
      typeof s === 'string' ? s.toLowerCase().trim() : s.symptom.toLowerCase().trim()
    );

    console.log('Analyzing symptoms with medical algorithms:', normalizedSymptoms);

    // Run diagnostic algorithms
    let diagnosticResults = [];
    
    const feverResults = this.diagnosticAlgorithms.feverAlgorithm(normalizedSymptoms, userInfo);
    const headacheResults = this.diagnosticAlgorithms.headacheAlgorithm(normalizedSymptoms, userInfo);
    const respiratoryResults = this.diagnosticAlgorithms.respiratoryAlgorithm(normalizedSymptoms, userInfo);

    if (feverResults) diagnosticResults = diagnosticResults.concat(feverResults);
    if (headacheResults) diagnosticResults = diagnosticResults.concat(headacheResults);
    if (respiratoryResults) diagnosticResults = diagnosticResults.concat(respiratoryResults);

    // Pattern matching against disease database
    let diseaseMatches = this.matchDiseasePatterns(normalizedSymptoms);

    // Combine results
    let allConditions = [...diagnosticResults, ...diseaseMatches];

    // Remove duplicates and sort by probability
    const uniqueConditions = this.deduplicateConditions(allConditions);
    
    // If no specific matches, use fallback analysis
    if (uniqueConditions.length === 0) {
      uniqueConditions.push({
        condition: 'Viral Syndrome',
        probability: 60,
        reasoning: 'Symptom pattern suggests common viral illness'
      });
    }

    // Assess urgency using clinical criteria
    const urgencyLevel = this.assessClinicalUrgency(normalizedSymptoms, userInfo);

    // Generate clinical recommendations
    const recommendations = this.generateClinicalRecommendations(normalizedSymptoms, urgencyLevel, uniqueConditions);

    return {
      possibleConditions: uniqueConditions.slice(0, 4).map(condition => ({
        condition: condition.condition,
        probability: Math.round(condition.probability),
        description: condition.reasoning || condition.description || `Clinical analysis suggests ${condition.condition} based on symptom presentation.`
      })),
      recommendations,
      urgencyLevel,
      clinicalNotes: this.generateClinicalNotes(normalizedSymptoms, uniqueConditions),
      disclaimer: 'This analysis is provided by an AI medical assistant and is for educational purposes only. It does not constitute medical advice and should not replace consultation with a qualified healthcare provider.',
      analysisMethod: this.aiAvailable ? 'ai-enhanced-medical' : 'advanced-medical-knowledge'
    };
  }

  matchDiseasePatterns(symptoms) {
    const matches = [];

    Object.entries(this.medicalKnowledge.diseasePatterns).forEach(([disease, pattern]) => {
      let score = 0;
      let maxScore = 0;

      // Check required symptoms
      if (pattern.requiredSymptoms && pattern.requiredSymptoms.length > 0) {
        pattern.requiredSymptoms.forEach(required => {
          maxScore += 30;
          if (symptoms.includes(required)) {
            score += 30;
          }
        });
      }

      // Check common symptoms
      if (pattern.commonSymptoms && pattern.commonSymptoms.length > 0) {
        pattern.commonSymptoms.forEach(common => {
          maxScore += 10;
          if (symptoms.includes(common)) {
            score += 10;
          }
        });
      }

      if (maxScore > 0) {
        const probability = (score / maxScore) * 100;
        if (probability > 20) {
          matches.push({
            condition: disease.charAt(0).toUpperCase() + disease.slice(1),
            probability: probability,
            reasoning: `Symptom pattern matches ${disease} (${Math.round(probability)}% match)`
          });
        }
      }
    });

    return matches.sort((a, b) => b.probability - a.probability);
  }

  deduplicateConditions(conditions) {
    const seen = new Set();
    return conditions.filter(condition => {
      const key = condition.condition.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  assessClinicalUrgency(symptoms, userInfo) {
    // Emergency red flags
    const emergencySymptoms = [
      'chest pain with shortness of breath',
      'severe difficulty breathing',
      'loss of consciousness',
      'severe headache with fever',
      'blood in vomit',
      'severe abdominal pain'
    ];

    const symptomString = symptoms.join(' ');
    if (emergencySymptoms.some(emergency => symptomString.includes(emergency.replace(' with ', ' ')))) {
      return 'emergency';
    }

    // High urgency indicators
    const highUrgencyIndicators = [
      'chest pain', 'shortness of breath', 'high fever', 'severe headache'
    ];

    if (symptoms.some(symptom => 
      highUrgencyIndicators.some(high => symptom.includes(high))
    )) {
      return 'high';
    }

    // Medium urgency indicators
    const mediumUrgencyIndicators = [
      'fever', 'persistent symptoms', 'worsening condition'
    ];

    if (symptoms.some(symptom => 
      mediumUrgencyIndicators.some(medium => symptom.includes(medium))
    )) {
      return 'medium';
    }

    return 'low';
  }

  generateClinicalRecommendations(symptoms, urgencyLevel, conditions) {
    let recommendations = [];

    // Urgency-based recommendations
    switch (urgencyLevel) {
      case 'emergency':
        recommendations.push('🚨 Seek immediate emergency medical care - call 911 or go to the nearest emergency room');
        recommendations.push('Do not drive yourself - call an ambulance or have someone drive you');
        break;
      case 'high':
        recommendations.push('⚡ Seek prompt medical attention within 2-4 hours');
        recommendations.push('Contact your healthcare provider immediately or visit urgent care');
        break;
      case 'medium':
        recommendations.push('📞 Schedule an appointment with your healthcare provider within 24-48 hours');
        recommendations.push('Monitor symptoms closely and seek immediate care if they worsen');
        break;
      case 'low':
        recommendations.push('📅 Consider scheduling a routine appointment with your healthcare provider');
        recommendations.push('Monitor symptoms and seek care if they persist or worsen');
        break;
    }

    // Symptom-specific recommendations
    if (symptoms.includes('fever')) {
      recommendations.push('🌡️ Monitor temperature regularly and stay hydrated');
      recommendations.push('Rest and consider fever-reducing medications if comfortable');
    }

    if (symptoms.includes('headache')) {
      recommendations.push('🧠 Rest in a quiet, dark room');
      recommendations.push('Apply cold or warm compress as preferred');
    }

    if (symptoms.includes('cough')) {
      recommendations.push('💧 Stay well-hydrated and consider honey for cough relief');
      recommendations.push('Avoid irritants and get plenty of rest');
    }

    // General medical advice
    recommendations.push('📝 Keep a symptom diary noting timing, severity, and triggers');
    recommendations.push('🏠 Get adequate rest and maintain good hydration');
    recommendations.push('📱 Follow up if symptoms change or new symptoms develop');

    return recommendations;
  }

  generateClinicalNotes(symptoms, conditions) {
    return {
      chiefComplaint: `Patient reports ${symptoms.join(', ')}`,
      assessment: `Most likely diagnosis: ${conditions[0]?.condition || 'Undifferentiated symptoms'}`,
      differentialDiagnosis: conditions.map(c => c.condition).slice(0, 3),
      clinicalImpression: 'Symptoms suggest common medical condition requiring appropriate evaluation and care'
    };
  }

  buildMedicalDoctorPrompt(symptoms, userInfo) {
    const symptomsText = Array.isArray(symptoms) 
      ? symptoms.map(s => typeof s === 'string' ? `- ${s}` : `- ${s.symptom}: Severity ${s.severity}/10, Duration: ${s.duration}, Frequency: ${s.frequency}`).join('\n')
      : `- ${symptoms}`;
    
    return `
You are a highly experienced medical doctor with expertise in internal medicine, emergency medicine, and primary care. A patient has presented with the following symptoms. Provide a comprehensive medical analysis as you would in clinical practice.

PATIENT PRESENTATION:
${symptomsText}

Additional Information: ${userInfo.additionalInfo || 'None provided'}

As an experienced physician, please provide:

1. Clinical assessment with differential diagnosis
2. Probability estimates based on clinical experience
3. Appropriate urgency level and triage decisions
4. Specific medical recommendations

Respond in this JSON format:
{
  "possibleConditions": [
    {
      "condition": "Most likely diagnosis",
      "probability": 75,
      "description": "Clinical reasoning: explain why this diagnosis fits the presentation, including pathophysiology and epidemiological factors"
    },
    {
      "condition": "Second differential",
      "probability": 60,
      "description": "Clinical reasoning for this alternative diagnosis"
    },
    {
      "condition": "Third consideration",
      "probability": 35,
      "description": "Why this should be in the differential diagnosis"
    }
  ],
  "recommendations": [
    "Primary clinical recommendation",
    "Specific diagnostic steps if needed",
    "Treatment or management advice",
    "Follow-up instructions",
    "Red flag symptoms to watch for"
  ],
  "urgencyLevel": "emergency|high|medium|low",
  "clinicalNotes": {
    "chiefComplaint": "Brief summary of presenting symptoms",
    "assessment": "Primary clinical impression",
    "plan": "Recommended next steps"
  },
  "disclaimer": "This AI analysis is for educational purposes and does not replace professional medical evaluation. Please consult with a qualified healthcare provider for diagnosis and treatment."
}

Consider epidemiology, pathophysiology, clinical guidelines, and red flag symptoms in your analysis. Prioritize patient safety and appropriate care escalation.`;
  }

  parseMedicalAnalysis(responseText) {
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonText);
        parsed.analysisMethod = 'ai-medical-doctor';
        return parsed;
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing medical analysis:', error);
      return this.getComprehensiveDefaultAnalysis();
    }
  }

  getComprehensiveDefaultAnalysis() {
    return {
      possibleConditions: [
        {
          condition: "Common Medical Condition",
          probability: 65,
          description: "Based on the symptoms provided, this appears to be a common medical condition that would benefit from professional medical evaluation for proper diagnosis and treatment planning."
        },
        {
          condition: "Alternative Diagnosis",
          probability: 35,
          description: "Alternative medical conditions should be considered in the differential diagnosis. A healthcare provider can perform appropriate clinical assessment."
        }
      ],
      recommendations: [
        '🏥 Consult with a healthcare professional for comprehensive evaluation and diagnosis',
        '📊 Consider appropriate diagnostic testing as recommended by your healthcare provider', 
        '💊 Follow medical advice regarding treatment and management',
        '📞 Seek immediate medical attention if symptoms worsen or new concerning symptoms develop',
        '📝 Maintain a detailed symptom log including timing, severity, and any triggers',
        '🏠 Focus on supportive care including rest, hydration, and stress management'
      ],
      urgencyLevel: 'medium',
      clinicalNotes: {
        chiefComplaint: 'Patient reports multiple symptoms requiring medical evaluation',
        assessment: 'Symptoms require professional medical assessment for accurate diagnosis',
        plan: 'Recommend consultation with healthcare provider for evaluation and management'
      },
      disclaimer: 'This analysis is provided by an AI medical assistant for educational purposes only. It does not constitute medical advice and should not replace consultation with a qualified healthcare provider.',
      analysisMethod: 'comprehensive-default'
    };
  }
}

module.exports = MedicalAIDoctor;
