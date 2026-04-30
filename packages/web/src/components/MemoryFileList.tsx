import { SidebarPanelItem } from './SidebarPanel.js';

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
    <div>
      {FILES.map(({ file, label }) => {
        const exists = fileFlags[file];
        return (
          <SidebarPanelItem
            key={file}
            isActive={selected === file}
            onClick={() => onSelect(file)}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${exists ? 'bg-success-deep' : 'bg-rule-strong'}`}
                aria-label={exists ? 'létezik' : 'nem létezik'}
              />
              <span className="text-sm">{label}</span>
            </div>
          </SidebarPanelItem>
        );
      })}
    </div>
  );
}
