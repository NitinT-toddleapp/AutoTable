import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { ShortcutsGuide } from './ShortcutsGuide';

type Props = {
  layoutControl?: ReactNode;
  onReset: () => void;
};

export function AppFooter({ layoutControl, onReset }: Props) {
  return (
    <footer className="glass flex items-center justify-between gap-2 px-3 py-2 text-xs text-soft">
      <div className="flex items-center gap-2">
        {layoutControl}
        <ShortcutsGuide />
        <button
          className="rounded-md border border-line bg-panel2/50 px-2 py-1 text-xs hover:border-danger/60"
          title="Reset app data and restart setup wizard"
          onClick={onReset}
        >
          <span className="inline-flex items-center gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </span>
        </button>
      </div>
      <span>© {new Date().getFullYear()} AutoTable. All rights reserved.</span>
    </footer>
  );
}
