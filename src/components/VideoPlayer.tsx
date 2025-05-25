
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoPlayerProps {
  onVideoControl?: (command: string, value?: any) => void;
}

export interface VideoCommand {
  type: 'play' | 'pause' | 'seek' | 'volume' | 'mute' | 'unmute' | 'fullscreen' | 'load';
  value?: number | string;
}

const VideoPlayer = ({ onVideoControl }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoSrc, setVideoSrc] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  // Expose video control function globally for WebSocket messages
  useEffect(() => {
    const handleVideoCommand = (command: VideoCommand) => {
      const video = videoRef.current;
      if (!video) return;

      console.log('Received video command:', command);

      switch (command.type) {
        case 'play':
          video.play();
          setIsPlaying(true);
          break;
        case 'pause':
          video.pause();
          setIsPlaying(false);
          break;
        case 'seek':
          if (typeof command.value === 'number') {
            video.currentTime = command.value;
          }
          break;
        case 'volume':
          if (typeof command.value === 'number') {
            const vol = Math.max(0, Math.min(1, command.value));
            video.volume = vol;
            setVolume(vol);
            setIsMuted(vol === 0);
          }
          break;
        case 'mute':
          video.muted = true;
          setIsMuted(true);
          break;
        case 'unmute':
          video.muted = false;
          setIsMuted(false);
          break;
        case 'fullscreen':
          if (video.requestFullscreen) {
            video.requestFullscreen();
          }
          break;
        case 'load':
          if (typeof command.value === 'string') {
            setVideoSrc(command.value);
            toast({
              title: "Video Loaded",
              description: "New video source loaded",
            });
          }
          break;
      }
    };

    // Make function available globally for WebSocket service
    (window as any).handleVideoCommand = handleVideoCommand;

    return () => {
      delete (window as any).handleVideoCommand;
    };
  }, [toast]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="mb-8 bg-black/80 border-gray-700 backdrop-blur-sm shadow-2xl">
      <div className="relative">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-64 md:h-96 bg-black rounded-t-lg object-cover"
          src={videoSrc}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onVolumeChange={(e) => {
            setVolume(e.currentTarget.volume);
            setIsMuted(e.currentTarget.muted);
          }}
          poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2NjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBWaWRlbzwvdGV4dD48L3N2Zz4="
        />
        
        {/* Video Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-white text-sm mb-2">
              <span>{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-200"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPause}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </Button>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMuteToggle}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSeek(0)}
                className="text-white hover:bg-white/20"
              >
                <RotateCcw size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => videoRef.current?.requestFullscreen()}
                className="text-white hover:bg-white/20"
              >
                <Maximize size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Load Video Section */}
      <div className="p-4 bg-gray-900/50">
        <div className="flex space-x-2">
          <input
            type="url"
            placeholder="Enter video URL..."
            value={videoSrc}
            onChange={(e) => setVideoSrc(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <Button
            onClick={() => {
              if (videoSrc) {
                videoRef.current?.load();
                toast({
                  title: "Video Loaded",
                  description: "Video source updated",
                });
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Load
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default VideoPlayer;
