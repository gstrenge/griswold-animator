# Griswold - Light Show Animator

A browser-based, serverless light show animator for creating synchronized light displays. Works entirely offline with no server required.

## Features

- **Timeline Editor**: Add actors with keyframe-based animation synced to audio
- **Audio Support**: Load MP3/WAV files with waveform visualization  
- **Canvas Visualization**: Draw polygons to represent lights, see real-time color interpolation
- **Drawing Tools**: Rectangle and arbitrary polygon drawing with actor assignment
- **Export Options**: 
  - `.gris` project files for saving/loading projects
  - JSON cue export with configurable tick rate
- **Undo/Redo**: Full history tracking for all edits
- **Auto-save**: Projects automatically saved to localStorage
- **Keyboard Shortcuts**: Space (play/pause), arrow keys (step), Ctrl+Z/Y (undo/redo), V/R/P (tools)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Create or Load a Project**: From the landing page, create a new project or load an existing `.gris` file

2. **Load Audio**: Click on the audio track or drag-and-drop an audio file

3. **Add Actors**: Click "Add Actor" to create light actors

4. **Add Keyframes**: Double-click on an actor track to add keyframes
   - Click keyframes to edit values (0-1)
   - Drag keyframes to adjust timing
   - Right-click to delete

5. **Draw Shapes**: Use the Rectangle or Polygon tool to draw shapes on the canvas
   - Rectangle: Click and drag
   - Polygon: Click to add points, click near first point or double-click to close
   - Assign shapes to actors for visualization

6. **Export**: 
   - Save Project: Export `.gris` file with all project data
   - Export Cues: Generate JSON with state values at configurable tick intervals

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← / → | Step backward/forward (0.1s) |
| Shift + ← / → | Step backward/forward (1s) |
| Home / End | Skip to start/end |
| Ctrl + Z | Undo |
| Ctrl + Y / Ctrl + Shift + Z | Redo |
| V | Select tool |
| R | Rectangle tool |
| P | Polygon tool |
| Escape | Cancel current drawing |

## Export Format

### Cues JSON
```json
[
  {"t": 0.0, "id": "Actor 1", "state": 0.0},
  {"t": 0.1, "id": "Actor 1", "state": 0.5},
  {"t": 0.2, "id": "Actor 1", "state": 1.0}
]
```

### Project File (.gris)
```json
{
  "version": 1,
  "project": {
    "name": "My Show",
    "songFilename": "song.mp3",
    "canvasSize": {"width": 1920, "height": 1080}
  },
  "actors": [...],
  "backgrounds": [...]
}
```

## Tech Stack

- React 18 + TypeScript
- Zustand (state management with undo/redo)
- Vite (build tool)
- Tailwind CSS
- Web Audio API
- HTML5 Canvas

## License

MIT
