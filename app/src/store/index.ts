import { create } from 'zustand';
import { temporal } from 'zundo';
import type { 
  Project, 
  Actor, 
  CanvasBackground, 
  PlaybackState, 
  UIState,
  KeyFrame,
  Shape,
  InterpolationType
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Store State Interface
// ============================================================================

interface ProjectState {
  // Core data (tracked for undo/redo)
  project: Project;
  actors: Actor[];
  backgrounds: CanvasBackground[];
  
  // Playback state (not tracked for undo)
  playback: PlaybackState;
  
  // UI state (not tracked for undo)
  ui: UIState;
  
  // Audio data (runtime only, not persisted)
  audioBuffer: AudioBuffer | null;
  audioFile: File | null;
}

interface ProjectActions {
  // Project actions
  setProject: (project: Partial<Project>) => void;
  resetProject: () => void;
  loadProject: (project: Project, actors: Actor[], backgrounds: CanvasBackground[]) => void;
  
  // Actor actions
  addActor: (label: string) => string;
  removeActor: (id: string) => void;
  updateActor: (id: string, updates: Partial<Actor>) => void;
  setActorShape: (actorId: string, shape: Shape | null) => void;
  
  // Keyframe actions
  addKeyframe: (actorId: string, keyframe: KeyFrame) => void;
  removeKeyframe: (actorId: string, time: number) => void;
  updateKeyframe: (actorId: string, time: number, value: number) => void;
  
  // Background actions
  addBackground: (dataUrl: string, width: number, height: number) => string;
  removeBackground: (id: string) => void;
  updateBackground: (id: string, updates: Partial<CanvasBackground>) => void;
  
  // Playback actions
  setPlayback: (playback: Partial<PlaybackState>) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  
  // UI actions
  setUI: (ui: Partial<UIState>) => void;
  selectActor: (id: string | null) => void;
  selectBackground: (id: string | null) => void;
  setTool: (tool: UIState['tool']) => void;
  setZoom: (zoom: number) => void;
  
  // Audio actions
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  setAudioFile: (file: File | null) => void;
}

type ProjectStore = ProjectState & ProjectActions;

// ============================================================================
// Initial State
// ============================================================================

const initialProject: Project = {
  name: 'Untitled Project',
  songFilename: '',
  canvasSize: { width: 1920, height: 1080 },
};

const initialPlayback: PlaybackState = {
  currentTime: 0,
  isPlaying: false,
  duration: 0,
};

const initialUI: UIState = {
  selectedActorId: null,
  selectedBackgroundId: null,
  zoom: 100, // 100 pixels per second
  scrollX: 0,
  scrollY: 0,
  tool: 'select',
};

const initialState: ProjectState = {
  project: initialProject,
  actors: [],
  backgrounds: [],
  playback: initialPlayback,
  ui: initialUI,
  audioBuffer: null,
  audioFile: null,
};

// ============================================================================
// Store Creation with Temporal (Undo/Redo)
// ============================================================================

export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set, get) => ({
      ...initialState,

      // Project actions
      setProject: (updates) =>
        set((state) => ({
          project: { ...state.project, ...updates },
        })),

      resetProject: () =>
        set({
          ...initialState,
          playback: initialPlayback,
          ui: initialUI,
        }),

      loadProject: (project, actors, backgrounds) =>
        set({
          project,
          actors,
          backgrounds,
          ui: { ...initialUI },
        }),

      // Actor actions
      addActor: (label) => {
        const id = uuidv4();
        set((state) => ({
          actors: [
            ...state.actors,
            {
              id,
              label,
              shape: null,
              keyframes: [],
              interpolation: 'step' as InterpolationType,
            },
          ],
        }));
        return id;
      },

      removeActor: (id) =>
        set((state) => ({
          actors: state.actors.filter((a) => a.id !== id),
          ui: state.ui.selectedActorId === id 
            ? { ...state.ui, selectedActorId: null }
            : state.ui,
        })),

      updateActor: (id, updates) =>
        set((state) => ({
          actors: state.actors.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),

      setActorShape: (actorId, shape) =>
        set((state) => ({
          actors: state.actors.map((a) =>
            a.id === actorId ? { ...a, shape } : a
          ),
        })),

      // Keyframe actions
      addKeyframe: (actorId, keyframe) =>
        set((state) => ({
          actors: state.actors.map((a) => {
            if (a.id !== actorId) return a;
            // Remove any existing keyframe at the same time, then add new one
            const filtered = a.keyframes.filter((k) => k.time !== keyframe.time);
            const newKeyframes = [...filtered, keyframe].sort((x, y) => x.time - y.time);
            return { ...a, keyframes: newKeyframes };
          }),
        })),

      removeKeyframe: (actorId, time) =>
        set((state) => ({
          actors: state.actors.map((a) =>
            a.id === actorId
              ? { ...a, keyframes: a.keyframes.filter((k) => k.time !== time) }
              : a
          ),
        })),

      updateKeyframe: (actorId, time, value) =>
        set((state) => ({
          actors: state.actors.map((a) =>
            a.id === actorId
              ? {
                  ...a,
                  keyframes: a.keyframes.map((k) =>
                    k.time === time ? { ...k, value } : k
                  ),
                }
              : a
          ),
        })),

      // Background actions
      addBackground: (dataUrl, width, height) => {
        const id = uuidv4();
        const state = get();
        const maxZIndex = Math.max(0, ...state.backgrounds.map((b) => b.zIndex));
        set((state) => ({
          backgrounds: [
            ...state.backgrounds,
            {
              id,
              dataUrl,
              x: 0,
              y: 0,
              width,
              height,
              zIndex: maxZIndex + 1,
            },
          ],
        }));
        // Update canvas size if this image is larger
        const currentSize = state.project.canvasSize;
        if (width > currentSize.width || height > currentSize.height) {
          set((s) => ({
            project: {
              ...s.project,
              canvasSize: {
                width: Math.max(currentSize.width, width),
                height: Math.max(currentSize.height, height),
              },
            },
          }));
        }
        return id;
      },

      removeBackground: (id) =>
        set((state) => ({
          backgrounds: state.backgrounds.filter((b) => b.id !== id),
          ui: state.ui.selectedBackgroundId === id
            ? { ...state.ui, selectedBackgroundId: null }
            : state.ui,
        })),

      updateBackground: (id, updates) =>
        set((state) => ({
          backgrounds: state.backgrounds.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        })),

      // Playback actions
      setPlayback: (updates) =>
        set((state) => ({
          playback: { ...state.playback, ...updates },
        })),

      play: () =>
        set((state) => ({
          playback: { ...state.playback, isPlaying: true },
        })),

      pause: () =>
        set((state) => ({
          playback: { ...state.playback, isPlaying: false },
        })),

      seek: (time) =>
        set((state) => ({
          playback: { 
            ...state.playback, 
            currentTime: Math.max(0, Math.min(time, state.playback.duration)) 
          },
        })),

      // UI actions
      setUI: (updates) =>
        set((state) => ({
          ui: { ...state.ui, ...updates },
        })),

      selectActor: (id) =>
        set((state) => ({
          ui: { ...state.ui, selectedActorId: id, selectedBackgroundId: null },
        })),

      selectBackground: (id) =>
        set((state) => ({
          ui: { ...state.ui, selectedBackgroundId: id, selectedActorId: null },
        })),

      setTool: (tool) =>
        set((state) => ({
          ui: { ...state.ui, tool },
        })),

      setZoom: (zoom) =>
        set((state) => ({
          ui: { ...state.ui, zoom: Math.max(10, Math.min(500, zoom)) },
        })),

      // Audio actions
      setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),
      setAudioFile: (file) => set({ audioFile: file }),
    }),
    {
      // Temporal options - only track certain state for undo/redo
      partialize: (state) => ({
        project: state.project,
        actors: state.actors,
        backgrounds: state.backgrounds,
      }),
      limit: 100, // Keep last 100 states
    }
  )
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the interpolated value of an actor at a given time
 */
