// Script to regenerate demo data using the improved functions
const fetch = require('node-fetch');

async function regenerateDemo() {
  try {
    // Get a valid admin token from localStorage simulation
    const token = process.env.DEMO_ADMIN_TOKEN;
    
    if (!token) {
      console.log('Using mock auth - calling endpoint without strict auth');
      
      // Make request directly to generate demo data endpoint
      const response = await fetch('http://localhost:5000/api/demo-data/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-demo'
        }
      });
      
      const result = await response.text();
      console.log('Demo generation result:', result);
    }
  } catch (error) {
    console.error('Error regenerating demo:', error);
  }
}

regenerateDemo();