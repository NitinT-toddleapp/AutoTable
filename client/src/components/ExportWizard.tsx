import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import type { SchoolBreak, SlotValue, TimetableData } from '../types';
import { buildTimelineRows, conflictMap, parseSlotKey, slotKey } from '../utils';

type ExportView = 'class' | 'teacher' | 'room' | 'whole';
type ExportFormat = 'xlsx';

type LayoutOptions = {
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter';
  includeBreaks: boolean;
  includeEmptyPeriods: boolean;
  showSubjectTeacher: boolean;
  showRoom: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: TimetableData;
  conflictsCount: number;
};

type SheetRow = string[];
type Sheet = {
  name: string;
  rows: SheetRow[];
};

const defaultLayoutOptions: LayoutOptions = {
  orientation: 'landscape',
  pageSize: 'A4',
  includeBreaks: true,
  includeEmptyPeriods: true,
  showSubjectTeacher: true,
  showRoom: true
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;');
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*\[\]:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Sheet';
}

function uniqueSheetNames(sheets: Sheet[]): Sheet[] {
  const used = new Set<string>();
  return sheets.map((sheet) => {
    const base = safeSheetName(sheet.name);
    let next = base;
    let idx = 2;
    while (used.has(next)) {
      const suffix = ` ${idx}`;
      next = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      idx += 1;
    }
    used.add(next);
    return { ...sheet, name: next };
  });
}

function colName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function worksheetXml(rows: SheetRow[]): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          if (!cell) return '';
          const ref = `${colName(colIndex)}${rowIndex + 1}`;
          const style = rowIndex === 3 ? ' s="1"' : '';
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function workbookXml(sheets: Sheet[]): string {
  const sheetNodes = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 2}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNodes}</sheets>
