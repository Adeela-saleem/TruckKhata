import { AppError, newId } from '../core/db/core';
import { idbDelete, idbGet, idbSet } from './idb';

/** Opens the browser's file picker. Resolves null when the person cancels. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function downloadText(name: string, content: string, mimeType: string) {
  downloadBlob(name, new Blob([content], { type: mimeType }));
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileToDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function pickLogoDataUri(): Promise<string | null> {
  const file = await pickFile('image/png,image/jpeg');
  if (!file) return null;
  if (file.size > 1024 * 1024) throw new AppError('errors.fileTooLarge');
  return fileToDataUri(file);
}

/** Attachments are kept in the browser under a generated name; the record stores only the name. */
export async function storeAttachment(file: File): Promise<string> {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const name = `${newId()}${extension}`;
  await idbSet('files', name, file);
  return name;
}

export async function openAttachment(name: string) {
  const blob = await idbGet<Blob>('files', name);
  if (!blob) throw new AppError('errors.notFound');
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

export const removeAttachment = (name: string) => idbDelete('files', name);

export async function readAttachmentsBase64(names: string[]): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  for (const name of names) {
    const blob = await idbGet<Blob>('files', name);
    if (blob) output[name] = (await fileToDataUri(blob)).split(',')[1] ?? '';
  }
  return output;
}

export async function writeAttachmentsBase64(files: Record<string, string>) {
  for (const [name, data] of Object.entries(files)) {
    // Names come from a backup file, so only plain generated names are accepted.
    if (!/^[\w.-]+$/.test(name)) continue;
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    await idbSet('files', name, new Blob([bytes]));
  }
}
