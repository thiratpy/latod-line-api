// Bro, make sure to run: npm install express axios dotenv
// And create your .env file!

import express from 'express';
import axios from 'axios';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// --- YOUR CONFIG - PULLS FROM .ENV FILE ---
// The chatbot service you already have
const EXISTING_CHATBOT_WEBHOOK_URL = process.env.EXISTING_CHATBOT_WEBHOOK_URL;
// Your channel token for sending push messages
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Middleware to parse JSON bodies
app.use(express.json());


// =================================================================
// 1. WEBHOOK FORWARDER 📲 ➡️ 🤖
// This is the URL you will give to LINE.
// It catches the request and forwards it to your real chatbot.
// =================================================================
app.post('/webhook', async (req, res) => {
    console.log('Received webhook from LINE. Forwarding now...');
    
    // The signature from LINE is important for verification by the target service
    const lineSignature = req.headers['x-line-signature'];

    try {
        // Forward the *exact same request body* to your existing chatbot URL
        await axios.post(EXISTING_CHATBOT_WEBHOOK_URL, req.body, {
            headers: {
                'Content-Type': 'application/json',
                // Pass the signature along so your chatbot service can verify it
                'X-Line-Signature': lineSignature 
            }
        });
        console.log('Successfully forwarded webhook to:', EXISTING_CHATBOT_WEBHOOK_URL);
    } catch (error) {
        // Even if forwarding fails, we don't want LINE to retry.
        // Log the error for debugging.
        console.error('Error forwarding webhook:', error.message);
    }

    // IMPORTANT: Always send a 200 OK back to LINE immediately.
    // This tells LINE "I got the message, we're good".
    // Your abdul.in.th service will handle the actual reply to the user.
    res.status(200).send('OK');
});


// =================================================================
// 2. YOUR AUTO-SENDER SERVICE 📢 ➡️ 👤
// Create a custom endpoint to trigger push messages.
// Make it a POST request to keep it secure.
// =================================================================
app.post('/send-push', async (req, res) => {
    const { userId, message } = req.body; // Expecting { "userId": "...", "message": "..." }

    if (!userId || !message) {
        return res.status(400).json({ error: 'Bruh, send me a userId and a message.' });
    }

    console.log(`Sending push message to ${userId}: "${message}"`);
    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [{
                type: 'text',
                text: message
            }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            }
        });
        console.log('Push message sent successfully.');
        res.status(200).json({ success: true, message: 'Push message sent!' });
    } catch (error) {
        console.error('Error sending push message:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: 'Failed to send push message.' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Proxy server is vibin' on port ${PORT}`);
    console.log('Listening for webhooks at /webhook to forward them.');
    console.log('Ready to send push messages at /send-push.');
});
