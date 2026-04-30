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
    <ul>
      {FILES.map(({ file, label }) => {
        const exists = fileFlags[file];
        const isActive = selected === file;
        return (
          <li key={file}>
            <button
              onClick={() => onSelect(file)}
              className={`w-full text-left flex items-center gap-2 px-4 py-2.5 border-l-2 transition-colors text-sm ${
                isActive
                  ? 'border-primary bg-cream text-ink-1 font-medium'
                  : 'border-transparent text-ink-2 hover:bg-cream hover:text-ink-1'
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${exists ? 'bg-success-deep' : 'bg-rule-strong'}`}
                aria-label={exists ? 'létezik' : 'nem létezik'}
              />
              <span>{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
