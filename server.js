const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // For simple HTML UI

// === DARAJA CONFIG (USE SANDBOX CREDENTIALS) ===
const CONSUMER_KEY = 'rQGpZYIle1QGx1sQJLyPFGONmpLMOI8Pu4S2rUpaV2Fp4xcI';
const CONSUMER_SECRET = 'sA8lVk0wocgfRzHxwwRroAdRXhEpJEBOqvyGZz2kgtNkGLmeWoQDtGvrmYDWAx4r';
const SHORTCODE = '174379';
const PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://webhook.site/f18d153e-d9f6-4382-b6e1-dc05c1e2b659'; // From webhook.site

// Mock parking sessions (in real app: use DB)
const sessions = {
  'PARK-2024-001': { entry: new Date(Date.now() - 7200000) } // 2 hours ago
};

// Get M-Pesa access token
async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const res = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  });
  return res.data.access_token;
}

// Calculate fee (KES 50 per hour)
function calculateFee(sessionId) {
  const session = sessions[sessionId];
  if (!session) return null;
  const hours = (Date.now() - session.entry.getTime()) / 3600000;
  return Math.ceil(hours) * 50;
}

// STK Push endpoint
app.post('/pay', async (req, res) => {
  const { session_id, phone } = req.body; // phone: "0712345678"
  
  const fee = calculateFee(session_id);
  if (!fee) return res.status(400).json({ error: 'Invalid session' });

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = crypto.createHash('sha256').update(SHORTCODE + PASSKEY + timestamp).digest('base64');
  const accessToken = await getAccessToken();

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: fee,
    PartyA: '254' + phone.substring(1), // Convert 07... to 2547...
    PartyB: SHORTCODE,
    PhoneNumber: '254' + phone.substring(1),
    CallBackURL: CALLBACK_URL,
    AccountReference: session_id,
    TransactionDesc: 'Parking Fee'
  };

  try {
    await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    res.json({ success: true, message: 'STK Push sent!', fee });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// Simulate gate open (call this from your Daraja callback later)
app.post('/open-gate', (req, res) => {
  // In real app: verify payment first!
  if (require.main === module) {
    console.log("🟢 GATE OPENED (simulated)");
  } else {
    require('./hardware').openGate();
  }
  res.json({ status: 'gate opened' });
});

// Simple UI
app.get('/', (req, res) => {
  res.send(`
    <h2>SmartPark KE – Prototype</h2>
    <p>Scan ticket → Enter phone → Pay via M-Pesa</p>
    <input id="phone" placeholder="0712345678" />
    <button onclick="pay()">Pay Now</button>
    <script>
      async function pay() {
        const phone = document.getElementById('phone').value;
        const res = await fetch('/pay', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ session_id: 'PARK-2024-001', phone })
        });
        const data = await res.json();
        alert(data.message || data.error);
      }
    </script>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));   