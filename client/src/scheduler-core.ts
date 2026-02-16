import type { CandidateSchedule, SlotValue, TimetableData } from './types';
import { parseSlotKey, slotKey } from './utils';

export type GeneratePayload = {
  data: TimetableData;
  lockedSlots: string[];
  keep: number;
  attempts: number;
};

type LessonItem = {
  classId: string;
  subjectId: string;
  preferredRoomId?: string;
  allowedTeacherIds: string[];
};

type Option = {
  key: string;
  value: SlotValue;
};

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function teacherBusy(slots: Record<string, SlotValue | null>, day: string, periodId: string, teacherId: string): boolean {
  for (const [key, value] of Object.entries(slots)) {
    if (!value) continue;
    const parsed = parseSlotKey(key);
    if (parsed.day !== day || parsed.periodId !== periodId) continue;
    if (value.teacherId === teacherId) return true;
  }
  return false;
}

function roomBusy(slots: Record<string, SlotValue | null>, day: string, periodId: string, roomId: string): boolean {
  for (const [key, value] of Object.entries(slots)) {
    if (!value?.roomId) continue;
    const parsed = parseSlotKey(key);
    if (parsed.day !== day || parsed.periodId !== periodId) continue;
    if (value.roomId === roomId) return true;
  }
  return false;
}

function scoreSchedule(data: TimetableData, slots: Record<string, SlotValue | null>, unplaced: number): number {
  let penalty = unplaced * 1000;

  for (const klass of data.entities.classes) {
    for (const day of data.settings.days) {
      const daySubjects: string[] = [];
      for (const period of data.settings.periods) {
        const value = slots[slotKey(day, period.id, klass.id)];
        daySubjects.push(value?.subjectId ?? '');
      }
      for (let i = 1; i < daySubjects.length; i += 1) {
        if (daySubjects[i] && daySubjects[i] === daySubjects[i - 1]) penalty += 6;
      }
    }
  }

  return Math.max(0, 10000 - penalty);
}

function buildLessonItems(data: TimetableData): LessonItem[] {
  const teachersAll = data.entities.teachers.map((t) => t.id);
  const items: LessonItem[] = [];
  for (const req of data.requirements) {
    const allowed = req.allowedTeacherIds.length ? req.allowedTeacherIds : teachersAll;
    for (let i = 0; i < req.periodsPerCycle; i += 1) {
      items.push({
        classId: req.classId,
        subjectId: req.subjectId,
        preferredRoomId: req.preferredRoomId,
        allowedTeacherIds: allowed
      });
    }
  }

  return items.sort((a, b) => a.allowedTeacherIds.length - b.allowedTeacherIds.length);
}

function chooseOptions(data: TimetableData, slots: Record<string, SlotValue | null>, item: LessonItem, rand: () => number): Option[] {
  const options: Option[] = [];

  for (const day of data.settings.days) {
    for (const period of data.settings.periods) {
      if (period.isBreak) continue;
      const key = slotKey(day, period.id, item.classId);
      if (slots[key]) continue;

      for (const teacherId of shuffle(item.allowedTeacherIds, rand)) {
        const blockedKey = `${day}|${period.id}`;
        if (data.teacherBlocked[teacherId]?.includes(blockedKey)) continue;
        if (teacherBusy(slots, day, period.id, teacherId)) continue;

        let roomId: string | undefined = item.preferredRoomId;
        if (roomId && roomBusy(slots, day, period.id, roomId)) {
          roomId = undefined;
        }

        options.push({
          key,
          value: {
            subjectId: item.subjectId,
            teacherId,
            roomId
          }
        });
      }
    }
  }

  return options;
}

function seededAttempt(data: TimetableData, seed: number, lockedSlots: string[]): { slots: Record<string, SlotValue | null>; unplaced: number } {
  const rand = createRng(seed);
  const lessons = shuffle(buildLessonItems(data), rand);

  const slots: Record<string, SlotValue | null> = {};
  const locked = new Set(lockedSlots);

  for (const day of data.settings.days) {
    for (const period of data.settings.periods) {
      if (period.isBreak) continue;
      for (const klass of data.entities.classes) {
        const key = slotKey(day, period.id, klass.id);
        if (locked.has(key)) {
          slots[key] = data.slots[key] ?? null;
        } else {
          slots[key] = null;
        }
      }
    }
  }

  let unplaced = 0;
  for (const lesson of lessons) {
    const options = chooseOptions(data, slots, lesson, rand);
    if (!options.length) {
      unplaced += 1;
      continue;
    }

    const pick = options[Math.floor(rand() * options.length)];
    slots[pick.key] = pick.value;
  }

  return { slots, unplaced };
}

export function generateCandidates(payload: GeneratePayload): CandidateSchedule[] {
  const { data, lockedSlots, keep, attempts } = payload;

  const best: CandidateSchedule[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < attempts; i += 1) {
    const trial = seededAttempt(data, Date.now() + i * 97, lockedSlots);
    const score = scoreSchedule(data, trial.slots, trial.unplaced);
    const signature = JSON.stringify(trial.slots);
    if (seen.has(signature)) continue;
    seen.add(signature);
    best.push({
      id: `cand_${i}_${Math.random().toString(36).slice(2, 7)}`,
      score,
      unplaced: trial.unplaced,
      slots: trial.slots
    });
    best.sort((a, b) => b.score - a.score || a.unplaced - b.unplaced);
    if (best.length > keep) best.pop();
  }

  return best;
}
