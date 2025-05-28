import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AudioRecorder from "./AudioRecorder";
import AudioStreamer from "./AudioStreamer";
import WebSocketService from "@/services/WebSocketService";
import { RealtimeUtils } from '../lib/RealtimeUtils.js'

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
type AssistantState = "idle" | "listening" | "processing" | "speaking";

const VoiceAssistant = () => {
  const connectionStatus = useRef<ConnectionStatus>("disconnected");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wsUrl, setWsUrl] = useState('');
  const { toast } = useToast();
  
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const localAudioBufferRef = useRef<Int16Array>(new Int16Array());

  useEffect(() => {
    setWsUrl(`ws://${window.location.host}/ws_recall`);
  }, []);

  useEffect(() => {
    // Initialize WebSocket service
    wsServiceRef.current = new WebSocketService({
      onConnect: () => {
        connectionStatus.current = "connected"
        toast({
          title: "Connected",
          description: "Voice assistant is ready",
        });
        console.log(` connection status = ${connectionStatus}`)
        localAudioBufferRef.current = new Int16Array()
      },
      onDisconnect: () => {
        console.log("Disconnected !")
        connectionStatus.current = "disconnected";
        setAssistantState("idle");
        setIsRecording(false);
        toast({
          title: "Disconnected",
          description: "Disconnected from the backend.",
        });
      },
      onError: (error) => {
        connectionStatus.current = "error";
        setAssistantState("idle");
        toast({
          title: "Connection Error",
          description: error,
          variant: "destructive",
        });
      },
      onAudioReceived: (audioData) => {
        var buf = RealtimeUtils.arrayBufferToInt16(audioData)
        localAudioBufferRef.current = RealtimeUtils.mergeInt16Arrays(localAudioBufferRef.current, audioData)
        //playAudio(audioData);
      },
      onAudioDone: () => {
        playAudio(localAudioBufferRef.current)
        localAudioBufferRef.current = new Int16Array()
      },
      onResponseStart: () => {
        setAssistantState("processing");
      },
      onResponseEnd: () => {
        setAssistantState("idle");
      },
    }, wsUrl);

    // Initialize audio recorder
    audioRecorderRef.current = new AudioRecorder({
      onAudioData: (audioData) => {
        console.log(`onAudioData()`)
        if (wsServiceRef.current && connectionStatus.current === "connected") {
          console.log(`wsServiceRef audio if then.`)
          wsServiceRef.current.sendAudio(audioData);
        }
      },
      onStartRecording: () => {
        setIsRecording(true);
        setAssistantState("listening");
      },
      onStopRecording: () => {
        setIsRecording(false);
        if (assistantState === "listening") {
          setAssistantState("processing");
        }
      },
      onError: (error) => {
        toast({
          title: "Microphone Error",
          description: error,
          variant: "destructive",
        });
      },
    });

    // Initialize audio recorder
    audioStreamerRef.current = new AudioStreamer({
      onAudioData: (audioData) => {
        console.log(`onAudioData() ${connectionStatus} ${JSON.stringify(wsServiceRef.current)}`)
        if (wsServiceRef.current && connectionStatus.current === "connected") {
          console.log(`wsServiceRef audio if then.`)
          wsServiceRef.current.sendAudio(audioData);
        }
      },
      onStartRecording: () => {
        setIsRecording(true);
        setAssistantState("listening");
      },
      onStopRecording: () => {
        setIsRecording(false);
        if (assistantState === "listening") {
          setAssistantState("processing");
        }
      },
      onError: (error) => {
        toast({
          title: "Microphone Error",
          description: error,
          variant: "destructive",
        });
      },
    });

    return () => {
      wsServiceRef.current?.disconnect();
      audioRecorderRef.current?.cleanup();
      audioStreamerRef.current?.cleanup();
      audioContextRef.current?.close();
    };
  }, []);

  function int16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }
    return float32Array;
  }

  const playAudio = async (audioData: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          sampleRate: 24000
        });
      }



     // const audioBuffer = await audioContextRef.current.decodeAudioData(int16ToFloat32(new Int16Array(audioData)).buffer);
      
      const float32Array = int16ToFloat32(new Int16Array(audioData))
      const myBuffer: AudioBuffer = audioContextRef.current.createBuffer(
        1,                        // 1 channel (mono)
        float32Array.length,      // number of frames
        24000                     // sample rate (OpenAI uses 16 kHz)
      );
    
      myBuffer.copyToChannel(float32Array, 0); // copy to channel 0 (mono)
    
      //const source: AudioBufferSourceNode = this.audioContext.createBufferSource();


      const source = audioContextRef.current.createBufferSource();
      //source.buffer = audioBuffer;
      source.buffer = myBuffer;
      source.connect(audioContextRef.current.destination);
      
      setIsPlaying(true);
      setAssistantState("speaking");
      
      source.onended = () => {
        setIsPlaying(false);
        setAssistantState("idle");
      };
      
      source.start();
    } catch (error) {
      console.error("Error playing audio:", error);
      toast({
        title: "Audio Error",
        description: "Failed to play response",
        variant: "destructive",
      });
    }
  };

  const handleConnect = () => {
    if (connectionStatus.current === "disconnected") {
      connectionStatus.current = "connecting"
      wsServiceRef.current?.connect();
    }
  };

  const handleDisconnect = () => {
    wsServiceRef.current?.disconnect();
    setIsRecording(false);
    setAssistantState("idle");
  };

  const handleMicToggle = async () => {
    console.log("handleMicToggle called.")
    if (connectionStatus.current !== "connected") {
      handleConnect();
      return;
    }

    if (isRecording) {
      console.log("stopRecording called.")
      //audioRecorderRef.current?.stopRecording();
      audioStreamerRef.current?.stopRecording();
    } else {
      // await audioRecorderRef.current?.startRecording();
      await audioStreamerRef.current?.startRecording();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus.current) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus.current) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  const getMicButtonText = () => {
    if (connectionStatus.current !== "connected") return "Connect";
    if (isRecording) return "Stop Recording";
    return "Start Recording";
  };

  const getAssistantStateText = () => {
    switch (assistantState) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      default:
        return "Ready to chat";
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Card */}
      <Card className="p-6 backdrop-blur-sm bg-black/60 border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            <Badge variant="outline" className="font-medium bg-gray-800/50 text-gray-200 border-gray-600">
              {getStatusText()}
            </Badge>
          </div>
          {connectionStatus.current === "connected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="text-red-400 hover:text-red-300 border-gray-600 hover:bg-gray-800"
            >
              Disconnect
            </Button>
          )}
        </div>
        
        <div className="text-center">
          <p className="text-lg font-medium text-gray-200 mb-2">
            {getAssistantStateText()}
          </p>
          {assistantState === "listening" && (
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-8 bg-red-500 rounded animate-pulse" />
                <div className="w-2 h-6 bg-red-400 rounded animate-pulse delay-75" />
                <div className="w-2 h-10 bg-red-500 rounded animate-pulse delay-150" />
                <div className="w-2 h-4 bg-red-400 rounded animate-pulse delay-200" />
                <div className="w-2 h-8 bg-red-500 rounded animate-pulse delay-300" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Control removed animate-pulse from isRecording */}
      <Card className="p-8 backdrop-blur-sm bg-black/60 border-gray-700 shadow-2xl">
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <Button
              size="lg"
              onClick={handleMicToggle}
              disabled={assistantState === "processing" || assistantState === "speaking"}
              className={`w-24 h-24 rounded-full text-white shadow-2xl transition-all duration-300 transform hover:scale-105 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600  pointer-events-auto"
                  : connectionStatus.current === "connected"
                  ? "bg-gradient-to-r from-red-600 to-yellow-600 hover:from-red-700 hover:to-yellow-700"
                  : "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
              }`}
            >
              {isRecording ? (
                <MicOff size={32} />
              ) : (
                <Mic size={32} />
              )}
            </Button>
            {/* removing animate-ping */}
            
            {isRecording && (
              <div onClick={handleMicToggle} className="absolute inset-0 rounded-full border-4 border-red-300 pointer-events-auto" />
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-200">
              {getMicButtonText()}
            </p>
            {connectionStatus.current === "disconnected" && (
              <p className="text-sm text-gray-400">
                Click to connect to the voice assistant
              </p>
            )}
          </div>

          {/* Audio Status */}
          {isPlaying && (
            <div className="flex items-center justify-center space-x-2 text-yellow-400">
              <Volume2 size={20} />
              <span className="text-sm font-medium">Playing response...</span>
            </div>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4 backdrop-blur-sm bg-black/40 border-gray-700">
        <div className="text-center text-sm text-gray-300 space-y-1">
          <p>• Click the microphone to connect and start recording</p>
          <p>• Control the video player with voice commands</p>
          <p>• Say "play", "pause", "volume up/down", or "load video [URL]"</p>
        </div>
      </Card>
    </div>
  );
};

export default VoiceAssistant;
