import { Moon, Sun } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAppStore } from '../store';

export function ThemeSlider() {
  const { data, setUI } = useAppStore();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState('');

  const currentPreference = data.ui.themePreference;
  const position = dragPosition ?? (currentPreference === 'light' ? 0 : 1);

  const updateFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setDragPosition(p);
  };

  const commitAtPosition = (p: number) => {
    const next = p < 0.5 ? 'light' : 'dark';
    setUI({ themePreference: next });
    setTooltip(next === 'light' ? 'Bright' : 'Dark');
    window.setTimeout(() => setTooltip(''), 900);
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Theme slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={currentPreference === 'light' ? 0 : 1}
        tabIndex={0}
        className="relative h-8 w-24 cursor-pointer select-none rounded-full border border-line/90 p-1 outline-none transition duration-180 focus:border-glow/70"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          updateFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          const p = dragPosition ?? position;
          setDragPosition(null);
          commitAtPosition(p);
        }}
        onPointerCancel={() => setDragPosition(null)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          commitAtPosition(p);
        }}
        onWheel={(e) => {
          e.preventDefault();
          if (e.deltaY < 0) {
            setUI({ themePreference: 'light' });
            setTooltip('Bright');
          } else {
            setUI({ themePreference: 'dark' });
            setTooltip('Dark');
          }
          window.setTimeout(() => setTooltip(''), 900);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setUI({ themePreference: 'light' });
            setTooltip('Bright');
            window.setTimeout(() => setTooltip(''), 900);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setUI({ themePreference: 'dark' });
            setTooltip('Dark');
            window.setTimeout(() => setTooltip(''), 900);
          }
        }}
      >
        <div
          className={`absolute inset-0 rounded-full transition duration-180 ${
            position < 0.3
              ? 'bg-gradient-to-r from-amber-100/60 via-yellow-100/40 to-sky-200/35'
            : position > 0.5
                ? 'bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-blue-900/65'
                : 'bg-gradient-to-r from-zinc-300/30 via-slate-500/20 to-slate-900/40'
          }`}
        />

        {position > 0.5 && (
          <>
            <span className="absolute left-8 top-2 h-0.5 w-0.5 rounded-full bg-white/60" />
            <span className="absolute left-16 top-3 h-0.5 w-0.5 rounded-full bg-white/50" />
            <span className="absolute right-9 top-4 h-0.5 w-0.5 rounded-full bg-white/45" />
          </>
        )}

        <span className="absolute left-2 top-1.5 text-amber-200">
          <Sun className="h-4 w-4" />
        </span>
        <span className="absolute right-2 top-1.5 text-blue-200">
          <Moon className="h-4 w-4" />
        </span>

        <span
          className={`absolute top-1 h-6 w-6 rounded-full border border-white/30 bg-white/90 shadow-md transition duration-180 ${
            position < 0.5
              ? 'left-1 shadow-[0_0_18px_rgba(251,191,36,0.42)]'
              : 'left-[calc(100%-1.75rem)] shadow-[0_0_18px_rgba(96,165,250,0.45)]'
          }`}
        />
      </div>

      {tooltip && (
        <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border border-line bg-panel2/95 px-2 py-1 text-[11px]">
          {tooltip}
        </div>
      )}
    </div>
  );
}
