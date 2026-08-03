'use client';

import { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentBeatId, isPlaying, snippetUrl, pause } = usePlayerStore();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !snippetUrl) return;
    if (audio.src !== snippetUrl) {
      audio.src = snippetUrl;
      audio.load();
    }
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying, snippetUrl]);

  if (!mounted || !currentBeatId) return null;

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-stone-800 px-6 py-3"
      role="region"
      aria-label="Audio player"
    >
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <button
          onClick={pause}
          aria-label="Pause playback"
          className="w-10 h-10 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
        >
          ⏸
        </button>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-stone-400 tabular-nums w-10 text-right">{formatTime(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
            aria-label="Seek"
            className="flex-1 h-1 bg-stone-700 rounded-full appearance-none cursor-pointer accent-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
          />
          <span className="text-xs text-stone-400 tabular-nums w-10">{formatTime(duration)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={pause}
        preload="metadata"
        aria-hidden="true"
      />
    </div>
  );
}