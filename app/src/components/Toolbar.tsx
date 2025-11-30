import { useState } from 'react';
import { useProjectStore, getActorValueAtTime } from '../store';
import type { GrisFile, ExportedCue } from '../types';

interface ToolbarProps {
  onHome: () => void;
}

export default function Toolbar({ onHome }: ToolbarProps) {
  const { project, actors, backgrounds, playback, setProject } = useProjectStore();
  const { undo, redo, pastStates, futureStates } = useProjectStore.temporal.getState();
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [tickRate, setTickRate] = useState(0.1); // Default 100ms

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const handleExportGris = () => {
    const data: GrisFile = {
      version: 1,
      project,
      actors,
      backgrounds,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'project'}.gris`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCues = () => {
    setShowExportModal(true);
  };

  const generateCues = (): ExportedCue[] => {
    const cues: ExportedCue[] = [];
    const duration = playback.duration || 0;
    
    if (duration === 0) {
      // No audio loaded, generate cues from keyframes only
      for (const actor of actors) {
        // Add initial state
        cues.push({
          t: 0,
          id: actor.label,
          state: getActorValueAtTime(actor, 0),
        });
        
        // Add keyframe states
        for (const kf of actor.keyframes) {
          cues.push({
            t: kf.time,
            id: actor.label,
            state: kf.value,
          });
        }
      }
    } else {
      // Generate cues at regular intervals based on tick rate
      for (let t = 0; t <= duration; t += tickRate) {
        for (const actor of actors) {
          const value = getActorValueAtTime(actor, t);
          cues.push({
            t: Math.round(t * 1000) / 1000, // Round to avoid floating point issues
            id: actor.label,
            state: Math.round(value * 1000) / 1000,
          });
        }
      }
    }
    
    // Sort by time, then by id
    cues.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
    
    return cues;
  };

  const handleDownloadCues = () => {
    const cues = generateCues();
    const json = JSON.stringify(cues, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'project'}-cues.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProject({ name: e.target.value });
  };

  return (
    <>
      <div className="h-14 flex items-center justify-between px-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        {/* Left section - Logo and project name */}
        <div className="flex items-center gap-4">
          <button
            onClick={onHome}
            className="text-[var(--color-accent)] font-bold text-lg hover:opacity-80 transition-opacity"
          >
            GRISWOLD
          </button>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <input
            type="text"
            value={project.name}
            onChange={handleProjectNameChange}
            className="bg-transparent border-none outline-none text-[var(--color-text-primary)]
                       px-2 py-1 rounded hover:bg-[var(--color-bg-tertiary)] focus:bg-[var(--color-bg-tertiary)]
                       transition-colors w-48"
            placeholder="Project name..."
          />
        </div>

        {/* Center section - Undo/Redo */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 
                       disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 
                       disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Right section - Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCues}
            disabled={actors.length === 0}
            className="px-4 py-2 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                       hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors text-sm"
          >
            Export Cues
          </button>
          <button
            onClick={handleExportGris}
            className="px-4 py-2 rounded bg-[var(--color-accent)] text-white
                       hover:bg-[var(--color-accent-dim)] transition-colors text-sm font-medium"
          >
            Save Project
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-xl border border-[var(--color-border)] max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Export Cues</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                Tick Rate (seconds)
              </label>
              <input
                type="number"
                min="0.001"
                max="1"
                step="0.001"
                value={tickRate}
                onChange={(e) => setTickRate(parseFloat(e.target.value) || 0.1)}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]
                           focus:border-[var(--color-accent)] outline-none"
              />
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Smaller values = more precision, larger file size
              </p>
            </div>

            <div className="mb-4 p-3 bg-[var(--color-bg-tertiary)] rounded">
              <p className="text-sm text-[var(--color-text-secondary)]">
                <strong>Actors:</strong> {actors.length}<br />
                <strong>Duration:</strong> {playback.duration.toFixed(2)}s<br />
                <strong>Estimated cues:</strong> ~{Math.ceil((playback.duration || 1) / tickRate) * actors.length}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadCues}
                className="flex-1 px-4 py-2 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dim)] transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
