import type { IdNameColor, Period, SchoolBreak, SlotValue, TimetableData } from './types';

export const storageKey = 'timetable:v1';

export const palette = ['#00d1ff', '#f6c945', '#54f59a', '#ff6b6b', '#7aa2ff', '#ffa7f3', '#ff9d4d', '#91a7b3'];

export function createId(prefix: string): string {
  const seed = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${seed}`;
}

export function slotKey(day: string, periodId: string, classId: string): string {
  return `${day}|${periodId}|${classId}`;
}

export function parseSlotKey(key: string): { day: string; periodId: string; classId: string } {
  const [day, periodId, classId] = key.split('|');
  return { day, periodId, classId };
}

export function randomColor(index: number): string {
  return palette[index % palette.length];
}

export function listById(list: IdNameColor[]): Record<string, IdNameColor> {
  return list.reduce<Record<string, IdNameColor>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

export function createEmptyData(): TimetableData {
  return {
    schemaVersion: 1,
    settings: {
      days: [],
      periods: [],
      mode: 'weekly',
      dayStartTime: '08:30',
      dayEndTime: '15:00',
      periodCount: 7,
      breaks: []
    },
    entities: {
      teachers: [],
      classes: [],
      rooms: [],
      subjects: []
    },
    slots: {},
    requirements: [],
    teacherBlocked: {},
    teacherSubjectMap: {},
    ui: {
      selectedDay: 'Mon',
      viewMode: 'whole',
      selectedEntityId: '',
      zoom: 1,
      showConflictsOnly: false,
      readOnly: false,
      themePreference: getSystemPreferredTheme()
    }
  };
}

export function getSystemPreferredTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function validateImport(payload: unknown): payload is TimetableData {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<TimetableData>;
  if (p.schemaVersion !== 1) return false;
  if (!Array.isArray(p.settings?.days) || !Array.isArray(p.settings?.periods)) return false;
  if (!p.entities || !p.slots || !p.ui) return false;
  return true;
}

export function ensureDataShape(payload: TimetableData): TimetableData {
  const safeBreaks = Array.isArray(payload.settings.breaks) ? payload.settings.breaks : [];
  const normalizedPeriods =
    payload.settings.periods?.length
      ? payload.settings.periods.map((period) => ({ ...period, isBreak: period.isBreak ?? false }))
      : [];

  const incomingTheme = payload.ui?.themePreference;
  const normalizedTheme = incomingTheme === 'light' || incomingTheme === 'dark' ? incomingTheme : getSystemPreferredTheme();

  return {
    ...payload,
    settings: {
      ...payload.settings,
      periods: normalizedPeriods,
      mode: payload.settings?.mode ?? 'weekly',
      dayStartTime: payload.settings?.dayStartTime ?? '08:30',
      dayEndTime: payload.settings?.dayEndTime ?? '15:00',
      periodCount: payload.settings?.periodCount ?? Math.max(1, normalizedPeriods.filter((p) => !p.isBreak).length || 7),
      breaks: safeBreaks
    },
    requirements: payload.requirements ?? [],
    teacherBlocked: payload.teacherBlocked ?? {},
    teacherSubjectMap: payload.teacherSubjectMap ?? {},
    ui: {
      ...payload.ui,
      readOnly: payload.ui?.readOnly ?? false,
      themePreference: normalizedTheme
    }
  };
}

export function parseHHMM(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function validateBreaks(breaks: SchoolBreak[], dayStart: string, dayEnd: string): string | null {
  const safeBreaks = Array.isArray(breaks) ? breaks : [];
  const start = parseHHMM(dayStart);
  const end = parseHHMM(dayEnd);
  if (start === null || end === null) return 'Invalid school start/end time.';
  if (start >= end) return 'School start time must be before end time.';

  const rows = safeBreaks
    .map((item) => ({
      ...item,
      start: parseHHMM(item.startTime),
      end: parseHHMM(item.endTime)
    }))
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  for (const br of rows) {
    if (br.start === null || br.end === null) return `Invalid break time in ${br.name}.`;
    if (br.start >= br.end) return `${br.name}: start must be before end.`;
    if (br.start < start || br.end > end) return `${br.name}: must be within school day window.`;
  }

  for (let i = 1; i < rows.length; i += 1) {
    if ((rows[i].start ?? 0) < (rows[i - 1].end ?? 0)) {
      return `Break overlap detected between ${rows[i - 1].name} and ${rows[i].name}.`;
    }
  }
  return null;
}

export function validateManualPeriods(
  periods: Period[],
  dayStart: string,
  dayEnd: string,
  breaks: SchoolBreak[]
): string | null {
  const breakError = validateBreaks(breaks, dayStart, dayEnd);
  if (breakError) return breakError;

  const start = parseHHMM(dayStart);
  const end = parseHHMM(dayEnd);
  if (start === null || end === null || start >= end) return 'Invalid school day time window.';
  if (!Array.isArray(periods) || periods.length === 0) return 'Add at least one period.';

  const parsedPeriods = periods
    .map((p, idx) => ({
      idx,
      label: p.label || `P${idx + 1}`,
      start: parseHHMM(p.start ?? ''),
      end: parseHHMM(p.end ?? '')
    }))
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  for (const p of parsedPeriods) {
    if (p.start === null || p.end === null) return `${p.label}: invalid time format.`;
    if (p.start >= p.end) return `${p.label}: start must be before end.`;
    if (p.start < start || p.end > end) return `${p.label}: must be within school day.`;
  }

  for (let i = 1; i < parsedPeriods.length; i += 1) {
    if ((parsedPeriods[i].start ?? 0) < (parsedPeriods[i - 1].end ?? 0)) {
      return `${parsedPeriods[i].label} overlaps with ${parsedPeriods[i - 1].label}.`;
    }
  }

  const parsedBreaks = (Array.isArray(breaks) ? breaks : [])
    .map((b) => ({ name: b.name, start: parseHHMM(b.startTime), end: parseHHMM(b.endTime) }))
    .filter((b) => b.start !== null && b.end !== null) as { name: string; start: number; end: number }[];

  for (const p of parsedPeriods) {
    for (const b of parsedBreaks) {
      const overlap = p.start! < b.end && p.end! > b.start;
      if (overlap) return `${p.label} overlaps with break "${b.name}".`;
    }
  }

  return null;
}

export function buildComputedPeriods(
  dayStartTime: string,
  dayEndTime: string,
  periodCount: number,
  breaks: SchoolBreak[],
  minPeriodMinutes = 20
): { periods: Period[]; error?: string } {
  const safeBreaks = Array.isArray(breaks) ? breaks : [];
  const error = validateBreaks(safeBreaks, dayStartTime, dayEndTime);
  if (error) return { periods: [], error };

  const dayStart = parseHHMM(dayStartTime)!;
  const dayEnd = parseHHMM(dayEndTime)!;
  const sortedBreaks = [...safeBreaks].sort((a, b) => (parseHHMM(a.startTime) ?? 0) - (parseHHMM(b.startTime) ?? 0));

  const intervals: { start: number; end: number }[] = [];
  let cursor = dayStart;
  for (const br of sortedBreaks) {
    const bStart = parseHHMM(br.startTime)!;
    const bEnd = parseHHMM(br.endTime)!;
    if (cursor < bStart) intervals.push({ start: cursor, end: bStart });
    cursor = bEnd;
  }
  if (cursor < dayEnd) intervals.push({ start: cursor, end: dayEnd });

  const totalInstruction = intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
  if (periodCount <= 0) return { periods: [], error: 'Periods per day must be at least 1.' };
  if (totalInstruction < periodCount * minPeriodMinutes) {
    return { periods: [], error: `Not enough instructional minutes. Need at least ${periodCount * minPeriodMinutes} minutes.` };
  }

  const rawShare = intervals.map((i) => ((i.end - i.start) / totalInstruction) * periodCount);
  const counts = rawShare.map((v) => Math.floor(v));
  let remaining = periodCount - counts.reduce((a, b) => a + b, 0);

  const remainders = rawShare
    .map((v, idx) => ({ idx, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remainders.length && remaining > 0; i += 1) {
    counts[remainders[i].idx] += 1;
    remaining -= 1;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < counts.length; i += 1) {
      if (counts[i] <= 0) continue;
      const len = intervals[i].end - intervals[i].start;
      if (len / counts[i] >= minPeriodMinutes) continue;
      counts[i] -= 1;
      let target = -1;
      let targetScore = -1;
      for (let j = 0; j < counts.length; j += 1) {
        const lenJ = intervals[j].end - intervals[j].start;
        const possible = lenJ / (counts[j] + 1);
        if (possible >= minPeriodMinutes && possible > targetScore) {
          target = j;
          targetScore = possible;
        }
      }
      if (target >= 0) {
        counts[target] += 1;
      } else {
        return { periods: [], error: 'Break layout leaves no valid period split (min period 20 min).' };
      }
      changed = true;
    }
  }

  const out: Period[] = [];
  let periodIndex = 1;
  for (let i = 0; i < intervals.length; i += 1) {
    const interval = intervals[i];
    const count = counts[i];
    if (count <= 0) continue;
    const length = interval.end - interval.start;
    const base = Math.floor(length / count);
    let rem = length % count;
    let start = interval.start;
    for (let p = 0; p < count; p += 1) {
      const dur = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      const end = start + dur;
      out.push({
        id: `p${periodIndex}`,
        label: `P${periodIndex}`,
        start: formatHHMM(start),
        end: formatHHMM(end),
        isBreak: false
      });
      periodIndex += 1;
      start = end;
    }
  }

  if (out.length !== periodCount) {
    return { periods: [], error: 'Failed to compute period layout for given breaks.' };
  }

  return { periods: out };
}

export type TimelineRow =
  | { kind: 'period'; id: string; label: string; start: string; end: string }
  | { kind: 'break'; id: string; label: string; start: string; end: string };

export function buildTimelineRows(periods: Period[], breaks: SchoolBreak[]): TimelineRow[] {
  const safePeriods = Array.isArray(periods) ? periods : [];
  const safeBreaks = Array.isArray(breaks) ? breaks : [];
  const rows: TimelineRow[] = [];
  for (const period of safePeriods) {
    rows.push({
      kind: 'period',
      id: period.id,
      label: period.label,
      start: period.start ?? '',
      end: period.end ?? ''
    });
  }
  for (const br of safeBreaks) {
    rows.push({
      kind: 'break',
      id: br.id,
      label: br.name,
      start: br.startTime,
      end: br.endTime
    });
  }
  rows.sort((a, b) => (parseHHMM(a.start) ?? 0) - (parseHHMM(b.start) ?? 0));
  return rows;
}

export function conflictMap(data: TimetableData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const classById = listById(data.entities.classes);

  const matrix: Record<string, { key: string; classId: string; value: SlotValue }[]> = {};
  for (const [key, value] of Object.entries(data.slots)) {
    if (!value) continue;
    const { day, periodId, classId } = parseSlotKey(key);
    const blockedKey = `${day}|${periodId}`;
    if ((data.teacherBlocked[value.teacherId] ?? []).includes(blockedKey)) {
      out[key] ??= [];
      out[key].push('Teacher unavailable for this slot');
    }
    const bucketKey = `${day}|${periodId}`;
    matrix[bucketKey] ??= [];
    matrix[bucketKey].push({ key, classId, value });
  }

  for (const entries of Object.values(matrix)) {
    for (let i = 0; i < entries.length; i += 1) {
      const a = entries[i];
      for (let j = i + 1; j < entries.length; j += 1) {
        const b = entries[j];
        if (a.value.teacherId && a.value.teacherId === b.value.teacherId) {
          const bClass = classById[b.classId]?.name ?? b.classId;
          const aClass = classById[a.classId]?.name ?? a.classId;
          out[a.key] ??= [];
          out[b.key] ??= [];
          out[a.key].push(`Teacher can only be in one class at one time (also in ${bClass})`);
          out[b.key].push(`Teacher can only be in one class at one time (also in ${aClass})`);
        }
        if (a.value.roomId && b.value.roomId && a.value.roomId === b.value.roomId) {
          const bClass = classById[b.classId]?.name ?? b.classId;
          const aClass = classById[a.classId]?.name ?? a.classId;
          out[a.key] ??= [];
          out[b.key] ??= [];
          out[a.key].push(`Room clash with ${bClass}`);
          out[b.key].push(`Room clash with ${aClass}`);
        }
      }
    }
  }

  return out;
}
