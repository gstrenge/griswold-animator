import { useCallback, useState, useRef, useEffect } from 'react';
import { useProjectStore, getActorValueAtTime } from '../../store';
import type { Actor, KeyFrame } from '../../types';

interface ActorTrackProps {
  actor: Actor;
  width: number;
  zoom: number;
}

interface DragState {
  isDragging: boolean;
  keyframeTime: number;
  startX: number;
  originalTime: number;
}

export default function ActorTrack({ actor, width, zoom }: ActorTrackProps) {
  const { 
    ui, 
    selectActor, 
    addKeyframe, 
    removeKeyframe,
    playback,
    seek,
  } = useProjectStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    keyframeTime: 0,
    startX: 0,
    originalTime: 0,
  });
  const [editingKeyframe, setEditingKeyframe] = useState<KeyFrame | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [hoverX, setHoverX] = useState<number | null>(null);

  const isSelected = ui.selectedActorId === actor.id;
  const playheadX = playback.currentTime * zoom;
  
  // Check if hovering near the playhead (within 15px)
  const ghostKeyframeThreshold = 15;
  const isNearPlayhead = hoverX !== null && Math.abs(hoverX - playheadX) < ghostKeyframeThreshold;
  
  // Check if there's already a keyframe at the current time (within small tolerance)
  const hasKeyframeAtPlayhead = actor.keyframes.some(
    kf => Math.abs(kf.time - playback.currentTime) < 0.01
  );

  // Handle double-click to add keyframe
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (editingKeyframe) return; // Don't add keyframe when editing
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / zoom);
    
    // Default to toggling between 0 and 1
    const currentValue = getActorValueAtTime(actor, time);
    const newValue = currentValue > 0.5 ? 0 : 1;
    
    addKeyframe(actor.id, { time, value: newValue });
  }, [actor, zoom, addKeyframe, editingKeyframe]);

  // Handle click to seek and select
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / zoom);
    seek(time);
    selectActor(actor.id);
  }, [actor.id, selectActor, seek, zoom]);

  // Handle mouse move to track hover position
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverX(x);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
  }, []);

  // Handle ghost keyframe click to add keyframe at playhead
  const handleGhostKeyframeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentValue = getActorValueAtTime(actor, playback.currentTime);
    const newValue = currentValue > 0.5 ? 0 : 1;
    addKeyframe(actor.id, { time: playback.currentTime, value: newValue });
  }, [actor, playback.currentTime, addKeyframe]);

  // Handle keyframe mouse down for dragging
  const handleKeyframeMouseDown = useCallback((e: React.MouseEvent, keyframe: KeyFrame) => {
    e.stopPropagation();
    e.preventDefault();
    
    setDragState({
      isDragging: true,
      keyframeTime: keyframe.time,
      startX: e.clientX,
      originalTime: keyframe.time,
    });
  }, []);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;
      const newTime = Math.max(0, Math.min(playback.duration, dragState.originalTime + deltaTime));
      
      // Update keyframe position
      removeKeyframe(actor.id, dragState.keyframeTime);
      const kf = actor.keyframes.find(k => k.time === dragState.keyframeTime);
      if (kf) {
        addKeyframe(actor.id, { time: newTime, value: kf.value });
      }
      
      setDragState(prev => ({ ...prev, keyframeTime: newTime }));
    };

    const handleMouseUp = () => {
      setDragState({
        isDragging: false,
        keyframeTime: 0,
        startX: 0,
        originalTime: 0,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, dragState.startX, dragState.originalTime, dragState.keyframeTime, zoom, playback.duration, actor.id, actor.keyframes, removeKeyframe, addKeyframe]);

  // Handle keyframe click to snap playhead to keyframe time
  const handleKeyframeClick = useCallback((e: React.MouseEvent, keyframe: KeyFrame) => {
    e.stopPropagation();
    seek(keyframe.time);
    selectActor(actor.id);
  }, [seek, selectActor, actor.id]);

  // Handle keyframe double-click to edit value
  const handleKeyframeDoubleClick = useCallback((e: React.MouseEvent, keyframe: KeyFrame) => {
    e.stopPropagation();
    setEditingKeyframe(keyframe);
    setEditValue(keyframe.value.toFixed(2));
  }, []);

  // Handle keyframe right-click to delete
  const handleKeyframeContextMenu = useCallback((e: React.MouseEvent, keyframe: KeyFrame) => {
    e.preventDefault();
    e.stopPropagation();
    removeKeyframe(actor.id, keyframe.time);
  }, [actor.id, removeKeyframe]);

  // Handle value edit submit
  const handleValueSubmit = useCallback(() => {
    if (editingKeyframe) {
      const newValue = Math.max(0, Math.min(1, parseFloat(editValue) || 0));
      removeKeyframe(actor.id, editingKeyframe.time);
      addKeyframe(actor.id, { time: editingKeyframe.time, value: newValue });
      setEditingKeyframe(null);
    }
  }, [editingKeyframe, editValue, actor.id, removeKeyframe, addKeyframe]);

  // Handle escape to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingKeyframe(null);
      } else if (e.key === 'Enter') {
        handleValueSubmit();
      }
    };
    
    if (editingKeyframe) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingKeyframe, handleValueSubmit]);

  // Draw value curve between keyframes
  const renderValueCurve = () => {
    if (actor.keyframes.length === 0) return null;

    const points: string[] = [];
    const height = 48;
    const valueToY = (value: number) => height - value * (height - 8);
    
    // Start from time 0
    const startValue = getActorValueAtTime(actor, 0);
    points.push(`0,${valueToY(startValue)}`);

    if (actor.interpolation === 'step') {
      // Step interpolation: horizontal then vertical
      let prevValue = startValue;
      for (const kf of actor.keyframes) {
        const x = kf.time * zoom;
        // First: horizontal line to the new time at the OLD value
        points.push(`${x},${valueToY(prevValue)}`);
        // Then: vertical jump to the NEW value at the same time
        points.push(`${x},${valueToY(kf.value)}`);
        prevValue = kf.value;
      }
      // End at track width
      const endX = Math.max(width, (playback.duration || 0) * zoom);
      points.push(`${endX},${valueToY(prevValue)}`);
    } else {
      // Linear interpolation: direct lines between keyframes
      for (const kf of actor.keyframes) {
        const x = kf.time * zoom;
        points.push(`${x},${valueToY(kf.value)}`);
      }
      // End at track width
      const endX = Math.max(width, (playback.duration || 0) * zoom);
      const endValue = actor.keyframes.length > 0 
        ? actor.keyframes[actor.keyframes.length - 1].value 
        : 0;
      points.push(`${endX},${valueToY(endValue)}`);
    }

    return (
      <svg className="absolute inset-0 pointer-events-none" style={{ width: Math.max(width, (playback.duration || 0) * zoom), height }}>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={isSelected ? '#ff6b35' : '#4a9eff'}
          strokeWidth="2"
          opacity="0.6"
        />
      </svg>
    );
  };

  return (
    <div 
      ref={trackRef}
      className={`h-full relative ${
        isSelected ? 'bg-[rgba(255,107,53,0.1)]' : 'bg-[var(--color-bg-primary)]'
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: dragState.isDragging ? 'grabbing' : 'pointer' }}
    >
      {/* Value curve */}
      {renderValueCurve()}

      {/* Ghost keyframe marker - shows when hovering near playhead and no keyframe exists there */}
      {isNearPlayhead && !hasKeyframeAtPlayhead && !dragState.isDragging && !editingKeyframe && (
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10
                     hover:scale-110 transition-all"
          style={{
            left: playheadX - 8,
            width: 16,
            height: 16,
          }}
          onClick={handleGhostKeyframeClick}
          title="Click to add keyframe here"
        >
          <div
            className="w-4 h-4 rounded-full animate-pulse"
            style={{
              backgroundColor: 'rgba(255, 107, 53, 0.4)',
              border: '2px dashed rgba(255, 107, 53, 0.7)',
              boxShadow: '0 0 8px rgba(255, 107, 53, 0.3)',
            }}
          />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-[var(--color-accent)] whitespace-nowrap opacity-80">
            + Add
          </div>
        </div>
      )}

      {/* Keyframe markers */}
      {actor.keyframes.map((kf, index) => (
        <div
          key={`${kf.time}-${index}`}
          className={`absolute top-1/2 -translate-y-1/2 cursor-grab
                     hover:scale-125 transition-transform z-20 ${
                       dragState.isDragging && dragState.keyframeTime === kf.time ? 'scale-125' : ''
                     }`}
          style={{
            left: kf.time * zoom - 8,
            width: 16,
            height: 16,
          }}
          onMouseDown={(e) => handleKeyframeMouseDown(e, kf)}
          onClick={(e) => handleKeyframeClick(e, kf)}
          onDoubleClick={(e) => handleKeyframeDoubleClick(e, kf)}
          onContextMenu={(e) => handleKeyframeContextMenu(e, kf)}
          title={`Time: ${kf.time.toFixed(2)}s\nValue: ${kf.value.toFixed(2)}\nClick to snap • Double-click to edit • Drag to move • Right-click to delete`}
        >
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: `hsl(${120 * kf.value}, 70%, 45%)`,
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            }}
          />
          
          {/* Value label */}
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap">
            {kf.value.toFixed(1)}
          </div>
        </div>
      ))}

      {/* Value editor popover */}
      {editingKeyframe && (
        <div 
          className="absolute z-30 bg-[var(--color-bg-secondary)] rounded shadow-lg border border-[var(--color-border)] p-2"
          style={{
            left: editingKeyframe.time * zoom,
            top: -40,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-16 px-2 py-1 bg-[var(--color-bg-tertiary)] rounded text-sm border border-[var(--color-border)]"
              autoFocus
            />
            <button
              onClick={handleValueSubmit}
              className="px-2 py-1 bg-[var(--color-accent)] text-white rounded text-xs"
            >
              Set
            </button>
          </div>
        </div>
      )}

      {/* Empty state message */}
      {actor.keyframes.length === 0 && !isNearPlayhead && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-[var(--color-text-secondary)] opacity-50">
            Click to seek • Hover near playhead to add keyframe
          </span>
        </div>
      )}
    </div>
  );
}
