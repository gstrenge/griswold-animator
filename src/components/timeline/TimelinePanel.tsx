import { useRef, useCallback, useState, useEffect } from 'react';
import { useProjectStore } from '../../store';
import WaveformTrack from './WaveformTrack';
import ActorTrack from './ActorTrack';
import PlaybackControls from './PlaybackControls';
import { INTERPOLATION_OPTIONS, type InterpolationType } from '../../types';

export default function TimelinePanel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timeRulerRef = useRef<HTMLDivElement>(null);
  const [editingActorId, setEditingActorId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Drag-and-drop reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync time ruler scroll with tracks scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      setScrollLeft(scrollContainer.scrollLeft);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
  const { 
    actors, 
    playback, 
    ui,
    addActor,
    removeActor,
    updateActor,
    reorderActors,
    setZoom,
    seek,
  } = useProjectStore();

  const handleAddActor = () => {
    const label = `Actor ${actors.length + 1}`;
    addActor(label);
  };

  // Drag-and-drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderActors(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleZoomIn = () => {
    setZoom(ui.zoom * 1.2);
  };

  const handleZoomOut = () => {
    setZoom(ui.zoom / 1.2);
  };

  const handleTimeRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // getBoundingClientRect already accounts for the CSS transform,
    // so clientX - rect.left gives us the position within the element directly
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / ui.zoom;
    seek(Math.max(0, Math.min(time, playback.duration)));
  }, [ui.zoom, seek, playback.duration]);

  const handleActorLabelDoubleClick = (actorId: string, currentLabel: string) => {
    setEditingActorId(actorId);
    setEditingLabel(currentLabel);
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingLabel(e.target.value);
  };

  const handleLabelSubmit = (actorId: string) => {
    if (editingLabel.trim()) {
      updateActor(actorId, { label: editingLabel.trim() });
    }
    setEditingActorId(null);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent, actorId: string) => {
    if (e.key === 'Enter') {
      handleLabelSubmit(actorId);
    } else if (e.key === 'Escape') {
      setEditingActorId(null);
    }
  };

  const handleRemoveActor = (actorId: string) => {
    if (confirm('Remove this actor? This cannot be undone.')) {
      removeActor(actorId);
    }
  };

  const handleInterpolationChange = (actorId: string, interpolation: InterpolationType) => {
    updateActor(actorId, { interpolation });
  };

  // Calculate timeline width based on duration
  const timelineWidth = Math.max(playback.duration * ui.zoom, 1000);

  // Generate time markers
  const timeMarkers = [];
  const markerInterval = getMarkerInterval(ui.zoom);
  const maxTime = Math.max(playback.duration, timelineWidth / ui.zoom);
  for (let t = 0; t <= maxTime; t += markerInterval) {
    timeMarkers.push(t);
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-secondary)]">
      {/* Timeline toolbar */}
      <div className="h-10 flex items-center gap-2 px-4 border-b border-[var(--color-border)]">
        <PlaybackControls />
        
        <div className="flex-1" />
        
        <button
          onClick={handleAddActor}
          className="px-3 py-1 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                     hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
                     transition-colors text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Actor
        </button>

        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-xs text-[var(--color-text-secondary)] w-16 text-center">
            {ui.zoom.toFixed(0)}px/s
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline content - outer container for vertical scroll */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row (sticky) */}
        <div className="flex flex-shrink-0">
          {/* Time ruler label */}
          <div className="w-48 flex-shrink-0 h-8 border-b border-r border-[var(--color-border)] flex items-center px-3 bg-[var(--color-bg-secondary)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Time</span>
          </div>
          
          {/* Time ruler (horizontal scroll synced) */}
          <div 
            ref={timeRulerRef}
            className="flex-1 h-8 border-b border-[var(--color-border)] overflow-hidden"
          >
            <div 
              className="h-full relative time-ruler cursor-pointer"
              style={{ 
                width: timelineWidth, 
                transform: `translateX(-${scrollLeft}px)` 
              }}
              onClick={handleTimeRulerClick}
            >
              {timeMarkers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: t * ui.zoom }}
                >
                  <div className="w-px h-2 bg-[var(--color-border)]" />
                  <span className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {formatTime(t)}
                  </span>
                </div>
              ))}
              
              {/* Playhead */}
              <div 
                className="absolute top-0 w-0.5 h-full bg-[var(--color-accent)] z-10"
                style={{ left: playback.currentTime * ui.zoom }}
              >
                <div className="w-3 h-3 bg-[var(--color-accent)] -ml-[5px] -mt-1 rotate-45" />
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable tracks area (both labels and tracks scroll together vertically) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex">
            {/* Track labels column (fixed width, scrolls vertically with tracks) */}
            <div className="w-48 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              {/* Audio track label */}
              <div className="h-16 border-b border-[var(--color-border)] flex items-center px-3">
                <span className="text-sm">Audio</span>
              </div>
              
              {/* Actor track labels */}
              {actors.map((actor, index) => (
                <div 
                  key={actor.id}
                  draggable={editingActorId !== actor.id}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`h-12 border-b border-[var(--color-border)] flex items-center px-1 group gap-1 transition-colors
                             ${draggedIndex === index ? 'opacity-50' : ''}
                             ${dragOverIndex === index ? 'bg-[var(--color-accent)]/20 border-t-2 border-t-[var(--color-accent)]' : ''}`}
                >
                  {/* Drag handle */}
                  <div 
                    className="cursor-grab active:cursor-grabbing p-1 opacity-30 hover:opacity-100 transition-opacity"
                    title="Drag to reorder"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="5" r="1.5" />
                      <circle cx="15" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" />
                      <circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                  
                  {editingActorId === actor.id ? (
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={handleLabelChange}
                      onBlur={() => handleLabelSubmit(actor.id)}
                      onKeyDown={(e) => handleLabelKeyDown(e, actor.id)}
                      className="flex-1 bg-[var(--color-bg-tertiary)] px-2 py-1 rounded text-sm outline-none
                                 border border-[var(--color-accent)]"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span 
                        className="text-sm truncate flex-1 cursor-pointer hover:text-[var(--color-accent)]"
                        onDoubleClick={() => handleActorLabelDoubleClick(actor.id, actor.label)}
                        title="Double-click to rename"
                      >
                        {actor.label}
                      </span>
                      <select
                        value={actor.interpolation}
                        onChange={(e) => handleInterpolationChange(actor.id, e.target.value as InterpolationType)}
                        className="text-[10px] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] 
                                   rounded px-1 py-0.5 opacity-60 hover:opacity-100 focus:opacity-100
                                   transition-opacity cursor-pointer"
                        title="Interpolation type"
                      >
                        {INTERPOLATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemoveActor(actor.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                        title="Remove actor"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Scrollable timeline tracks (horizontal scroll only here) */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-x-auto overflow-y-hidden"
            >
              <div style={{ width: timelineWidth, minWidth: '100%' }}>
                {/* Waveform track */}
                <div className="h-16 border-b border-[var(--color-border)] relative">
                  <WaveformTrack width={timelineWidth} zoom={ui.zoom} />
                  
                  {/* Playhead line */}
                  <div 
                    className="absolute top-0 w-0.5 h-full bg-[var(--color-accent)] z-10 pointer-events-none"
                    style={{ left: playback.currentTime * ui.zoom }}
                  />
                </div>

                {/* Actor tracks */}
                {actors.map((actor) => (
                  <div 
                    key={actor.id}
                    className="h-12 border-b border-[var(--color-border)] relative"
                  >
                    <ActorTrack actor={actor} width={timelineWidth} zoom={ui.zoom} />
                    
                    {/* Playhead line */}
                    <div 
                      className="absolute top-0 w-0.5 h-full bg-[var(--color-accent)] z-10 pointer-events-none"
                      style={{ left: playback.currentTime * ui.zoom }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

function getMarkerInterval(zoom: number): number {
  // Adjust interval based on zoom level
  if (zoom > 200) return 0.5;
  if (zoom > 100) return 1;
  if (zoom > 50) return 2;
  if (zoom > 25) return 5;
  return 10;
}
