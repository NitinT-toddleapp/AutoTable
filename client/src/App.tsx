import { useEffect, useMemo, useRef, useState } from 'react';
import { conflictMap, parseSlotKey, slotKey, storageKey } from './utils';
import { useAppStore } from './store';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CommandPalette } from './components/CommandPalette';
import { Toast } from './components/Toast';
import { LayoutControls, type PanelId } from './components/LayoutControls';
import { PanelShell } from './components/PanelShell';
import { AppFooter } from './components/AppFooter';
import { ExportWizard } from './components/ExportWizard';

type LayoutState = {
  order: PanelId[];
  panelWidths: Record<PanelId, number>;
};

const layoutStorageKey = 'timetable:layout:v1';
const minPanelWidth = 220;
const maxPanelWidth = 1200;
const panelTitles: Record<PanelId, string> = {
  library: 'Library',
  canvas: 'Timetable',
  inspector: 'Inspector'
};

function defaultLayout(): LayoutState {
  return {
    order: ['library', 'canvas', 'inspector'],
    panelWidths: {
      library: 320,
      canvas: 360,
      inspector: 340
    }
  };
}

function clampPanelWidth(value: number): number {
  return Math.max(minPanelWidth, Math.min(maxPanelWidth, value));
}

function resizePanelPair(startLeft: number, startRight: number, dx: number): [number, number] {
  let left = startLeft + dx;
  let right = startRight - dx;

  if (left < minPanelWidth) {
    const diff = minPanelWidth - left;
    left = minPanelWidth;
    right -= diff;
  }
  if (right < minPanelWidth) {
    const diff = minPanelWidth - right;
    right = minPanelWidth;
    left -= diff;
  }
  if (left > maxPanelWidth) {
    const diff = left - maxPanelWidth;
    left = maxPanelWidth;
    right += diff;
  }
  if (right > maxPanelWidth) {
    const diff = right - maxPanelWidth;
    right = maxPanelWidth;
    left += diff;
  }

  return [clampPanelWidth(left), clampPanelWidth(right)];
}

