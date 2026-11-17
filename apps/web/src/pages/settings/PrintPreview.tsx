import { useApp } from '../../app/context';

/**
 * A small sheet of paper showing the top of a printed page: company name, contact line,
 * the rule under it, and the logo (or name) as the faint watermark. Paper is white in
 * both themes because the printout is, so it uses the print colours from core/print/html.ts.
 */
export function PrintPreview({ name, phone, address, logo }: { name: string; phone: string; address: string; logo: string | null }) {
  const { t } = useApp();
  const company = name.trim() || t('app.name');
  const contact = [phone.trim(), address.trim()].filter(Boolean).join('  |  ');
  const ink = '#15192B';
  const soft = '#4B5165';
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="relative mx-auto aspect-[210/150] w-full max-w-[420px] overflow-hidden rounded-md shadow-sm" style={{ background: '#FFFFFF', color: ink }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          {logo
            ? <img src={logo} alt="" className="max-w-[55%] max-h-[55%] object-contain" style={{ opacity: 0.08 }} />
            : <span className="text-[28px] font-semibold text-center leading-snug -rotate-[28deg] px-6" style={{ opacity: 0.07 }}>{company}</span>}
        </div>
        <div className="relative px-5 pt-4">
          <div className="pb-2" style={{ borderBottom: `2px solid #121412` }}>
            <p className="text-[14px] font-semibold leading-tight break-words" style={{ color: '#121412' }}>{company}</p>
            {contact && <p className="text-[11px] mt-0.5 break-words" style={{ color: soft }}>{contact}</p>}
            <p className="mt-2 text-[12px] font-semibold">{t('web.settings.sampleTitle')}</p>
            <p className="text-[11px]" style={{ color: soft }}>{t('web.settings.samplePeriod')}</p>
          </div>
          <div className="mt-3 flex flex-col gap-1.5" aria-hidden>
            <span className="h-3 rounded-sm" style={{ background: '#F0FCCB' }} />
            {[0, 1, 2, 3].map((i) => <span key={i} className="h-2 rounded-sm" style={{ background: '#E6E8EE', width: `${92 - i * 9}%` }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
