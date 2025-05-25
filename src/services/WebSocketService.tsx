
interface WebSocketServiceOptions {
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (error: string) => void;
  onAudioReceived: (audioData: ArrayBuffer) => void;
  onResponseStart: () => void;
  onResponseEnd: () => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private options: WebSocketServiceOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  constructor(options: WebSocketServiceOptions) {
    this.options = options;
  }

  connect(): void {
    try {
      // Connect to your Express.js backend WebSocket server
      // Replace with your actual backend URL
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? 'wss://your-backend-url.com/ws' 
        : 'ws://localhost:3001/ws';
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.options.onConnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.options.onDisconnect();
        
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.options.onError('Connection failed');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.options.onError('Failed to connect');
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      if (event.data instanceof ArrayBuffer) {
        // Binary audio data
        this.options.onAudioReceived(event.data);
      } else if (typeof event.data === 'string') {
        // JSON messages
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'response_start':
            this.options.onResponseStart();
            break;
          case 'response_end':
            this.options.onResponseEnd();
            break;
          case 'video_control':
            // Handle video control messages from backend
            if ((window as any).handleVideoCommand) {
              (window as any).handleVideoCommand(message.command);
            }
            break;
          case 'error':
            this.options.onError(message.error || 'Unknown error');
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export default WebSocketService;