function App() {
  const { data, runtime, setRuntime, resetAll, importData, copySelectedSlot, pasteSelectedSlot, deleteSelectedSlot, undoSlots, redoSlots } =
    useAppStore();
  const autosaveTimer = useRef<number | null>(null);
  const [layout, setLayout] = useState<LayoutState>(() => {
    try {
      const raw = localStorage.getItem(layoutStorageKey);
      if (!raw) return defaultLayout();
      const parsed = JSON.parse(raw) as Partial<LayoutState>;
      if (!Array.isArray(parsed.order) || parsed.order.length !== 3) return defaultLayout();
      const order = parsed.order as PanelId[];
      const fallback = defaultLayout();
      if (parsed.panelWidths) {
        return {
          order,
          panelWidths: {
            library: clampPanelWidth(parsed.panelWidths.library ?? fallback.panelWidths.library),
            canvas: clampPanelWidth(parsed.panelWidths.canvas ?? fallback.panelWidths.canvas),
            inspector: clampPanelWidth(parsed.panelWidths.inspector ?? fallback.panelWidths.inspector)
          }
        };
      }
      // Backward-compatible hydrate from old left/right width shape.
      const leftId = order[0];
      const rightId = order[2];
      const migrated = { ...fallback.panelWidths };
      const old = parsed as Partial<{ leftWidth: number; rightWidth: number }>;
      if (typeof old.leftWidth === 'number') migrated[leftId] = clampPanelWidth(old.leftWidth);
      if (typeof old.rightWidth === 'number') migrated[rightId] = clampPanelWidth(old.rightWidth);
      return {
        order,
        panelWidths: migrated
      };
    } catch {
      return defaultLayout();
    }
  });
  const [isWide, setIsWide] = useState<boolean>(() => window.matchMedia('(min-width: 1280px)').matches);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeDivider, setActiveDivider] = useState<0 | 1 | null>(null);
  const [draggingPanel, setDraggingPanel] = useState<PanelId | null>(null);
  const [dropTargetPanel, setDropTargetPanel] = useState<PanelId | null>(null);
  const resizeStartRef = useRef<{
    x: number;
    leftPanel: PanelId;
    rightPanel: PanelId;
    leftWidth: number;
    rightWidth: number;
  } | null>(null);

  const conflicts = useMemo(() => conflictMap(data), [data]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (isTypingTarget) return;

      const isMod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isMod && key === 'k') {
        event.preventDefault();
        setRuntime({ commandOpen: !useAppStore.getState().runtime.commandOpen });
        return;
      }

      if (isMod && key === 'c') {
        event.preventDefault();
        if (useAppStore.getState().data.ui.readOnly) {
          setRuntime({ toast: 'Read-only mode is enabled.' });
          return;
        }
        copySelectedSlot();
        return;
      }

      if (isMod && key === 'v') {
        event.preventDefault();
        if (useAppStore.getState().data.ui.readOnly) {
          setRuntime({ toast: 'Read-only mode is enabled.' });
          return;
        }
        pasteSelectedSlot();
        return;
      }

      if (isMod && (key === 'delete' || key === 'backspace')) {
        event.preventDefault();
        if (useAppStore.getState().data.ui.readOnly) {
          setRuntime({ toast: 'Read-only mode is enabled.' });
          return;
        }
        deleteSelectedSlot();
        return;
      }

      if (isMod && key === 'z' && event.shiftKey) {
        event.preventDefault();
        redoSlots();
        return;
      }

      if (isMod && key === 'z') {
        event.preventDefault();
        undoSlots();
        return;
      }

      if (event.ctrlKey && key === 'y') {
        event.preventDefault();
        redoSlots();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copySelectedSlot, deleteSelectedSlot, pasteSelectedSlot, redoSlots, setRuntime, undoSlots]);

  useEffect(() => {
    const onQuota = () => setRuntime({ toast: 'Storage full. Export your timetable.' });
    window.addEventListener('timetable:quota-error', onQuota);
    return () => window.removeEventListener('timetable:quota-error', onQuota);
  }, [setRuntime]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-light');
    html.classList.add(data.ui.themePreference === 'dark' ? 'theme-dark' : 'theme-light');
  }, [data.ui.themePreference]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const onChange = (event: MediaQueryListEvent) => setIsWide(event.matches);
    setIsWide(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (activeDivider === null) return;
    const onMove = (event: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const [leftWidth, rightWidth] = resizePanelPair(start.leftWidth, start.rightWidth, dx);
      setLayout((prev) => {
        return {
          ...prev,
          panelWidths: {
            ...prev.panelWidths,
            [start.leftPanel]: leftWidth,
            [start.rightPanel]: rightWidth
          }
        };
      });
    };
    const onUp = () => {
      setActiveDivider(null);
      resizeStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeDivider]);

  useEffect(() => {
    setRuntime({ autosaveStatus: 'Saving...' });
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      setRuntime({ autosaveStatus: 'Saved' });
    }, 500);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [data, setRuntime]);

  const selectedSlot = data.slots[runtime.selectedSlotKey] ?? null;

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const ok = importData(parsed);
      if (ok) setRuntime({ toast: 'Imported successfully.' });
    } catch {
      setRuntime({ toast: 'Import failed. Invalid JSON.' });
    }
  };

  const resetApp = () => {
    localStorage.removeItem(storageKey);
    resetAll();
    setRuntime({ toast: 'Reset complete.' });
  };

  const activeClassId =
    runtime.selectedSlotKey && parseSlotKey(runtime.selectedSlotKey).classId
      ? parseSlotKey(runtime.selectedSlotKey).classId
      : data.ui.viewMode === 'class'
        ? data.ui.selectedEntityId || data.entities.classes[0]?.id || ''
        : data.entities.classes[0]?.id ?? '';

  const defaultSelectKey =
    runtime.selectedSlotKey ||
    slotKey(
      data.ui.selectedDay,
      data.settings.periods.find((p) => !p.isBreak)?.id ?? data.settings.periods[0]?.id ?? 'p1',
      (data.ui.viewMode === 'class' ? data.ui.selectedEntityId : data.entities.classes[0]?.id) ?? 'class'
    );

  const movePanel = (panel: PanelId, direction: 'left' | 'right') => {
    setLayout((prev) => {
      const idx = prev.order.indexOf(panel);
      if (idx < 0) return prev;
      const nextIndex = direction === 'left' ? idx - 1 : idx + 1;
      if (nextIndex < 0 || nextIndex >= prev.order.length) return prev;
      const order = [...prev.order];
      [order[idx], order[nextIndex]] = [order[nextIndex], order[idx]];
      return { ...prev, order };
    });
  };

  const swapPanels = (source: PanelId, target: PanelId) => {
    if (source === target) return;
    setLayout((prev) => {
      const a = prev.order.indexOf(source);
      const b = prev.order.indexOf(target);
      if (a < 0 || b < 0) return prev;
      const next = [...prev.order];
      [next[a], next[b]] = [next[b], next[a]];
      return { ...prev, order: next };
    });
  };

  const panelMap: Record<PanelId, JSX.Element> = {
    library: <Sidebar />,
    canvas: (
      <div className="h-full min-h-0 min-w-0 overflow-hidden">
        <Canvas conflicts={conflicts} fallbackSelectKey={defaultSelectKey} />
      </div>
    ),
    inspector: (
      <Inspector slotKey={runtime.selectedSlotKey || defaultSelectKey} slotValue={selectedSlot} activeClassId={activeClassId} />
    )
  };

  const orderedPanels = layout.order.map((id) => panelMap[id]);
  const buildLayoutControl = () => (
    <LayoutControls
      order={layout.order}
      panelWidths={layout.panelWidths}
      onMove={movePanel}
      onWidthChange={(panel, width) =>
        setLayout((prev) => ({
          ...prev,
          panelWidths: {
            ...prev.panelWidths,
            [panel]: width
          }
        }))
      }
      onReset={() => setLayout(defaultLayout())}
    />
  );

  return (
    <main className="h-full overflow-hidden p-3 md:p-4">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3">
        <TopBar
          onExport={() => setExportOpen(true)}
          onImport={importJson}
          conflictsCount={Object.keys(conflicts).length}
        />
        {isWide ? (
          <div
            className="grid min-h-0 gap-0 overflow-hidden"
            style={{
              gridTemplateColumns: `${layout.panelWidths[layout.order[0]]}px 8px minmax(0,1fr) 8px ${layout.panelWidths[layout.order[2]]}px`
            }}
          >
            <div className="min-h-0 p-1.5">
              <PanelShell
                panelId={layout.order[0]}
                title={panelTitles[layout.order[0]]}
                isWide={isWide}
                content={orderedPanels[0]}
                draggingPanel={draggingPanel}
                dropTargetPanel={dropTargetPanel}
                setDraggingPanel={setDraggingPanel}
                setDropTargetPanel={setDropTargetPanel}
                onSwapPanels={swapPanels}
              />
            </div>
            <button
              className="cursor-col-resize rounded-md border border-line/60 bg-panel2/30 text-xs font-semibold text-soft hover:bg-glow/10"
              onMouseDown={(e) => {
                e.preventDefault();
                const leftPanel = layout.order[0];
                const rightPanel = layout.order[1];
                resizeStartRef.current = {
                  x: e.clientX,
                  leftPanel,
                  rightPanel,
                  leftWidth: layout.panelWidths[leftPanel],
                  rightWidth: layout.panelWidths[rightPanel]
                };
                setActiveDivider(0);
              }}
              title="Resize left panel"
            >
              ::
            </button>
            <div className="min-h-0 min-w-0 p-1.5">
              <PanelShell
                panelId={layout.order[1]}
                title={panelTitles[layout.order[1]]}
                isWide={isWide}
                content={orderedPanels[1]}
                draggingPanel={draggingPanel}
                dropTargetPanel={dropTargetPanel}
                setDraggingPanel={setDraggingPanel}
                setDropTargetPanel={setDropTargetPanel}
                onSwapPanels={swapPanels}
              />
            </div>
            <button
              className="cursor-col-resize rounded-md border border-line/60 bg-panel2/30 text-xs font-semibold text-soft hover:bg-glow/10"
              onMouseDown={(e) => {
                e.preventDefault();
                const leftPanel = layout.order[1];
                const rightPanel = layout.order[2];
                resizeStartRef.current = {
                  x: e.clientX,
                  leftPanel,
                  rightPanel,
                  leftWidth: layout.panelWidths[leftPanel],
                  rightWidth: layout.panelWidths[rightPanel]
                };
                setActiveDivider(1);
              }}
              title="Resize right panel"
            >
              ::
            </button>
            <div className="min-h-0 p-1.5">
              <PanelShell
                panelId={layout.order[2]}
                title={panelTitles[layout.order[2]]}
                isWide={isWide}
                content={orderedPanels[2]}
                draggingPanel={draggingPanel}
                dropTargetPanel={dropTargetPanel}
                setDraggingPanel={setDraggingPanel}
                setDropTargetPanel={setDropTargetPanel}
                onSwapPanels={swapPanels}
              />
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 grid-cols-1 gap-3 overflow-hidden">
            {orderedPanels.map((panel, idx) => (
              <div key={idx} className="min-h-0">
                {panel}
              </div>
            ))}
          </div>
        )}
        <AppFooter layoutControl={buildLayoutControl()} onReset={resetApp} />
      </div>
      <CommandPalette />
      <ExportWizard
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={data}
        conflictsCount={Object.keys(conflicts).length}
      />
      <Toast message={runtime.toast} onDismiss={() => setRuntime({ toast: '' })} />
    </main>
  );
}

export default App;
