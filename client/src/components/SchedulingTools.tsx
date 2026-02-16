import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, Play, Settings2, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import type { CandidateSchedule, Requirement, ScheduleMode, SchoolBreak } from '../types';
import { buildTimelineRows, createId } from '../utils';

type WorkerResponse = {
  type: 'result';
  candidates: CandidateSchedule[];
};

function SectionDialog({
  title,
  open,
  onOpenChange,
  children,
  trigger
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  trigger: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[96vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl2 border border-line bg-panel p-4 shadow-soft">
          <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
          <div className="mt-3 max-h-[75vh] overflow-auto pr-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RequirementRow({ requirement, index }: { requirement: Requirement; index: number }) {
  const { data, updateRequirement, deleteRequirement } = useAppStore();

  const toggleTeacher = (teacherId: string) => {
    const current = requirement.allowedTeacherIds;
    const next = current.includes(teacherId) ? current.filter((id) => id !== teacherId) : [...current, teacherId];
    updateRequirement(requirement.id, { allowedTeacherIds: next });
  };

  return (
    <div className="rounded-lg border border-line bg-panel2/60 p-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-soft">Requirement #{index + 1}</p>
        <button className="rounded border border-line px-2 py-1 text-xs hover:border-danger/60" onClick={() => deleteRequirement(requirement.id)}>
          Delete
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <select className="soft-input w-full" value={requirement.classId} onChange={(e) => updateRequirement(requirement.id, { classId: e.target.value })}>
          {data.entities.classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select className="soft-input w-full" value={requirement.subjectId} onChange={(e) => updateRequirement(requirement.id, { subjectId: e.target.value })}>
          {data.entities.subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <input
          className="soft-input w-full"
          type="number"
          min={1}
          max={20}
          value={requirement.periodsPerCycle}
          onChange={(e) => updateRequirement(requirement.id, { periodsPerCycle: Math.max(1, Number(e.target.value) || 1) })}
        />

        <select
          className="soft-input w-full"
          value={requirement.preferredRoomId ?? ''}
          onChange={(e) => updateRequirement(requirement.id, { preferredRoomId: e.target.value || undefined })}
        >
          <option value="">No room preference</option>
          {data.entities.rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2">
        <p className="mb-1 text-xs text-soft">Allowed teachers</p>
        <div className="flex flex-wrap gap-1">
          {data.entities.teachers.map((teacher) => {
            const on = requirement.allowedTeacherIds.includes(teacher.id);
            return (
              <button
                key={teacher.id}
                className={`rounded-md border px-2 py-1 text-xs ${on ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel/60'}`}
                onClick={() => toggleTeacher(teacher.id)}
              >
                {teacher.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SchedulingToolsProps = {
  showRequirements?: boolean;
  showAvailability?: boolean;
  showGenerate?: boolean;
  buttonClassName?: string;
};

export function SchedulingTools({
  showRequirements = false,
  showAvailability = false,
  showGenerate = false,
  buttonClassName = 'rounded-md border border-line bg-panel2/50 px-2 py-1 text-xs hover:border-glow/40'
}: SchedulingToolsProps) {
  const {
    data,
    runtime,
    setRuntime,
    setScheduleMode,
    setTimeModel,
    addRequirement,
    toggleTeacherBlocked,
    applyAvailabilityPreset,
    setGeneratedCandidates,
    applyCandidate
  } = useAppStore();

  const [reqOpen, setReqOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [cycleDays, setCycleDays] = useState(6);
  const [dayOff, setDayOff] = useState('');
  const [keep, setKeep] = useState(3);
  const [attempts, setAttempts] = useState(100);

  const [modelStart, setModelStart] = useState(data.settings.dayStartTime);
  const [modelEnd, setModelEnd] = useState(data.settings.dayEndTime);
  const [modelCount, setModelCount] = useState(data.settings.periodCount);
  const [modelBreaks, setModelBreaks] = useState<SchoolBreak[]>(Array.isArray(data.settings.breaks) ? data.settings.breaks : []);

  const workerRef = useRef<Worker | null>(null);

  const activeTeacher = teacherId || data.entities.teachers[0]?.id || '';
  const blockedSet = useMemo(() => new Set(data.teacherBlocked[activeTeacher] ?? []), [activeTeacher, data.teacherBlocked]);
  const timelineRows = useMemo(() => buildTimelineRows(data.settings.periods, data.settings.breaks), [data.settings.periods, data.settings.breaks]);

  useEffect(() => {
    if (!teacherId && data.entities.teachers.length) setTeacherId(data.entities.teachers[0].id);
  }, [data.entities.teachers, teacherId]);

  useEffect(() => {
    if (!reqOpen) return;
    setModelStart(data.settings.dayStartTime);
    setModelEnd(data.settings.dayEndTime);
    setModelCount(data.settings.periodCount);
    setModelBreaks(Array.isArray(data.settings.breaks) ? data.settings.breaks : []);
  }, [data.settings, reqOpen]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const runGenerate = () => {
    if (!data.requirements.length) {
      setRuntime({ toast: 'Add requirements first.' });
      return;
    }

    workerRef.current?.terminate();
    const worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setRuntime({ generating: true });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.type !== 'result') return;
      setGeneratedCandidates(event.data.candidates);
      setRuntime({ toast: `Generated ${event.data.candidates.length} candidate(s).` });
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ type: 'generate', payload: { data, lockedSlots: runtime.lockedSlots, keep, attempts } });
  };

  const modeChip = (mode: ScheduleMode, label: string) => (
    <button
      className={`rounded-md border px-2 py-1 text-xs ${data.settings.mode === mode ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel2/50'}`}
      onClick={() => setScheduleMode(mode, cycleDays)}
    >
      {label}
    </button>
  );

  const applyTime = () => {
    const result = setTimeModel(modelStart, modelEnd, modelCount, modelBreaks);
    if (!result.ok && result.error) setRuntime({ toast: result.error });
  };

  return (
    <>
      {showRequirements && (
      <SectionDialog
        title="Requirements & Day Model"
        open={reqOpen}
        onOpenChange={setReqOpen}
        trigger={
          <button className={buttonClassName} title="Define subject load and class requirements for scheduling">
            <span className="inline-flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" /> Requirements
            </span>
          </button>
        }
      >
        <div className="mb-3 rounded-lg border border-line bg-panel2/50 p-2">
          <p className="mb-2 text-xs text-soft">Schedule Model</p>
          <div className="flex flex-wrap items-center gap-2">
            {modeChip('weekly', 'Weekly')}
            {modeChip('cycle', 'Cycle')}
            {data.settings.mode === 'cycle' && (
              <>
                <input className="soft-input h-8 w-24" type="number" min={2} max={14} value={cycleDays} onChange={(e) => setCycleDays(Math.max(2, Number(e.target.value) || 2))} />
                <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => setScheduleMode('cycle', cycleDays)}>
                  Apply Days
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-line bg-panel2/50 p-2">
          <p className="mb-2 text-xs text-soft">Period Timings & Breaks</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="soft-input" type="time" value={modelStart} onChange={(e) => setModelStart(e.target.value)} />
            <input className="soft-input" type="time" value={modelEnd} onChange={(e) => setModelEnd(e.target.value)} />
            <input className="soft-input" type="number" min={2} max={14} value={modelCount} onChange={(e) => setModelCount(Math.max(2, Number(e.target.value) || 2))} />
          </div>

          <div className="mt-2 space-y-2">
            {modelBreaks.map((item) => (
              <div key={item.id} className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
                <input className="soft-input" value={item.name} onChange={(e) => setModelBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))} />
                <select className="soft-input" value={item.type} onChange={(e) => setModelBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, type: e.target.value as 'break' | 'non-instructional' } : x)))}>
                  <option value="break">break</option>
                  <option value="non-instructional">non-instructional</option>
                </select>
                <input className="soft-input" type="time" value={item.startTime} onChange={(e) => setModelBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, startTime: e.target.value } : x)))} />
                <input className="soft-input" type="time" value={item.endTime} onChange={(e) => setModelBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, endTime: e.target.value } : x)))} />
                <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => setModelBreaks((prev) => prev.filter((x) => x.id !== item.id))}>
                  Remove
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                className="rounded-md border border-line px-2 py-1 text-xs"
                onClick={() => setModelBreaks((prev) => [...prev, { id: createId('break'), name: 'Lunch', type: 'break', startTime: '12:00', endTime: '12:30' }])}
              >
                Add Break
              </button>
              <button className="rounded-md border border-glow/50 bg-glow/10 px-2 py-1 text-xs" onClick={applyTime}>
                Recompute Periods
              </button>
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-soft">Per-class subject load and teacher eligibility</p>
          <button className="rounded-md border border-line px-2 py-1 text-xs hover:border-glow/40" onClick={addRequirement}>
            Add Requirement
          </button>
        </div>
        <div className="space-y-2">
          {data.requirements.map((req, idx) => (
            <RequirementRow key={req.id} requirement={req} index={idx} />
          ))}
          {!data.requirements.length && <p className="text-sm text-soft">No requirements yet.</p>}
        </div>
      </SectionDialog>
      )}

      {showAvailability && (
      <SectionDialog
        title="Teacher Availability"
        open={availOpen}
        onOpenChange={setAvailOpen}
        trigger={
          <button className={buttonClassName} title="Set teacher blocked slots and working-day availability">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Availability
            </span>
          </button>
        }
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <select className="soft-input h-8 min-w-40" value={activeTeacher} onChange={(e) => setTeacherId(e.target.value)}>
            {data.entities.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => applyAvailabilityPreset(activeTeacher, 'mornings')}>
            Only mornings
          </button>
          <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => applyAvailabilityPreset(activeTeacher, 'afternoons')}>
            Only afternoons
          </button>
          <select className="soft-input h-8" value={dayOff} onChange={(e) => setDayOff(e.target.value)}>
            <option value="">Day off</option>
            {data.settings.days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => dayOff && applyAvailabilityPreset(activeTeacher, 'dayoff', dayOff)}>
            Works 4 days
          </button>
        </div>

        <div className="overflow-auto rounded-lg border border-line">
          <div className="min-w-[640px]">
            <div className="grid" style={{ gridTemplateColumns: `160px repeat(${data.settings.days.length}, minmax(90px, 1fr))` }}>
              <div className="border-b border-r border-line bg-panel2/90 p-2 text-xs text-soft">Time Block</div>
              {data.settings.days.map((day) => (
                <div key={day} className="border-b border-r border-line bg-panel2/90 p-2 text-xs font-semibold">
                  {day}
                </div>
              ))}

              {timelineRows.map((row) => (
                <div key={row.id} className="contents">
                  <div className={`border-b border-r border-line p-2 text-xs ${row.kind === 'break' ? 'text-amber-300' : 'text-soft'}`}>
                    {row.label} {row.start && row.end ? `${row.start}-${row.end}` : ''}
                  </div>
                  {row.kind === 'break'
                    ? (
                        <div className="flex h-10 items-center border-b border-r border-line bg-amber-500/10 px-2 text-xs text-amber-200" style={{ gridColumn: `span ${data.settings.days.length}` }}>
                          Break row (disabled)
                        </div>
                      )
                    : data.settings.days.map((day) => {
                        const key = `${day}|${row.id}`;
                        const blocked = blockedSet.has(key);
                        return (
                          <button
                            key={key}
                            className={`h-10 border-b border-r border-line text-xs ${blocked ? 'bg-danger/20 text-danger' : 'bg-panel/60 text-soft'}`}
                            onClick={() => toggleTeacherBlocked(activeTeacher, key)}
                          >
                            {blocked ? 'Blocked' : 'Open'}
                          </button>
                        );
                      })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionDialog>
      )}

      {showGenerate && (
      <SectionDialog
        title="Generate Candidates"
        open={genOpen}
        onOpenChange={setGenOpen}
        trigger={
          <button className={buttonClassName} title="Generate candidate timetables from your requirements">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Generate
            </span>
          </button>
        }
      >
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <input className="soft-input h-9" type="number" min={1} max={10} value={keep} onChange={(e) => setKeep(Math.max(1, Number(e.target.value) || 1))} placeholder="Candidates" />
          <input className="soft-input h-9" type="number" min={20} max={500} step={10} value={attempts} onChange={(e) => setAttempts(Math.max(20, Number(e.target.value) || 20))} placeholder="Attempts" />
          <button className="rounded-md border border-glow/50 bg-glow/10 px-3 py-2 text-sm" onClick={runGenerate}>
            <span className="inline-flex items-center gap-1">
              <Play className="h-4 w-4" /> {runtime.generating ? 'Generating...' : 'Generate'}
            </span>
          </button>
        </div>

        <div className="space-y-2">
          {runtime.generatedCandidates.map((candidate, index) => (
            <div key={candidate.id} className="rounded-lg border border-line bg-panel2/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Candidate {index + 1}</p>
                <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => applyCandidate(candidate.id)}>
                  Apply
                </button>
              </div>
              <p className="mt-1 text-xs text-soft">Score: {candidate.score} | Unplaced: {candidate.unplaced}</p>
            </div>
          ))}
          {!runtime.generatedCandidates.length && <p className="text-sm text-soft">No candidates yet.</p>}
        </div>
      </SectionDialog>
      )}
    </>
  );
}
