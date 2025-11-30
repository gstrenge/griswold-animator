// ============================================================================
// Polygon Types
// ============================================================================

export interface RectanglePolygon {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArbitraryPolygon {
  type: 'polygon';
  points: [number, number][];
}

export type Polygon = RectanglePolygon | ArbitraryPolygon;

// ============================================================================
// Actor Visualization
// ============================================================================

export interface Shape {
  geometry: Polygon;
  offColor: string;  // Color when state = 0
  onColor: string;   // Color when state = 1
}

// ============================================================================
// Keyframes (sparse storage)
// ============================================================================

export interface KeyFrame {
  time: number;  // seconds
  value: number; // 0-1
}

// ============================================================================
// Actor
// ============================================================================

export interface Actor {
  id: string;
  label: string;
  shape: Shape | null;  // null if no shape assigned yet
  keyframes: KeyFrame[];
}

// ============================================================================
// Canvas Background
// ============================================================================

export interface CanvasBackground {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

// ============================================================================
// Project
// ============================================================================

export interface Project {
  name: string;
  songFilename: string;
  canvasSize: { width: number; height: number };
}

// ============================================================================
// Playback State
// ============================================================================

export interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}

// ============================================================================
// UI State
// ============================================================================

export interface UIState {
  selectedActorId: string | null;
  selectedBackgroundId: string | null;
  zoom: number;  // pixels per second
  scrollX: number;
  scrollY: number;
  tool: 'select' | 'rectangle' | 'polygon';
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ExportedCue {
  t: number;
  id: string;
  state: number;
}

export interface GrisFile {
  version: number;
  project: Project;
  actors: Actor[];
  backgrounds: CanvasBackground[];
}

