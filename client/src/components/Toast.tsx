import { useEffect } from 'react';

type Props = {
  message: string;
  onDismiss: () => void;
};

export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 2400);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] rounded-lg border border-line bg-panel2/95 px-3 py-2 text-sm shadow-soft">
      {message}
    </div>
  );
}
