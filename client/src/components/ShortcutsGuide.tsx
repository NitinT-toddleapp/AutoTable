import * as Dialog from '@radix-ui/react-dialog';
import { Keyboard } from 'lucide-react';

const shortcuts: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl/Cmd + K', description: 'Open command palette' },
  { keys: 'Ctrl/Cmd + C', description: 'Copy selected lesson cell' },
  { keys: 'Ctrl/Cmd + V', description: 'Paste copied lesson into selected cell' },
  { keys: 'Ctrl/Cmd + Delete', description: 'Clear selected lesson cell' },
  { keys: 'Ctrl/Cmd + Z', description: 'Undo timetable change' },
  { keys: 'Ctrl/Cmd + Shift + Z / Ctrl + Y', description: 'Redo timetable change' },
  { keys: 'Arrow Left/Right', description: 'Switch theme slider state while focused' }
];

export function ShortcutsGuide() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="rounded-md border border-line bg-panel2/50 px-2 py-1 text-xs hover:border-glow/40">
          <span className="inline-flex items-center gap-1">
            <Keyboard className="h-3.5 w-3.5" /> Shortcuts
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl2 border border-line bg-panel p-4 shadow-soft">
          <Dialog.Title className="text-sm font-semibold">Keyboard Shortcuts</Dialog.Title>
          <p className="mt-1 text-xs text-soft">Use these shortcuts to build timetable faster.</p>

          <div className="mt-3 overflow-hidden rounded-md border border-line">
            {shortcuts.map((item) => (
              <div
                key={item.keys}
                className="grid grid-cols-[minmax(230px,auto)_1fr] gap-x-4 border-b border-line/80 bg-panel2/40 px-3 py-2 text-xs last:border-b-0"
              >
                <span className="font-medium text-text">{item.keys}</span>
                <span className="text-soft">{item.description}</span>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
