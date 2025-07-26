const https = require('https');
const http = require('http');

async function testSymptomAPI() {
  const data = JSON.stringify({
    symptoms: ["headache", "fever", "fatigue"],
    additionalInfo: "Symptoms started 2 days ago"
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/analyze-symptoms-simple',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', body);
        resolve(body);
      });
    });

    req.on('error', (err) => {
      console.error('Request Error:', err);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

testSymptomAPI().catch(console.error);
