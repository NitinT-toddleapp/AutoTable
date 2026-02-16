import type { ReactNode } from 'react';
import type { PanelId } from './LayoutControls';

type Props = {
  panelId: PanelId;
  title: string;
  isWide: boolean;
  content: ReactNode;
  draggingPanel: PanelId | null;
  dropTargetPanel: PanelId | null;
  setDraggingPanel: (panel: PanelId | null) => void;
  setDropTargetPanel: (panel: PanelId | null) => void;
  onSwapPanels: (source: PanelId, target: PanelId) => void;
};

export function PanelShell({
  panelId,
  title,
  isWide,
  content,
  draggingPanel,
  dropTargetPanel,
  setDraggingPanel,
  setDropTargetPanel,
  onSwapPanels
}: Props) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (draggingPanel && draggingPanel !== panelId) setDropTargetPanel(panelId);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (draggingPanel) onSwapPanels(draggingPanel, panelId);
        setDraggingPanel(null);
        setDropTargetPanel(null);
      }}
      onDragEnd={() => {
        setDraggingPanel(null);
        setDropTargetPanel(null);
      }}
      className={`flex h-full min-h-0 flex-col rounded-xl2 ${dropTargetPanel === panelId ? 'ring-2 ring-glow/60 ring-offset-1 ring-offset-ink' : ''}`}
    >
      {isWide && (
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', panelId);
            setDraggingPanel(panelId);
            setDropTargetPanel(null);
          }}
          className="mb-1 flex cursor-grab items-center justify-between rounded-md border border-line/70 bg-panel2/45 px-2 py-1 text-xs font-medium text-text/95 active:cursor-grabbing"
          title="Drag this panel to swap position"
        >
          <span>{title}</span>
          <span>::</span>
        </div>
      )}
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
}
