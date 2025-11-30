import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../components/Toolbar';
import CanvasPanel from '../components/canvas/CanvasPanel';
import TimelinePanel from '../components/timeline/TimelinePanel';
import { useProjectStore } from '../store';
import type { GrisFile } from '../types';

const LOCAL_STORAGE_KEY = 'griswold-autosave';

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
  
  const { undo, redo } = useProjectStore.temporal.getState();

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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas Panel - top half */}
        <div className="flex-1 min-h-0 border-b border-[var(--color-border)]">
          <CanvasPanel />
        </div>

        {/* Timeline Panel - bottom half */}
        <div className="h-[45%] min-h-[200px]">
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