</workbook>`;
}

function workbookRelsXml(sheets: Sheet[]): string {
  const nodes = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  ];
  sheets.forEach((_, index) => {
    nodes.push(
      `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    );
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${nodes.join('')}
</Relationships>`;
}

function contentTypesXml(sheets: Sheet[]): string {
  const overrides = [
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  ];
  sheets.forEach((_, index) => {
    overrides.push(
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides.join('')}
</Types>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF7EF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;
}

function packageRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function zipStore(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = new TextEncoder().encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes
    ]);

    localParts.push(localHeader, data);

    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralDir = concatBytes(centralParts);
  const localData = concatBytes(localParts);
  const eocd = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(localData.length),
    u16(0)
  ]);

  return concatBytes([localData, centralDir, eocd]);
}

function buildXlsxBlob(sheetsInput: Sheet[]): Blob {
  const sheets = uniqueSheetNames(sheetsInput);
  const encoder = new TextEncoder();
  const entries: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml(sheets)) },
    { name: '_rels/.rels', data: encoder.encode(packageRelsXml()) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml(sheets)) },
    { name: 'xl/styles.xml', data: encoder.encode(stylesXml()) }
  ];

  sheets.forEach((sheet, idx) => {
    entries.push({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      data: encoder.encode(worksheetXml(sheet.rows))
    });
  });

  const zipBytes = zipStore(entries);
  const stableBytes = new Uint8Array(Array.from(zipBytes));
  return new Blob([stableBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function textForLesson(value: SlotValue, data: TimetableData, options: LayoutOptions): string {
  const subject = data.entities.subjects.find((s) => s.id === value.subjectId)?.name ?? 'Subject';
  const teacher = data.entities.teachers.find((t) => t.id === value.teacherId)?.name ?? 'Teacher';
  const room = data.entities.rooms.find((r) => r.id === value.roomId)?.name ?? '';
  const lines: string[] = [];
  if (options.showSubjectTeacher) {
    lines.push(subject);
    lines.push(teacher);
  } else {
    lines.push(subject);
  }
  if (options.showRoom && room) lines.push(room);
  return lines.slice(0, 3).join('\n');
}

function buildEntityGridSheet(
  title: string,
  dayLabels: string[],
  timelineRows: ReturnType<typeof buildTimelineRows>,
  options: LayoutOptions,
  rowBuilder: (day: string, periodId: string) => string
): Sheet {
  const rows: SheetRow[] = [];
  rows.push([title]);
  rows.push([`Layout: ${options.orientation}, ${options.pageSize}`]);
  rows.push([]);
  rows.push(['Period', ...dayLabels]);

  for (const row of timelineRows) {
    if (row.kind === 'break') {
      if (!options.includeBreaks) continue;
      rows.push([`${row.label} ${row.start}-${row.end}`, ...dayLabels.map(() => 'Break')]);
      continue;
    }

    const values = dayLabels.map((day) => rowBuilder(day, row.id));
    if (!options.includeEmptyPeriods && values.every((value) => !value.trim())) {
      continue;
    }
    rows.push([`${row.label} ${row.start}-${row.end}`, ...values.map((value) => value || '')]);
  }

  return { name: title, rows };
}

function buildExportSheets(
  data: TimetableData,
  view: ExportView,
  options: LayoutOptions,
  selectedIds: string[],
  includeWhole: { classes: boolean; teachers: boolean; rooms: boolean }
): Sheet[] {
  const timelineRows = buildTimelineRows(
    data.settings.periods,
    options.includeBreaks ? data.settings.breaks : ([] as SchoolBreak[])
  );
  const days = data.settings.days;
  const sheets: Sheet[] = [];
  const conflicts = conflictMap(data);

  const addSummary = () => {
    const totalSlots = Object.values(data.slots).filter(Boolean).length;
    sheets.push({
      name: 'Summary',
      rows: [
        ['AutoTable Export Summary'],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Classes: ${data.entities.classes.length}`],
        [`Teachers: ${data.entities.teachers.length}`],
        [`Rooms: ${data.entities.rooms.length}`],
        [`Filled slots: ${totalSlots}`],
        [`Conflicts: ${Object.keys(conflicts).length}`]
      ]
    });
  };

  const classSheet = (klassId: string) => {
    const klass = data.entities.classes.find((c) => c.id === klassId);
    if (!klass) return;
    sheets.push(
      buildEntityGridSheet(`Class - ${klass.name}`, days, timelineRows, options, (day, periodId) => {
        const value = data.slots[slotKey(day, periodId, klassId)];
        if (!value) return '';
        return textForLesson(value, data, options);
      })
    );
  };

  const teacherSheet = (teacherId: string) => {
    const teacher = data.entities.teachers.find((t) => t.id === teacherId);
    if (!teacher) return;
    sheets.push(
      buildEntityGridSheet(`Teacher - ${teacher.name}`, days, timelineRows, options, (day, periodId) => {
        const hits = Object.entries(data.slots)
          .filter(([key, value]) => {
            if (!value || value.teacherId !== teacherId) return false;
            const parsed = parseSlotKey(key);
            return parsed.day === day && parsed.periodId === periodId;
          })
          .map(([key, value]) => {
            const parsed = parseSlotKey(key);
            const className = data.entities.classes.find((c) => c.id === parsed.classId)?.name ?? parsed.classId;
            return `${className}\n${textForLesson(value as SlotValue, data, options)}`;
          });
        return hits.join('\n---\n');
      })
    );
  };

  const roomSheet = (roomId: string) => {
    const room = data.entities.rooms.find((r) => r.id === roomId);
    if (!room) return;
    sheets.push(
      buildEntityGridSheet(`Room - ${room.name}`, days, timelineRows, options, (day, periodId) => {
        const hits = Object.entries(data.slots)
          .filter(([key, value]) => {
            if (!value || value.roomId !== roomId) return false;
            const parsed = parseSlotKey(key);
            return parsed.day === day && parsed.periodId === periodId;
          })
          .map(([key, value]) => {
            const parsed = parseSlotKey(key);
            const className = data.entities.classes.find((c) => c.id === parsed.classId)?.name ?? parsed.classId;
            return `${className}\n${textForLesson(value as SlotValue, data, options)}`;
          });
        return hits.join('\n---\n');
      })
    );
  };

  if (view === 'whole') {
    addSummary();
    if (includeWhole.classes) {
      sheets.push({
        name: 'Classes - Index',
        rows: [
          ['Class', 'Filled periods'],
          ...data.entities.classes.map((item) => [
            item.name,
            String(Object.entries(data.slots).filter(([key, value]) => value && key.endsWith(`|${item.id}`)).length)
          ])
        ]
      });
      data.entities.classes.forEach((item) => classSheet(item.id));
    }
    if (includeWhole.teachers) {
      sheets.push({
        name: 'Teachers - Index',
        rows: [
          ['Teacher', 'Assigned periods'],
          ...data.entities.teachers.map((item) => [
            item.name,
            String(Object.values(data.slots).filter((value) => value?.teacherId === item.id).length)
          ])
        ]
      });
      data.entities.teachers.forEach((item) => teacherSheet(item.id));
    }
    if (includeWhole.rooms) {
      sheets.push({
        name: 'Rooms - Index',
        rows: [
          ['Room', 'Assigned periods'],
          ...data.entities.rooms.map((item) => [
            item.name,
            String(Object.values(data.slots).filter((value) => value?.roomId === item.id).length)
          ])
        ]
      });
      data.entities.rooms.forEach((item) => roomSheet(item.id));
    }
    return sheets;
  }

  if (view === 'class') {
    selectedIds.forEach(classSheet);
  } else if (view === 'teacher') {
    selectedIds.forEach(teacherSheet);
  } else if (view === 'room') {
    selectedIds.forEach(roomSheet);
  }
  return sheets;
}

