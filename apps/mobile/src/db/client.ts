import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { Db, type Param } from './core';
import { migrate } from './schema';

export async function openDb(): Promise<Db> {
  const sqlite = await SQLite.openDatabaseAsync('truckkhata.db');
  const db = new Db({
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params: Param[]) => {
      await sqlite.runAsync(sql, params);
    },
    all: <T,>(sql: string, params: Param[]) => sqlite.getAllAsync<T>(sql, params),
  });
  if (Platform.OS !== 'web') await db.exec('PRAGMA journal_mode = WAL');
  await migrate(db);
  return db;
}
