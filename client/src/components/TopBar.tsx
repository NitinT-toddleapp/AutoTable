import { useMemo, useRef } from 'react';
import { Download, FileUp, Search } from 'lucide-react';
import { useAppStore } from '../store';
import type { ViewMode } from '../types';
import { SchedulingTools } from './SchedulingTools';
import { ThemeSlider } from './ThemeSlider';

type Props = {
  onExport: () => void;
  onImport: (file: File | undefined) => void;
  conflictsCount: number;
};

function ViewButton({ mode, label }: { mode: ViewMode; label: string }) {
  const { data, setUI } = useAppStore();
  return (
    <button
      className={`rounded-md border px-2 py-1 text-xs transition duration-180 ${
        data.ui.viewMode === mode ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel2/60 hover:border-glow/40'
      }`}
      onClick={() => setUI({ viewMode: mode, selectedEntityId: '' })}
    >
      {label}
    </button>
  );
}

function ViewSwitcher() {
  const { data, setUI } = useAppStore();

  const currentEntities = useMemo(() => {
    if (data.ui.viewMode === 'class') return data.entities.classes;
    if (data.ui.viewMode === 'teacher') return data.entities.teachers;
    if (data.ui.viewMode === 'room') return data.entities.rooms;
    return [];
  }, [data.entities.classes, data.entities.rooms, data.entities.teachers, data.ui.viewMode]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        <ViewButton mode="whole" label="Whole" />
        <ViewButton mode="class" label="Class" />
        <ViewButton mode="teacher" label="Teacher" />
        <ViewButton mode="room" label="Room" />
      </div>

      {data.ui.viewMode !== 'whole' && (
        <select
          className="soft-input h-8 min-w-36 py-0"
          value={data.ui.selectedEntityId}
          onChange={(e) => setUI({ selectedEntityId: e.target.value })}
        >
          <option value="">Select</option>
          {currentEntities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function BrandCenter() {
  return (
    <div className="flex items-center justify-center gap-3">
      <img src="/favicon-96x96.png" alt="AutoTable logo" className="h-8 w-8 rounded-md" />
      <span
        className="bg-gradient-to-r from-[#0db660] via-[#9bd347] to-[#ffcb28] bg-clip-text text-3xl font-black tracking-[0.08em] text-transparent"
        style={{ fontFamily: '"Avenir Next", "Poppins", "Segoe UI", sans-serif' }}
      >
        AutoTable
      </span>
    </div>
  );
}

function StatusSection() {
  const { runtime } = useAppStore();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs text-soft">
        <span
          className={`h-2 w-2 rounded-full ${runtime.autosaveStatus === 'Saving...' ? 'animate-pulseDot bg-amber-400' : 'bg-emerald-400'}`}
        />
        {runtime.autosaveStatus}
      </div>
      <ThemeSlider />
    </div>
  );
}

function SearchCenter() {
  const { runtime, setRuntime } = useAppStore();

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
      <input
        className="soft-input h-9 w-full !py-0 !pl-12"
        placeholder="Search lessons"
        value={runtime.globalSearch}
        onChange={(e) => setRuntime({ globalSearch: e.target.value })}
      />
    </div>
  );
}

function ActionRow({
  onExport,
  onImport,
  conflictsCount
}: {
  onExport: () => void;
  onImport: (file: File | undefined) => void;
  conflictsCount: number;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const actionButtonClass = 'rounded-md border border-line bg-panel2/50 px-2 py-1 text-xs hover:border-glow/40';

  return (
    <div className="grid items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
      <div className="flex flex-wrap items-center gap-2">
        <SchedulingTools showRequirements buttonClassName={actionButtonClass} />
        <SchedulingTools showAvailability buttonClassName={actionButtonClass} />

        <button
          className={actionButtonClass}
          title="Import timetable JSON from a local file"
          onClick={() => fileRef.current?.click()}
        >
          <span className="inline-flex items-center gap-1">
            <FileUp className="h-3.5 w-3.5" /> Import
          </span>
        </button>
        <input ref={fileRef} type="file" hidden accept="application/json" onChange={(e) => onImport(e.target.files?.[0])} />
      </div>

      <SearchCenter />

      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        <div className="rounded-md border border-line px-2 py-1 text-xs text-soft">Conflicts: {conflictsCount}</div>
        <SchedulingTools showGenerate buttonClassName={actionButtonClass} />
        <button className={actionButtonClass} title="Open export wizard" onClick={onExport}>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> Export
          </span>
        </button>
      </div>
    </div>
  );
}

export function TopBar({ onExport, onImport, conflictsCount }: Props) {
  return (
    <header className="glass grid gap-3 p-3">
      <div className="grid items-center gap-2 xl:grid-cols-[1fr_auto_1fr]">
        <div className="flex justify-start">
          <ViewSwitcher />
        </div>
        <BrandCenter />
        <div className="flex justify-end">
          <StatusSection />
        </div>
      </div>

      <ActionRow onExport={onExport} onImport={onImport} conflictsCount={conflictsCount} />
    </header>
  );
}
