/* =====================================================================
   📝 RESUME → PDF and Word.  9 Nov 2026 (0205).

   Both files are REAL TEXT, one column, top to bottom — the same blocks()
   the screen draws — so hiring software reads every word. No pictures of
   text, no tables, no text boxes.

   ⚠️ Runs in the browser only (called from a click). pdf-lib is loaded
   with a dynamic import so it never weighs down any other page.
   ⚠️ The Word file is a hand-built .docx (a zip with no compression) so
   there is no second library. Word, Google Docs and Pages all open it.
   ===================================================================== */
import { blocks } from './resume-data';

const LETTER = [612, 792];

const THEMES = {
  classic: { serif: true,  name: [0.07, 0.09, 0.15], title: [0.23, 0.26, 0.32], head: [0.07, 0.09, 0.15], rule: [0.07, 0.09, 0.15], center: true },
  modern:  { serif: false, name: [0.04, 0.07, 0.40], title: [0.07, 0.16, 0.69], head: [0.07, 0.16, 0.69], rule: [0.07, 0.16, 0.69] },
  bold:    { serif: false, name: [1, 1, 1], title: [0.62, 1, 0.69], head: [0.04, 0.07, 0.40], rule: [0, 0.78, 0.29], band: [0.04, 0.07, 0.40] },
};

/* Standard PDF fonts only know WinAnsi. Swap or drop anything else so a
   stray emoji can never break the download. */
function clean(s) {
  return String(s || '')
    .replace(/[‐-‒]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[^\x20-\x7E¡-ÿ–—‘’“”•…€·]/g, '')
    .trim();
}

export async function makePdf(r) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const t = THEMES[r.look] || THEMES.modern;
  const doc = await PDFDocument.create();
  doc.setTitle(`${clean(r.name) || 'Resume'} - Resume`);
  doc.setCreator('Sober Book');
  const F = t.serif
    ? { reg: await doc.embedFont(StandardFonts.TimesRoman), bold: await doc.embedFont(StandardFonts.TimesRomanBold), it: await doc.embedFont(StandardFonts.TimesRomanItalic) }
    : { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold), it: await doc.embedFont(StandardFonts.HelveticaOblique) };
  const C = (a) => rgb(a[0], a[1], a[2]);
  const ink = rgb(0.11, 0.13, 0.19), soft = rgb(0.29, 0.32, 0.39);
  const M = 54, W = LETTER[0] - M * 2;
  let page = doc.addPage(LETTER);
  let y = LETTER[1] - M;

  const ensure = (h) => { if (y - h < M) { page = doc.addPage(LETTER); y = LETTER[1] - M; } };
  const wrap = (text, font, size, width) => {
    const words = clean(text).split(/\s+/).filter(Boolean); const lines = []; let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(next, size) <= width || !cur) cur = next; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const line = (text, font, size, color, x = M, width = W, align = 'left', gap = 1.32) => {
    for (const l of wrap(text, font, size, width)) {
      ensure(size * gap);
      const w = font.widthOfTextAtSize(l, size);
      const xx = align === 'center' ? x + (width - w) / 2 : align === 'right' ? x + width - w : x;
      page.drawText(l, { x: xx, y: y - size, size, font, color });
      y -= size * gap;
    }
  };

  const B = blocks(r);
  const head = B.filter((b) => b.k === 'name' || b.k === 'title' || b.k === 'contact');
  const rest = B.filter((b) => !head.includes(b));

  // ---- header ----
  if (t.band) {
    const bandH = 112;
    page.drawRectangle({ x: 0, y: LETTER[1] - bandH, width: LETTER[0], height: bandH, color: C(t.band) });
    y = LETTER[1] - 34;
  }
  for (const b of head) {
    const al = t.center ? 'center' : 'left';
    if (b.k === 'name') line(b.t, F.bold, 24, C(t.name), M, W, al, 1.2);
    if (b.k === 'title') { y -= 2; line(b.t, F.bold, 12, C(t.title), M, W, al); }
    if (b.k === 'contact') { y -= 4; line(b.items.join('   |   '), F.reg, 9.5, t.band ? rgb(0.79, 0.82, 1) : soft, M, W, al); }
  }
  y = t.band ? LETTER[1] - 112 - 22 : y - 8;

  // ---- body ----
  for (const b of rest) {
    if (b.k === 'h') {
      ensure(30); y -= 10;
      page.drawText(clean(b.t).toUpperCase(), { x: M, y: y - 10, size: 10, font: F.bold, color: C(t.head) });
      y -= 15;
      page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: t.band ? 2 : 1, color: C(t.rule) });
      y -= 8;
    } else if (b.k === 'p') {
      line(b.t, F.reg, 10.5, ink); y -= 2;
    } else if (b.k === 'skills') {
      line(b.items.join('  ·  '), F.reg, 10.5, ink); y -= 2;
    } else if (b.k === 'job') {
      ensure(30); y -= 3;
      const dw = F.reg.widthOfTextAtSize(clean(b.dates), 9.5);
      const titleLines = wrap(b.title, F.bold, 11, W - dw - 12);
      titleLines.forEach((l, i) => {
        ensure(15);
        page.drawText(l, { x: M, y: y - 11, size: 11, font: F.bold, color: ink });
        if (i === 0 && b.dates) page.drawText(clean(b.dates), { x: M + W - dw, y: y - 11, size: 9.5, font: F.reg, color: soft });
        y -= 14.5;
      });
      if (b.sub) line(b.sub, F.it, 10, soft);
      if (b.note) line(b.note, F.reg, 10.5, ink);
      for (const bl of b.bullets) {
        const ls = wrap(bl, F.reg, 10.5, W - 14);
        ls.forEach((l, i) => {
          ensure(14);
          if (i === 0) page.drawText('•', { x: M + 2, y: y - 10.5, size: 10.5, font: F.reg, color: ink });
          page.drawText(l, { x: M + 14, y: y - 10.5, size: 10.5, font: F.reg, color: ink });
          y -= 13.9;
        });
      }
      y -= 5;
    }
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

