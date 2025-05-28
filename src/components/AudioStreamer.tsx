
interface AudioStreamerOptions {
  onAudioData: (data: ArrayBuffer) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onError: (error: string) => void;
}

class AudioStreamer {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private options: AudioStreamerOptions;
  private audioChunks: Blob[] = [];
  private audioContext:AudioContext = null;
  private source = null;
  private processor = null;

  constructor(options: AudioStreamerOptions) {
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
          sampleRate: 24000,
        },
      });
      this.audioContext = new AudioContext({ sampleRate: 24000 }); // Required by OpenAI
      this.source = this.audioContext.createMediaStreamSource(this.audioStream);
  
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

    //   // Create MediaRecorder
    //   this.mediaRecorder = new MediaRecorder(this.audioStream, {
    //     mimeType: 'audio/webm;codecs=opus',
    //   });

      this.audioChunks = [];
      this.options.onStartRecording();


    //   // Start recording
    //   this.mediaRecorder.start(100); // Collect data every 100ms
    //   this.options.onStartRecording();

      this.processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcmData = this._float32ToInt16(input);
        this.options.onAudioData(pcmData.buffer)
      };

    } catch (error) {
      console.error('Error starting recording:', error);
      this.options.onError('Failed to access microphone');
    }
  }

    stopRecording(): void {

        this.options.onStopRecording();
        if (this.processor) this.processor.disconnect();
        if (this.source) this.source.disconnect();
        if (this.audioContext) this.audioContext.close();
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }
        console.log('[MicStreamer] Mic stopped.');

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

    _float32ToInt16(buffer) {
        const l = buffer.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            const s = Math.max(-1, Math.min(1, buffer[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16;
    }
}

export default AudioStreamer;
