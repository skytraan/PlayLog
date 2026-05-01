import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Play, Pause } from "lucide-react";
import { useState } from "react";

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  /** Local file (immediately after upload). One of file/src is required. */
  file?: File;
  /** Remote URL (e.g. R2 presigned read URL) — used after a reload when the
   *  original File object is no longer in memory. */
  src?: string;
  /** Optional list of cue points to mark on the progress bar (in seconds) */
  cues?: number[];
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ file, src, cues = [] }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Two source modes: local File (createObjectURL + revoke), or a plain URL
    // string (just set src directly). The else-branch lets the player rehydrate
    // a session's R2 video after the user reloads the page or navigates back.
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

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value);
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
    };

    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    return (
      <div className="rounded-lg overflow-hidden border border-border bg-black">
        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full max-h-64 object-contain bg-black"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          playsInline
          muted={false}
        />

        {/* Controls */}
        <div className="bg-card px-3 py-2 space-y-1.5">
          {/* Progress bar + cue markers */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-1.5 accent-primary cursor-pointer"
            />
            {/* Cue markers */}
            {duration > 0 && cues.map((cue) => (
              <button
                key={cue}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = cue;
                    setCurrentTime(cue);
                  }
                }}
                title={fmt(cue)}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary border border-background hover:scale-125 transition-transform"
                style={{ left: `calc(${(cue / duration) * 100}% - 4px)` }}
              />
            ))}
          </div>

          {/* Play + time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-foreground hover:text-primary transition-colors"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
