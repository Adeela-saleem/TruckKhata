import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { Archivo_400Regular, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Lang, Translate } from '../i18n';
import { needsUrduFont, renderDocument, type PrintDocument, type PrintFonts } from '../print/html';
import type { Company } from '../repo/settings';

async function fontBase64(module: number): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  const asset = await Asset.fromModule(module).downloadAsync();
  return asset.localUri ? new File(asset.localUri).base64() : undefined;
}

/** Fonts are embedded because the print engine cannot read app font files. */
async function loadFonts(doc: PrintDocument, company: Company, lang: Lang): Promise<PrintFonts> {
  const fonts: PrintFonts = {
    latin: await fontBase64(Archivo_400Regular),
    latinBold: await fontBase64(Archivo_700Bold),
  };
  if (needsUrduFont(doc, company, lang)) {
    fonts.urdu = await fontBase64(NotoNastaliqUrdu_400Regular);
    fonts.urduBold = await fontBase64(NotoNastaliqUrdu_700Bold);
  }
  return fonts;
}

const buildHtml = async (doc: PrintDocument, company: Company, lang: Lang, t: Translate) =>
  renderDocument(doc, company, lang, t, await loadFonts(doc, company, lang));

/** The phone's print screen shows the preview before anything is printed (SRS 09 FR-06). */
export async function printDocument(doc: PrintDocument, company: Company, lang: Lang, t: Translate): Promise<void> {
  await Print.printAsync({ html: await buildHtml(doc, company, lang, t) });
}

export async function sharePdf(doc: PrintDocument, company: Company, lang: Lang, t: Translate): Promise<void> {
  const html = await buildHtml(doc, company, lang, t);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: doc.landscape ? 842 : 595, height: doc.landscape ? 595 : 842 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: doc.title });
}
