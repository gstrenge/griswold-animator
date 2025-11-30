import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../../store';

export default function PlaybackControls() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const { 
    playback, 
    audioBuffer,
    play, 
    pause, 
    seek, 
    setPlayback,
  } = useProjectStore();

  // Update current time during playback
  const updateTime = useCallback(() => {
    if (!audioContextRef.current || !playback.isPlaying) return;
    
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    const newTime = Math.min(elapsed, playback.duration);
    
    setPlayback({ currentTime: newTime });
    
    if (newTime >= playback.duration) {
      pause();
      return;
    }
    
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [playback.isPlaying, playback.duration, setPlayback, pause]);

  // Handle play/pause
  useEffect(() => {
    if (!audioBuffer) return;

    if (playback.isPlaying) {
      // Start playback
      audioContextRef.current = new AudioContext();
      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = audioBuffer;
      sourceNodeRef.current.connect(audioContextRef.current.destination);
      
      startTimeRef.current = audioContextRef.current.currentTime - playback.currentTime;
      sourceNodeRef.current.start(0, playback.currentTime);
      
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      // Stop playback
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {
          // Ignore - already stopped
        }
        sourceNodeRef.current = null;
      }
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [playback.isPlaying, audioBuffer, playback.currentTime, updateTime]);

  const handlePlayPause = () => {
    if (playback.isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleStop = () => {
    pause();
    seek(0);
  };

  const handleStepBackward = () => {
    seek(Math.max(0, playback.currentTime - 0.1));
  };

  const handleStepForward = () => {
    seek(Math.min(playback.duration, playback.currentTime + 0.1));
  };

  const handleSkipBackward = () => {
    seek(0);
  };

  const handleSkipForward = () => {
    seek(playback.duration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Skip to start */}
      <button
        onClick={handleSkipBackward}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        title="Skip to Start"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      {/* Step backward */}
      <button
        onClick={handleStepBackward}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        title="Step Backward (-0.1s)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={handlePlayPause}
        className="p-2 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] 
                   transition-colors"
        title={playback.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {playback.isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        title="Stop"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>

      {/* Step forward */}
      <button
        onClick={handleStepForward}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        title="Step Forward (+0.1s)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
        </svg>
      </button>

      {/* Skip to end */}
      <button
        onClick={handleSkipForward}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        title="Skip to End"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      {/* Time display */}
      <div className="ml-4 font-mono text-sm">
        <span className="text-[var(--color-text-primary)]">
          {formatTime(playback.currentTime)}
        </span>
        <span className="text-[var(--color-text-secondary)] mx-1">/</span>
        <span className="text-[var(--color-text-secondary)]">
          {formatTime(playback.duration)}
        </span>
      </div>
    </div>
  );
}

