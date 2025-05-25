
interface AudioRecorderOptions {
  onAudioData: (data: ArrayBuffer) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onError: (error: string) => void;
}

class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private options: AudioRecorderOptions;
  private audioChunks: Blob[] = [];

  constructor(options: AudioRecorderOptions) {
    this.options = options;
  }

  async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        this.options.onAudioData(arrayBuffer);
        this.options.onStopRecording();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.options.onError('Recording failed');
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.options.onStartRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
      this.options.onError('Failed to access microphone');
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  cleanup(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    this.mediaRecorder = null;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

export default AudioRecorder;
