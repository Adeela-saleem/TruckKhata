import type { Lang, Translate } from '../core/i18n';
import { needsUrduFont, renderDocument, type PrintDocument } from '../core/print/html';
import type { Company } from '../core/repo/settings';

import archivo400 from '@fontsource/archivo/files/archivo-latin-400-normal.woff2?url';
import archivo700 from '@fontsource/archivo/files/archivo-latin-700-normal.woff2?url';
import archivoExt400 from '@fontsource/archivo/files/archivo-latin-ext-400-normal.woff2?url';
import archivoExt700 from '@fontsource/archivo/files/archivo-latin-ext-700-normal.woff2?url';
import nastaliq400 from '@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2?url';
import nastaliq700 from '@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-700-normal.woff2?url';

const fontCache = new Map<string, Promise<string>>();
/** Fonts go into the page as data URLs: the PDF renderer copies the page, and a linked font may not be ready in the copy. */
function dataUrl(url: string): Promise<string> {
  if (!fontCache.has(url)) {
    fontCache.set(url, fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(b);
    })).catch((e) => { fontCache.delete(url); throw e; }));
  }
  return fontCache.get(url)!;
}

const registered = new Set<string>();

async function fontFaces(urdu: boolean): Promise<string> {
  const faces: [string, number, string][] = [
    ['PrintLatin', 400, archivo400], ['PrintLatin', 700, archivo700], ['PrintLatin', 400, archivoExt400], ['PrintLatin', 700, archivoExt700],
  ];
  if (urdu) faces.push(['PrintUrdu', 400, nastaliq400], ['PrintUrdu', 700, nastaliq700]);
  // html2canvas draws text on a canvas of this page, so the faces must exist here as well as in the frame.
  await Promise.all(faces.filter(([, , url]) => !registered.has(url)).map(async ([family, weight, url]) => {
    try {
      const face = new FontFace(family, `url(${url})`, { weight: String(weight) });
      document.fonts.add(await face.load());
      registered.add(url);
    } catch { /* the frame copy still has it */ }
  }));
  const css = await Promise.all(faces.map(async ([family, weight, url]) => {
    try { return `@font-face{font-family:'${family}';font-weight:${weight};src:url(${await dataUrl(url)}) format('woff2');}`; } catch { return ''; }
  }));
  return `<style>${css.join('')}</style>`;
}

export async function documentHtml(doc: PrintDocument, company: Company, lang: Lang, t: Translate): Promise<string> {
  const faces = await fontFaces(needsUrduFont(doc, company, lang));
  return renderDocument(doc, company, lang, t).replace('</head>', `${faces}</head>`);
}

/** Loads every print face in a document; html2canvas draws a copy of the page, so the copy waits too. */
async function fontsReady(d: Document): Promise<void> {
  try {
    await Promise.all(['PrintLatin', 'PrintUrdu'].flatMap((f) => [400, 700].map((w) => d.fonts.load(`${w} 16px '${f}'`, 'Aa اب'))));
    await d.fonts.ready;
  } catch { /* draw anyway */ }
}

/** A4 in millimetres, with the same margins the print layout used. */
const PAGE = { w: 210, h: 297, mx: 12, my: 14 };
const PX_PER_MM = 96 / 25.4;
const SCALE = 2;

