const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../.env' });

async function testGeminiAPI() {
  try {
    console.log('Testing Gemini API...');
    console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not found');
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // First, let's list available models
    console.log('Listing available models...');
    try {
      const models = await genAI.listModels();
      console.log('Available models:');
      models.forEach(model => {
        console.log(`- ${model.name}`);
      });
    } catch (listError) {
      console.log('Could not list models:', listError.message);
    }
    
    // Try the newer model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
You are a medical AI assistant. Analyze these symptoms: headache, fever, fatigue.

Respond in this JSON format:
{
  "possibleConditions": [
    {
      "condition": "Common Cold",
      "probability": 70,
      "description": "These symptoms commonly indicate a viral infection"
    }
  ],
  "recommendations": ["Consult a healthcare professional"],
  "urgencyLevel": "low",
  "disclaimer": "This is for educational purposes only"
}
`;
    
    console.log('Sending request to Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    console.log('Raw response:', response.text());
    
    // Try to parse JSON
    const jsonMatch = response.text().match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
    } else {
      console.log('No JSON found in response');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testGeminiAPI();
