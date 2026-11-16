import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { AppError, newId } from '../db/core';

const attachmentsDir = () => new Directory(Paths.document, 'attachments');

function ensureDir() {
  const dir = attachmentsDir();
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export type Picked = { uri: string; name: string; mimeType?: string; file?: Blob; size?: number };

export async function pickFile(types: string[]): Promise<Picked | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0] as Picked;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Attachments live in app storage under a generated name, so paths survive reinstalling. */
export async function storeAttachment(picked: Picked): Promise<string> {
  const extension = picked.name.includes('.') ? picked.name.slice(picked.name.lastIndexOf('.')) : '';
  const name = `${newId()}${extension}`;
  if (Platform.OS === 'web') return name;
  new File(picked.uri).copy(new File(ensureDir(), name));
  return name;
}

export async function shareAttachment(name: string): Promise<void> {
  const file = new File(attachmentsDir(), name);
  if (!file.exists) throw new AppError('errors.notFound');
  await Sharing.shareAsync(file.uri);
}

export async function pickLogoDataUri(): Promise<string | null> {
  const picked = await pickFile(['image/png', 'image/jpeg']);
  if (!picked) return null;
  if (picked.size && picked.size > 1024 * 1024) throw new AppError('errors.fileTooLarge');
  if (Platform.OS === 'web') {
    return picked.uri.startsWith('data:') ? picked.uri : blobToDataUri(await (await fetch(picked.uri)).blob());
  }
  const type = picked.mimeType ?? 'image/png';
  return `data:${type};base64,${await new File(picked.uri).base64()}`;
}

export async function readAttachmentsBase64(names: string[]): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  if (Platform.OS === 'web') return output;
  for (const name of names) {
    const file = new File(attachmentsDir(), name);
    if (file.exists) output[name] = await file.base64();
  }
  return output;
}

export async function writeAttachmentsBase64(files: Record<string, string>): Promise<void> {
  if (Platform.OS === 'web') return;
  const dir = ensureDir();
  for (const [name, data] of Object.entries(files)) {
    // Names come from a backup file, so keep them inside the attachments folder.
    if (!/^[\w.-]+$/.test(name)) continue;
    const file = new File(dir, name);
    if (!file.exists) file.create();
    file.write(data, { encoding: 'base64' });
  }
}

export async function shareTextFile(name: string, content: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType });
}

export async function readPickedText(picked: Picked): Promise<string> {
  if (Platform.OS === 'web') return (await fetch(picked.uri)).text();
  return new File(picked.uri).text();
}
