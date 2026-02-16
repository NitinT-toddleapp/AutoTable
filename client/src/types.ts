export type IdNameColor = {
  id: string;
  name: string;
  color: string;
};

export type Period = {
  id: string;
  label: string;
  start?: string;
  end?: string;
  isBreak?: boolean;
};

export type ScheduleMode = 'weekly' | 'cycle';

export type SchoolBreak = {
  id: string;
  name: string;
  type: 'break' | 'non-instructional';
  startTime: string;
  endTime: string;
};

export type Settings = {
  days: string[];
  periods: Period[];
  mode: ScheduleMode;
  dayStartTime: string;
  dayEndTime: string;
  periodCount: number;
  breaks: SchoolBreak[];
};

export type SlotValue = {
  subjectId: string;
  teacherId: string;
  roomId?: string;
};

export type Requirement = {
  id: string;
  classId: string;
  subjectId: string;
  periodsPerCycle: number;
  allowedTeacherIds: string[];
  preferredRoomId?: string;
};

export type CandidateSchedule = {
  id: string;
  score: number;
  unplaced: number;
  slots: Record<string, SlotValue | null>;
};

export type ViewMode = 'whole' | 'class' | 'teacher' | 'room';
export type ThemePreference = 'light' | 'dark';

export type EntityKind = 'teachers' | 'classes' | 'subjects' | 'rooms';

export type PersistedUI = {
  selectedDay: string;
  viewMode: ViewMode;
  selectedEntityId: string;
  zoom: number;
  showConflictsOnly: boolean;
  readOnly: boolean;
  themePreference: ThemePreference;
};

export type TimetableData = {
  schemaVersion: 1;
  settings: Settings;
  entities: {
    teachers: IdNameColor[];
    classes: IdNameColor[];
    rooms: IdNameColor[];
    subjects: IdNameColor[];
  };
  slots: Record<string, SlotValue | null>;
  requirements: Requirement[];
  teacherBlocked: Record<string, string[]>;
  teacherSubjectMap: Record<string, string[]>;
  ui: PersistedUI;
};

export type RuntimeState = {
  selectedSlotKey: string;
  autosaveStatus: 'Saved' | 'Saving...';
  toast: string;
  commandOpen: boolean;
  globalSearch: string;
  conflictsOnly: boolean;
  lockedSlots: string[];
  generatedCandidates: CandidateSchedule[];
  generating: boolean;
  clipboardSlot: SlotValue | null;
  historyPast: Record<string, SlotValue | null>[];
  historyFuture: Record<string, SlotValue | null>[];
};
