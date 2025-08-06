
import express from 'express';
import axios from 'axios';
import mqtt from 'mqtt'; // 
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

const EXISTING_CHATBOT_WEBHOOK_URL = process.env.EXISTING_CHATBOT_WEBHOOK_URL;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = process.env.MQTT_TOPIC;

const LINE_API_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';

app.use(express.json());


// =================================================================
// PART 1: WEBHOOK FORWARDER (Unchanged) 📲 ➡️ 🤖
// Forwards user messages to your existing chatbot.
// =================================================================
app.post('/webhook', async (req, res) => {
    console.log('Received webhook from LINE. Forwarding now...');
    const lineSignature = req.headers['x-line-signature'];
    try {
        await axios.post(EXISTING_CHATBOT_WEBHOOK_URL, req.body, {
            headers: { 'Content-Type': 'application/json', 'X-Line-Signature': lineSignature }
        });
        console.log('Successfully forwarded webhook to:', EXISTING_CHATBOT_WEBHOOK_URL);
    } catch (error) {
        console.error('Error forwarding webhook:', error.message);
    }
    res.status(200).send('OK');
});


// =================================================================
// PART 2: THE MQTT-POWERED BROADCASTER 📢 ➡️ 👥
// This sends a message to ALL your OA followers.
// =================================================================
async function sendBroadcastMessage(message) {
    console.log(`Broadcasting message to all users: "${message}"`);
    try {
        await axios.post(LINE_API_BROADCAST_URL, {
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
        console.log('✅ Broadcast sent successfully!');
    } catch (error) {
        console.error('❌ Error sending broadcast:', error.response ? error.response.data : error.message);
    }
}


// =================================================================
// PART 3: CONNECT TO HIVEMQ AND LISTEN 📡
// This section connects to your MQTT broker and waits for messages.
// =================================================================
if (!MQTT_BROKER_URL) {
    console.warn('⚠️ MQTT_BROKER_URL is not set. MQTT client will not start.');
} else {
    console.log('Connecting to MQTT Broker...');
    const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD
    });

    mqttClient.on('connect', () => {
        console.log('✅ Successfully connected to HiveMQ Broker!');
        // Subscribe to the topic once connected
        mqttClient.subscribe(MQTT_TOPIC, (err) => {
            if (!err) {
                console.log(`📡 Subscribed to topic: ${MQTT_TOPIC}`);
            } else {
                console.error('❌ MQTT Subscription error:', err);
            }
        });
    });

    // This is the magic part ✨
    mqttClient.on('message', (topic, payload) => {
        const message = payload.toString();
        console.log(`Received message from MQTT topic "${topic}": ${message}`);
        
        // When a message comes in, broadcast it to all LINE users
        sendBroadcastMessage(message);
    });

    mqttClient.on('error', (err) => {
        console.error('❌ MQTT Connection Error:', err);
    });
}

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server is vibin' on port ${PORT}`);
    console.log('Proxy is live at /webhook.');
});