import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from "react";
import { Play, Pause } from "lucide-react";

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  file?: File;
  src?: string;
  cues?: number[];
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ file, src, cues = [] }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
      if (file) {
        const url = URL.createObjectURL(file);
        if (videoRef.current) videoRef.current.src = url;
        return () => URL.revokeObjectURL(url);
      }
      if (src && videoRef.current) {
        videoRef.current.src = src;
      }
    }, [file, src]);

    useImperativeHandle(ref, () => ({
      seekTo(seconds: number) {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        video.play().catch(() => {});
        setPlaying(true);
      },
    }));

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
        setPlaying(true);
      } else {
        video.pause();
        setPlaying(false);
      }
    }, []);

    const handleTimeUpdate = () => {
      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) setDuration(videoRef.current.duration);
    };

    const handleEnded = () => setPlaying(false);

    const seekToPosition = (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      const video = videoRef.current;
      if (!track || !video || !duration) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = pct * duration;
      video.currentTime = t;
      setCurrentTime(t);
    };

    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className="rounded-2xl overflow-hidden border border-border bg-black">
        <video
          ref={videoRef}
          className="w-full max-h-72 object-contain bg-black"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          playsInline
        />

        <div className="bg-card px-4 py-3 space-y-2">
          {/* Custom scrubber track */}
          <div
            ref={trackRef}
            className="relative h-8 cursor-pointer"
            onClick={seekToPosition}
          >
            {/* Track background */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full" />
            {/* Progress fill */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary/70 rounded-full pointer-events-none"
              style={{ width: `${pct}%` }}
            />
            {/* Cue markers */}
            {duration > 0 && cues.map((cue) => (
              <button
                key={cue}
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    videoRef.current.currentTime = cue;
                    setCurrentTime(cue);
                  }
                }}
                title={`Key moment · ${fmt(cue)}`}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-5 rounded-sm bg-amber-400/80 hover:bg-amber-300 hover:h-6 transition-all z-10"
                style={{ left: `${(cue / duration) * 100}%` }}
              />
            ))}
            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
              style={{ left: `${pct}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-foreground hover:text-primary transition-colors">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <span className="text-xs text-muted-foreground font-mono">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            </div>
            {cues.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-sm bg-amber-400/80 flex-shrink-0" />
                <span>Key moments</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
