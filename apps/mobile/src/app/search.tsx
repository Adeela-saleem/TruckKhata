import { router } from 'expo-router';
import { useState } from 'react';
import { searchCases } from '../repo/trash';
import { useApp, useData } from '../ui/context';
import { Badge, Button, Card, Empty, SearchBar } from '../ui/controls';
import { ListScreen } from '../ui/screen';
import { T } from '../ui/text';
import { View } from 'react-native';
import { space } from '../ui/theme';

export default function Search() {
  const { t } = useApp();
  const [term, setTerm] = useState('');
  const { data } = useData((db) => searchCases(db, term), [term]);
  return (
    <ListScreen
      title={t('search.title')}
      data={data ?? []}
      keyExtractor={(hit) => hit.caseId}
      renderItem={({ item }) => (
        <Card onPress={() => router.push(`/case/${item.caseId}`)}>
          <T variant="title">{item.caseNo}</T>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {item.hasAda && <Badge tone="info" label={t('search.hasAda')} />}
            {item.hasTrip && <Badge tone="info" label={t('search.hasTrip')} />}
            {!item.hasAda && !item.hasTrip && <Badge tone="info" label={t('search.onlyBills')} />}
          </View>
        </Card>
      )}
      empty={term.trim()
        ? (
          <View>
            <Empty icon="magnify-close" title={t('search.noResults')} hint={t('search.noResultsHint')} />
            <View style={{ gap: space.sm }}>
              <Button tone="quiet" icon="notebook-edit-outline" label={t('add.ada')} onPress={() => router.push({ pathname: '/ada/form', params: { caseNo: term.trim() } })} />
              <Button tone="quiet" icon="truck-fast-outline" label={t('add.trip')} onPress={() => router.push({ pathname: '/trips/form', params: { caseNo: term.trim() } })} />
            </View>
          </View>
        )
        : <Empty icon="magnify" title={t('search.title')} hint={t('search.hint')} />}
    >
      <SearchBar value={term} onChange={setTerm} placeholder={t('home.searchPlaceholder')} />
    </ListScreen>
  );
}
