import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { createId } from '../utils';
import type { SchoolBreak } from '../types';

const dayPresets: Record<string, string[]> = {
  'Mon-Fri': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  'Mon-Sat': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};

export function Wizard() {
  const setupFromWizard = useAppStore((s) => s.setupFromWizard);
  const [step, setStep] = useState(1);
  const [preset, setPreset] = useState<'Mon-Fri' | 'Mon-Sat' | 'Custom'>('Mon-Fri');
  const [customDays, setCustomDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  const [periodCount, setPeriodCount] = useState(7);
  const [dayStartTime, setDayStartTime] = useState('08:30');
  const [dayEndTime, setDayEndTime] = useState('15:00');
  const [breaks, setBreaks] = useState<SchoolBreak[]>([
    { id: createId('break'), name: 'Lunch', type: 'break', startTime: '12:00', endTime: '12:30' }
  ]);

  const [firstClass, setFirstClass] = useState('Class A');
  const [firstTeacher, setFirstTeacher] = useState('Teacher 1');
  const [firstSubject, setFirstSubject] = useState('Subject 1');

  const days = useMemo(() => (preset === 'Custom' ? customDays : dayPresets[preset]), [customDays, preset]);

  const toggleDay = (day: string) => {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  return (
    <section className="mx-auto max-w-4xl animate-rise glass p-5 md:p-8">
      <h1 className="text-2xl font-semibold">AutoTable Setup</h1>
      <p className="mt-1 text-sm text-soft/90">Configure days, timings, breaks, and seed entities.</p>

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wide text-soft">Step 1: Working days</h2>
          <div className="flex flex-wrap gap-2">
            {(['Mon-Fri', 'Mon-Sat', 'Custom'] as const).map((option) => (
              <button
                key={option}
                className={`rounded-lg border px-3 py-2 text-sm transition duration-180 ${
                  preset === option ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel2/50 hover:border-glow/40'
                }`}
                onClick={() => setPreset(option)}
              >
                {option}
              </button>
            ))}
          </div>
          {preset === 'Custom' && (
            <div className="grid grid-cols-4 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <button
                  key={day}
                  className={`rounded-md border px-2 py-2 text-xs ${
                    customDays.includes(day) ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel2/50'
                  }`}
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
          <button className="rounded-lg bg-glow/20 px-4 py-2 text-sm hover:bg-glow/30" disabled={!days.length} onClick={() => setStep(2)}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wide text-soft">Step 2: Timings & Breaks</h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-soft">School start</label>
              <input className="soft-input w-full" type="time" value={dayStartTime} onChange={(e) => setDayStartTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-soft">School end</label>
              <input className="soft-input w-full" type="time" value={dayEndTime} onChange={(e) => setDayEndTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-soft">Periods/day (2-12)</label>
              <input
                className="soft-input w-full"
                type="number"
                min={2}
                max={12}
                value={periodCount}
                onChange={(e) => setPeriodCount(Math.max(2, Math.min(12, Number(e.target.value) || 2)))}
              />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel2/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-soft">Breaks</p>
              <button
                className="rounded-md border border-line px-2 py-1 text-xs"
                onClick={() =>
                  setBreaks((prev) => [
                    ...prev,
                    { id: createId('break'), name: 'Break', type: 'break', startTime: '10:30', endTime: '10:45' }
                  ])
                }
              >
                Add Break
              </button>
            </div>

            <div className="space-y-2">
              {breaks.map((item) => (
                <div key={item.id} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                  <input
                    className="soft-input"
                    value={item.name}
                    onChange={(e) =>
                      setBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="Break name"
                  />
                  <select
                    className="soft-input"
                    value={item.type}
                    onChange={(e) =>
                      setBreaks((prev) =>
                        prev.map((x) =>
                          x.id === item.id
                            ? { ...x, type: e.target.value as 'break' | 'non-instructional' }
                            : x
                        )
                      )
                    }
                  >
                    <option value="break">break</option>
                    <option value="non-instructional">non-instructional</option>
                  </select>
                  <input
                    className="soft-input"
                    type="time"
                    value={item.startTime}
                    onChange={(e) =>
                      setBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, startTime: e.target.value } : x)))
                    }
                  />
                  <input
                    className="soft-input"
                    type="time"
                    value={item.endTime}
                    onChange={(e) =>
                      setBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, endTime: e.target.value } : x)))
                    }
                  />
                  <button
                    className="rounded-md border border-line px-2 py-1 text-xs hover:border-danger/60"
                    onClick={() => setBreaks((prev) => prev.filter((x) => x.id !== item.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button className="rounded-lg border border-line px-4 py-2 text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="rounded-lg bg-glow/20 px-4 py-2 text-sm hover:bg-glow/30" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wide text-soft">Step 3: Quick add</h2>
          <input className="soft-input w-full" value={firstClass} onChange={(e) => setFirstClass(e.target.value)} placeholder="Class" />
          <input className="soft-input w-full" value={firstTeacher} onChange={(e) => setFirstTeacher(e.target.value)} placeholder="Teacher" />
          <input className="soft-input w-full" value={firstSubject} onChange={(e) => setFirstSubject(e.target.value)} placeholder="Subject" />
          <div className="flex gap-2">
            <button className="rounded-lg border border-line px-4 py-2 text-sm" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              className="rounded-lg bg-glow/20 px-4 py-2 text-sm hover:bg-glow/30"
              onClick={() =>
                setupFromWizard({
                  days,
                  periodCount,
                  dayStartTime,
                  dayEndTime,
                  breaks,
                  firstClass,
                  firstTeacher,
                  firstSubject
                })
              }
            >
              Finish
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
