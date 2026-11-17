import { useState } from 'react';
import { Database, Eraser, Loader2 } from 'lucide-react';
import { clearRecords, isEmpty, loadSampleData } from '../core/sample';
import { useApp } from '../app/context';
import { useDialog } from '../app/dialog';
import { Btn } from './bits';

/** Loads the sample khata, asking first when real records would be replaced. */
export function useSampleData() {
  const { db, t, changed } = useApp();
  const { confirm, toast, showError } = useDialog();
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      if (!(await isEmpty(db)) && !(await confirm(t('web.sample.replaceTitle'), t('web.sample.replaceMessage'), t('web.sample.load'), 'danger'))) return;
      setBusy(true);
      await clearRecords(db);
      await loadSampleData(db);
      changed();
      toast.success(t('web.sample.loaded'));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    try {
      if (!(await confirm(t('web.sample.clearTitle'), t('web.sample.clearMessage'), t('web.sample.clear'), 'danger'))) return;
      setBusy(true);
      await clearRecords(db);
      changed();
      toast.success(t('web.sample.cleared'));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  return { load, clear, busy };
}

export function SampleButton({ tone = 'plain' }: { tone?: 'plain' | 'primary' }) {
  const { t } = useApp();
  const { load, busy } = useSampleData();
  return (
    <Btn tone={tone} onClick={load} disabled={busy} icon={busy ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}>
      {t('web.sample.load')}
    </Btn>
  );
}

/** Settings card: load the sample khata or empty it again. */
export function SampleCard() {
  const { t } = useApp();
  const { clear, busy } = useSampleData();
  return (
    <section className="card px-6 sm:px-7 py-6">
      <h2 className="font-display text-[16px] text-content">{t('web.sample.title')}</h2>
      <p className="mt-1.5 text-[14px] text-content-muted max-w-2xl leading-relaxed">{t('web.sample.hint')}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <SampleButton />
        <Btn tone="danger" onClick={clear} disabled={busy} icon={<Eraser size={16} />}>{t('web.sample.clear')}</Btn>
      </div>
    </section>
  );
}
