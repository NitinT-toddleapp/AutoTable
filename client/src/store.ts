import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CandidateSchedule,
  EntityKind,
  IdNameColor,
  Requirement,
  RuntimeState,
  ScheduleMode,
  SchoolBreak,
  SlotValue,
  TimetableData
} from './types';
import {
  buildComputedPeriods,
  createEmptyData,
  createId,
  ensureDataShape,
  getSystemPreferredTheme,
  randomColor,
  storageKey,
  validateManualPeriods,
  validateImport
} from './utils';

type WizardPayload = {
  days: string[];
  periodCount: number;
  dayStartTime: string;
  dayEndTime: string;
  breaks: SchoolBreak[];
  firstClass: string;
  firstTeacher: string;
  firstSubject: string;
};

type AppStore = {
  data: TimetableData;
  runtime: RuntimeState;
  setupFromWizard: (payload: WizardPayload) => void;
  setUI: (patch: Partial<TimetableData['ui']>) => void;
  setRuntime: (patch: Partial<RuntimeState>) => void;
  setScheduleMode: (mode: ScheduleMode, cycleDays?: number) => void;
  setTimeModel: (dayStartTime: string, dayEndTime: string, periodCount: number, breaks: SchoolBreak[]) => { ok: boolean; error?: string };
  setManualTimeModel: (
    dayStartTime: string,
    dayEndTime: string,
    periods: TimetableData['settings']['periods'],
    breaks: SchoolBreak[]
  ) => { ok: boolean; error?: string };
  addEntity: (kind: EntityKind, name: string, options?: { defaultSubjectIds?: string[] }) => void;
  updateEntity: (kind: EntityKind, id: string, patch: Partial<IdNameColor>) => void;
  deleteEntity: (kind: EntityKind, id: string) => void;
  setTeacherSubjects: (teacherId: string, subjectIds: string[]) => void;
  addRequirement: () => void;
  updateRequirement: (id: string, patch: Partial<Requirement>) => void;
  deleteRequirement: (id: string) => void;
  setTeacherBlocked: (teacherId: string, blocked: string[]) => void;
  toggleTeacherBlocked: (teacherId: string, key: string) => void;
  applyAvailabilityPreset: (teacherId: string, preset: 'mornings' | 'afternoons' | 'dayoff', dayOff?: string) => void;
  upsertSlot: (key: string, value: SlotValue | null) => void;
  swapOrMoveSlot: (source: string, target: string) => void;
  clearSlot: (key: string) => void;
  setGeneratedCandidates: (candidates: CandidateSchedule[]) => void;
  applyCandidate: (id: string) => void;
  copySelectedSlot: () => void;
  pasteSelectedSlot: () => void;
  deleteSelectedSlot: () => void;
  undoSlots: () => void;
  redoSlots: () => void;
  importData: (payload: unknown) => boolean;
  resetAll: () => void;
};

const runtimeDefaults: RuntimeState = {
  selectedSlotKey: '',
  autosaveStatus: 'Saved',
  toast: '',
  commandOpen: false,
  globalSearch: '',
  conflictsOnly: false,
  lockedSlots: [],
  generatedCandidates: [],
  generating: false,
  clipboardSlot: null,
  historyPast: [],
  historyFuture: []
};

const maxHistoryDepth = 80;

function cloneSlots(slots: Record<string, SlotValue | null>): Record<string, SlotValue | null> {
  const out: Record<string, SlotValue | null> = {};
  for (const [key, value] of Object.entries(slots)) {
    out[key] = value ? { ...value } : null;
  }
  return out;
}

function pushSlotHistory(
  runtime: RuntimeState,
  slots: Record<string, SlotValue | null>
): Pick<RuntimeState, 'historyPast' | 'historyFuture'> {
  const historyPast = [...runtime.historyPast, cloneSlots(slots)];
  if (historyPast.length > maxHistoryDepth) {
    historyPast.splice(0, historyPast.length - maxHistoryDepth);
  }
  return { historyPast, historyFuture: [] };
}

