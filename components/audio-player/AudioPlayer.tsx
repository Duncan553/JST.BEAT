'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentBeatId, isPlaying, snippetUrl, pause, play } = usePlayerStore();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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

  if (!currentBeatId) return null;

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
    <div className="fixed bottom-0 left-0 right-0 bg-stone-950 border-t border-orange-900/30 text-orange-50 px-4 py-3 flex items-center gap-4 z-50">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => pause()} preload="metadata" />
      <button
        onClick={() => (isPlaying ? pause() : play(currentBeatId, snippetUrl || ''))}
        className="w-10 h-10 flex items-center justify-center bg-orange-600 text-white rounded-full font-bold text-lg hover:bg-orange-500 transition"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-stone-500 w-10 text-right">{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={handleSeek}
          className="flex-1 h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <span className="text-xs text-stone-500 w-10">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
