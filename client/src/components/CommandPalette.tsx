import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type { ViewMode } from '../types';

type CmdItem = {
  id: string;
  label: string;
  view: ViewMode;
  entityId: string;
};

export function CommandPalette() {
  const { data, runtime, setRuntime, setUI } = useAppStore();
  const [query, setQuery] = useState('');

  const commands = useMemo<CmdItem[]>(() => {
    const from = <T extends { id: string; name: string }>(arr: T[], view: ViewMode, prefix: string) =>
      arr.map((item) => ({ id: `${prefix}-${item.id}`, label: `${prefix}: ${item.name}`, view, entityId: item.id }));

    return [
      ...from(data.entities.classes, 'class', 'Class'),
      ...from(data.entities.teachers, 'teacher', 'Teacher'),
      ...from(data.entities.rooms, 'room', 'Room'),
      { id: 'whole-view', label: 'View: Whole School', view: 'whole', entityId: '' }
    ];
  }, [data.entities.classes, data.entities.rooms, data.entities.teachers]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((item) => item.label.toLowerCase().includes(q));
  }, [commands, query]);

  return (
    <Dialog.Root open={runtime.commandOpen} onOpenChange={(open) => setRuntime({ commandOpen: open })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[20%] z-50 w-[95vw] max-w-xl -translate-x-1/2 rounded-xl2 border border-line bg-panel p-3 shadow-soft">
          <Dialog.Title className="mb-2 text-sm font-semibold">Command Palette</Dialog.Title>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
            <input
              autoFocus
              className="soft-input w-full !pl-12"
              value={query}
              placeholder="Jump to class, teacher, room..."
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-80 space-y-1 overflow-auto">
            {filtered.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-md border border-line bg-panel2/70 px-2 py-2 text-left text-sm hover:border-glow/50"
                onClick={() => {
                  setUI({ viewMode: item.view, selectedEntityId: item.entityId });
                  setRuntime({ commandOpen: false });
                  setQuery('');
                }}
              >
                {item.label}
              </button>
            ))}
            {!filtered.length && <p className="p-2 text-sm text-soft">No matches</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
