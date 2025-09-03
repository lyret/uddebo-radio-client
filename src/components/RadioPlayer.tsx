import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, SkipForward, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Recording {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  duration: number | null;
}

export const RadioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const currentTrack = recordings[currentTrackIndex];

  useEffect(() => {
    fetchRecordings();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => nextTrack();

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const fetchRecordings = async () => {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      toast({
        title: "Error loading recordings",
        description: "Failed to fetch the playlist",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    if (recordings.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % recordings.length;
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
  };

  const previousTrack = () => {
    if (recordings.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? recordings.length - 1 : currentTrackIndex - 1;
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-secondary/20 border-border/50">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (recordings.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-secondary/20 border-border/50 text-center">
        <h3 className="text-lg font-semibold mb-2">No recordings available</h3>
        <p className="text-muted-foreground">Upload some recordings to start the radio!</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary/20 border-border/50 backdrop-blur-sm">
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.file_url}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}
      
      <div className="space-y-6">
        {/* Track Info */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {currentTrack?.title || "No track selected"}
          </h2>
          {currentTrack?.artist && (
            <p className="text-muted-foreground">{currentTrack.artist}</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration}
            step={1}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={previousTrack}
            disabled={recordings.length <= 1}
            className="h-12 w-12 hover:bg-primary/20"
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            disabled={!currentTrack}
            className="h-16 w-16 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextTrack}
            disabled={recordings.length <= 1}
            className="h-12 w-12 hover:bg-primary/20"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-3">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            max={1}
            step={0.1}
            onValueChange={(value) => setVolume(value[0])}
            className="flex-1"
          />
        </div>

        {/* Playlist Info */}
        <div className="text-center text-sm text-muted-foreground">
          Track {currentTrackIndex + 1} of {recordings.length}
        </div>
      </div>
    </Card>
  );
};