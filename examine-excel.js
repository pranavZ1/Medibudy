const xlsx = require('xlsx');

// Quick script to examine the Excel file structure
try {
  const workbook = xlsx.readFile('./Best Hospitals in India - .xlsx');
  const sheetName = workbook.SheetNames[0];
  console.log('Sheet name:', sheetName);
  
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); // Get raw data with headers
  
  console.log('\nFirst few rows:');
  data.slice(0, 5).forEach((row, index) => {
    console.log(`Row ${index}:`, row);
  });
  
  console.log('\nColumn headers (if first row):');
  if (data[0]) {
    data[0].forEach((header, index) => {
      console.log(`Column ${index}: "${header}"`);
    });
  }
  
  console.log('\nTotal rows:', data.length);
  
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}
