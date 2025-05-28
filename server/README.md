
# Voice Assistant Backend

Express.js backend server with WebSocket support and OpenAI Realtime API integration.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

## Running the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

- `GET /health` - Health check and connection count
- `POST /video-control` - Broadcast video commands to all clients
- `WebSocket /ws` - Main WebSocket endpoint for voice communication

## Video Control Commands

The assistant can understand and execute these voice commands:

- **Play**: "play", "start the video"
- **Pause**: "pause", "stop the video"
- **Volume**: "volume up", "volume down", "increase volume", "decrease volume"
- **Mute**: "mute", "unmute"
- **Seek**: "restart", "go to beginning"
- **Fullscreen**: "fullscreen"
- **Load Video**: "load video [URL]"

## Features

- Real-time audio streaming between frontend and OpenAI
- Automatic voice activity detection
- Video player control via voice commands
- WebSocket connection management
- Error handling and reconnection logic
- Health monitoring endpoint

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3001)

## WebSocket Message Types

### From Client:
- Binary audio data (microphone input)
- JSON messages for control

### To Client:
- Binary audio data (OpenAI response)
- `response_start` - AI started responding
- `response_end` - AI finished responding  
- `video_control` - Video player commands
- `error` - Error messages
