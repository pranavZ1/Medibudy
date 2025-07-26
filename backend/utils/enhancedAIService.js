const { GoogleGenerativeAI } = require('@google/generative-ai');

class EnhancedAIService {
  constructor() {
    // Initialize Gemini if API key is available
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
      try {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.aiAvailable = true;
      } catch (error) {
        console.warn('Gemini AI initialization failed, using rule-based system:', error.message);
        this.aiAvailable = false;
      }
    } else {
      console.warn('No valid Gemini API key found, using rule-based medical analysis');
      this.aiAvailable = false;
    }

    // Medical knowledge base for rule-based analysis
    this.medicalKnowledge = this.initializeMedicalKnowledge();
  }

  initializeMedicalKnowledge() {
    return {
      symptoms: {
        'fever': {
          commonConditions: [
            { condition: 'Viral Infection', probability: 60, urgency: 'low' },
            { condition: 'Bacterial Infection', probability: 30, urgency: 'medium' },
            { condition: 'Influenza', probability: 25, urgency: 'low' }
          ],
          urgencyFactors: ['high fever (>102°F)', 'persistent fever', 'fever with rash']
        },
        'headache': {
          commonConditions: [
            { condition: 'Tension Headache', probability: 50, urgency: 'low' },
            { condition: 'Migraine', probability: 30, urgency: 'medium' },
            { condition: 'Sinus Infection', probability: 20, urgency: 'low' }
          ],
          urgencyFactors: ['severe sudden onset', 'headache with vision changes', 'headache with fever']
        },
        'fatigue': {
          commonConditions: [
            { condition: 'Viral Infection', probability: 40, urgency: 'low' },
            { condition: 'Sleep Deprivation', probability: 35, urgency: 'low' },
            { condition: 'Stress/Anxiety', probability: 25, urgency: 'low' }
          ],
          urgencyFactors: ['extreme fatigue', 'fatigue with chest pain', 'fatigue with shortness of breath']
        },
        'cough': {
          commonConditions: [
            { condition: 'Common Cold', probability: 50, urgency: 'low' },
            { condition: 'Bronchitis', probability: 30, urgency: 'medium' },
            { condition: 'Allergies', probability: 20, urgency: 'low' }
          ],
          urgencyFactors: ['coughing up blood', 'difficulty breathing', 'persistent cough >3 weeks']
        },
        'sore throat': {
          commonConditions: [
            { condition: 'Viral Infection', probability: 60, urgency: 'low' },
            { condition: 'Strep Throat', probability: 25, urgency: 'medium' },
            { condition: 'Allergies', probability: 15, urgency: 'low' }
          ],
          urgencyFactors: ['difficulty swallowing', 'severe throat pain', 'throat pain with fever']
        },
        'nausea': {
          commonConditions: [
            { condition: 'Gastroenteritis', probability: 40, urgency: 'low' },
            { condition: 'Food Poisoning', probability: 30, urgency: 'medium' },
            { condition: 'Motion Sickness', probability: 20, urgency: 'low' }
          ],
          urgencyFactors: ['severe dehydration', 'blood in vomit', 'severe abdominal pain']
        },
        'diarrhea': {
          commonConditions: [
            { condition: 'Gastroenteritis', probability: 45, urgency: 'low' },
            { condition: 'Food Poisoning', probability: 35, urgency: 'medium' },
            { condition: 'Medication Side Effect', probability: 20, urgency: 'low' }
          ],
          urgencyFactors: ['blood in stool', 'severe dehydration', 'high fever with diarrhea']
        },
        'chest pain': {
          commonConditions: [
            { condition: 'Muscle Strain', probability: 40, urgency: 'low' },
            { condition: 'Acid Reflux', probability: 30, urgency: 'low' },
            { condition: 'Anxiety', probability: 20, urgency: 'low' }
          ],
          urgencyFactors: ['severe chest pain', 'chest pain with shortness of breath', 'radiating pain to arm/jaw']
        },
        'shortness of breath': {
          commonConditions: [
            { condition: 'Asthma', probability: 35, urgency: 'medium' },
            { condition: 'Anxiety', probability: 25, urgency: 'low' },
            { condition: 'Upper Respiratory Infection', probability: 20, urgency: 'low' }
          ],
          urgencyFactors: ['severe breathing difficulty', 'blue lips/fingernails', 'chest pain with breathing']
        },
        'rash': {
          commonConditions: [
            { condition: 'Contact Dermatitis', probability: 40, urgency: 'low' },
            { condition: 'Eczema', probability: 30, urgency: 'low' },
            { condition: 'Allergic Reaction', probability: 25, urgency: 'medium' }
          ],
          urgencyFactors: ['widespread rash', 'rash with fever', 'difficulty breathing with rash']
        }
      },

      combinationPatterns: {
        'fever,headache,fatigue': [
          { condition: 'Viral Infection (Common Cold/Flu)', probability: 75, urgency: 'low' },
          { condition: 'COVID-19', probability: 15, urgency: 'medium' },
          { condition: 'Bacterial Infection', probability: 10, urgency: 'medium' }
        ],
        'fever,cough,fatigue': [
          { condition: 'Respiratory Viral Infection', probability: 70, urgency: 'low' },
          { condition: 'Bronchitis', probability: 20, urgency: 'medium' },
          { condition: 'Pneumonia', probability: 10, urgency: 'high' }
        ],
        'headache,nausea,fatigue': [
          { condition: 'Migraine', probability: 50, urgency: 'medium' },
          { condition: 'Tension Headache', probability: 30, urgency: 'low' },
          { condition: 'Dehydration', probability: 20, urgency: 'low' }
        ],
        'chest pain,shortness of breath': [
          { condition: 'Anxiety/Panic Attack', probability: 40, urgency: 'medium' },
          { condition: 'Asthma', probability: 30, urgency: 'medium' },
          { condition: 'Heart-related Issue', probability: 20, urgency: 'high' }
        ],
        'nausea,diarrhea,fatigue': [
          { condition: 'Gastroenteritis', probability: 70, urgency: 'low' },
          { condition: 'Food Poisoning', probability: 25, urgency: 'medium' },
          { condition: 'Stomach Bug', probability: 5, urgency: 'low' }
        ]
      }
    };
  }

  async analyzeSymptoms(symptoms, userInfo = {}) {
    try {
      // First try AI analysis if available
      if (this.aiAvailable) {
        try {
          return await this.geminiAnalysis(symptoms, userInfo);
        } catch (error) {
          console.warn('AI analysis failed, falling back to rule-based system:', error.message);
        }
      }

      // Rule-based analysis as primary or fallback
      return this.ruleBasedAnalysis(symptoms, userInfo);
    } catch (error) {
      console.error('Error in symptom analysis:', error);
      return this.getDefaultSymptomsAnalysis();
    }
  }

  async geminiAnalysis(symptoms, userInfo) {
    const prompt = this.buildEnhancedSymptomsPrompt(symptoms, userInfo);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    return this.parseSymptomsAnalysis(response.text());
  }

  ruleBasedAnalysis(symptoms, userInfo) {
    const normalizedSymptoms = symptoms.map(s => 
      typeof s === 'string' ? s.toLowerCase().trim() : s.symptom.toLowerCase().trim()
    );

    // Check for symptom combinations first
    const combinationKey = normalizedSymptoms.sort().join(',');
    let possibleConditions = [];

    // Check exact matches first
    if (this.medicalKnowledge.combinationPatterns[combinationKey]) {
      possibleConditions = this.medicalKnowledge.combinationPatterns[combinationKey];
    } else {
      // Check partial matches for common combinations
      const commonCombinations = Object.keys(this.medicalKnowledge.combinationPatterns);
      for (const combo of commonCombinations) {
        const comboSymptoms = combo.split(',');
        const matchCount = comboSymptoms.filter(symptom => 
          normalizedSymptoms.includes(symptom)
        ).length;
        
        // If we match most symptoms in a combination pattern
        if (matchCount >= comboSymptoms.length - 1 && matchCount >= 2) {
          possibleConditions = this.medicalKnowledge.combinationPatterns[combo];
          break;
        }
      }
    }

    // If no combination found, analyze individual symptoms
    if (possibleConditions.length === 0) {
      const conditionScores = {};
      
      normalizedSymptoms.forEach(symptom => {
        const symptomData = this.medicalKnowledge.symptoms[symptom];
        if (symptomData) {
          symptomData.commonConditions.forEach(condition => {
            if (!conditionScores[condition.condition]) {
              conditionScores[condition.condition] = {
                condition: condition.condition,
                probability: 0,
                urgency: condition.urgency,
                description: `Based on reported symptoms including: ${symptom}`
              };
            }
            conditionScores[condition.condition].probability += condition.probability;
          });
        }
      });

      // Convert to array and normalize probabilities
      possibleConditions = Object.values(conditionScores)
        .map(condition => ({
          ...condition,
          probability: Math.min(condition.probability / normalizedSymptoms.length, 85)
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 4);
    }

    // Determine overall urgency level
    const urgencyLevel = this.determineUrgencyLevel(normalizedSymptoms, userInfo);

    // Generate recommendations
    const recommendations = this.generateRecommendations(normalizedSymptoms, urgencyLevel);

    return {
      possibleConditions: possibleConditions.map(condition => ({
        condition: condition.condition,
        probability: Math.round(condition.probability),
        description: condition.description || `Symptoms match common patterns for ${condition.condition}.`
      })),
      recommendations,
      urgencyLevel,
      disclaimer: 'This analysis is based on medical knowledge patterns and is for educational purposes only. Always consult a healthcare professional for proper diagnosis and treatment.',
      analysisMethod: this.aiAvailable ? 'hybrid' : 'rule-based'
    };
  }

  determineUrgencyLevel(symptoms, userInfo) {
    const highUrgencySymptoms = [
      'chest pain', 'shortness of breath', 'severe headache', 'blood', 'difficulty breathing'
    ];
    
    const mediumUrgencySymptoms = [
      'fever', 'severe pain', 'persistent symptoms'
    ];

    // Check for high urgency indicators
    if (symptoms.some(symptom => 
      highUrgencySymptoms.some(urgent => symptom.includes(urgent.toLowerCase()))
    )) {
      return 'high';
    }

    // Check for medium urgency indicators
    if (symptoms.some(symptom => 
      mediumUrgencySymptoms.some(medium => symptom.includes(medium.toLowerCase()))
    )) {
      return 'medium';
    }

    return 'low';
  }

  generateRecommendations(symptoms, urgencyLevel) {
    const baseRecommendations = [
      'Consult a healthcare professional for proper diagnosis and treatment',
      'Monitor your symptoms and note any changes or worsening',
      'Stay hydrated and get adequate rest',
      'Keep a symptom diary noting timing, triggers, and severity'
    ];

    if (urgencyLevel === 'high') {
      return [
        'Seek immediate medical attention or call emergency services',
        'Do not delay medical care for these symptoms',
        ...baseRecommendations
      ];
    } else if (urgencyLevel === 'medium') {
      return [
        'Schedule an appointment with your doctor within 24-48 hours',
        'Contact your healthcare provider if symptoms worsen',
        ...baseRecommendations
      ];
    } else {
      return [
        ...baseRecommendations,
        'Consider over-the-counter remedies if appropriate',
        'Focus on rest and self-care measures'
      ];
    }
  }

  buildEnhancedSymptomsPrompt(symptoms, userInfo) {
    const additionalInfo = userInfo.additionalInfo || '';
    
    const symptomsText = Array.isArray(symptoms) 
      ? symptoms.map(s => typeof s === 'string' ? `- ${s}` : `- ${s.symptom}: Severity ${s.severity}/10, Duration: ${s.duration}, Frequency: ${s.frequency}`).join('\n')
      : `- ${symptoms}`;
    
    return `
You are a highly skilled medical AI assistant with expertise in symptom analysis and differential diagnosis. Analyze the following symptoms and provide a comprehensive medical assessment.

Symptoms reported:
${symptomsText}

Additional Information: ${additionalInfo}

INSTRUCTIONS:
1. Provide a thorough analysis considering common conditions first, then less common possibilities
2. Consider symptom combinations and patterns
3. Assess urgency level based on symptom severity and combinations
4. Provide probability percentages based on clinical likelihood
5. Include educational information about each condition
6. Always emphasize the need for professional medical consultation

Respond in this exact JSON format:
{
  "possibleConditions": [
    {
      "condition": "Most likely condition name",
      "probability": 75,
      "description": "Detailed explanation of why this condition matches the symptoms, including typical presentation and diagnostic considerations"
    },
    {
      "condition": "Second most likely condition",
      "probability": 60,
      "description": "Explanation for this potential condition with clinical reasoning"
    },
    {
      "condition": "Third possibility",
      "probability": 35,
      "description": "Why this condition should be considered based on the symptoms"
    }
  ],
  "recommendations": [
    "Primary recommendation for next steps",
    "Monitoring and self-care advice",
    "When to seek urgent care",
    "Specific suggestions based on symptoms"
  ],
  "urgencyLevel": "low|medium|high|emergency",
  "disclaimer": "This AI analysis is for educational and informational purposes only. It does not constitute medical advice and should not replace consultation with a qualified healthcare provider. Always seek professional medical advice for diagnosis and treatment."
}`;
  }

  parseSymptomsAnalysis(responseText) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonText);
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing symptoms analysis:', error);
      return this.getDefaultSymptomsAnalysis();
    }
  }

  getDefaultSymptomsAnalysis() {
    return {
      possibleConditions: [
        {
          condition: "Common Medical Condition",
          probability: 60,
          description: "Based on the symptoms provided, this appears to be a common medical condition. A healthcare professional can provide proper evaluation and diagnosis."
        },
        {
          condition: "Alternative Possibility",
          probability: 40,
          description: "Alternative conditions should also be considered. Professional medical evaluation is recommended for accurate diagnosis."
        }
      ],
      recommendations: [
        'Consult a healthcare professional for proper diagnosis and treatment',
        'Monitor your symptoms and note any changes or progression',
        'Stay hydrated and get adequate rest',
        'Seek medical attention if symptoms worsen or new symptoms develop',
        'Keep a symptom diary with timing, triggers, and severity levels'
      ],
      urgencyLevel: 'medium',
      disclaimer: 'This analysis is for educational purposes only. Please consult a qualified healthcare provider for proper diagnosis and treatment.',
      analysisMethod: 'default'
    };
  }

  // Keep other methods for compatibility
  async recommendTreatments(diagnosis, symptoms, userInfo = {}) {
    // Implementation for treatment recommendations
    return this.getDefaultTreatmentRecommendations();
  }

  async analyzeMedicalReport(reportText, reportType) {
    // Implementation for medical report analysis
    return this.getDefaultReportAnalysis();
  }

  getDefaultTreatmentRecommendations() {
    return {
      primaryTreatments: [],
      alternativeTreatments: [],
      lifestyle: ['Maintain a healthy diet', 'Exercise regularly', 'Get adequate sleep'],
      warning: 'Treatment recommendations require professional medical consultation.'
    };
  }

  getDefaultReportAnalysis() {
    return {
      summary: 'Report analysis requires professional medical review',
      keyFindings: [],
      abnormalValues: [],
      recommendations: ['Consult with your healthcare provider'],
      urgency: 'medium',
      warning: 'Please discuss these results with your healthcare provider'
    };
  }
}

module.exports = EnhancedAIService;
