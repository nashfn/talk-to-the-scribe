
import VoiceAssistant from "@/components/VoiceAssistant";
import VideoPlayer from "@/components/VideoPlayer";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent mb-4">
            Cinema Voice Assistant
          </h1>
          <p className="text-lg text-gray-300">
            Control your media with voice commands
          </p>
        </div>
        
        <VideoPlayer />
        <VoiceAssistant />
      </div>
    </div>
  );
};

export default Index;
