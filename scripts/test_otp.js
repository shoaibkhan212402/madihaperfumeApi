import fetch from 'node-fetch';

const testOTP = async () => {
  const phone = '9999999999'; // Test number
  const url = 'http://localhost:5000/api/users/whatsapp-login';

  console.log(`🚀 Sending test OTP request to ${url} for phone: ${phone}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    
    if (res.ok) {
      console.log('✅ Test API Request Succeeded!');
      console.log('Response:', data);
      console.log('\n👉 Check the backend terminal to see if Baileys attempted to send the OTP via WhatsApp!');
    } else {
      console.error('❌ Test API Request Failed!');
      console.error('Status:', res.status);
      console.error('Error Response:', data);
    }
  } catch (err) {
    console.error('❌ Failed to connect to server. Make sure it is running on port 5000.', err.message);
  }
};

testOTP();
