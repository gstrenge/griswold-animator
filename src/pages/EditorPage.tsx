import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../components/Toolbar';
import CanvasPanel from '../components/canvas/CanvasPanel';
import TimelinePanel from '../components/timeline/TimelinePanel';
import { useProjectStore } from '../store';
import type { GrisFile } from '../types';

const LOCAL_STORAGE_KEY = 'griswold-autosave';
const SPLIT_STORAGE_KEY = 'griswold-split-position';

export default function EditorPage() {
  const navigate = useNavigate();
  const { 
    project, 
    actors, 
    backgrounds, 
    playback,
    play,
    pause,
    seek,
    setTool,
  } = useProjectStore();

  // Splitter state - percentage of height for the canvas panel
  const [canvasHeight, setCanvasHeight] = useState(() => {
    const saved = localStorage.getItem(SPLIT_STORAGE_KEY);
    return saved ? parseFloat(saved) : 55; // Default 55%
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { undo, redo } = useProjectStore.temporal.getState();

  // Handle splitter drag
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percentage = (y / rect.height) * 100;
      
      // Clamp between 20% and 80%
      const clamped = Math.max(20, Math.min(80, percentage));
      setCanvasHeight(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Save to localStorage
      localStorage.setItem(SPLIT_STORAGE_KEY, canvasHeight.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, canvasHeight]);

  // Autosave to localStorage on changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const data: GrisFile = {
          version: 1,
          project,
          actors,
          backgrounds,
        };
        const json = JSON.stringify(data);
        
        // Check size before saving (localStorage limit ~5MB)
        if (json.length > 4 * 1024 * 1024) {
          console.warn('Project too large for autosave (>4MB)');
          return;
        }
        
        localStorage.setItem(LOCAL_STORAGE_KEY, json);
      } catch (err) {
        console.error('Autosave failed:', err);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [project, actors, backgrounds]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Undo: Ctrl+Z
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      redo();
      return;
    }

    // Play/Pause: Space
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (playback.isPlaying) {
        pause();
      } else {
        play();
      }
      return;
    }

    // Step backward: Left arrow
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 0.1;
      seek(Math.max(0, playback.currentTime - step));
      return;
    }

    // Step forward: Right arrow
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 0.1;
      seek(Math.min(playback.duration, playback.currentTime + step));
      return;
    }

    // Skip to start: Home
    if (e.key === 'Home') {
      e.preventDefault();
      seek(0);
      return;
    }

    // Skip to end: End
    if (e.key === 'End') {
      e.preventDefault();
      seek(playback.duration);
      return;
    }

    // Tool shortcuts
    if (e.key === 'v' || e.key === 'V') {
      setTool('select');
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      setTool('rectangle');
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      setTool('polygon');
      return;
    }
  }, [undo, redo, playback.isPlaying, playback.currentTime, playback.duration, play, pause, seek, setTool]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Warn before closing tab/window to prevent accidental data loss
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if there's actual content (actors or backgrounds)
      if (actors.length > 0 || backgrounds.length > 0) {
        e.preventDefault();
        // Modern browsers ignore custom messages and show their own
        // but we need to set returnValue for the dialog to appear
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [actors.length, backgrounds.length]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      // Could add a confirmation dialog here
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Toolbar */}
      <Toolbar onHome={() => navigate('/')} />

      {/* Main content area - split between canvas and timeline */}
      <div 
        ref={containerRef}
        className="flex-1 flex flex-col overflow-hidden"
        style={{ cursor: isDragging ? 'row-resize' : undefined }}
      >
        {/* Canvas Panel - top */}
        <div 
          className="min-h-0 overflow-hidden"
          style={{ height: `${canvasHeight}%` }}
        >
          <CanvasPanel />
        </div>

        {/* Draggable splitter */}
        <div
          className={`h-1.5 flex-shrink-0 cursor-row-resize group relative
                      ${isDragging ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}
                      hover:bg-[var(--color-accent)] transition-colors`}
          onMouseDown={handleSplitterMouseDown}
        >
          {/* Visual handle indicator */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
            <div className={`w-12 h-1 rounded-full transition-colors
                          ${isDragging ? 'bg-white' : 'bg-[var(--color-text-secondary)] opacity-50 group-hover:opacity-100'}`} 
            />
          </div>
        </div>

        {/* Timeline Panel - bottom */}
        <div 
          className="min-h-0 overflow-hidden"
          style={{ height: `${100 - canvasHeight}%` }}
        >
          <TimelinePanel />
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 right-4 text-xs text-[var(--color-text-secondary)] opacity-50 pointer-events-none">
        <div>Space: Play/Pause • ←→: Step • Ctrl+Z/Y: Undo/Redo</div>
        <div>V: Select • R: Rectangle • P: Polygon</div>
      </div>
    </div>
  );
}
