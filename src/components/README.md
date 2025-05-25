
# Voice Assistant Frontend

This React application provides a real-time voice assistant interface that connects to an Express.js backend using WebSockets and OpenAI's Realtime API.

## Backend Setup Required

To complete this application, you'll need to set up an Express.js backend with the following features:

### 1. WebSocket Server Setup
```javascript
const WebSocket = require('ws');
const express = require('express');
const app = express();
const server = require('http').createServer(app);

const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

server.listen(3001, () => {
  console.log('Server running on port 3001');
});
```

### 2. OpenAI Realtime API Integration
You'll need to:
- Install the OpenAI SDK: `npm install openai`
- Set up your OpenAI API key in environment variables
- Connect to OpenAI's Realtime API endpoint
- Handle audio streaming between the frontend and OpenAI

### 3. WebSocket Message Handling
The backend should handle:
- Incoming audio data from the frontend
- Forwarding audio to OpenAI Realtime API
- Streaming OpenAI's audio responses back to the frontend
- Connection management and error handling

### 4. Environment Variables
Create a `.env` file in your backend:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

## Frontend Features

- **Real-time Audio Recording**: Uses the Web Audio API to capture microphone input
- **WebSocket Communication**: Establishes persistent connection with the backend
- **Audio Playback**: Plays assistant responses using the Web Audio API
- **Visual Feedback**: Shows recording state, connection status, and assistant state
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful error handling and user feedback

## Usage

1. Click "Connect" to establish WebSocket connection with the backend
2. Click the microphone button to start recording
3. Speak your message
4. Click again to stop recording and send to the assistant
5. Listen to the assistant's audio response

## WebSocket URL Configuration

Update the WebSocket URL in `src/services/WebSocketService.tsx`:
- Development: `ws://localhost:3001/ws`
- Production: `wss://your-backend-url.com/ws`
