# MediBudy - AI-Powered Medical Assistant

A comprehensive MERN stack medical application with AI-powered symptom analysis and hospital finder features.

## Features

### 🔬 AI Symptom Checker
- Advanced symptom analysis using Google Gemini AI
- Comprehensive medical assessments with probability scores
- Clinical reasoning and urgency level evaluation
- Professional medical recommendations

### 🏥 Hospital Finder
- Location-based hospital search
- Comprehensive database of 100+ hospitals across Indian cities
- Treatment-specific hospital recommendations
- Real-time location services

### 👨‍⚕️ Doctor Directory
- Database of 340+ verified doctors
- Specialty-wise doctor search
- Location-based doctor finder

### 🎯 Treatment Search
- Comprehensive treatment database
- Condition-specific treatment recommendations
- Evidence-based medical information

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **Google Gemini AI** for medical analysis
- **JWT** authentication
- **CORS** and security middleware
- **Rate limiting** for API protection

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** icons
- **Axios** for API calls
- **React Router** for navigation

### AI & Medical Intelligence
- **Google Gemini 1.5-flash** model
- Advanced medical reasoning algorithms
- Clinical decision support systems
- Medical knowledge databases

## Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB
- Google Gemini API key

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/medibudy.git
   cd medibudy
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Environment Variables**
   
   Create `.env` file in the root directory:
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   GOOGLE_API_KEY=your_google_gemini_api_key
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

   Create `frontend/.env` file:
   ```env
   REACT_APP_API_URL=http://localhost:5001/api
   ```

## Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   npm start
   ```
   Backend runs on `http://localhost:5001`

2. **Start the frontend server**
   ```bash
   cd frontend
   npm start
   ```
   Frontend runs on `http://localhost:3000`

3. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## API Endpoints

### AI Analysis
- `POST /api/ai/analyze-symptoms-simple` - Analyze symptoms without authentication
- `POST /api/ai/analyze-symptoms` - Full symptom analysis (requires auth)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Hospitals & Doctors
- `GET /api/hospitals` - Get hospitals
- `GET /api/treatments` - Get treatments

### Health Check
- `GET /api/health` - Server health status

## Usage Examples

### Symptom Analysis API
```bash
curl -X POST http://localhost:5001/api/ai/analyze-symptoms-simple \
  -H "Content-Type: application/json" \
  -d '{
    "symptoms": ["headache", "fever", "fatigue"],
    "additionalInfo": "Symptoms started 2 days ago"
  }'
```

## Project Structure

```
medibudy/
├── backend/
│   ├── routes/          # API routes
│   ├── models/          # MongoDB models
│   ├── utils/           # Utility functions & AI services
│   └── middleware/      # Custom middleware
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── App.tsx      # Main app component
│   └── public/          # Static files
├── scrapers/            # Data collection scripts
├── server.js            # Main server file
└── package.json         # Dependencies
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This application is for educational and informational purposes only. It is not intended to replace professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions you may have regarding medical conditions.

## Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ using MERN stack and AI technology