export function ExportWizard({ open, onOpenChange, data, conflictsCount }: Props) {
  const [step, setStep] = useState(1);
  const [view, setView] = useState<ExportView>('class');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [layout, setLayout] = useState<LayoutOptions>(defaultLayoutOptions);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [includeWhole, setIncludeWhole] = useState({ classes: true, teachers: true, rooms: true });

  const entityList = useMemo(() => {
    if (view === 'class') return data.entities.classes;
    if (view === 'teacher') return data.entities.teachers;
    if (view === 'room') return data.entities.rooms;
    return [];
  }, [data.entities.classes, data.entities.rooms, data.entities.teachers, view]);

  const selectedIds = view === 'class' ? selectedClassIds : view === 'teacher' ? selectedTeacherIds : selectedRoomIds;
  const setSelectedIds = (ids: string[]) => {
    if (view === 'class') setSelectedClassIds(ids);
    if (view === 'teacher') setSelectedTeacherIds(ids);
    if (view === 'room') setSelectedRoomIds(ids);
  };

  const canExport = view === 'whole' ? includeWhole.classes || includeWhole.teachers || includeWhole.rooms : selectedIds.length > 0;

  const onDownload = () => {
    if (conflictsCount > 0) {
      const proceed = window.confirm(`There are ${conflictsCount} conflicts. Continue export anyway?`);
      if (!proceed) return;
    }
    const sheets = buildExportSheets(data, view, layout, selectedIds, includeWhole);
    const blob = buildXlsxBlob(sheets);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `autotable-${view}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(href);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl2 border border-line bg-panel p-4 shadow-soft">
          <Dialog.Title className="text-base font-semibold">Export Timetable</Dialog.Title>
          <p className="mt-1 text-xs text-soft">Step {step} of 4</p>

          {step === 1 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(['class', 'teacher', 'room', 'whole'] as ExportView[]).map((item) => (
                <button
                  key={item}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${view === item ? 'border-glow/70 bg-glow/10' : 'border-line bg-panel2/40'}`}
                  onClick={() => setView(item)}
                >
                  {item === 'whole' ? 'Whole school bundle' : `${item[0].toUpperCase()}${item.slice(1)} timetable`}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 space-y-2">
              {view !== 'whole' ? (
                <>
                  <div className="flex gap-2">
                    <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => setSelectedIds(entityList.map((x) => x.id))}>
                      Select all
                    </button>
                    <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => setSelectedIds([])}>
                      Clear
                    </button>
                  </div>
                  <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                    {entityList.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 rounded-md border border-line bg-panel2/30 px-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) =>
                            setSelectedIds(
                              e.target.checked ? [...selectedIds, item.id] : selectedIds.filter((id) => id !== item.id)
                            )
                          }
                        />
                        {item.name}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 rounded-md border border-line bg-panel2/30 px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={includeWhole.classes}
                      onChange={(e) => setIncludeWhole((prev) => ({ ...prev, classes: e.target.checked }))}
                    />
                    Include classes
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-line bg-panel2/30 px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={includeWhole.teachers}
                      onChange={(e) => setIncludeWhole((prev) => ({ ...prev, teachers: e.target.checked }))}
                    />
                    Include teachers
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-line bg-panel2/30 px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={includeWhole.rooms}
                      onChange={(e) => setIncludeWhole((prev) => ({ ...prev, rooms: e.target.checked }))}
                    />
                    Include rooms
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="mt-4 space-y-2">
              <button
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${format === 'xlsx' ? 'border-glow/70 bg-glow/10' : 'border-line bg-panel2/40'}`}
                onClick={() => setFormat('xlsx')}
              >
                Excel workbook (.xlsx)
              </button>
              <p className="text-xs text-soft">Real multi-sheet .xlsx export compatible with Excel/Numbers/Sheets.</p>
            </div>
          )}

          {step === 4 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-soft">
                Orientation
                <select className="soft-input mt-1 w-full" value={layout.orientation} onChange={(e) => setLayout((prev) => ({ ...prev, orientation: e.target.value as LayoutOptions['orientation'] }))}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>

              <label className="text-xs text-soft">
                Page size
                <select className="soft-input mt-1 w-full" value={layout.pageSize} onChange={(e) => setLayout((prev) => ({ ...prev, pageSize: e.target.value as LayoutOptions['pageSize'] }))}>
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={layout.includeBreaks} onChange={(e) => setLayout((prev) => ({ ...prev, includeBreaks: e.target.checked }))} />
                Include breaks
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={layout.includeEmptyPeriods} onChange={(e) => setLayout((prev) => ({ ...prev, includeEmptyPeriods: e.target.checked }))} />
                Include empty periods
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={layout.showSubjectTeacher} onChange={(e) => setLayout((prev) => ({ ...prev, showSubjectTeacher: e.target.checked }))} />
                Show subject + teacher
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={layout.showRoom} onChange={(e) => setLayout((prev) => ({ ...prev, showRoom: e.target.checked }))} />
                Show room
              </label>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-2">
              <button className="rounded-md border border-line px-3 py-1.5 text-xs" onClick={() => setStep((prev) => Math.max(1, prev - 1))} disabled={step === 1}>
                Back
              </button>
              <button className="rounded-md border border-line px-3 py-1.5 text-xs" onClick={() => setStep((prev) => Math.min(4, prev + 1))} disabled={step === 4}>
                Next
              </button>
            </div>
            <button
              className="rounded-md border border-glow/70 bg-glow/10 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onDownload}
              disabled={step !== 4 || !canExport}
            >
              Download
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
