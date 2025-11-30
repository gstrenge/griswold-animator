import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store';
import type { GrisFile } from '../types';
import { useEffect, useState } from 'react';

const LOCAL_STORAGE_KEY = 'griswold-autosave';

export default function LandingPage() {
  const navigate = useNavigate();
  const { resetProject, loadProject } = useProjectStore();
  const [hasAutosave, setHasAutosave] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    setHasAutosave(!!saved);
  }, []);

  const handleCreate = () => {
    resetProject();
    navigate('/editor');
  };

  const handleLoad = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gris';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data: GrisFile = JSON.parse(text);
        loadProject(data.project, data.actors, data.backgrounds);
        navigate('/editor');
      } catch (err) {
        console.error('Failed to load project:', err);
        alert('Failed to load project file. Please ensure it is a valid .gris file.');
      }
    };
    input.click();
  };

  const handleRestoreAutosave = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const data: GrisFile = JSON.parse(saved);
        loadProject(data.project, data.actors, data.backgrounds);
        navigate('/editor');
      }
    } catch (err) {
      console.error('Failed to restore autosave:', err);
      alert('Failed to restore autosave.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ff6b35' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 text-center">
        {/* Logo / Title */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold tracking-tight mb-4">
            <span className="text-[var(--color-accent)]">GRISWOLD</span>
          </h1>
          <p className="text-[var(--color-text-secondary)] text-xl tracking-widest uppercase">
            Light Show Animator
          </p>
        </div>

        {/* Decorative lights animation */}
        <div className="flex justify-center gap-2 mb-12">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: `hsl(${(i * 30) % 360}, 70%, 50%)`,
                animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
                boxShadow: `0 0 10px hsl(${(i * 30) % 360}, 70%, 50%)`,
              }}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-4 items-center">
          <button
            onClick={handleCreate}
            className="w-64 px-8 py-4 bg-[var(--color-accent)] text-white font-semibold 
                       rounded-lg hover:bg-[var(--color-accent-dim)] transition-all duration-200
                       hover:scale-105 glow-accent text-lg tracking-wide"
          >
            Create New Project
          </button>

          <button
            onClick={handleLoad}
            className="w-64 px-8 py-4 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]
                       font-semibold rounded-lg border border-[var(--color-border)]
                       hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
                       transition-all duration-200 text-lg tracking-wide"
          >
            Load Project (.gris)
          </button>

          {hasAutosave && (
            <button
              onClick={handleRestoreAutosave}
              className="w-64 px-8 py-4 bg-[var(--color-bg-secondary)] text-[var(--color-warning)]
                         font-semibold rounded-lg border border-[var(--color-warning)]
                         hover:bg-[var(--color-warning)] hover:text-[var(--color-bg-primary)]
                         transition-all duration-200 text-lg tracking-wide"
            >
              Restore Autosave
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="mt-16 text-[var(--color-text-secondary)] text-sm opacity-50">
          Browser-based • No server required • Works offline
        </p>
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

