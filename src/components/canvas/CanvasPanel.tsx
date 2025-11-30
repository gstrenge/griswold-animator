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

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  panStartX: number;
  panStartY: number;
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

  const [viewState, setViewState] = useState<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
  });

  const [showActorAssignModal, setShowActorAssignModal] = useState(false);
  const [pendingShape, setPendingShape] = useState<Polygon | null>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  
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
    addActorShape,
    clearActorShapes,
    updateActorShapeColors,
    setUI,
  } = useProjectStore();

  // Get the currently selected actor
  const selectedActor = actors.find(a => a.id === ui.selectedActorId) || null;

  // Handle color changes for selected actor's shapes (applies to all shapes)
  const handleColorChange = (colorType: 'off' | 'on', color: string) => {
    if (selectedActor && selectedActor.shapes.length > 0) {
      const currentShape = selectedActor.shapes[0]; // Use first shape as reference
      const offColor = colorType === 'off' ? color : currentShape.offColor;
      const onColor = colorType === 'on' ? color : currentShape.onColor;
      updateActorShapeColors(selectedActor.id, offColor, onColor);
    }
  };

  // Handle removing all shapes from actor
  const handleRemoveShapes = () => {
    if (selectedActor) {
      clearActorShapes(selectedActor.id);
      selectActor(null);
    }
  };

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

  // Get canvas coordinates from mouse event (accounting for zoom and pan)
  const getCanvasCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;
    
    // Mouse position relative to container center
    const mouseX = e.clientX - rect.left - containerCenterX;
    const mouseY = e.clientY - rect.top - containerCenterY;
    
    // Convert to canvas coordinates
    const canvasX = (mouseX - viewState.panX) / viewState.zoom + project.canvasSize.width / 2;
    const canvasY = (mouseY - viewState.panY) / viewState.zoom + project.canvasSize.height / 2;
    
    return { x: canvasX, y: canvasY };
  }, [viewState.zoom, viewState.panX, viewState.panY, project.canvasSize]);

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

    // Draw backgrounds (sorted by zIndex) with opacity
    ctx.globalAlpha = ui.backgroundOpacity;
    const sortedBackgrounds = [...backgrounds].sort((a, b) => a.zIndex - b.zIndex);
    for (const bg of sortedBackgrounds) {
      const img = imageCache.current.get(bg.id);
      if (img && img.complete) {
        ctx.drawImage(img, bg.x, bg.y, bg.width, bg.height);
        
        // Draw selection border (at full opacity)
        if (ui.selectedBackgroundId === bg.id) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(bg.x, bg.y, bg.width, bg.height);
          ctx.setLineDash([]);
          ctx.globalAlpha = ui.backgroundOpacity;
        }
      }
    }
    ctx.globalAlpha = 1; // Reset to full opacity for other elements

    // Draw actor shapes
    for (const actor of actors) {
      if (actor.shapes.length === 0) continue;

      const value = getActorValueAtTime(actor, playback.currentTime);
      const isSelected = ui.selectedActorId === actor.id;
      
      // Draw all shapes for this actor
      let labelBounds: { centerX: number; centerY: number } | null = null;
      
      for (const shape of actor.shapes) {
        const color = interpolateColor(shape.offColor, shape.onColor, value);
        
        ctx.fillStyle = color;
        ctx.strokeStyle = isSelected ? '#ff6b35' : '#ffffff';
        ctx.lineWidth = isSelected ? 3 : 1;

        drawPolygon(ctx, shape.geometry);
        
        // Use first shape's bounds for label position
        if (!labelBounds) {
          labelBounds = getPolygonBounds(shape.geometry);
        }
      }

      // Draw actor label on first shape
      if (labelBounds) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text background
        const textWidth = ctx.measureText(actor.label).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(labelBounds.centerX - textWidth / 2 - 4, labelBounds.centerY - 10, textWidth + 8, 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(actor.label, labelBounds.centerX, labelBounds.centerY);
      }
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
  }, [project.canvasSize, backgrounds, actors, playback.currentTime, ui.selectedActorId, ui.selectedBackgroundId, ui.backgroundOpacity, ui.tool, drawingState]);

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

  // Zoom functions
  const handleZoomIn = () => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.25, 5),
    }));
  };

  const handleZoomOut = () => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.25, 0.1),
    }));
  };

  const handleFitToView = () => {
    const container = containerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const padding = 40;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;
    
    const scaleX = availableWidth / project.canvasSize.width;
    const scaleY = availableHeight / project.canvasSize.height;
    const zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in past 100%
    
    setViewState({
      zoom,
      panX: 0,
      panY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
    });
  };

  const handleResetZoom = () => {
    setViewState({
      zoom: 1,
      panX: 0,
      panY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
    });
  };

  // Handle mouse wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(viewState.zoom * delta, 0.1), 5);
    
    // Zoom toward mouse position
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      const zoomRatio = newZoom / viewState.zoom;
      const newPanX = mouseX - (mouseX - viewState.panX) * zoomRatio;
      const newPanY = mouseY - (mouseY - viewState.panY) * zoomRatio;
      
      setViewState(prev => ({
        ...prev,
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      }));
    }
  }, [viewState.zoom, viewState.panX, viewState.panY]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or ctrl+left click for panning
    if (e.button === 1 || (ctrlPressed && e.button === 0)) {
      e.preventDefault();
      setViewState(prev => ({
        ...prev,
        isPanning: true,
        panStartX: e.clientX - prev.panX,
        panStartY: e.clientY - prev.panY,
      }));
      return;
    }

    if (e.button !== 0) return;
    
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
  }, [ui.tool, getCanvasCoords, ctrlPressed]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle panning
    if (viewState.isPanning) {
      setViewState(prev => ({
        ...prev,
        panX: e.clientX - prev.panStartX,
        panY: e.clientY - prev.panStartY,
      }));
      return;
    }

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
  }, [viewState.isPanning, drawingState.isDrawing, drawingState.polygonPoints.length, ui.tool, getCanvasCoords]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Stop panning
    if (viewState.isPanning) {
      setViewState(prev => ({
        ...prev,
        isPanning: false,
      }));
      return;
    }

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
  }, [viewState.isPanning, drawingState, ui.tool, getCanvasCoords]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Don't handle click if we were panning
    if (viewState.isPanning) return;
    
    const { x, y } = getCanvasCoords(e);

    if (ui.tool === 'polygon') {
      // Check if clicking near the first point to close the polygon
      if (drawingState.polygonPoints.length >= 3) {
        const firstPoint = drawingState.polygonPoints[0];
        const distance = Math.sqrt(
          Math.pow(x - firstPoint[0], 2) + Math.pow(y - firstPoint[1], 2)
        );
        if (distance < 15 / viewState.zoom) { // Adjust for zoom
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
      // Check if clicked on any of an actor's shapes
      for (const actor of [...actors].reverse()) {
        if (actor.shapes.length === 0) continue;
        for (const shape of actor.shapes) {
          if (isPointInPolygon(x, y, shape.geometry)) {
            selectActor(actor.id);
            return;
          }
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
  }, [ui.tool, actors, backgrounds, selectActor, selectBackground, drawingState.polygonPoints, getCanvasCoords, viewState.isPanning, viewState.zoom]);

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

  // Assign shape to actor (add to actor's shapes array)
  const handleAssignToActor = (actorId: string) => {
    if (pendingShape) {
      // Find the actor to get existing colors (if any)
      const actor = actors.find(a => a.id === actorId);
      const existingShape = actor?.shapes[0];
      
      const shape: Shape = {
        geometry: pendingShape,
        // Use existing colors if actor already has shapes, otherwise defaults
        offColor: existingShape?.offColor || '#333333',
        onColor: existingShape?.onColor || '#ffcc00',
      };
      addActorShape(actorId, shape);
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

  // Handle keyboard events for panning and escape
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
      if (e.key === 'Control' && !e.repeat) {
        setCtrlPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setCtrlPressed(false);
        setViewState(prev => ({ ...prev, isPanning: false }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Determine cursor
  const getCursor = () => {
    if (viewState.isPanning || ctrlPressed) return 'grab';
    if (ui.tool === 'select') return 'default';
    return 'crosshair';
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Canvas toolbar */}
      <div className="h-10 flex items-center gap-2 px-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <span className="text-[var(--color-text-secondary)] text-sm mr-2">Tools:</span>
        
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

        <div className="w-px h-6 bg-[var(--color-border)] mx-2" />

        {/* Zoom controls */}
        <button
          onClick={handleZoomOut}
          className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Zoom Out (-)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        
        <span className="text-xs text-[var(--color-text-secondary)] w-14 text-center">
          {Math.round(viewState.zoom * 100)}%
        </span>
        
        <button
          onClick={handleZoomIn}
          className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Zoom In (+)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>

        <button
          onClick={handleFitToView}
          className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Fit to View"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <button
          onClick={handleResetZoom}
          className="px-2 py-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors text-xs"
          title="Reset to 100%"
        >
          100%
        </button>

        <div className="w-px h-6 bg-[var(--color-border)] mx-2" />

        {/* Background opacity slider */}
        <div className="flex items-center gap-2" title="Background image opacity">
          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={ui.backgroundOpacity}
            onChange={(e) => setUI({ backgroundOpacity: parseFloat(e.target.value) })}
            className="w-20 h-1 accent-[var(--color-accent)] cursor-pointer"
          />
          <span className="text-xs text-[var(--color-text-secondary)] w-8">
            {Math.round(ui.backgroundOpacity * 100)}%
          </span>
        </div>

        <div className="flex-1" />

        <span className="text-[var(--color-text-secondary)] text-xs">
          {project.canvasSize.width} × {project.canvasSize.height}
        </span>
        
        <span className="text-[var(--color-text-secondary)] text-xs ml-4">
          {ui.tool === 'polygon' && drawingState.polygonPoints.length > 0 
            ? `Drawing polygon (${drawingState.polygonPoints.length} points)`
            : ctrlPressed ? 'Pan mode (release Ctrl)' : 'Scroll to zoom • Ctrl+drag to pan'}
        </span>
      </div>

      {/* Canvas container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-[var(--color-bg-primary)]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setViewState(prev => ({ ...prev, isPanning: false }))}
        style={{ cursor: getCursor() }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleDoubleClick}
          className="shadow-2xl"
          style={{
            transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
            transformOrigin: 'center center',
            imageRendering: viewState.zoom > 1 ? 'pixelated' : 'auto',
          }}
        />
      </div>

      {/* Selected actor color editor panel */}
      {selectedActor && selectedActor.shapes.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-[var(--color-bg-secondary)] rounded-lg p-4 shadow-xl border border-[var(--color-border)] w-64 z-40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-sm">{selectedActor.label}</h4>
              {selectedActor.shapes.length > 1 && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {selectedActor.shapes.length} shapes (colors synced)
                </span>
              )}
            </div>
            <button
              onClick={() => selectActor(null)}
              className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
              title="Deselect"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Off color */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--color-text-secondary)] w-12">Off:</label>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="color"
                  value={selectedActor.shapes[0].offColor}
                  onChange={(e) => handleColorChange('off', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-[var(--color-border)]"
                />
                <input
                  type="text"
                  value={selectedActor.shapes[0].offColor}
                  onChange={(e) => handleColorChange('off', e.target.value)}
                  className="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]"
                />
              </div>
            </div>
            
            {/* On color */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--color-text-secondary)] w-12">On:</label>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="color"
                  value={selectedActor.shapes[0].onColor}
                  onChange={(e) => handleColorChange('on', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-[var(--color-border)]"
                />
                <input
                  type="text"
                  value={selectedActor.shapes[0].onColor}
                  onChange={(e) => handleColorChange('on', e.target.value)}
                  className="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]"
                />
              </div>
            </div>

            {/* Color preview */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
              <span className="text-xs text-[var(--color-text-secondary)]">Preview:</span>
              <div 
                className="w-8 h-8 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: selectedActor.shapes[0].offColor }}
                title="Off state"
              />
              <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <div 
                className="w-8 h-8 rounded border border-[var(--color-border)]"
                style={{ backgroundColor: selectedActor.shapes[0].onColor }}
                title="On state"
              />
            </div>
            
            {/* Remove all shapes button */}
            <button
              onClick={handleRemoveShapes}
              className="w-full mt-2 px-3 py-2 text-xs rounded bg-red-500/20 text-red-400 
                         hover:bg-red-500/30 transition-colors border border-red-500/30"
            >
              Remove All Shapes ({selectedActor.shapes.length})
            </button>
          </div>
        </div>
      )}

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
                    className="w-full p-3 rounded text-left transition-colors
                               bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] hover:text-white"
                  >
                    <span className="font-medium">{actor.label}</span>
                    {actor.shapes.length > 0 && (
                      <span className="text-xs ml-2 opacity-70">
                        ({actor.shapes.length} shape{actor.shapes.length !== 1 ? 's' : ''})
                      </span>
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
