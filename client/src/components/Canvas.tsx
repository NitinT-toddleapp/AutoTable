import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Eye, GripVertical } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../store';
import { buildComputedPeriods, buildTimelineRows, createId, parseSlotKey, slotKey } from '../utils';
import type { ScheduleMode, SchoolBreak, SlotValue, TimetableData } from '../types';

type Props = {
  conflicts: Record<string, string[]>;
  fallbackSelectKey: string;
};

type DragMeta = {
  key: string;
  value: SlotValue;
};

type WeekDropTarget = {
  day: string;
  periodId: string;
};

function encodeWeekDropTarget(target: WeekDropTarget): string {
  return `week|${target.day}|${target.periodId}`;
}

function decodeWeekDropTarget(id: string): WeekDropTarget | null {
  if (!id.startsWith('week|')) return null;
  const [, day, periodId] = id.split('|');
  if (!day || !periodId) return null;
  return { day, periodId };
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(normalized, 16);
  if (Number.isNaN(n)) return `rgba(62,197,255,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getName(data: TimetableData, kind: 'subjects' | 'teachers' | 'rooms' | 'classes', id?: string): string {
  if (!id) return '—';
  return data.entities[kind].find((x) => x.id === id)?.name ?? 'Unknown';
}

function matchSearch(value: SlotValue | null, data: TimetableData, query: string): boolean {
  if (!value || !query.trim()) return false;
  const q = query.toLowerCase();
  const subject = getName(data, 'subjects', value.subjectId).toLowerCase();
  const teacher = getName(data, 'teachers', value.teacherId).toLowerCase();
  const room = getName(data, 'rooms', value.roomId).toLowerCase();
  return subject.includes(q) || teacher.includes(q) || room.includes(q);
}

function LessonContent({ data, value, compact = false }: { data: TimetableData; value: SlotValue; compact?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={`${compact ? 'text-xs' : 'text-sm'} truncate font-semibold leading-tight`}>{getName(data, 'subjects', value.subjectId)}</p>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} truncate text-soft leading-tight`}>{getName(data, 'teachers', value.teacherId)}</p>
        {!compact ? <p className="truncate text-[11px] leading-tight text-soft/80">{getName(data, 'rooms', value.roomId)}</p> : null}
      </div>
      <GripVertical className="h-4 w-4 text-soft opacity-40" />
    </div>
  );
}

