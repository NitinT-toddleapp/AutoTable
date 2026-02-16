import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, LayoutGrid, MoveHorizontal, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';

export type PanelId = 'library' | 'canvas' | 'inspector';

type Props = {
  order: PanelId[];
  panelWidths: Record<PanelId, number>;
  onMove: (panel: PanelId, direction: 'left' | 'right') => void;
  onWidthChange: (panel: PanelId, width: number) => void;
  onReset: () => void;
};

const labels: Record<PanelId, string> = {
  library: 'Library',
  canvas: 'Timetable',
  inspector: 'Inspector'
};

const presets: Array<{ id: string; name: string; order: PanelId[]; widths: Record<PanelId, number> }> = [
  {
    id: 'balanced',
    name: 'Balanced',
    order: ['library', 'canvas', 'inspector'],
    widths: { library: 320, canvas: 620, inspector: 320 }
  },
  {
    id: 'focus-timetable',
    name: 'Focus Timetable',
    order: ['library', 'canvas', 'inspector'],
    widths: { library: 260, canvas: 820, inspector: 260 }
  },
  {
    id: 'focus-inspector',
    name: 'Focus Inspector',
    order: ['library', 'inspector', 'canvas'],
    widths: { library: 260, canvas: 760, inspector: 460 }
  }
];

function clampWidth(value: number): number {
  return Math.max(220, Math.min(1200, value));
}

export function LayoutControls({ order, panelWidths, onMove, onWidthChange, onReset }: Props) {
  const [selectedPanel, setSelectedPanel] = useState<PanelId>('canvas');
  const totalPreviewWidth = useMemo(() => order.reduce((sum, panel) => sum + panelWidths[panel], 0), [order, panelWidths]);

  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    const workingOrder = [...order];

    // Reorder current layout to target preset using the existing move actions.
    for (let targetIndex = 0; targetIndex < preset.order.length; targetIndex += 1) {
      const panel = preset.order[targetIndex];
      let currentIndex = workingOrder.indexOf(panel);
      while (currentIndex > targetIndex) {
        onMove(panel, 'left');
        [workingOrder[currentIndex - 1], workingOrder[currentIndex]] = [workingOrder[currentIndex], workingOrder[currentIndex - 1]];
        currentIndex -= 1;
      }
      while (currentIndex < targetIndex) {
        onMove(panel, 'right');
        [workingOrder[currentIndex], workingOrder[currentIndex + 1]] = [workingOrder[currentIndex + 1], workingOrder[currentIndex]];
        currentIndex += 1;
      }
    }

    for (const panel of preset.order) {
      onWidthChange(panel, preset.widths[panel]);
    }
    setSelectedPanel(preset.order[1] ?? 'canvas');
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="rounded-md border border-line bg-panel2/50 px-2 py-1 text-xs hover:border-glow/40">
          <span className="inline-flex items-center gap-1">
            <LayoutGrid className="h-3.5 w-3.5" /> Layout
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl2 border border-line bg-panel p-4 shadow-soft">
          <Dialog.Title className="text-sm font-semibold">Layout Controls</Dialog.Title>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                className="rounded-md border border-line bg-panel2/50 p-2 text-left text-xs hover:border-glow/40"
                onClick={() => applyPreset(preset.id)}
              >
                <p className="font-medium text-text">{preset.name}</p>
                <div className="mt-2 flex h-4 overflow-hidden rounded border border-line/80">
                  {preset.order.map((panel) => (
                    <span
                      key={`${preset.id}-${panel}`}
                      className="flex items-center justify-center text-[9px] text-soft"
                      style={{
                        width: `${(preset.widths[panel] / (preset.widths.library + preset.widths.canvas + preset.widths.inspector)) * 100}%`
                      }}
                    >
                      {labels[panel].slice(0, 1)}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-line bg-panel2/50 p-2">
            <p className="mb-2 text-xs text-soft">Live layout preview (click panel to resize)</p>
            <div className="flex h-14 overflow-hidden rounded-md border border-line/80">
              {order.map((panel) => (
                <button
                  key={`preview-${panel}`}
                  className={`flex h-full items-center justify-center border-r border-line/80 text-[11px] last:border-r-0 ${
                    selectedPanel === panel ? 'bg-glow/15 text-text' : 'bg-panel2/30 text-soft'
                  }`}
                  style={{ width: `${(panelWidths[panel] / totalPreviewWidth) * 100}%` }}
                  onClick={() => setSelectedPanel(panel)}
                  title={`Select ${labels[panel]}`}
                >
                  {labels[panel]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {order.map((panel) => (
              <div key={panel} className="flex items-center justify-between rounded-md border border-line bg-panel2/50 p-2">
                <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => onMove(panel, 'left')} title="Move left">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  className={`mx-2 rounded-md px-2 py-1 text-xs ${selectedPanel === panel ? 'bg-glow/15 text-text' : 'text-soft'}`}
                  onClick={() => setSelectedPanel(panel)}
                >
                  {labels[panel]}
                </button>
                <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => onMove(panel, 'right')} title="Move right">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1">
            <label className="block text-xs text-soft">
              {labels[selectedPanel]} width: {panelWidths[selectedPanel]}px
            </label>
            <input
              className="w-full"
              type="range"
              min={220}
              max={1200}
              value={panelWidths[selectedPanel]}
              onChange={(e) => onWidthChange(selectedPanel, clampWidth(Number(e.target.value)))}
            />
          </div>

          <div className="mt-4 flex justify-between">
            <span className="inline-flex items-center gap-1 text-xs text-soft">
              <MoveHorizontal className="h-3.5 w-3.5" /> Drag dividers on desktop too
            </span>
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={onReset}>
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
