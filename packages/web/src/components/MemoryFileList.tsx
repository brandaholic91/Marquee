const FILES = [
  { file: 'profile.md',              label: 'Ügyfélprofil' },
  { file: 'brand_voice.md',          label: 'Brand voice' },
  { file: 'ongoing_campaigns.md',    label: 'Aktív kampányok' },
  { file: 'email_list_segments.md',  label: 'Email szegmensek' },
  { file: 'seo_keyword_bank.md',     label: 'SEO kulcsszó-bank' },
  { file: 'brand_voice_guidelines.md', label: 'Brand voice guidelines' },
];

export function MemoryFileList({
  fileFlags, selected, onSelect,
}: {
  fileFlags: Record<string, boolean>;
  selected: string;
  onSelect: (file: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {FILES.map(({ file, label }) => {
        const exists = fileFlags[file];
        const isActive = selected === file;
        return (
          <li key={file}>
            <button
              onClick={() => onSelect(file)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md ${
                isActive ? 'bg-primary-soft text-primary-hover' : 'hover:bg-cream text-ink-1'
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${exists ? 'bg-success-deep' : 'bg-ink-3'}`}
                aria-label={exists ? 'létezik' : 'nem létezik'}
              />
              <span className="font-medium">{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
