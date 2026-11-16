import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { partiesDocument } from '../../print/documents';
import { listParties } from '../../repo/parties';
import { useApp, useData } from '../../ui/context';
import { Chips, Empty, Fab, SearchBar } from '../../ui/controls';
import { Avatar, ChipRow, MetaChip, MoneyStrip, PayProgress, RowCard } from '../../ui/rows';
import { ListScreen } from '../../ui/screen';
import { usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { space } from '../../ui/theme';

export default function PartyList() {
  const { t } = useApp();
  const print = usePrint();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const { data } = useData((db) => listParties(db, { search, archived: view === 'archived' }), [search, view]);
  const rows = data ?? [];
  return (
    <ListScreen
      title={t('modules.parties')}
      actions={[{ icon: 'printer-outline', label: t('actions.print'), onPress: () => print(() => partiesDocument(rows, t)) }]}
      data={rows}
      keyExtractor={(p) => p.id}
      renderItem={({ item: p }) => (
        <RowCard
          onPress={() => router.push(`/parties/${p.id}`)}
          footer={<>
            <PayProgress due={p.freight} received={p.received} />
            <MoneyStrip items={[
              { label: t('fields.freight'), value: p.freight },
              { label: t('fields.received'), value: p.received, tone: 'good' },
              { label: t('fields.balance'), value: p.outstanding, tone: p.outstanding > 0 ? 'bad' : undefined },
            ]} />
          </>}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar name={p.name} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="heading" numberOfLines={1}>{p.name}</T>
              <ChipRow>
                <MetaChip icon="phone-outline" label={p.phone ?? t('party.noPhone')} />
                <MetaChip icon="briefcase-outline" label={`${t('party.casesCount')}: ${p.caseCount}`} />
              </ChipRow>
            </View>
          </View>
        </RowCard>
      )}
      empty={search || view === 'archived'
        ? <Empty icon="magnify-close" title={t('empty.noMatch')} hint={t('empty.noMatchHint')} />
        : <Empty icon="account-group-outline" title={t('empty.parties')} hint={t('empty.partiesHint')} />}
      overlay={<Fab label={t('actions.add')} onPress={() => router.push('/parties/form')} />}
    >
      <SearchBar value={search} onChange={setSearch} placeholder={t('actions.search')} />
      <Chips value={view} onChange={setView} options={[{ value: 'active', label: t('modules.parties') }, { value: 'archived', label: t('party.archived') }]} />
    </ListScreen>
  );
}
