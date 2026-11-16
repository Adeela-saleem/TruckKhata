import type { Lang, Translate } from '../core/i18n';
import { renderDocument, type PrintDocument } from '../core/print/html';
import type { Company } from '../core/repo/settings';

/** The print engine reads web fonts, so they are linked rather than embedded. */
const fontLinks = (family: string) => `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet" />
<style>body{font-family:${family}}</style>`;

export function documentHtml(doc: PrintDocument, company: Company, lang: Lang, t: Translate): string {
  const family = lang === 'ur' ? `'Noto Nastaliq Urdu', 'Archivo', Arial, sans-serif` : `'Archivo', 'Noto Nastaliq Urdu', Arial, sans-serif`;
  return renderDocument(doc, company, lang, t).replace('</head>', `${fontLinks(family)}</head>`);
}

/**
 * Prints through a hidden frame. The browser's print dialog shows the preview and offers
 * "Save as PDF", which is how every document in the app becomes a PDF (SRS 09 FR-06).
 */
export function printDocument(doc: PrintDocument, company: Company, lang: Lang, t: Translate): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    // Off screen but full size: some browsers print a zero-size or hidden frame as a blank page.
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0';
    document.body.appendChild(frame);
    const win = frame.contentWindow!;
    const title = document.title;
    win.document.open();
    win.document.write(documentHtml(doc, company, lang, t));
    win.document.close();
    const go = async () => {
      try { await win.document.fonts.ready; } catch { /* print anyway */ }
      // The PDF's suggested file name comes from the page title.
      document.title = doc.title;
      win.focus();
      win.print();
      document.title = title;
      setTimeout(() => frame.remove(), 1000);
      resolve();
    };
    if (win.document.readyState === 'complete') void go();
    else frame.onload = () => void go();
  });
}
