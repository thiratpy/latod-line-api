// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js'); // ✅ Corrected this line
const cors = require('cors');

// --- Initialize App & Supabase ---
const app = express();
// No port needed for Vercel

// Use CORS to allow requests from any origin
app.use(cors());

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Check if credentials are provided
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase URL or Key is missing.");
  // Don't exit process in serverless, just log the error
}

// Create a single Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

app.get("/", (req, res) => {
    res.json({ message: "API is working! Welcome." });
});

// --- The API Endpoint ---
app.get('/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('farm_status')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error("DB Error:", error.message);
      return res.status(500).type('text/plain').send('😵 Oops! Could not fetch data from the database.');
    }

    if (!data) {
      return res.status(404).type('text/plain').send('🤔 Hmm, no data found.');
    }

    const now = new Date();
    const date = now.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" });
    const time = now.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour12: true });

    const message = `
🌊 **Latod Farm Status Update** ✨

🗓️ วันที่: ${date}
⏰ เวลา: ${time}

- - - - - - - - - - - - -

🌡️ อุณหภูมิ: ${data.temp}°C
💧 ค่าความเค็ม: ${data.salinity} ppt
🧪 pH: ${data.ph}
☀️ ค่าความสว่าง: ${data.lux} lux
⚡️ ค่าความนำไฟฟ้า: ${data.conductivity} µS/cm

- - - - - - - - - - - - -

Status: Everything looks OK! ✅🤙
    `.trim();

    res.status(200).type('text/plain').send(message);

  } catch (e) {
    console.error("Server Error:", e.message);
    res.status(500).type('text/plain').send('💀 Oh no! A wild server error appeared.');
  }
});

app.get('/echo', (req, res) => {
  console.log('Received a request!');

  // Construct a response object with all the juicy details from the request
  const responseObject = {
    message: "🤙 Echo successful!",
    method: req.method,
    query_params: req.query,
    body: req.body,
    headers: req.headers,
  };

  // Send the response object back to the client as JSON
  res.status(200).json(responseObject);
});

// --- Export the app for Vercel ---
// DO NOT USE app.listen()
module.exports = app;