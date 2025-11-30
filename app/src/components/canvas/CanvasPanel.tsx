import { useRef, useEffect, useCallback, useState } from 'react';
import { useProjectStore, getActorValueAtTime, interpolateColor } from '../../store';
import type { Polygon, RectanglePolygon, ArbitraryPolygon, Shape } from '../../types';

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  polygonPoints: [number, number][];
}

export default function CanvasPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    polygonPoints: [],
  });

  const [showActorAssignModal, setShowActorAssignModal] = useState(false);
  const [pendingShape, setPendingShape] = useState<Polygon | null>(null);
  
  const { 
    project, 
    actors, 
    backgrounds, 
    playback,
    ui,
    addBackground,
    selectActor,
    selectBackground,
    setTool,
    setActorShape,
  } = useProjectStore();

  // Preload background images
  useEffect(() => {
    backgrounds.forEach((bg) => {
      if (!imageCache.current.has(bg.id)) {
        const img = new Image();
        img.src = bg.dataUrl;
        img.onload = () => {
          imageCache.current.set(bg.id, img);
          draw(); // Redraw when image loads
        };
      }
    });
  }, [backgrounds]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = project.canvasSize;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, width, height);

    // Draw grid pattern
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw backgrounds (sorted by zIndex)
    const sortedBackgrounds = [...backgrounds].sort((a, b) => a.zIndex - b.zIndex);
    for (const bg of sortedBackgrounds) {
      const img = imageCache.current.get(bg.id);
      if (img && img.complete) {
        ctx.drawImage(img, bg.x, bg.y, bg.width, bg.height);
        
        // Draw selection border
        if (ui.selectedBackgroundId === bg.id) {
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(bg.x, bg.y, bg.width, bg.height);
          ctx.setLineDash([]);
        }
      }
    }

    // Draw actor shapes
    for (const actor of actors) {
      if (!actor.shape) continue;

      const value = getActorValueAtTime(actor, playback.currentTime);
      const color = interpolateColor(actor.shape.offColor, actor.shape.onColor, value);
      
      ctx.fillStyle = color;
      ctx.strokeStyle = ui.selectedActorId === actor.id ? '#ff6b35' : '#ffffff';
      ctx.lineWidth = ui.selectedActorId === actor.id ? 3 : 1;

      const { geometry } = actor.shape;
      drawPolygon(ctx, geometry);

      // Draw actor label
      const bounds = getPolygonBounds(geometry);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text background
      const textWidth = ctx.measureText(actor.label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bounds.centerX - textWidth / 2 - 4, bounds.centerY - 10, textWidth + 8, 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(actor.label, bounds.centerX, bounds.centerY);
    }

    // Draw current drawing preview
    if (drawingState.isDrawing) {
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      if (ui.tool === 'rectangle') {
        const x = Math.min(drawingState.startX, drawingState.currentX);
        const y = Math.min(drawingState.startY, drawingState.currentY);
        const w = Math.abs(drawingState.currentX - drawingState.startX);
        const h = Math.abs(drawingState.currentY - drawingState.startY);
        ctx.strokeRect(x, y, w, h);
      }
      
      ctx.setLineDash([]);
    }

    // Draw polygon points being drawn
    if (ui.tool === 'polygon' && drawingState.polygonPoints.length > 0) {
      ctx.strokeStyle = '#ff6b35';
      ctx.fillStyle = 'rgba(255, 107, 53, 0.3)';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(drawingState.polygonPoints[0][0], drawingState.polygonPoints[0][1]);
      for (let i = 1; i < drawingState.polygonPoints.length; i++) {
        ctx.lineTo(drawingState.polygonPoints[i][0], drawingState.polygonPoints[i][1]);
      }
      if (drawingState.currentX && drawingState.currentY) {
        ctx.lineTo(drawingState.currentX, drawingState.currentY);
      }
      ctx.stroke();
      
      // Draw points
      for (const point of drawingState.polygonPoints) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b35';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [project.canvasSize, backgrounds, actors, playback.currentTime, ui.selectedActorId, ui.selectedBackgroundId, ui.tool, drawingState]);

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle file drop for background images
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            addBackground(dataUrl, img.width, img.height);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
    }
  }, [addBackground]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e);

    if (ui.tool === 'rectangle') {
      setDrawingState({
        isDrawing: true,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        polygonPoints: [],
      });
    }
  }, [ui.tool, getCanvasCoords]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e);

    if (drawingState.isDrawing && ui.tool === 'rectangle') {
      setDrawingState((prev) => ({
        ...prev,
        currentX: x,
        currentY: y,
      }));
    } else if (ui.tool === 'polygon' && drawingState.polygonPoints.length > 0) {
      setDrawingState((prev) => ({
        ...prev,
        currentX: x,
        currentY: y,
      }));
    }
  }, [drawingState.isDrawing, drawingState.polygonPoints.length, ui.tool, getCanvasCoords]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (drawingState.isDrawing && ui.tool === 'rectangle') {
      const { x, y } = getCanvasCoords(e);
      const rectX = Math.min(drawingState.startX, x);
      const rectY = Math.min(drawingState.startY, y);
      const width = Math.abs(x - drawingState.startX);
      const height = Math.abs(y - drawingState.startY);

      if (width > 10 && height > 10) {
        const polygon: RectanglePolygon = {
          type: 'rectangle',
          x: rectX,
          y: rectY,
          width,
          height,
        };
        setPendingShape(polygon);
        setShowActorAssignModal(true);
      }

      setDrawingState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        polygonPoints: [],
      });
    }
  }, [drawingState, ui.tool, getCanvasCoords]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e);

    if (ui.tool === 'polygon') {
      // Check if clicking near the first point to close the polygon
      if (drawingState.polygonPoints.length >= 3) {
        const firstPoint = drawingState.polygonPoints[0];
        const distance = Math.sqrt(
          Math.pow(x - firstPoint[0], 2) + Math.pow(y - firstPoint[1], 2)
        );
        if (distance < 15) {
          // Close the polygon
          const polygon: ArbitraryPolygon = {
            type: 'polygon',
            points: [...drawingState.polygonPoints],
          };
          setPendingShape(polygon);
          setShowActorAssignModal(true);
          setDrawingState({
            isDrawing: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            polygonPoints: [],
          });
          return;
        }
      }
      
      // Add point to polygon
      setDrawingState((prev) => ({
        ...prev,
        polygonPoints: [...prev.polygonPoints, [x, y]],
        currentX: x,
        currentY: y,
      }));
      return;
    }

    if (ui.tool === 'select') {
      // Check if clicked on an actor shape
      for (const actor of [...actors].reverse()) {
        if (!actor.shape) continue;
        if (isPointInPolygon(x, y, actor.shape.geometry)) {
          selectActor(actor.id);
          return;
        }
      }

      // Check if clicked on a background
      for (const bg of [...backgrounds].reverse()) {
        if (x >= bg.x && x <= bg.x + bg.width && y >= bg.y && y <= bg.y + bg.height) {
          selectBackground(bg.id);
          return;
        }
      }

      // Deselect all
      selectActor(null);
      selectBackground(null);
    }
  }, [ui.tool, actors, backgrounds, selectActor, selectBackground, drawingState.polygonPoints, getCanvasCoords]);

  // Handle double-click to finish polygon
  const handleDoubleClick = useCallback(() => {
    if (ui.tool === 'polygon' && drawingState.polygonPoints.length >= 3) {
      const polygon: ArbitraryPolygon = {
        type: 'polygon',
        points: [...drawingState.polygonPoints],
      };
      setPendingShape(polygon);
      setShowActorAssignModal(true);
      setDrawingState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        polygonPoints: [],
      });
    }
  }, [ui.tool, drawingState.polygonPoints]);

  // Assign shape to actor
  const handleAssignToActor = (actorId: string) => {
    if (pendingShape) {
      const shape: Shape = {
        geometry: pendingShape,
        offColor: '#333333',
        onColor: '#ffcc00',
      };
      setActorShape(actorId, shape);
    }
    setPendingShape(null);
    setShowActorAssignModal(false);
    setTool('select');
  };

  // Cancel shape creation
  const handleCancelShape = () => {
    setPendingShape(null);
    setShowActorAssignModal(false);
  };

  // Handle escape key to cancel drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawingState({
          isDrawing: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
          polygonPoints: [],
        });
        setPendingShape(null);
        setShowActorAssignModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-full flex flex-col relative">
      {/* Canvas toolbar */}
      <div className="h-10 flex items-center gap-2 px-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <span className="text-[var(--color-text-secondary)] text-sm mr-4">Tools:</span>
        
        <button
          onClick={() => setTool('select')}
          className={`p-2 rounded transition-colors ${
            ui.tool === 'select' 
              ? 'bg-[var(--color-accent)] text-white' 
              : 'hover:bg-[var(--color-bg-tertiary)]'
          }`}
          title="Select (V)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>
        
        <button
          onClick={() => setTool('rectangle')}
          className={`p-2 rounded transition-colors ${
            ui.tool === 'rectangle' 
              ? 'bg-[var(--color-accent)] text-white' 
              : 'hover:bg-[var(--color-bg-tertiary)]'
          }`}
          title="Rectangle (R)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
          </svg>
        </button>
        
        <button
          onClick={() => setTool('polygon')}
          className={`p-2 rounded transition-colors ${
            ui.tool === 'polygon' 
              ? 'bg-[var(--color-accent)] text-white' 
              : 'hover:bg-[var(--color-bg-tertiary)]'
          }`}
          title="Polygon (P)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" strokeWidth={2} />
          </svg>
        </button>

        <div className="flex-1" />

        <span className="text-[var(--color-text-secondary)] text-xs">
          {project.canvasSize.width} × {project.canvasSize.height}
        </span>
        
        <span className="text-[var(--color-text-secondary)] text-xs ml-4">
          {ui.tool === 'polygon' && drawingState.polygonPoints.length > 0 
            ? `Drawing polygon (${drawingState.polygonPoints.length} points) - Click near first point or double-click to finish`
            : 'Drop images to add backgrounds'}
        </span>
      </div>

      {/* Canvas container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-[var(--color-bg-primary)] p-4"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="max-w-full max-h-full object-contain shadow-2xl"
          style={{
            cursor: ui.tool === 'select' ? 'default' : 'crosshair',
          }}
        />
      </div>

      {/* Actor assignment modal */}
      {showActorAssignModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-xl border border-[var(--color-border)] max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Assign Shape to Actor</h3>
            
            {actors.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] mb-4">
                No actors available. Create an actor first using the "Add Actor" button in the timeline.
              </p>
            ) : (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {actors.map((actor) => (
                  <button
                    key={actor.id}
                    onClick={() => handleAssignToActor(actor.id)}
                    className={`w-full p-3 rounded text-left transition-colors ${
                      actor.shape 
                        ? 'bg-[var(--color-bg-tertiary)] opacity-50' 
                        : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] hover:text-white'
                    }`}
                    disabled={!!actor.shape}
                  >
                    <span className="font-medium">{actor.label}</span>
                    {actor.shape && (
                      <span className="text-xs ml-2 opacity-70">(has shape)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={handleCancelShape}
                className="flex-1 px-4 py-2 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function drawPolygon(ctx: CanvasRenderingContext2D, polygon: Polygon) {
  ctx.beginPath();
  
  if (polygon.type === 'rectangle') {
    const rect = polygon as RectanglePolygon;
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
  } else {
    const poly = polygon as ArbitraryPolygon;
    if (poly.points.length > 0) {
      ctx.moveTo(poly.points[0][0], poly.points[0][1]);
      for (let i = 1; i < poly.points.length; i++) {
        ctx.lineTo(poly.points[i][0], poly.points[i][1]);
      }
      ctx.closePath();
    }
  }
  
  ctx.fill();
  ctx.stroke();
}

function getPolygonBounds(polygon: Polygon): { centerX: number; centerY: number } {
  if (polygon.type === 'rectangle') {
    const rect = polygon as RectanglePolygon;
    return {
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + rect.height / 2,
    };
  } else {
    const poly = polygon as ArbitraryPolygon;
    if (poly.points.length === 0) return { centerX: 0, centerY: 0 };
    
    const xs = poly.points.map(p => p[0]);
    const ys = poly.points.map(p => p[1]);
    return {
      centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
      centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }
}

function isPointInPolygon(x: number, y: number, polygon: Polygon): boolean {
  if (polygon.type === 'rectangle') {
    const rect = polygon as RectanglePolygon;
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  } else {
    const poly = polygon as ArbitraryPolygon;
    // Ray casting algorithm
    let inside = false;
    const points = poly.points;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i][0], yi = points[i][1];
      const xj = points[j][0], yj = points[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
}