function cycleDaysFromCount(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Day ${i + 1}`);
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      data: createEmptyData(),
      runtime: runtimeDefaults,
      setupFromWizard: ({ days, periodCount, dayStartTime, dayEndTime, breaks, firstClass, firstTeacher, firstSubject }) => {
        const computed = buildComputedPeriods(dayStartTime, dayEndTime, periodCount, breaks);
        if (computed.error) {
          set((state) => ({ runtime: { ...state.runtime, toast: computed.error ?? 'Invalid time model.' } }));
          return;
        }
        const classId = createId('class');
        const teacherId = createId('teacher');
        const subjectId = createId('subject');
        set({
          data: {
            schemaVersion: 1,
            settings: {
              days,
              periods: computed.periods,
              mode: 'weekly',
              dayStartTime,
              dayEndTime,
              periodCount,
              breaks
            },
            entities: {
              classes: [{ id: classId, name: firstClass || 'Class A', color: randomColor(0) }],
              teachers: [{ id: teacherId, name: firstTeacher || 'Teacher 1', color: randomColor(1) }],
              subjects: [{ id: subjectId, name: firstSubject || 'Subject 1', color: randomColor(2) }],
              rooms: [{ id: createId('room'), name: 'Room 101', color: randomColor(3) }]
            },
            slots: {},
            requirements: [],
            teacherBlocked: {},
            teacherSubjectMap: { [teacherId]: [subjectId] },
            ui: {
              selectedDay: days[0] ?? 'Mon',
              viewMode: 'whole',
              selectedEntityId: classId,
              zoom: 1,
              showConflictsOnly: false,
              readOnly: false,
              themePreference: getSystemPreferredTheme()
            }
          }
        });
      },
      setUI: (patch) => {
        set((state) => ({ data: { ...state.data, ui: { ...state.data.ui, ...patch } } }));
      },
      setRuntime: (patch) => {
        set((state) => ({ runtime: { ...state.runtime, ...patch } }));
      },
      setScheduleMode: (mode, cycleDays) => {
        set((state) => {
          const days = mode === 'weekly' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : cycleDaysFromCount(Math.max(2, cycleDays ?? 6));
          return {
            data: {
              ...state.data,
              slots: {},
              teacherBlocked: {},
              settings: { ...state.data.settings, mode, days },
              ui: { ...state.data.ui, selectedDay: days[0] ?? 'Mon' }
            }
          };
        });
      },
      setTimeModel: (dayStartTime, dayEndTime, periodCount, breaks) => {
        const computed = buildComputedPeriods(dayStartTime, dayEndTime, periodCount, breaks);
        if (computed.error) {
          get().setRuntime({ toast: computed.error });
          return { ok: false, error: computed.error };
        }
        set((state) => ({
          data: {
            ...state.data,
            slots: {},
            teacherBlocked: {},
            settings: {
              ...state.data.settings,
              dayStartTime,
              dayEndTime,
              periodCount,
              breaks,
              periods: computed.periods
            }
          },
          runtime: { ...state.runtime, toast: 'Time model updated.', selectedSlotKey: '', lockedSlots: [] }
        }));
        return { ok: true };
      },
      setManualTimeModel: (dayStartTime, dayEndTime, periods, breaks) => {
        const safePeriods = (Array.isArray(periods) ? periods : []).map((period, idx) => ({
          id: period.id || `p${idx + 1}`,
          label: period.label || `P${idx + 1}`,
          start: period.start,
          end: period.end,
          isBreak: false
        }));
        const error = validateManualPeriods(safePeriods, dayStartTime, dayEndTime, breaks);
        if (error) {
          get().setRuntime({ toast: error });
          return { ok: false, error };
        }
        set((state) => ({
          data: {
            ...state.data,
            slots: {},
            teacherBlocked: {},
            settings: {
              ...state.data.settings,
              dayStartTime,
              dayEndTime,
              periodCount: safePeriods.length,
              breaks,
              periods: safePeriods
            }
          },
          runtime: { ...state.runtime, toast: 'Time model updated.', selectedSlotKey: '', lockedSlots: [] }
        }));
        return { ok: true };
      },
      addEntity: (kind, name, options) => {
        set((state) => {
          const list = state.data.entities[kind];
          const id = createId(kind.slice(0, -1));
          const teacherSubjectMap = state.data.teacherSubjectMap ?? {};
          const next = [...list, { id, name, color: randomColor(list.length) }];
          return {
            data: {
              ...state.data,
              entities: { ...state.data.entities, [kind]: next },
              teacherSubjectMap:
                kind === 'teachers'
                  ? {
                      ...teacherSubjectMap,
                      [id]:
                        options?.defaultSubjectIds?.length
                          ? options.defaultSubjectIds
                          : state.data.entities.subjects[0]
                            ? [state.data.entities.subjects[0].id]
                            : []
                    }
                  : teacherSubjectMap
            }
          };
        });
      },
      updateEntity: (kind, id, patch) => {
        set((state) => ({
          data: {
            ...state.data,
            entities: {
              ...state.data.entities,
              [kind]: state.data.entities[kind].map((item) => (item.id === id ? { ...item, ...patch } : item))
            }
          }
        }));
      },
      deleteEntity: (kind, id) => {
        set((state) => {
          const entities = {
            ...state.data.entities,
            [kind]: state.data.entities[kind].filter((item) => item.id !== id)
          };
          const slots = Object.fromEntries(
            Object.entries(state.data.slots).map(([key, value]) => {
              if (!value) return [key, value];
              if (kind === 'classes' && key.endsWith(`|${id}`)) return [key, null];
              if (kind === 'teachers' && value.teacherId === id) return [key, null];
              if (kind === 'subjects' && value.subjectId === id) return [key, null];
              if (kind === 'rooms' && value.roomId === id) return [key, { ...value, roomId: undefined }];
              return [key, value];
            })
          );
          const requirements = state.data.requirements.filter((req) => {
            if (kind === 'classes' && req.classId === id) return false;
            if (kind === 'subjects' && req.subjectId === id) return false;
            if (kind === 'teachers') {
              return req.allowedTeacherIds.includes(id)
                ? req.allowedTeacherIds.length > 1
                : true;
            }
            if (kind === 'rooms' && req.preferredRoomId === id) return false;
            return true;
          }).map((req) => kind === 'teachers' ? { ...req, allowedTeacherIds: req.allowedTeacherIds.filter((t) => t !== id) } : req);

          const teacherBlocked = { ...state.data.teacherBlocked };
          if (kind === 'teachers') delete teacherBlocked[id];
          const teacherSubjectMap = { ...(state.data.teacherSubjectMap ?? {}) };
          if (kind === 'teachers') {
            delete teacherSubjectMap[id];
          }
          if (kind === 'subjects') {
            for (const teacherId of Object.keys(teacherSubjectMap)) {
              teacherSubjectMap[teacherId] = teacherSubjectMap[teacherId].filter((subjectId) => subjectId !== id);
            }
          }

          return { data: { ...state.data, entities, slots, requirements, teacherBlocked, teacherSubjectMap } };
        });
      },
      setTeacherSubjects: (teacherId, subjectIds) => {
        set((state) => ({
          data: {
            ...state.data,
            teacherSubjectMap: {
              ...(state.data.teacherSubjectMap ?? {}),
              [teacherId]: Array.from(new Set(subjectIds))
            }
          }
        }));
      },
      addRequirement: () => {
        set((state) => {
          const klass = state.data.entities.classes[0]?.id ?? '';
          const subject = state.data.entities.subjects[0]?.id ?? '';
          const teacher = state.data.entities.teachers[0]?.id;
          if (!klass || !subject) return {};
          const next: Requirement = {
            id: createId('req'),
            classId: klass,
            subjectId: subject,
            periodsPerCycle: 1,
            allowedTeacherIds: teacher ? [teacher] : []
          };
          return { data: { ...state.data, requirements: [...state.data.requirements, next] } };
        });
      },
      updateRequirement: (id, patch) => {
        set((state) => ({
          data: {
            ...state.data,
            requirements: state.data.requirements.map((req) => (req.id === id ? { ...req, ...patch } : req))
          }
        }));
      },
      deleteRequirement: (id) => {
        set((state) => ({
          data: { ...state.data, requirements: state.data.requirements.filter((req) => req.id !== id) }
        }));
      },
      setTeacherBlocked: (teacherId, blocked) => {
        set((state) => ({
          data: {
            ...state.data,
            teacherBlocked: { ...state.data.teacherBlocked, [teacherId]: blocked }
          }
        }));
      },
      toggleTeacherBlocked: (teacherId, key) => {
        set((state) => {
          const existing = state.data.teacherBlocked[teacherId] ?? [];
          const next = existing.includes(key) ? existing.filter((x) => x !== key) : [...existing, key];
          return {
            data: {
              ...state.data,
              teacherBlocked: { ...state.data.teacherBlocked, [teacherId]: next }
            }
          };
        });
      },
      applyAvailabilityPreset: (teacherId, preset, dayOff) => {
        set((state) => {
          const blocked = new Set<string>();
          const mid = Math.ceil(state.data.settings.periods.length / 2);
          for (const day of state.data.settings.days) {
            for (let i = 0; i < state.data.settings.periods.length; i += 1) {
              const period = state.data.settings.periods[i];
              if (period.isBreak) continue;
              const key = `${day}|${period.id}`;
              if (preset === 'mornings' && i >= mid) blocked.add(key);
              if (preset === 'afternoons' && i < mid) blocked.add(key);
              if (preset === 'dayoff' && dayOff && day === dayOff) blocked.add(key);
            }
          }
          return {
            data: {
              ...state.data,
              teacherBlocked: { ...state.data.teacherBlocked, [teacherId]: Array.from(blocked) }
            }
          };
        });
      },
      upsertSlot: (key, value) => {
        set((state) => {
          const nextSlots = { ...state.data.slots, [key]: value };
          const nextHistory = pushSlotHistory(state.runtime, state.data.slots);
          return {
            data: { ...state.data, slots: nextSlots },
            runtime: { ...state.runtime, ...nextHistory }
          };
        });
      },
      swapOrMoveSlot: (source, target) => {
        if (!source || !target || source === target) return;
        set((state) => {
          const next = { ...state.data.slots };
          const sourceValue = next[source] ?? null;
          const targetValue = next[target] ?? null;
          next[target] = sourceValue;
          next[source] = targetValue;
          const nextHistory = pushSlotHistory(state.runtime, state.data.slots);
          return {
            data: { ...state.data, slots: next },
            runtime: { ...state.runtime, ...nextHistory, selectedSlotKey: target }
          };
        });
      },
      clearSlot: (key) => {
        set((state) => {
          const nextSlots = { ...state.data.slots, [key]: null };
          const nextHistory = pushSlotHistory(state.runtime, state.data.slots);
          return {
            data: { ...state.data, slots: nextSlots },
            runtime: { ...state.runtime, ...nextHistory }
          };
        });
      },
      setGeneratedCandidates: (candidates) => {
        set((state) => ({ runtime: { ...state.runtime, generatedCandidates: candidates, generating: false } }));
      },
      applyCandidate: (id) => {
        set((state) => {
          const candidate = state.runtime.generatedCandidates.find((item) => item.id === id);
          if (!candidate) return {};
          const nextHistory = pushSlotHistory(state.runtime, state.data.slots);
          return {
            data: { ...state.data, slots: candidate.slots },
            runtime: { ...state.runtime, ...nextHistory, toast: 'Candidate applied.' }
          };
        });
      },
      copySelectedSlot: () => {
        set((state) => {
          const key = state.runtime.selectedSlotKey;
          if (!key) return { runtime: { ...state.runtime, toast: 'Select a slot first.' } };
          const value = state.data.slots[key];
          if (!value) return { runtime: { ...state.runtime, toast: 'Selected slot is empty.' } };
          return { runtime: { ...state.runtime, clipboardSlot: { ...value }, toast: 'Lesson copied.' } };
        });
      },
      pasteSelectedSlot: () => {
        set((state) => {
          const key = state.runtime.selectedSlotKey;
          if (!key) return { runtime: { ...state.runtime, toast: 'Select a slot first.' } };
          const copied = state.runtime.clipboardSlot;
          if (!copied) return { runtime: { ...state.runtime, toast: 'Clipboard is empty.' } };
          const nextSlots = { ...state.data.slots, [key]: { ...copied } };
          const nextHistory = pushSlotHistory(state.runtime, state.data.slots);
          return {
            data: { ...state.data, slots: nextSlots },
            runtime: { ...state.runtime, ...nextHistory, toast: 'Lesson pasted.' }
          };
        });
      },
      deleteSelectedSlot: () => {
        set((state) => {
          const key = state.runtime.selectedSlotKey;
          if (!key) return { runtime: { ...state.runtime, toast: 'Select a slot first.' } };
          const nextSlots = { ...state.data.slots, [key]: null };
          const nextHistory = pushSlotHistory(state.runtime, state.data.slots);
          return {
            data: { ...state.data, slots: nextSlots },
            runtime: { ...state.runtime, ...nextHistory, toast: 'Lesson cleared.' }
          };
        });
      },
      undoSlots: () => {
        set((state) => {
          if (!state.runtime.historyPast.length) return {};
          const historyPast = [...state.runtime.historyPast];
          const previous = historyPast.pop();
          if (!previous) return {};
          const historyFuture = [...state.runtime.historyFuture, cloneSlots(state.data.slots)];
          return {
            data: { ...state.data, slots: cloneSlots(previous) },
            runtime: { ...state.runtime, historyPast, historyFuture, toast: 'Undo' }
          };
        });
      },
      redoSlots: () => {
        set((state) => {
          if (!state.runtime.historyFuture.length) return {};
          const historyFuture = [...state.runtime.historyFuture];
          const next = historyFuture.pop();
          if (!next) return {};
          const historyPast = [...state.runtime.historyPast, cloneSlots(state.data.slots)];
          if (historyPast.length > maxHistoryDepth) {
            historyPast.splice(0, historyPast.length - maxHistoryDepth);
          }
          return {
            data: { ...state.data, slots: cloneSlots(next) },
            runtime: { ...state.runtime, historyPast, historyFuture, toast: 'Redo' }
          };
        });
      },
      importData: (payload) => {
        if (!validateImport(payload)) {
          get().setRuntime({ toast: 'Invalid import file.' });
          return false;
        }
        const data = ensureDataShape(payload);
        set({
          data,
          runtime: { ...get().runtime, selectedSlotKey: '', historyPast: [], historyFuture: [], clipboardSlot: null }
        });
        return true;
      },
      resetAll: () => {
        set({ data: createEmptyData(), runtime: runtimeDefaults });
      }
    }),
    {
      name: storageKey,
      storage: createJSONStorage(() => ({
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            window.dispatchEvent(new CustomEvent('timetable:quota-error'));
          }
        },
        removeItem: (key) => localStorage.removeItem(key)
      })),
      partialize: (state) => ({ data: state.data }),
      version: 3,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { data?: TimetableData } | undefined;
        if (!state?.data) {
          return { data: createEmptyData() };
        }
        return {
          ...state,
          data: ensureDataShape(state.data)
        };
      }
    }
  )
);
