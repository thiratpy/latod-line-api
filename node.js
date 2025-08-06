// This one file is all you need for RunPod.
// It does webhook forwarding AND MQTT broadcasting.

import express from 'express';
import axios from 'axios';
import mqtt from 'mqtt';
import 'dotenv/config';

const app = express();
// Use port 3000 inside the container. We'll map it later in RunPod.
const PORT = 3000; 

// --- PULL CONFIG FROM ENVIRONMENT VARIABLES ---
const EXISTING_CHATBOT_WEBHOOK_URL = "https://abdul.in.th/lite/wh/48371714361879/0a6c1cb10d302fb61d37cb626446161d.php";
const LINE_CHANNEL_ACCESS_TOKEN = "Z8FqwHbyE6hfrjgAkvszrmswBU0weCrBa8L31OTD8UEqPhg6rTZOWWa0mehK/f9GlGGfMbqWjoKQCOMfuAu84vqE5t3Eibwf/089I4VciNxk1Rbp2toQuHUJAS5A0WbjNQw5EBESKFPldDTgM14ePAdB04t89/1O/w1cDnyilFU=";
const MQTT_BROKER_URL = "4b900b729fce417cbf4f040c25861074.s1.eu.hivemq.cloud";
const MQTT_USERNAME = "line_oa";
const MQTT_PASSWORD = "Hindnesz123";
const MQTT_TOPIC = "lineoa/broadcast";

const LINE_API_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';

app.use(express.json());

// --- Sanity check endpoint ---
app.get('/', (req, res) => {
    res.send('Server is up and vibin\'! 🤙');
});

// PART 1: WEBHOOK FORWARDER 📲 ➡️ 🤖
app.post('/webhook', async (req, res) => {
    console.log('Received webhook from LINE. Forwarding...');
    const lineSignature = req.headers['x-line-signature'];
    try {
        await axios.post(EXISTING_CHATBOT_WEBHOOK_URL, req.body, {
            headers: { 'Content-Type': 'application/json', 'X-Line-Signature': lineSignature }
        });
        console.log('✅ Successfully forwarded webhook.');
    } catch (error) {
        console.error('❌ Error forwarding webhook:', error.message);
    }
    res.status(200).send('OK');
});

// PART 2: MQTT BROADCASTER FUNCTION 📢 ➡️ 👥
async function sendBroadcastMessage(message) {
    console.log(`Broadcasting message: "${message}"`);
    try {
        await axios.post(LINE_API_BROADCAST_URL, {
            messages: [{ type: 'text', text: message }]
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

// PART 3: CONNECT TO HIVEMQ AND LISTEN 📡
function startMqttClient() {
    if (!MQTT_BROKER_URL || !LINE_CHANNEL_ACCESS_TOKEN) {
        console.error('❌ Critical env vars missing. MQTT client will not start.');
        return;
    }

    console.log('Connecting to HiveMQ Broker...');
    const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        reconnectPeriod: 5000
    });

    mqttClient.on('connect', () => {
        console.log('✅ Connected to HiveMQ!');
        mqttClient.subscribe(MQTT_TOPIC, (err) => {
            if (!err) {
                console.log(`📡 Subscribed to topic: ${MQTT_TOPIC}`);
            } else {
                console.error('❌ MQTT Subscription error:', err);
            }
        });
    });

    mqttClient.on('message', (topic, payload) => {
        const message = payload.toString();
        console.log(`Received message from MQTT topic "${topic}": ${message}`);
        sendBroadcastMessage(message);
    });

    mqttClient.on('error', (err) => console.error('❌ MQTT Connection Error:', err));
    mqttClient.on('close', () => console.log('MQTT connection closed. Reconnecting...'));
}

// START EVERYTHING
app.listen(PORT, () => {
    console.log(`🚀 HTTP server listening on port ${PORT}`);
    console.log('Webhook is live at /webhook.');
    startMqttClient(); // Start the MQTT client after the server is up
});