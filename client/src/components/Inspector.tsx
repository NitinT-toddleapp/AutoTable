import { Copy, Eraser, Lock, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { parseSlotKey, slotKey } from '../utils';
import type { SlotValue } from '../types';

type Props = {
  slotKey: string;
  slotValue: SlotValue | null;
  activeClassId: string;
};

export function Inspector({ slotKey: selectedKey, slotValue, activeClassId }: Props) {
  const { data, runtime, setRuntime, upsertSlot, clearSlot } = useAppStore();
  const isReadOnly = data.ui.readOnly;
  const [draft, setDraft] = useState<SlotValue>({ subjectId: '', teacherId: '', roomId: '' });

  useEffect(() => {
    setDraft(slotValue ?? { subjectId: '', teacherId: '', roomId: '' });
  }, [selectedKey, slotValue]);

  const parsed = useMemo(() => parseSlotKey(selectedKey), [selectedKey]);

  const duplicateSlot = () => {
    if (isReadOnly) {
      setRuntime({ toast: 'Read-only mode is enabled.' });
      return;
    }
    const source = data.slots[selectedKey];
    if (!source) return;

    const currentIndex = data.settings.periods.findIndex((p) => p.id === parsed.periodId);
    const candidates = data.settings.periods
      .slice(currentIndex + 1)
      .filter((period) => !period.isBreak)
      .map((period) => slotKey(parsed.day, period.id, activeClassId));
    const target = candidates.find((key) => !data.slots[key]);
    if (!target) {
      setRuntime({ toast: 'No empty slot to duplicate into.' });
      return;
    }
    upsertSlot(target, source);
    setRuntime({ toast: 'Duplicated.' });
  };

  const toggleLock = () => {
    if (isReadOnly) {
      setRuntime({ toast: 'Read-only mode is enabled.' });
      return;
    }
    const exists = runtime.lockedSlots.includes(selectedKey);
    setRuntime({ lockedSlots: exists ? runtime.lockedSlots.filter((k) => k !== selectedKey) : [...runtime.lockedSlots, selectedKey] });
  };

  return (
    <aside className="glass min-h-0 p-3">
      <p className="mt-1 text-xs text-soft">
        {parsed.day} / {parsed.periodId}
      </p>

      <div className="mt-3 space-y-2">
        <label className="block text-xs text-soft">Subject</label>
        <select className="soft-input w-full" value={draft.subjectId} disabled={isReadOnly} onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}>
          <option value="">Select subject</option>
          {data.entities.subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <label className="block text-xs text-soft">Teacher</label>
        <select
          className="soft-input w-full"
          value={draft.teacherId}
          disabled={isReadOnly}
          onChange={(e) => {
            const teacherId = e.target.value;
            const defaults = data.teacherSubjectMap[teacherId] ?? [];
            const nextSubject =
              defaults.length && (!draft.subjectId || !defaults.includes(draft.subjectId)) ? defaults[0] : draft.subjectId;
            setDraft({ ...draft, teacherId, subjectId: nextSubject });
          }}
        >
          <option value="">Select teacher</option>
          {data.entities.teachers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {draft.teacherId && (data.teacherSubjectMap[draft.teacherId] ?? []).length > 0 && (
          <p className="text-[11px] text-soft">
            Default subjects: {(data.teacherSubjectMap[draft.teacherId] ?? [])
              .map((id) => data.entities.subjects.find((s) => s.id === id)?.name)
              .filter(Boolean)
              .join(', ')}
          </p>
        )}

        <label className="block text-xs text-soft">Room</label>
        <select className="soft-input w-full" value={draft.roomId ?? ''} disabled={isReadOnly} onChange={(e) => setDraft({ ...draft, roomId: e.target.value })}>
          <option value="">Optional room</option>
          {data.entities.rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="rounded-md border border-glow/45 bg-glow/10 px-2 py-2 text-xs hover:bg-glow/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isReadOnly}
          onClick={() => {
            if (!draft.subjectId || !draft.teacherId) {
              setRuntime({ toast: 'Subject and Teacher are required.' });
              return;
            }
            upsertSlot(selectedKey, {
              subjectId: draft.subjectId,
              teacherId: draft.teacherId,
              roomId: draft.roomId || undefined
            });
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Save className="h-3.5 w-3.5" /> Save
          </span>
        </button>

        <button className="rounded-md border border-line bg-panel2/70 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60" disabled={isReadOnly} onClick={() => clearSlot(selectedKey)}>
          <span className="inline-flex items-center gap-1">
            <Eraser className="h-3.5 w-3.5" /> Clear
          </span>
        </button>

        <button className="rounded-md border border-line bg-panel2/70 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60" disabled={isReadOnly} onClick={duplicateSlot}>
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </span>
        </button>

        <button
          className={`rounded-md border px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60 ${runtime.lockedSlots.includes(selectedKey) ? 'border-amber-400/60 text-amber-300' : 'border-line bg-panel2/70'}`}
          disabled={isReadOnly}
          onClick={toggleLock}
        >
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> {runtime.lockedSlots.includes(selectedKey) ? 'Unlock' : 'Lock'}
          </span>
        </button>
      </div>
    </aside>
  );
}