/* ---------------- Word (.docx) ---------------- */
const X = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (a) => a.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

export function makeDocx(r) {
  const t = THEMES[r.look] || THEMES.modern;
  const font = t.serif ? 'Times New Roman' : 'Calibri';
  const run = (text, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}<w:color w:val="${o.c || '1C2130'}"/><w:sz w:val="${o.sz || 21}"/></w:rPr><w:t xml:space="preserve">${X(text)}</w:t></w:r>`;
  const para = (inner, o = {}) => `<w:p><w:pPr>${o.tabs ? '<w:tabs><w:tab w:val="right" w:pos="10080"/></w:tabs>' : ''}${o.border ? `<w:pBdr><w:bottom w:val="single" w:sz="${o.border}" w:space="2" w:color="${o.bc}"/></w:pBdr>` : ''}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 40}"/>${o.ind ? '<w:ind w:left="360" w:hanging="220"/>' : ''}${o.center ? '<w:jc w:val="center"/>' : ''}${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : ''}</w:pPr>${inner}</w:p>`;
  const body = [];
  const B = blocks(r);
  const band = t.band ? hex(t.band) : null;
  for (const b of B) {
    if (b.k === 'name') body.push(para(run(b.t, { b: true, sz: 48, c: hex(t.name) }), { center: t.center, shade: band, after: 0 }));
    else if (b.k === 'title') body.push(para(run(b.t, { b: true, sz: 24, c: hex(t.title) }), { center: t.center, shade: band, after: 0 }));
    else if (b.k === 'contact') body.push(para(run(b.items.join('   |   '), { sz: 19, c: band ? 'C9D2FF' : '4B5263' }), { center: t.center, shade: band, after: 160 }));
    else if (b.k === 'h') body.push(para(run(b.t.toUpperCase(), { b: true, sz: 20, c: hex(t.head) }), { border: band ? 16 : 8, bc: hex(t.rule), before: 220, after: 100 }));
    else if (b.k === 'p') body.push(para(run(b.t)));
    else if (b.k === 'skills') body.push(para(run(b.items.join('  ·  '))));
    else if (b.k === 'job') {
      body.push(para(run(b.title, { b: true, sz: 22 }) + (b.dates ? '<w:r><w:tab/></w:r>' + run(b.dates, { sz: 19, c: '4B5263' }) : ''), { tabs: true, before: 100, after: 0 }));
      if (b.sub) body.push(para(run(b.sub, { i: true, sz: 20, c: '3B4252' }), { after: 20 }));
      if (b.note) body.push(para(run(b.note)));
      for (const bl of b.bullets) body.push(para(run('•  ' + bl), { ind: true, after: 20 }));
    }
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', document],
  ];
  return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* A zip with no compression ("stored"). Enough for a .docx. */
let CRC;
function crc32(buf) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true);
    c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
    c.setUint32(38, 0, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const csize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
}

/* Hand the file to the person: the phone's share sheet when it can take
   files (iPhone app), otherwise a normal download. */
export async function deliver(blob, filename) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