export function getActorValueAtTime(actor: Actor, time: number): number {
  const { keyframes, interpolation } = actor;
  
  if (keyframes.length === 0) return 0;
  
  // Find surrounding keyframes
  let before: KeyFrame | null = null;
  let after: KeyFrame | null = null;
  
  for (const kf of keyframes) {
    if (kf.time <= time) {
      before = kf;
    }
    if (kf.time >= time && !after) {
      after = kf;
    }
  }
  
  // If no keyframe before, use the first keyframe's value
  if (!before) return after?.value ?? 0;
  
  // If no keyframe after, use the last keyframe's value
  if (!after) return before.value;
  
  // If same keyframe, return its value
  if (before.time === after.time) return before.value;
  
  // Apply interpolation based on actor's interpolation type
  switch (interpolation) {
    case 'linear': {
      const t = (time - before.time) / (after.time - before.time);
      return before.value + t * (after.value - before.value);
    }
    case 'step':
    default:
      // Step: hold previous value until next keyframe
      return before.value;
  }
}

/**
 * Interpolate between two colors based on a value 0-1
 */
export function interpolateColor(offColor: string, onColor: string, value: number): string {
  // Parse hex colors
  const parseHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  const off = parseHex(offColor);
  const on = parseHex(onColor);

  const r = Math.round(off.r + (on.r - off.r) * value);
  const g = Math.round(off.g + (on.g - off.g) * value);
  const b = Math.round(off.b + (on.b - off.b) * value);

  return `rgb(${r}, ${g}, ${b})`;
}

