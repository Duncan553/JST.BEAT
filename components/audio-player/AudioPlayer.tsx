'use client';

import { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const vinylRef = useRef<HTMLDivElement>(null);
  const lastUrlRef = useRef<string>('');
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  
  const { currentBeatId, isPlaying, snippetUrl, currentBeatTitle, currentBeatCover, pause, resume } = usePlayerStore();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // JS-driven vinyl rotation
  useEffect(() => {
    const vinyl = vinylRef.current;
    if (!vinyl) return;

    if (isPlaying) {
      let lastTime = performance.now();
      
      const rotate = (time: number) => {
        const delta = time - lastTime;
        lastTime = time;
        // 360 degrees per 2.5 seconds = 144 deg per second
        rotationRef.current += (delta / 1000) * 144;
        vinyl.style.transform = `rotate(${rotationRef.current}deg)`;
        rafRef.current = requestAnimationFrame(rotate);
      };
      
      rafRef.current = requestAnimationFrame(rotate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!snippetUrl) {
      audio.pause();
      audio.src = '';
      lastUrlRef.current = '';
      setProgress(0);
      setDuration(0);
      return;
    }

    if (lastUrlRef.current !== snippetUrl) {
      audio.src = snippetUrl;
      lastUrlRef.current = snippetUrl;
      audio.load();
      setAudioError(null);
    }

    if (isPlaying) {
      audio.play()
        .then(() => setAudioError(null))
        .catch(() => {
          setAudioError('Click play to start audio.');
          pause();
        });
    } else {
      audio.pause();
    }
  }, [isPlaying, snippetUrl, pause]);

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

  const handleToggle = () => {
    setAudioError(null);
    if (isPlaying) pause();
    else resume();
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black via-black/98 to-stone-950/95 backdrop-blur-xl border-t border-stone-800/30"
      role="region"
      aria-label="Audio player"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-5">
        {/* Vinyl Disc - JS rotated */}
        <div 
          ref={vinylRef}
          className="relative w-16 h-16 shrink-0"
          style={{ willChange: 'transform' }}
        >
          <div className="absolute -inset-1 rounded-full bg-black/40 blur-sm" />
          <div className="relative w-full h-full rounded-full overflow-hidden border-[2px] border-stone-800 shadow-xl">
            <img 
              src={currentBeatCover || '/images/hero-studio.jpg'} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-[4px] rounded-full border border-white/5" />
            <div className="absolute inset-[8px] rounded-full border border-white/5" />
            <div className="absolute inset-[12px] rounded-full border border-white/5" />
            <div className="absolute inset-[16px] rounded-full border border-white/5" />
            <div className="absolute inset-[20px] rounded-full border border-white/5" />
            <div className="absolute inset-[24px] rounded-full border border-white/5" />
            <div className="absolute inset-[28px] rounded-full border border-white/5" />
            <div className="absolute inset-[35%] rounded-full bg-black/80 border border-stone-600/30 flex items-center justify-center">
              <div className="w-2 h-2 bg-stone-900 rounded-full border border-stone-700" />
            </div>
            <div className="absolute top-2 left-4 w-4 h-8 bg-white/10 rounded-full rotate-45 blur-[1px]" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em]">Now Spinning</span>
            {isPlaying && (
              <span className="flex gap-[2px] items-end h-3">
                <span className="w-[3px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" style={{ height: '40%', animationDelay: '0ms' }} />
                <span className="w-[3px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" style={{ height: '80%', animationDelay: '120ms' }} />
                <span className="w-[3px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" style={{ height: '60%', animationDelay: '240ms' }} />
                <span className="w-[3px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" style={{ height: '100%', animationDelay: '360ms' }} />
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-white truncate leading-tight tracking-tight">
            {currentBeatTitle || 'Select a beat'}
          </p>
          {audioError && <p className="text-[10px] text-red-400 mt-0.5">{audioError}</p>}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-stone-500 tabular-nums w-8 text-right font-mono">{formatTime(progress)}</span>
            <div className="flex-1 relative h-1 bg-stone-800 rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-700 to-orange-500 rounded-full transition-all duration-100" style={{ width: `${progressPercent}%` }} />
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={handleSeek}
                aria-label="Seek"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[10px] text-stone-500 tabular-nums w-8 font-mono">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="hidden sm:block relative w-12 h-12 shrink-0">
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-stone-700 rounded-full border border-stone-600" />
          <div className="absolute bottom-1.5 right-1.5 w-[2px] h-10 bg-stone-500 origin-bottom-right rounded-full transition-transform duration-300" style={{ transform: `rotate(${-30 + (progressPercent * 0.5)}deg)` }} />
        </div>

        <button
          onClick={handleToggle}
          className="w-12 h-12 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-900/30 focus-visible:ring-2 focus-visible:ring-orange-400 outline-none touch-manipulation shrink-0"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1.5" />
              <rect x="14" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={pause}
        onError={(e) => {
          const audio = e.currentTarget;
          setAudioError(`Audio error: ${audio.error?.message || 'Unknown'}`);
          pause();
        }}
        preload="metadata"
        aria-hidden="true"
      />
    </div>
  );
}
