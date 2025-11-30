import { useRef, useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '../../store';

interface WaveformTrackProps {
  width: number;
  zoom: number;
}

export default function WaveformTrack({ width, zoom }: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const { audioBuffer, setAudioBuffer, setAudioFile, setPlayback, playback } = useProjectStore();

  // Generate waveform data from audio buffer
  useEffect(() => {
    if (!audioBuffer) {
      setWaveformData([]);
      return;
    }

    const channelData = audioBuffer.getChannelData(0);
    const samples = Math.floor(audioBuffer.duration * 100); // 100 samples per second
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      waveform.push(sum / blockSize);
    }

    // Normalize
    const max = Math.max(...waveform, 0.01);
    setWaveformData(waveform.map(v => v / max));
  }, [audioBuffer]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.width = width;
    canvas.height = 64;

    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, width, 64);

    if (waveformData.length === 0) {
      // Show placeholder
      ctx.fillStyle = '#2a2a3a';
      ctx.textAlign = 'center';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText('Drop audio file here or click to load', width / 2, 32);
      return;
    }

    // Draw waveform
    const midY = 32;
    ctx.fillStyle = '#ff6b35';
    ctx.globalAlpha = 0.8;

    const samplesPerPixel = waveformData.length / (playback.duration * zoom);
    
    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const value = waveformData[sampleIndex] || 0;
      const height = value * 28;
      
      ctx.fillRect(x, midY - height, 1, height * 2);
    }

    ctx.globalAlpha = 1;
  }, [waveformData, width, zoom, playback.duration]);

  // Handle audio file loading
  const handleLoadAudio = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      
      setAudioBuffer(buffer);
      setAudioFile(file);
      setPlayback({ 
        duration: buffer.duration,
        currentTime: 0,
      });
    } catch (err) {
      console.error('Failed to load audio:', err);
      alert('Failed to load audio file. Please ensure it is a valid audio file.');
    }
  }, [setAudioBuffer, setAudioFile, setPlayback]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      handleLoadAudio(file);
    }
  };

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleLoadAudio(file);
      }
    };
    input.click();
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    />
  );
}