const LessonCard = memo(function LessonCard({
  keyId,
  value,
  className,
  classColor,
  compact
}: {
  keyId: string;
  value: SlotValue;
  className?: string;
  classColor?: string;
  compact?: boolean;
}) {
  const data = useAppStore((s) => s.data);
  const isReadOnly = data.ui.readOnly;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: keyId,
    data: { key: keyId, value },
    disabled: isReadOnly
  });
  const cardStyle = {
    ...(!isDragging && transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    ...(classColor
      ? {
          borderColor: hexToRgba(classColor, 0.6),
          background: `linear-gradient(180deg, ${hexToRgba(classColor, 0.18)} 0%, rgba(0,0,0,0) 45%)`
        }
      : {})
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      className={`group overflow-hidden rounded-lg border border-line bg-panel2/85 p-2 text-left transition duration-180 ${isDragging ? 'opacity-0' : 'opacity-100 hover:shadow-glow'} ${className ?? ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="group-hover:[&_svg]:opacity-80">
        <LessonContent data={data} value={value} compact={compact} />
      </div>
    </div>
  );
});

function WholeCell({
  cellKey,
  value,
  conflict,
  onSelect,
  selected,
  dragging,
  warning,
  searchHit,
  classColor,
  cellHeight
}: {
  cellKey: string;
  value: SlotValue | null;
  conflict: string[] | undefined;
  onSelect: (key: string) => void;
  selected: boolean;
  dragging: boolean;
  warning: boolean;
  searchHit: boolean;
  classColor: string;
  cellHeight: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellKey });

  return (
    <div
      ref={setNodeRef}
      style={{ height: `${cellHeight}px` }}
      className={`relative overflow-visible rounded-lg border p-1.5 transition duration-180 ${
        selected ? 'border-glow/80 shadow-glow' : 'border-line/90'
      } ${isOver && dragging ? 'bg-glow/10' : 'bg-panel/70'} ${conflict?.length ? 'border-danger/85' : ''} ${warning ? 'border-amber-400/90' : ''} ${searchHit ? 'ring-2 ring-glow/55' : ''}`}
      onClick={() => {
        if (!dragging) onSelect(cellKey);
      }}
    >
      {conflict?.length ? (
        <div className="group/conflict absolute left-1.5 top-1.5 z-20">
          <div className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">
            <AlertTriangle className="h-3 w-3" />
            Conflict
          </div>
          <div className="pointer-events-none absolute left-0 top-6 hidden min-w-[220px] max-w-[320px] rounded-md border border-danger/40 bg-panel2/95 p-2 text-[11px] text-text shadow-soft group-hover/conflict:block">
            <p className="mb-1 font-semibold text-danger">Conflict details</p>
            <ul className="space-y-0.5">
              {conflict.map((message, idx) => (
                <li key={`${cellKey}-conflict-${idx}`}>• {message}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <div className={`box-border h-full ${conflict?.length ? 'pt-6' : ''}`}>
        {value ? (
          <LessonCard keyId={cellKey} value={value} className="h-full" classColor={classColor} compact={cellHeight < 100} />
        ) : (
          <button
            className="h-full w-full rounded-md border border-dashed border-line/80 text-xs text-soft/80 hover:border-glow/50"
            style={{ borderColor: hexToRgba(classColor, 0.35), backgroundColor: hexToRgba(classColor, 0.06) }}
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

export function Canvas({ conflicts, fallbackSelectKey }: Props) {
  const { data, runtime, setRuntime, setUI, swapOrMoveSlot, setScheduleMode, setTimeModel, setManualTimeModel } = useAppStore();
  const wholeScrollRef = useRef<HTMLDivElement | null>(null);
  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configMode, setConfigMode] = useState<ScheduleMode>(data.settings.mode ?? 'weekly');
  const [cycleDays, setCycleDays] = useState(Math.max(2, data.settings.days.length || 6));
  const [periodCount, setPeriodCount] = useState(Math.max(2, data.settings.periodCount || 7));
  const [dayStart, setDayStart] = useState(data.settings.dayStartTime || '08:30');
  const [dayEnd, setDayEnd] = useState(data.settings.dayEndTime || '15:00');
  const [breaks, setBreaks] = useState<SchoolBreak[]>(Array.isArray(data.settings.breaks) ? data.settings.breaks : []);
  const [manualPeriodMode, setManualPeriodMode] = useState(false);
  const [manualPeriods, setManualPeriods] = useState<TimetableData['settings']['periods']>(
    data.settings.periods.length
      ? data.settings.periods.map((p, idx) => ({ id: p.id || `p${idx + 1}`, label: p.label || `P${idx + 1}`, start: p.start, end: p.end, isBreak: false }))
      : []
  );
  const [activeDrag, setActiveDrag] = useState<DragMeta | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);
  const [activeDragHeight, setActiveDragHeight] = useState<number | null>(null);
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(null);
  const [overKey, setOverKey] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 2 }
    })
  );

  const selectedKey = runtime.selectedSlotKey || fallbackSelectKey;
  const needsConfiguration = data.settings.days.length === 0 || data.settings.periods.length === 0;
  const isReadOnly = data.ui.readOnly;
  const zoom = Math.max(0.2, Math.min(1.8, data.ui.zoom || 1));
  const periodColWidth = Math.round(120 * zoom);
  const classColMinWidth = Math.round(160 * zoom);
  const cellHeight = Math.round(108 * zoom);
  const breakHeight = Math.round(54 * zoom);
  const weekColMinWidth = Math.round(130 * zoom);
  const weekCellMinHeight = Math.round(74 * zoom);
  const timelineRows = useMemo(() => buildTimelineRows(data.settings.periods, data.settings.breaks), [data.settings.periods, data.settings.breaks]);

  useEffect(() => {
    if (needsConfiguration) setConfigOpen(true);
  }, [needsConfiguration]);

  useEffect(() => {
    if (!configOpen) return;
    setConfigMode(data.settings.mode ?? 'weekly');
    setCycleDays(Math.max(2, data.settings.days.length || 6));
    setPeriodCount(Math.max(2, data.settings.periodCount || data.settings.periods.length || 7));
    setDayStart(data.settings.dayStartTime || '08:30');
    setDayEnd(data.settings.dayEndTime || '15:00');
    setBreaks(Array.isArray(data.settings.breaks) ? data.settings.breaks : []);
    setManualPeriods(
      data.settings.periods.length
        ? data.settings.periods.map((p, idx) => ({ id: p.id || `p${idx + 1}`, label: p.label || `P${idx + 1}`, start: p.start, end: p.end, isBreak: false }))
        : []
    );
  }, [configOpen, data.settings]);

  const generateManualDefaults = () => {
    const computed = buildComputedPeriods(dayStart, dayEnd, periodCount, []);
    if (computed.error) {
      setRuntime({ toast: computed.error });
      return;
    }
    setManualPeriods(
      computed.periods.map((p, idx) => ({
        id: `p${idx + 1}`,
        label: `P${idx + 1}`,
        start: p.start,
        end: p.end,
        isBreak: false
      }))
    );
  };

  useEffect(() => {
    if (!manualPeriodMode) return;
    if (manualPeriods.length === periodCount) return;
    generateManualDefaults();
  }, [manualPeriodMode, periodCount]);

  const applyConfiguration = () => {
    if (configMode === 'cycle') {
      setScheduleMode('cycle', cycleDays);
    } else {
      setScheduleMode('weekly');
    }
    const result = manualPeriodMode
      ? setManualTimeModel(
          dayStart,
          dayEnd,
          manualPeriods.map((period, idx) => ({
            id: period.id || `p${idx + 1}`,
            label: period.label || `P${idx + 1}`,
            start: period.start,
            end: period.end,
            isBreak: false
          })),
          breaks
        )
      : setTimeModel(dayStart, dayEnd, periodCount, breaks);
    if (!result.ok) return;
    setConfigOpen(false);
    setRuntime({ toast: 'Timetable configured. Add classes/teachers/subjects from Library.' });
  };

  const searchCount = useMemo(() => {
    if (!runtime.globalSearch.trim()) return 0;
    return Object.values(data.slots).filter((value) => matchSearch(value, data, runtime.globalSearch)).length;
  }, [data, runtime.globalSearch]);

  const handleDragStart = (event: DragStartEvent) => {
    if (isReadOnly) {
      setRuntime({ toast: 'Read-only mode is enabled.' });
      return;
    }
    const payload = event.active.data.current as DragMeta | undefined;
    if (!payload) return;
    setActiveDrag(payload);
    const initialRect = event.active.rect.current.initial;
    setActiveDragWidth(initialRect?.width ?? null);
    setActiveDragHeight(initialRect?.height ?? null);
    const activator = event.activatorEvent as { clientX?: number; clientY?: number };
    if (typeof activator.clientX === 'number' && typeof activator.clientY === 'number') {
      setDragCursor({ x: activator.clientX, y: activator.clientY });
    } else {
      setDragCursor(null);
    }
  };

  useEffect(() => {
    if (!activeDrag) return;
    const onPointerMove = (event: PointerEvent) => {
      setDragCursor({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [activeDrag]);

  const handleDragOver = (event: DragOverEvent) => {
    setOverKey((event.over?.id as string) ?? '');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const source = event.active.id as string;
    const targetId = event.over?.id as string | undefined;
    setActiveDrag(null);
    setActiveDragWidth(null);
    setActiveDragHeight(null);
    setDragCursor(null);
    setOverKey('');
    if (isReadOnly) return;
    if (!targetId) return;
    const weekTarget = decodeWeekDropTarget(targetId);
    const target = weekTarget ? slotKey(weekTarget.day, weekTarget.periodId, parseSlotKey(source).classId) : targetId;
    if (runtime.lockedSlots.includes(source) || runtime.lockedSlots.includes(target)) {
      setRuntime({ toast: 'Cell is locked.' });
      return;
    }
    swapOrMoveSlot(source, target);
  };

  const adjustZoom = (delta: number) => {
    const next = Math.max(0.2, Math.min(1.8, Number((zoom + delta).toFixed(2))));
    setUI({ zoom: next });
  };

  const dayTabs = (
    <div className="mb-2 flex flex-wrap gap-1">
      {data.ui.viewMode === 'whole'
        ? data.settings.days.map((day) => (
            <button
              key={day}
              className={`rounded-md border px-2 py-1 text-xs ${
                data.ui.selectedDay === day ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel2/60'
              }`}
              onClick={() => setUI({ selectedDay: day })}
            >
              {day}
            </button>
          ))
        : null}
      <div className="ml-auto flex items-center gap-1">
        <button
          className={`rounded-md border px-2 py-1 text-xs ${isReadOnly ? 'border-amber-400/70 bg-amber-500/12 text-amber-300' : 'border-line text-soft'}`}
          onClick={() => setUI({ readOnly: !isReadOnly })}
          title="Toggle read-only mode"
        >
          Read only: {isReadOnly ? 'On' : 'Off'}
        </button>
        <button
          className={`rounded-md border px-2 py-1 text-xs ${data.ui.showConflictsOnly ? 'border-danger/70 text-danger' : 'border-line text-soft'}`}
          onClick={() => setUI({ showConflictsOnly: !data.ui.showConflictsOnly })}
        >
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> Conflicts only
          </span>
        </button>

        <button
          className="rounded-md border border-line px-2 py-1 text-xs text-soft hover:border-glow/40"
          onClick={() => adjustZoom(-0.1)}
          title="Zoom out"
        >
          -
        </button>
        <button
          className="rounded-md border border-line px-2 py-1 text-xs text-soft hover:border-glow/40"
          onClick={() => setUI({ zoom: 1 })}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="rounded-md border border-line px-2 py-1 text-xs text-soft hover:border-glow/40"
          onClick={() => adjustZoom(0.1)}
          title="Zoom in"
        >
          +
        </button>
      </div>
      {runtime.globalSearch ? <div className="rounded-md border border-line px-2 py-1 text-xs text-soft">Matches: {searchCount}</div> : null}
    </div>
  );

  const wouldWarn = (targetKey: string): boolean => {
    if (!activeDrag) return false;
    const targetInfo = parseSlotKey(targetKey);
    const sourceInfo = parseSlotKey(activeDrag.key);
    const candidate = data.slots[targetKey] ?? activeDrag.value;
    if (!candidate) return false;
    const matches = Object.entries(data.slots).filter(([k, v]) => {
      if (!v) return false;
      const p = parseSlotKey(k);
      if (p.day !== targetInfo.day || p.periodId !== targetInfo.periodId) return false;
      if (k === targetKey) return false;
      if (k === activeDrag.key) return false;
      return v.teacherId === candidate.teacherId || (v.roomId && candidate.roomId && v.roomId === candidate.roomId);
    });
    if (sourceInfo.day === targetInfo.day && sourceInfo.periodId === targetInfo.periodId) return false;
    return matches.length > 0;
  };

  const forceVerticalScroll = (element: HTMLDivElement | null, deltaY: number): boolean => {
    if (!element) return false;
    const before = element.scrollTop;
    element.scrollTop += deltaY;
    return element.scrollTop !== before;
  };

  return (
    <section className="glass grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-3">
      {dayTabs}

      {needsConfiguration ? (
        <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-line/90 bg-panel/30 p-4">
          <button
            className="rounded-lg border border-glow/60 bg-glow/10 px-4 py-3 text-sm font-medium hover:bg-glow/20"
            onClick={() => setConfigOpen(true)}
          >
            Configure Timetable
          </button>
        </div>
      ) : null}

      {!needsConfiguration && data.ui.viewMode === 'whole' && (
        <div className="relative h-full min-h-0 overflow-hidden">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={wholeScrollRef}
              className="timetable-scroll h-full flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-scroll rounded-lg border border-line/90 bg-panel/30 overscroll-contain [scrollbar-gutter:stable_both-edges] touch-pan-x touch-pan-y"
              onWheel={(event) => {
                if (Math.abs(event.deltaY) < 0.01) return;
                const moved = forceVerticalScroll(wholeScrollRef.current, event.deltaY);
                if (moved) event.preventDefault();
              }}
            >
                <div className="min-h-max min-w-[760px]">
                  <div className="grid" style={{ gridTemplateColumns: `${periodColWidth}px repeat(${data.entities.classes.length}, minmax(${classColMinWidth}px, 1fr))` }}>
                    <div className="sticky left-0 top-0 z-40 border-b border-r border-line bg-panel2/95 p-2 text-xs uppercase tracking-wide text-soft backdrop-blur">
                      Period
                    </div>
                    {data.entities.classes.map((klass) => (
                      <div key={klass.id} className="sticky top-0 z-30 border-b border-r border-line bg-panel2/95 p-2 text-xs font-semibold backdrop-blur">
                        {klass.name}
                      </div>
                    ))}

                    {timelineRows.map((row) =>
                      row.kind === 'break' ? (
                        <BreakRow
                          key={row.id}
                          label={`${row.label} ${row.start}-${row.end}`}
                          spanCount={data.entities.classes.length}
                          breakHeight={breakHeight}
                        />
                      ) : (
                      <Row
                          key={row.id}
                          periodLabel={row.label}
                          periodTime={`${row.start}-${row.end}`}
                          periodId={row.id}
                        classes={data.entities.classes.map((x) => ({ id: x.id, color: x.color }))}
                          selectedDay={data.ui.selectedDay}
                          slots={data.slots}
                          conflicts={conflicts}
                          selectedKey={selectedKey}
                          setSelected={(key) => setRuntime({ selectedSlotKey: key })}
                          showConflictsOnly={data.ui.showConflictsOnly}
                          dragging={Boolean(activeDrag)}
                          overKey={overKey}
                          warnCheck={wouldWarn}
                          searchCheck={(value) => matchSearch(value, data, runtime.globalSearch)}
                          cellHeight={cellHeight}
                        />
                      )
                    )}
                  </div>
                </div>
            </div>
          </DndContext>
        </div>
      )}

      {!needsConfiguration && data.ui.viewMode !== 'whole' && (
        <div
          ref={weekScrollRef}
          className="timetable-scroll h-full min-h-0 min-w-0 overflow-x-auto overflow-y-scroll rounded-lg border border-line/90 bg-panel/30 p-2 [scrollbar-gutter:stable_both-edges]"
          onWheel={(event) => {
            if (Math.abs(event.deltaY) < 0.01) return;
            const moved = forceVerticalScroll(weekScrollRef.current, event.deltaY);
            if (moved) event.preventDefault();
          }}
        >
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <WeekMatrix
                periodColWidth={periodColWidth}
                dayColMinWidth={weekColMinWidth}
                cellMinHeight={weekCellMinHeight}
                selectedKey={selectedKey}
                overKey={overKey}
                dragging={Boolean(activeDrag)}
              />
            </DndContext>
        </div>
      )}

      {activeDrag?.value ? (
        <DragGhost
          value={activeDrag.value}
          data={data}
          width={activeDragWidth}
          height={activeDragHeight}
          cursor={dragCursor}
        />
      ) : null}

      <Dialog.Root open={configOpen} onOpenChange={setConfigOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl2 border border-line bg-panel p-4 shadow-soft">
            <Dialog.Title className="text-sm font-semibold">Configure Timetable</Dialog.Title>
            <p className="mt-1 text-xs text-soft">Set days, periods, timings and optional breaks. You can edit everything later.</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-panel2/50 p-2">
                <p className="mb-2 text-xs text-soft">Mode</p>
                <div className="flex gap-2">
                  <button
                    className={`rounded-md border px-2 py-1 text-xs ${configMode === 'weekly' ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel/50'}`}
                    onClick={() => setConfigMode('weekly')}
                  >
                    Weekly
                  </button>
                  <button
                    className={`rounded-md border px-2 py-1 text-xs ${configMode === 'cycle' ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel/50'}`}
                    onClick={() => setConfigMode('cycle')}
                  >
                    Cycle
                  </button>
                </div>
                {configMode === 'cycle' && (
                  <input
                    className="soft-input mt-2 w-full"
                    type="number"
                    min={2}
                    max={14}
                    value={cycleDays}
                    onChange={(e) => setCycleDays(Math.max(2, Number(e.target.value) || 2))}
                    placeholder="Cycle days"
                  />
                )}
              </div>

              <div className="rounded-md border border-line bg-panel2/50 p-2">
                <p className="mb-2 text-xs text-soft">Periods & Time</p>
                <div className="grid gap-2">
                  <input
                    className="soft-input"
                    type="number"
                    min={2}
                    max={14}
                    value={periodCount}
                    onChange={(e) => setPeriodCount(Math.max(2, Number(e.target.value) || 2))}
                    placeholder="Periods per day"
                  />
                  <input className="soft-input" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
                  <input className="soft-input" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className={`rounded-md border px-2 py-1 text-xs ${manualPeriodMode ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel/50'}`}
                    onClick={() => setManualPeriodMode((v) => !v)}
                  >
                    {manualPeriodMode ? 'Manual period timing: On' : 'Manual period timing: Off'}
                  </button>
                  {manualPeriodMode && (
                    <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={generateManualDefaults}>
                      Auto-fill defaults
                    </button>
                  )}
                </div>
                {manualPeriodMode && (
                  <div className="mt-2 space-y-2">
                    {Array.from({ length: periodCount }, (_, i) => {
                      const row = manualPeriods[i] ?? { id: `p${i + 1}`, label: `P${i + 1}`, start: '', end: '', isBreak: false };
                      return (
                        <div key={`manual-period-${i}`} className="grid gap-2 sm:grid-cols-[70px_1fr_1fr]">
                          <div className="flex items-center rounded-md border border-line bg-panel/40 px-2 text-xs text-soft">{`P${i + 1}`}</div>
                          <input
                            className="soft-input"
                            type="time"
                            value={row.start ?? ''}
                            onChange={(e) =>
                              setManualPeriods((prev) => {
                                const next = [...prev];
                                next[i] = { ...row, id: `p${i + 1}`, label: `P${i + 1}`, start: e.target.value, isBreak: false };
                                return next;
                              })
                            }
                          />
                          <input
                            className="soft-input"
                            type="time"
                            value={row.end ?? ''}
                            onChange={(e) =>
                              setManualPeriods((prev) => {
                                const next = [...prev];
                                next[i] = { ...row, id: `p${i + 1}`, label: `P${i + 1}`, end: e.target.value, isBreak: false };
                                return next;
                              })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-line bg-panel2/50 p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-soft">Breaks (optional, editable later)</p>
                <button
                  className="rounded-md border border-line px-2 py-1 text-xs"
                  onClick={() =>
                    setBreaks((prev) => [
                      ...prev,
                      { id: createId('break'), name: 'Break', type: 'break', startTime: '12:00', endTime: '12:30' }
                    ])
                  }
                >
                  Add break
                </button>
              </div>
              <div className="space-y-2">
                {breaks.map((item) => (
                  <div key={item.id} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                    <input
                      className="soft-input"
                      value={item.name}
                      onChange={(e) => setBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      className="soft-input"
                      type="time"
                      value={item.startTime}
                      onChange={(e) => setBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, startTime: e.target.value } : x)))}
                    />
                    <input
                      className="soft-input"
                      type="time"
                      value={item.endTime}
                      onChange={(e) => setBreaks((prev) => prev.map((x) => (x.id === item.id ? { ...x, endTime: e.target.value } : x)))}
                    />
                    <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => setBreaks((prev) => prev.filter((x) => x.id !== item.id))}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-line px-3 py-1.5 text-xs" onClick={() => setConfigOpen(false)}>
                Close
              </button>
              <button className="rounded-md border border-glow/60 bg-glow/10 px-3 py-1.5 text-xs" onClick={applyConfiguration}>
                Apply configuration
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function DragGhost({
  value,
  data,
  width,
  height,
  cursor
}: {
  value: SlotValue;
  data: TimetableData;
  width: number | null;
  height: number | null;
  cursor: { x: number; y: number } | null;
}) {
  if (!cursor) return null;
  return (
    <div
      className="pointer-events-none fixed z-[120] rounded-lg border border-glow/60 bg-panel2/95 p-2 shadow-glow"
      style={{
        left: cursor.x - (width ?? 120) / 2,
        top: cursor.y - (height ?? 80) / 2,
        width: width ?? undefined,
        minHeight: height ?? undefined
      }}
    >
      <LessonContent data={data} value={value} />
    </div>
  );
}

const Row = memo(function Row({
  periodLabel,
  periodTime,
  periodId,
  classes,
  selectedDay,
  slots,
  conflicts,
  selectedKey,
  setSelected,
  showConflictsOnly,
  dragging,
  overKey,
  warnCheck,
  searchCheck,
  cellHeight
}: {
  periodLabel: string;
  periodTime: string;
  periodId: string;
  classes: { id: string; color: string }[];
  selectedDay: string;
  slots: Record<string, SlotValue | null>;
  conflicts: Record<string, string[]>;
  selectedKey: string;
  setSelected: (key: string) => void;
  showConflictsOnly: boolean;
  dragging: boolean;
  overKey: string;
  warnCheck: (targetKey: string) => boolean;
  searchCheck: (value: SlotValue | null) => boolean;
  cellHeight: number;
}) {
  return (
    <>
      <div className="sticky left-0 z-20 border-b border-r border-line bg-panel2/95 p-2 text-xs text-soft">
        <p>{periodLabel}</p>
        <p className="text-[10px] text-soft/70">{periodTime}</p>
      </div>
      {classes.map((klass) => {
        const key = slotKey(selectedDay, periodId, klass.id);
        const value = slots[key] ?? null;
        const conflict = conflicts[key];
        if (showConflictsOnly && !conflict?.length) {
          return <div key={key} className="border-b border-r border-line bg-panel/25" />;
        }
        return (
          <div key={key} className="border-b border-r border-line p-1.5">
            <WholeCell
              cellKey={key}
              value={value}
              conflict={conflict}
              selected={selectedKey === key}
              onSelect={setSelected}
              dragging={dragging}
              warning={overKey === key && warnCheck(key)}
              searchHit={searchCheck(value)}
              classColor={klass.color}
              cellHeight={cellHeight}
            />
          </div>
        );
      })}
    </>
  );
});

function BreakRow({ label, spanCount, breakHeight }: { label: string; spanCount: number; breakHeight: number }) {
  return (
    <>
      <div className="sticky left-0 z-20 border-b border-r border-line bg-panel2/95 p-2 text-xs text-amber-300">{label}</div>
      <div
        className="flex items-center border-b border-r border-line bg-amber-500/10 px-3 text-xs text-amber-200"
        style={{ height: `${breakHeight}px`, gridColumn: `span ${spanCount}` }}
      >
        Break period
      </div>
    </>
  );
}

function WeekDropCell({
  dropId,
  selected,
  dragging,
  minHeight,
  children
}: {
  dropId: string;
  selected: boolean;
  dragging: boolean;
  minHeight: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-line/70 p-1 ${selected ? 'ring-2 ring-glow/60' : ''} ${dragging && isOver ? 'bg-glow/10' : ''}`}
      style={{ minHeight }}
    >
      {children}
    </div>
  );
}

function WeekLessonPill({
  slotId,
  classColor,
  selected,
  onSelect,
  children
}: {
  slotId: string;
  classColor: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const isReadOnly = useAppStore((s) => s.data.ui.readOnly);
  const slotValue = useAppStore((s) => s.data.slots[slotId]);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: slotId,
    disabled: isReadOnly || !slotValue,
    data: slotValue ? { key: slotId, value: slotValue } : undefined
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      className={`w-full rounded border px-1.5 py-1 text-left text-xs transition ${selected ? 'ring-2 ring-glow/60' : ''} ${isDragging ? 'opacity-30' : ''}`}
      style={{
        borderColor: hexToRgba(classColor, 0.55),
        backgroundColor: hexToRgba(classColor, 0.12)
      }}
      {...listeners}
      {...attributes}
    >
      {children}
    </button>
  );
}

function WeekMatrix({
  periodColWidth,
  dayColMinWidth,
  cellMinHeight,
  selectedKey,
  overKey,
  dragging
}: {
  periodColWidth: number;
  dayColMinWidth: number;
  cellMinHeight: number;
  selectedKey: string;
  overKey: string;
  dragging: boolean;
}) {
  const { data, setRuntime } = useAppStore();
  const timelineRows = buildTimelineRows(data.settings.periods, data.settings.breaks);
  const mode = data.ui.viewMode;
  const selected = data.ui.selectedEntityId;

  if (!selected) {
    return <div className="p-4 text-sm text-soft">Select an entity from top bar.</div>;
  }

  const renderCell = (day: string, periodId: string) => {
    if (mode === 'class') {
      const key = slotKey(day, periodId, selected);
      const val = data.slots[key];
      return (
        <WeekDropCell dropId={key} selected={selectedKey === key} dragging={dragging} minHeight={cellMinHeight - 8}>
          {val ? (
            <WeekLessonPill
              slotId={key}
              classColor={data.entities.classes.find((c) => c.id === selected)?.color ?? '#3ec5ff'}
              selected={selectedKey === key}
              onSelect={() => setRuntime({ selectedSlotKey: key })}
            >
              <p className="font-semibold">{getName(data, 'subjects', val.subjectId)}</p>
              <p className="text-soft">{getName(data, 'teachers', val.teacherId)}</p>
              <p className="text-soft/80">{getName(data, 'rooms', val.roomId)}</p>
            </WeekLessonPill>
          ) : (
            <button className="h-full w-full text-left text-xs text-soft/60" onClick={() => setRuntime({ selectedSlotKey: key })}>
              + Add
            </button>
          )}
        </WeekDropCell>
      );
    }

    const list = Object.entries(data.slots)
      .filter(([key, value]) => {
        if (!value) return false;
        const parsed = parseSlotKey(key);
        if (parsed.day !== day || parsed.periodId !== periodId) return false;
        if (mode === 'teacher') return value.teacherId === selected;
        if (mode === 'room') return value.roomId === selected;
        return false;
      })
      .map(([key, value]) => {
        const parsed = parseSlotKey(key);
        return { key, classId: parsed.classId, value: value as SlotValue };
      });

    const dropId = encodeWeekDropTarget({ day, periodId });

    return (
      <WeekDropCell dropId={dropId} selected={overKey === dropId} dragging={dragging} minHeight={cellMinHeight - 8}>
        {list.length === 0 ? <span className="text-xs text-soft/60">—</span> : null}
        <div className="space-y-1 text-xs">
          {list.map((item, idx) => (
            <WeekLessonPill
              key={`${item.classId}-${idx}`}
              slotId={item.key}
              classColor={data.entities.classes.find((c) => c.id === item.classId)?.color ?? '#3ec5ff'}
              selected={selectedKey === item.key}
              onSelect={() => setRuntime({ selectedSlotKey: item.key })}
            >
              <p className="font-semibold">{getName(data, 'classes', item.classId)}</p>
              <p className="text-soft">{getName(data, 'subjects', item.value.subjectId)}</p>
            </WeekLessonPill>
          ))}
        </div>
      </WeekDropCell>
    );
  };

  return (
    <div className="min-w-[680px]">
      <div className="grid" style={{ gridTemplateColumns: `${periodColWidth}px repeat(${data.settings.days.length}, minmax(${dayColMinWidth}px, 1fr))` }}>
        <div className="sticky left-0 top-0 z-40 border-b border-r border-line bg-panel2/90 p-2 text-xs uppercase text-soft backdrop-blur">Period</div>
        {data.settings.days.map((day) => (
          <div key={day} className="sticky top-0 z-30 border-b border-r border-line bg-panel2/90 p-2 text-xs font-semibold backdrop-blur">
            {day}
          </div>
        ))}

        {timelineRows.map((row) =>
          row.kind === 'break' ? (
            <div key={row.id} className="contents">
              <div className="border-b border-r border-line p-2 text-xs text-amber-300">{row.label}</div>
              <div
                className="flex items-center border-b border-r border-line bg-amber-500/10 px-2 text-xs text-amber-200"
                style={{ minHeight: `${Math.round(cellMinHeight * 0.72)}px`, gridColumn: `span ${data.settings.days.length}` }}
              >
                {row.start}-{row.end}
              </div>
            </div>
          ) : (
            <div key={row.id} className="contents">
              <div className="border-b border-r border-line p-2 text-xs text-soft">
                <p>{row.label}</p>
                <p className="text-[10px] text-soft/70">{row.start}-{row.end}</p>
              </div>
              {data.settings.days.map((day) => (
                <div key={`${row.id}-${day}`} className="border-b border-r border-line p-1.5" style={{ minHeight: `${cellMinHeight}px` }}>
                  {renderCell(day, row.id)}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
