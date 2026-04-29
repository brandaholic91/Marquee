import { useState } from 'react';

interface SendBackModalProps {
  onCancel: () => void;
  onSubmit: (note: string) => Promise<void> | void;
}

export function SendBackModal({ onCancel, onSubmit }: SendBackModalProps) {
  const [note, setNote] = useState('');

  return (
    <div
      className="fixed inset-0 bg-ink-1/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-off-white rounded-lg p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg mb-3">Mit kell javítani?</h3>
        <textarea
          autoFocus
          className="w-full border border-rule-strong rounded-md p-3 min-h-[120px] font-sans"
          placeholder="Pl. túl rövid, hiányzik a CTA, nem elég a brand voice..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-3 py-2 rounded-md text-ink-2 hover:bg-cream"
            onClick={onCancel}
          >
            Mégsem
          </button>
          <button
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-hover disabled:opacity-50"
            disabled={!note.trim()}
            onClick={() => onSubmit(note)}
          >
            Visszaküld
          </button>
        </div>
      </div>
    </div>
  );
}
