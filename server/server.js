
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path')
require('dotenv').config();


const app = express();
const port = process.env.PORT || 3001;

// Serve static files from the Vite dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Middleware
app.use(cors());
app.use(express.json());

// Handle SPA routing (e.g., React Router or Vue Router in history mode)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws_recall'
});

// Store active connections
const connections = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const connectionId = Math.random().toString(36).substring(7);
  console.log(`New WebSocket connection: ${connectionId}`);

  // Initialize OpenAI Realtime connection for this client
  const openAIHandler = new OpenAIRealtimeHandler(ws);
  connections.set(connectionId, { ws, openAIHandler });

  ws.on('message', async (message) => {
    console.log(`Got message ${message.byteLength}`)
    try {
      if (message instanceof Buffer) {
        console.log(`Sending audio ${message.byteLength}`)
        // Binary audio data - forward to OpenAI
        await openAIHandler.sendAudio(message);
      } else {
        // JSON message
        const data = JSON.parse(message.toString());
        await openAIHandler.handleMessage(data);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Failed to process message' 
      }));
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed: ${connectionId}`);
    openAIHandler.cleanup();
    connections.delete(connectionId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    openAIHandler.cleanup();
    connections.delete(connectionId);
  });

  // Send connection confirmation
  ws.send(JSON.stringify({ type: 'connected' }));
});

const MODEL = 'gpt-4o-realtime-preview';
const API_VERSION = '2025-04-01-preview';
const OLD_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
const FULL_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}&api-version=${API_VERSION}`;

// OpenAI Realtime API Handler
class OpenAIRealtimeHandler {
  constructor(clientWs) {
    this.clientWs = clientWs;
    this.openAIWs = null;
    this.isConnecting = false;
    this.audioBuffer = [];
    this.connectToOpenAI();
  }

  async connectToOpenAI() {
    if (this.isConnecting || this.openAIWs) return;
    
    this.isConnecting = true;
    console.log('Connecting to OpenAI Realtime API...');

    try {
      const WebSocket = require('ws');
      this.openAIWs = new WebSocket(FULL_URL, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.openAIWs.on('open', () => {
        console.log('Connected to OpenAI Realtime API');
        this.isConnecting = false;
        
        // Configure the session
        this.openAIWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: `You are a helpful voice assistant that can control a video player. You can respond to commands like:
            - "play" or "start the video" - play the video
            - "pause" or "stop the video" - pause the video
            - "volume up" or "increase volume" - increase volume by 0.1
            - "volume down" or "decrease volume" - decrease volume by 0.1
            - "mute" - mute the video
            - "unmute" - unmute the video
            - "restart" or "go to beginning" - seek to start
            - "fullscreen" - enter fullscreen mode
            - "load video [URL]" - load a new video from URL
            
            When users give video control commands, execute them and provide a brief confirmation. For general conversation, respond naturally and helpfully.`,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }));
      });

      this.openAIWs.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleOpenAIMessage(message);
        } catch (error) {
          console.error('Error parsing OpenAI message:', error);
        }
      });

      this.openAIWs.on('close', () => {
        console.log('OpenAI WebSocket connection closed');
        this.openAIWs = null;
        this.isConnecting = false;
      });

      this.openAIWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        this.openAIWs = null;
        this.isConnecting = false;
      });

    } catch (error) {
      console.error('Failed to connect to OpenAI:', error);
      this.isConnecting = false;
    }
  }

  handleOpenAIMessage(message) {
    console.log(`received oai message ${JSON.stringify(message)}`)
    switch (message.type) {
      case 'response.audio.delta':
        // Stream audio back to client
        if (message.delta) {
          const audioBuffer = Buffer.from(message.delta, 'base64');
          this.clientWs.send(audioBuffer);
          console.log(`sent msg ${audioBuffer.byteLength}`)
        }
        break;

      case 'response.audio.done':
        this.clientWs.send(JSON.stringify({ type: 'response_audio_done' }));
        break;

      case 'response.done':
        this.clientWs.send(JSON.stringify({ type: 'response_end' }));
        break;

      case 'response.created':
        this.clientWs.send(JSON.stringify({ type: 'response_start' }));
        break;

      case 'response.audio_transcript.done':
        this.clientWs.send(JSON.stringify({ type: 'response_audio_transcript_done', transciprt: message.transciprt }));
        break;

      case 'response.text.delta':
        // Handle text responses for video commands
        if (message.delta) {
          this.processTextForVideoCommands(message.delta);
        }
        break;

      case 'conversation.item.created':
        if (message.item?.type === 'message' && message.item?.role === 'assistant') {
          const content = message.item.content?.[0];
          if (content?.type === 'text') {
            this.processTextForVideoCommands(content.text);
          }
        }
        break;

      case 'error':
        console.error('OpenAI error:', message.error);
        this.clientWs.send(JSON.stringify({ 
          type: 'error', 
          error: message.error?.message || 'OpenAI error' 
        }));
        break;
    }
  }

  processTextForVideoCommands(text) {
    console.log(`processing text commandss ${text}`)
    const lowerText = text.toLowerCase();
    
    // Video control commands
    if (lowerText.includes('play') && !lowerText.includes('pause')) {
      this.sendVideoCommand({ type: 'play' });
    } else if (lowerText.includes('pause') || lowerText.includes('stop')) {
      this.sendVideoCommand({ type: 'pause' });
    } else if (lowerText.includes('volume up') || lowerText.includes('increase volume')) {
      this.sendVideoCommand({ type: 'volume', value: 0.1 }); // relative increase
    } else if (lowerText.includes('volume down') || lowerText.includes('decrease volume')) {
      this.sendVideoCommand({ type: 'volume', value: -0.1 }); // relative decrease
    } else if (lowerText.includes('mute') && !lowerText.includes('unmute')) {
      this.sendVideoCommand({ type: 'mute' });
    } else if (lowerText.includes('unmute')) {
      this.sendVideoCommand({ type: 'unmute' });
    } else if (lowerText.includes('restart') || lowerText.includes('beginning')) {
      this.sendVideoCommand({ type: 'seek', value: 0 });
    } else if (lowerText.includes('fullscreen')) {
      this.sendVideoCommand({ type: 'fullscreen' });
    } else if (lowerText.includes('load video')) {
      // Extract URL from text (simple regex)
      const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        this.sendVideoCommand({ type: 'load', value: urlMatch[1] });
      }
    }
  }

  sendVideoCommand(command) {
    console.log('Sending video command:', command);
    this.clientWs.send(JSON.stringify({
      type: 'video_control',
      command
    }));
  }

  async sendAudio(audioData) {
    if (!this.openAIWs || this.openAIWs.readyState !== WebSocket.OPEN) {
      await this.connectToOpenAI();
      return;
    }

    // Convert audio data to base64 for OpenAI
    const base64Audio = audioData.toString('base64');
    
    this.openAIWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    }));
    console.log(`sent audio to oai ${base64Audio.byteLength}`)
  }

  async handleMessage(data) {
    if (!this.openAIWs || this.openAIWs.readyState !== WebSocket.OPEN) {
      await this.connectToOpenAI();
      return;
    }

    // Handle other message types if needed
    console.log('Received message from client:', data);
  }

  cleanup() {
    if (this.openAIWs) {
      this.openAIWs.close();
      this.openAIWs = null;
    }
  }
}

// API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', connections: connections.size });
});

// Broadcast video command to all connected clients
app.post('/video-control', (req, res) => {
  const { command } = req.body;
  
  connections.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'video_control',
        command
      }));
    }
  });

  res.json({ success: true, command });
});

// Start server
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}/`);
  console.log(`WebSocket endpoint: ws://localhost:${port}/ws_recall`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not found in environment variables');
    console.log('Please create a .env file with your OpenAI API key');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  connections.forEach(({ ws, openAIHandler }) => {
    openAIHandler.cleanup();
    ws.close();
  });
  
  server.close(() => {
    console.log('Server shut down complete');
    process.exit(0);
  });
});
