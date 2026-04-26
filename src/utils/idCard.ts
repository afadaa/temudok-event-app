import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const defaultTemplate = '/id-card-muswil.png';

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = (e) => reject(e);
  img.src = src;
});

export async function composeIdCard(templateSrc: string | undefined, photoSrc: string, name: string, category: string, qrText: string, photoYOffset = 0, nameYOffset = 0) {
  const template = await loadImage(templateSrc || defaultTemplate);
  const photo = photoSrc ? await loadImage(photoSrc).catch(() => null) : null;
  const qrDataUrl = await QRCode.toDataURL(qrText || name || '');

  const width = template.width;
  const height = template.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Debug toggle: set window.__IDCARD_DEBUG = true in the browser console to enable outlines/logs
  const debug = typeof window !== 'undefined' && Boolean((window as any).__IDCARD_DEBUG);

  // base template
  ctx.drawImage(template, 0, 0, width, height);

  // Tinggi header template kira-kira 18% dari height — foto mulai setelah itu
  const headerH = Math.round(height * 0.18);

  // Sisa area konten (bawah header)
  const contentH = height - headerH;

  // ── 1. FOTO ──────────────────────────────────────────────────────────────
  // Framed portrait photo (3:4) with accent border and white inner pad
  // helper: rounded rectangle drawer
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.max(0, r);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  const photoW = Math.round(width * 0.28);
  const photoH = Math.round(photoW * 4 / 3);
  const photoXc = Math.round((width - photoW) / 2);
  // move photo further down toward the name area
  const photoYc = headerH + Math.round(contentH * 0.08) + photoYOffset;
  const frameRadius = Math.round(photoW * 0.03);

  // outer accent stroke
  ctx.lineWidth = Math.max(2, Math.round(width * 0.005));
  ctx.strokeStyle = '#6b21a8';
  roundRect(ctx, photoXc - 6, photoYc - 6, photoW + 12, photoH + 12, frameRadius + 4);
  ctx.stroke();

  // inner white background
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, photoXc, photoYc, photoW, photoH, frameRadius);
  ctx.fill();

  // draw photo clipped to inner area
  if (photo) {
    const minSide = Math.min(photo.width, photo.height);
    const sx = (photo.width - minSide) / 2;
    const sy = (photo.height - minSide) / 2;
    ctx.save();
    roundRect(ctx, photoXc, photoYc, photoW, photoH, frameRadius);
    ctx.clip();
    ctx.drawImage(photo, sx, sy, minSide, minSide, photoXc, photoYc, photoW, photoH);
    ctx.restore();
  }

  // ── 2. NAMA ──────────────────────────────────────────────────────────────
  const nameFontSize = Math.round(width * 0.06);
  // bring the name lower so its top approaches the QR area
  const nameY        = photoYc + photoH + Math.round(contentH * 0.02) + nameYOffset;
  ctx.fillStyle  = '#0b1220';
  ctx.textAlign  = 'center';
  ctx.font       = `700 ${nameFontSize}px serif`;
  ctx.fillText(name.toUpperCase(), width / 2, nameY);

  // ── 3. DIVIDER ───────────────────────────────────────────────────────────
  const dividerY = nameY + Math.round(contentH * 0.01);
  ctx.strokeStyle = 'rgba(11,18,32,0.18)';
  ctx.lineWidth   = Math.max(1, Math.round(width * 0.002));
  const divW = Math.round(width * 0.30);
  const divStart  = Math.round((width - divW) / 2);
  const divEnd    = divStart + divW;
  ctx.beginPath();
  ctx.moveTo(divStart, dividerY);
  ctx.lineTo(divEnd,   dividerY);
  ctx.stroke();

  // ── 4. KATEGORI ──────────────────────────────────────────────────────────
  const catFontSize = Math.round(width * 0.028);
  const catY        = dividerY + Math.round(contentH * 0.028);
  ctx.fillStyle = '#1f2937';
  ctx.font      = `600 ${catFontSize}px sans-serif`;
  ctx.fillText(category.toUpperCase(), width / 2, catY);

  // ── 5. LABEL "ID REGISTRASI" ─────────────────────────────────────────────
  const idLabelY   = catY + Math.round(contentH * 0.04);
  const idFontSize = Math.round(width * 0.02);
  ctx.fillStyle = '#374151';
  ctx.font      = `700 ${idFontSize}px sans-serif`;
  ctx.fillText('ID REGISTRASI', width / 2, idLabelY);

// ── 6. KOTAK + QR CODE ───────────────────────────────────────────────────
// Ukuran kotak dibatasi agar tidak melewati batas bawah kartu
const maxBoxBottom = height - Math.round(height * 0.04); // 4% margin bawah
const idBoxSize    = Math.round(width * 0.36);
const idBoxX       = Math.round((width - idBoxSize) / 2);
const idBoxY       = idLabelY + Math.round(contentH * 0.016);

// Pastikan kotak tidak melewati batas bawah
const safeBoxSize  = Math.min(idBoxSize, maxBoxBottom - idBoxY);

// Decorative QR frame and drawing
const qrImg      = await loadImage(qrDataUrl);
const qrInset    = Math.max(4, Math.round(safeBoxSize * 0.04));
const qrDrawSize = safeBoxSize - qrInset * 2;

// outer thin rect (subtle)
ctx.save();
ctx.strokeStyle = 'rgba(0,0,0,0.25)';
ctx.lineWidth = Math.max(1, Math.round(width * 0.0018));
ctx.strokeRect(idBoxX, idBoxY, safeBoxSize, safeBoxSize);
ctx.restore();

// dashed inner guide
ctx.save();
ctx.setLineDash([4,3]);
ctx.strokeStyle = 'rgba(0,0,0,0.35)';
ctx.lineWidth = Math.max(1, Math.round(width * 0.002));
ctx.strokeRect(idBoxX + qrInset, idBoxY + qrInset, qrDrawSize, qrDrawSize);
ctx.restore();

// draw QR slightly inset so corners of guide show
ctx.drawImage(qrImg, idBoxX + qrInset + 2, idBoxY + qrInset + 2, qrDrawSize - 4, qrDrawSize - 4);

  return canvas;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename = 'id-card.png') {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadCanvasAsPdf(canvas: HTMLCanvasElement, filename = 'id-card.pdf') {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}