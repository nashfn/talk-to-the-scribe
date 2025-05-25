
import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AudioRecorder from "./AudioRecorder";
import WebSocketService from "@/services/WebSocketService";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
type AssistantState = "idle" | "listening" | "processing" | "speaking";

const VoiceAssistant = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();
  
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize WebSocket service
    wsServiceRef.current = new WebSocketService({
      onConnect: () => {
        setConnectionStatus("connected");
        toast({
          title: "Connected",
          description: "Voice assistant is ready",
        });
      },
      onDisconnect: () => {
        setConnectionStatus("disconnected");
        setAssistantState("idle");
        setIsRecording(false);
      },
      onError: (error) => {
        setConnectionStatus("error");
        setAssistantState("idle");
        toast({
          title: "Connection Error",
          description: error,
          variant: "destructive",
        });
      },
      onAudioReceived: (audioData) => {
        playAudio(audioData);
      },
      onResponseStart: () => {
        setAssistantState("processing");
      },
      onResponseEnd: () => {
        setAssistantState("idle");
      },
    });

    // Initialize audio recorder
    audioRecorderRef.current = new AudioRecorder({
      onAudioData: (audioData) => {
        if (wsServiceRef.current && connectionStatus === "connected") {
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
      audioContextRef.current?.close();
    };
  }, []);

  const playAudio = async (audioData: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
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
    if (connectionStatus === "disconnected") {
      setConnectionStatus("connecting");
      wsServiceRef.current?.connect();
    }
  };

  const handleDisconnect = () => {
    wsServiceRef.current?.disconnect();
    setIsRecording(false);
    setAssistantState("idle");
  };

  const handleMicToggle = async () => {
    if (connectionStatus !== "connected") {
      handleConnect();
      return;
    }

    if (isRecording) {
      audioRecorderRef.current?.stopRecording();
    } else {
      await audioRecorderRef.current?.startRecording();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
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
    switch (connectionStatus) {
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
    if (connectionStatus !== "connected") return "Connect";
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
      <Card className="p-6 backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            <Badge variant="outline" className="font-medium">
              {getStatusText()}
            </Badge>
          </div>
          {connectionStatus === "connected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="text-red-600 hover:text-red-700"
            >
              Disconnect
            </Button>
          )}
        </div>
        
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 mb-2">
            {getAssistantStateText()}
          </p>
          {assistantState === "listening" && (
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-8 bg-blue-500 rounded animate-pulse" />
                <div className="w-2 h-6 bg-blue-400 rounded animate-pulse delay-75" />
                <div className="w-2 h-10 bg-blue-500 rounded animate-pulse delay-150" />
                <div className="w-2 h-4 bg-blue-400 rounded animate-pulse delay-200" />
                <div className="w-2 h-8 bg-blue-500 rounded animate-pulse delay-300" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Control */}
      <Card className="p-8 backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <Button
              size="lg"
              onClick={handleMicToggle}
              disabled={assistantState === "processing" || assistantState === "speaking"}
              className={`w-24 h-24 rounded-full text-white shadow-2xl transition-all duration-300 transform hover:scale-105 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : connectionStatus === "connected"
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  : "bg-gradient-to-r from-gray-400 to-gray-600 hover:from-gray-500 hover:to-gray-700"
              }`}
            >
              {isRecording ? (
                <MicOff size={32} />
              ) : (
                <Mic size={32} />
              )}
            </Button>
            
            {isRecording && (
              <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {getMicButtonText()}
            </p>
            {connectionStatus === "disconnected" && (
              <p className="text-sm text-gray-500">
                Click to connect to the voice assistant
              </p>
            )}
          </div>

          {/* Audio Status */}
          {isPlaying && (
            <div className="flex items-center justify-center space-x-2 text-purple-600">
              <Volume2 size={20} />
              <span className="text-sm font-medium">Playing response...</span>
            </div>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4 backdrop-blur-sm bg-white/60 border-0">
        <div className="text-center text-sm text-gray-600 space-y-1">
          <p>• Click the microphone to connect and start recording</p>
          <p>• Speak clearly and wait for the assistant's response</p>
          <p>• The assistant will respond with audio automatically</p>
        </div>
      </Card>
    </div>
  );
};

export default VoiceAssistant;
