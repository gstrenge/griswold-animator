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
// Interpolation Types
// ============================================================================

export type InterpolationType = 'step' | 'linear';

export const INTERPOLATION_OPTIONS: { value: InterpolationType; label: string }[] = [
  { value: 'step', label: 'Step' },
  { value: 'linear', label: 'Linear' },
];

// ============================================================================
// Actor
// ============================================================================

export interface Actor {
  id: string;
  label: string;
  shapes: Shape[];  // Array of shapes (supports disconnected polygons)
  keyframes: KeyFrame[];
  interpolation: InterpolationType;
}

// Legacy Actor type for migration (v1 format)
export interface ActorV1 {
  id: string;
  label: string;
  shape: Shape | null;
  keyframes: KeyFrame[];
  interpolation: InterpolationType;
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
  backgroundOpacity: number;  // 0-1, controls opacity of all background images
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ExportedCue {
  t: number;
  id: string;
  state: number;
}

// Current version of the file format
export const GRIS_FILE_VERSION = 2;

export interface GrisFile {
  version: number;
  project: Project;
  actors: Actor[];
  backgrounds: CanvasBackground[];
}

// Legacy file format (v1) for migration
export interface GrisFileV1 {
  version: number;
  project: Project;
  actors: ActorV1[];
  backgrounds: CanvasBackground[];
}

// Migration function: converts any version to current
export function migrateGrisFile(data: unknown): GrisFile {
  const file = data as GrisFileV1 & { version?: number };
  
  // Handle v1 or missing version (shape → shapes)
  if (!file.version || file.version === 1) {
    return {
      version: GRIS_FILE_VERSION,
      project: file.project,
      backgrounds: file.backgrounds || [],
      actors: (file.actors || []).map((actor: ActorV1) => ({
        id: actor.id,
        label: actor.label,
        shapes: actor.shape ? [actor.shape] : [],
        keyframes: actor.keyframes || [],
        interpolation: actor.interpolation || 'step',
      })),
    };
  }
  
  // Already current version
  return file as unknown as GrisFile;
}

