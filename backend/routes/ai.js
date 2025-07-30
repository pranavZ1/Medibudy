const express = require('express');
const EnhancedAIService = require('../utils/enhancedAIService');
const MedicalAIDoctor = require('../utils/medicalAIDoctor');
const Consultation = require('../models/Consultation');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const aiService = new EnhancedAIService();
const medicalDoctor = new MedicalAIDoctor();

// Start new consultation
router.post('/consultation', verifyToken, async (req, res) => {
  try {
    const { type, userConsent } = req.body;

    if (!userConsent || !userConsent.dataProcessing || !userConsent.aiAnalysis) {
      return res.status(400).json({ error: 'User consent is required for AI analysis' });
    }

    const consultation = new Consultation({
      user: req.userId,
      type,
      userConsent: {
        ...userConsent,
        consentDate: new Date()
      },
      status: 'active'
    });

    await consultation.save();

    res.status(201).json({
      message: 'Consultation started successfully',
      consultationId: consultation._id
    });
  } catch (error) {
    console.error('Consultation creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze symptoms
router.post('/analyze-symptoms', verifyToken, async (req, res) => {
  try {
    const { consultationId, symptoms, medicalHistory, userInfo } = req.body;

    // Find consultation
    const consultation = await Consultation.findOne({
      _id: consultationId,
      user: req.userId,
      status: 'active'
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found or inactive' });
    }

    // Update consultation with symptoms
    consultation.symptoms = symptoms;
    if (medicalHistory) {
      consultation.medicalHistory = medicalHistory;
    }

    // AI Analysis
    const analysis = await aiService.analyzeSymptoms(symptoms, userInfo);
    
    consultation.aiAnalysis = {
      ...analysis,
      generatedAt: new Date()
    };

    await consultation.save();

    res.json({
      message: 'Symptoms analyzed successfully',
      analysis: consultation.aiAnalysis
    });
  } catch (error) {
    console.error('Symptoms analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze symptoms' });
  }
});

// Get treatment recommendations
router.post('/recommend-treatments', verifyToken, async (req, res) => {
  try {
    const { consultationId, selectedCondition, userInfo } = req.body;

    const consultation = await Consultation.findOne({
      _id: consultationId,
      user: req.userId,
      status: 'active'
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found or inactive' });
    }

    const recommendations = await aiService.recommendTreatments(
      selectedCondition,
      consultation.symptoms,
      userInfo
    );

    // Add to conversation history
    consultation.conversationHistory.push({
      role: 'ai',
      message: `Treatment recommendations for ${selectedCondition}`,
      timestamp: new Date(),
      metadata: { recommendations }
    });

    await consultation.save();

    res.json({
      message: 'Treatment recommendations generated',
      recommendations
    });
  } catch (error) {
    console.error('Treatment recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate treatment recommendations' });
  }
});

// Analyze medical report
router.post('/analyze-report', verifyToken, async (req, res) => {
  try {
    const { consultationId, reportText, reportType } = req.body;

    const consultation = await Consultation.findOne({
      _id: consultationId,
      user: req.userId,
      status: 'active'
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found or inactive' });
    }

    if (!consultation.userConsent.reportAnalysis) {
      return res.status(400).json({ error: 'Report analysis consent not provided' });
    }

    const analysis = await aiService.analyzeMedicalReport(reportText, reportType);

    // Add report to consultation
    consultation.reports.push({
      type: reportType,
      name: `Report - ${new Date().toLocaleDateString()}`,
      uploadDate: new Date(),
      analysis: JSON.stringify(analysis)
    });

    await consultation.save();

    res.json({
      message: 'Medical report analyzed successfully',
      analysis
    });
  } catch (error) {
    console.error('Report analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze medical report' });
  }
});

// Get surgery options
router.post('/surgery-options', verifyToken, async (req, res) => {
  try {
    const { consultationId, condition, patientProfile } = req.body;

    const consultation = await Consultation.findOne({
      _id: consultationId,
      user: req.userId,
      status: 'active'
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found or inactive' });
    }

    const surgeryOptions = await aiService.suggestSurgeryOptions(condition, patientProfile);

    // Add to conversation history
    consultation.conversationHistory.push({
      role: 'ai',
      message: `Surgery options for ${condition}`,
      timestamp: new Date(),
      metadata: { surgeryOptions }
    });

    await consultation.save();

    res.json({
      message: 'Surgery options generated',
      surgeryOptions
    });
  } catch (error) {
    console.error('Surgery options error:', error);
    res.status(500).json({ error: 'Failed to generate surgery options' });
  }
});

// Chat with AI
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { consultationId, message } = req.body;

    const consultation = await Consultation.findOne({
      _id: consultationId,
      user: req.userId,
      status: 'active'
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found or inactive' });
    }

    // Add user message to history
    consultation.conversationHistory.push({
      role: 'user',
      message: message,
      timestamp: new Date()
    });

    // Generate AI response (simplified - you can enhance this)
    const aiResponse = `Thank you for your message: "${message}". Based on our previous analysis, I recommend continuing with the suggested treatment plan. Please consult with a healthcare professional for detailed guidance.`;

    // Add AI response to history
    consultation.conversationHistory.push({
      role: 'ai',
      message: aiResponse,
      timestamp: new Date()
    });

    await consultation.save();

    res.json({
      message: 'Message sent successfully',
      response: aiResponse
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat failed' });
  }
});

// Get consultation history
router.get('/consultations', verifyToken, async (req, res) => {
  try {
    const consultations = await Consultation.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .populate('treatmentOptions.treatment')
      .populate('hospitalRecommendations.hospital');

    res.json({ consultations });
  } catch (error) {
    console.error('Consultation history error:', error);
    res.status(500).json({ error: 'Failed to fetch consultation history' });
  }
});

// Get specific consultation
router.get('/consultation/:id', verifyToken, async (req, res) => {
  try {
    const consultation = await Consultation.findOne({
      _id: req.params.id,
      user: req.userId
    })
    .populate('treatmentOptions.treatment')
    .populate('hospitalRecommendations.hospital');

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    res.json({ consultation });
  } catch (error) {
    console.error('Consultation fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
});

// Simple symptom analysis (no auth required) - Enhanced Medical AI
router.post('/analyze-symptoms-simple', async (req, res) => {
  try {
    console.log('=== SYMPTOM ANALYSIS REQUEST ===');
    console.log('Request received:', req.method, req.url);
    console.log('Request origin:', req.get('Origin'));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request body type:', typeof req.body);
    
    const { symptoms, additionalInfo } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      console.log('Invalid symptoms provided:', symptoms);
      return res.status(400).json({ error: 'Please provide at least one symptom' });
    }

    console.log('Analyzing symptoms with Medical AI Doctor:', symptoms);

    // Use Medical AI Doctor for comprehensive analysis
    const analysis = await medicalDoctor.analyzeSymptoms(symptoms, { additionalInfo });

    console.log('Analysis completed successfully');
    res.json({
      message: 'Medical analysis completed successfully',
      analysis: analysis
    });
  } catch (error) {
    console.error('Medical AI analysis error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to analyze symptoms',
      details: error.message,
      analysis: medicalDoctor.getComprehensiveDefaultAnalysis()
    });
  }
});

module.exports = router;