const fileName = (doc: PrintDocument) =>
  (doc.fileName ?? [doc.title, doc.subtitle].filter(Boolean).join(' - ')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';

/**
 * Page breaks fall between rows and blocks, never through a line of text: returns the y offsets
 * (in CSS px from the top of the content) where a page may end.
 */
function breakPoints(body: HTMLElement): number[] {
  const top = body.getBoundingClientRect().top;
  const points = new Set<number>();
  body.querySelectorAll('header, section, h2, tr, .pair, .note, footer, table').forEach((el) => {
    const r = el.getBoundingClientRect();
    points.add(Math.round(r.top - top));
    points.add(Math.round(r.bottom - top));
  });
  return [...points].sort((a, b) => a - b);
}

/**
 * Builds the document as a real PDF file and downloads it, with no print dialog. The page is drawn
 * in a hidden frame, captured, cut into A4 pages between rows, and the company watermark is laid
 * over every page.
 */
export async function printDocument(doc: PrintDocument, company: Company, lang: Lang, t: Translate): Promise<void> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const landscape = !!doc.landscape;
  const pageW = landscape ? PAGE.h : PAGE.w;
  const pageH = landscape ? PAGE.w : PAGE.h;
  const contentW = pageW - PAGE.mx * 2;
  const contentH = pageH - PAGE.my * 2;
  const widthPx = Math.round(contentW * PX_PER_MM);
  const pageHeightPx = contentH * PX_PER_MM;

  const html = await documentHtml(doc, company, lang, t);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${widthPx}px;height:${Math.round(pageHeightPx)}px;border:0`;
  document.body.appendChild(frame);
  try {
    const win = frame.contentWindow!;
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve();
      win.document.open();
      win.document.write(html);
      win.document.close();
      if (win.document.readyState === 'complete') resolve();
    });
    const d = win.document;
    await fontsReady(d);

    // The watermark is drawn once, in place and alone, then laid over every page.
    const main = d.querySelector<HTMLElement>('main');
    const wm = d.querySelector<HTMLElement>('.wm');
    let watermark: HTMLCanvasElement | null = null;
    if (wm && main) {
      main.style.visibility = 'hidden';
      d.documentElement.style.background = 'transparent';
      d.body.style.background = 'transparent';
      wm.style.cssText = `position:absolute;left:0;top:0;width:${widthPx}px;height:${Math.round(pageHeightPx)}px;display:flex;align-items:center;justify-content:center`;
      try { watermark = await html2canvas(wm, { scale: SCALE, backgroundColor: null, useCORS: true, logging: false, onclone: fontsReady }); } catch { watermark = null; }
      main.style.visibility = '';
      d.documentElement.style.background = '';
      d.body.style.background = '';
    }
    wm?.remove();

    const body = d.body;
    // A little room under the last line so the footer is never clipped.
    body.style.paddingBottom = '8px';
    frame.style.height = `${Math.ceil(d.documentElement.scrollHeight) + 50}px`;
    const totalPx = Math.ceil(Math.max(body.scrollHeight, body.getBoundingClientRect().height));
    const points = breakPoints(body);
    const content = await html2canvas(body, { scale: SCALE, backgroundColor: '#ffffff', width: widthPx, windowWidth: widthPx, height: totalPx, windowHeight: totalPx, useCORS: true, logging: false, onclone: fontsReady });

    // Cut pages at the last row edge that fits; fall back to a hard cut for a row taller than a page.
    const cuts: number[] = [0];
    while (totalPx - cuts[cuts.length - 1] > pageHeightPx) {
      const start = cuts[cuts.length - 1];
      const limit = start + pageHeightPx;
      const fit = points.filter((p) => p > start + pageHeightPx * 0.3 && p <= limit);
      cuts.push(fit.length ? fit[fit.length - 1] : Math.floor(limit));
    }
    cuts.push(totalPx);

    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    const mmPerPx = contentW / widthPx;
    for (let i = 0; i < cuts.length - 1; i++) {
      if (i > 0) pdf.addPage();
      const y0 = Math.round(cuts[i] * SCALE);
      const h = Math.min(Math.round(cuts[i + 1] * SCALE), content.height) - y0;
      if (h <= 0) continue;
      const slice = document.createElement('canvas');
      slice.width = content.width;
      slice.height = h;
      slice.getContext('2d')!.drawImage(content, 0, y0, content.width, h, 0, 0, content.width, h);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', PAGE.mx, PAGE.my, contentW, (h / SCALE) * mmPerPx, undefined, 'FAST');
      if (watermark) pdf.addImage(watermark, 'PNG', PAGE.mx, PAGE.my, contentW, contentH, 'wm', 'FAST');
      if (cuts.length > 2) {
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text(`${i + 1} / ${cuts.length - 1}`, pageW - PAGE.mx, pageH - PAGE.my / 2, { align: 'right' });
      }
    }
    pdf.save(`${fileName(doc)}.pdf`);
  } finally {
    frame.remove();
  }
}
