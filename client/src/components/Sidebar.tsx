import * as Tabs from '@radix-ui/react-tabs';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type { EntityKind } from '../types';

const kinds: { key: EntityKind; label: string }[] = [
  { key: 'classes', label: 'Classes' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'rooms', label: 'Rooms' }
];

export function Sidebar() {
  const { data, addEntity, updateEntity, deleteEntity, setTeacherSubjects } = useAppStore();
  const teacherSubjectMap = data.teacherSubjectMap ?? {};
  const [kind, setKind] = useState<EntityKind>('classes');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [teacherDefaults, setTeacherDefaults] = useState<string[]>([]);

  const list = useMemo(() => {
    const items = data.entities[kind];
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [data.entities, kind, query]);

  return (
    <aside className="glass min-h-0 p-3">
      <Tabs.Root value={kind} onValueChange={(value) => setKind(value as EntityKind)}>
        <Tabs.List className="grid grid-cols-2 gap-1">
          {kinds.map((item) => (
            <Tabs.Trigger
              key={item.key}
              value={item.key}
              className="rounded-md border border-line bg-panel2/50 px-1.5 py-1 text-xs text-center leading-tight data-[state=active]:border-glow/60 data-[state=active]:bg-glow/10"
            >
              {item.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      <input
        className="soft-input mt-3 w-full"
        placeholder={`Search ${kind}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-2 flex gap-2">
        <input
          className="soft-input w-full"
          placeholder={`Add ${kind.slice(0, -1)}`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          className="rounded-lg border border-line bg-panel2/50 px-2 hover:border-glow/40"
          onClick={() => {
            if (!newName.trim()) return;
            addEntity(kind, newName.trim(), kind === 'teachers' ? { defaultSubjectIds: teacherDefaults } : undefined);
            setNewName('');
            if (kind === 'teachers') setTeacherDefaults([]);
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {kind === 'teachers' && (
        <div className="mt-2 rounded-md border border-line bg-panel2/40 p-2">
          <p className="mb-1 text-[11px] text-soft">Default subjects for new teacher</p>
          <div className="flex flex-wrap gap-1">
            {data.entities.subjects.map((subject) => {
              const active = teacherDefaults.includes(subject.id);
              return (
                <button
                  key={subject.id}
                  className={`rounded-md border px-2 py-1 text-[11px] ${active ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel/60'}`}
                  onClick={() =>
                    setTeacherDefaults((prev) =>
                      prev.includes(subject.id) ? prev.filter((x) => x !== subject.id) : [...prev, subject.id]
                    )
                  }
                >
                  {subject.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 max-h-[calc(100vh-280px)] space-y-1 overflow-auto pr-1">
        {list.map((item) => (
          <div key={item.id} className="rounded-md border border-line bg-panel2/50 p-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <input
                className="w-full bg-transparent text-sm outline-none"
                value={item.name}
                onChange={(e) => updateEntity(kind, item.id, { name: e.target.value })}
              />
              <button
                className="rounded p-1 text-soft hover:text-danger"
                onClick={() => {
                  if (window.confirm(`Delete ${item.name}?`)) deleteEntity(kind, item.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {kind === 'teachers' && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.entities.subjects.map((subject) => {
                  const selected = (teacherSubjectMap[item.id] ?? []).includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] ${selected ? 'border-glow/60 bg-glow/10' : 'border-line bg-panel/60 text-soft'}`}
                      onClick={() => {
                        const current = teacherSubjectMap[item.id] ?? [];
                        const next = current.includes(subject.id)
                          ? current.filter((x) => x !== subject.id)
                          : [...current, subject.id];
                        setTeacherSubjects(item.id, next);
                      }}
                    >
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
