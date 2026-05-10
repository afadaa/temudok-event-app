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

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      current = testLine;
      continue;
    }

    if (current) lines.push(current);

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }

    let chunk = '';
    for (const char of word) {
      const testChunk = `${chunk}${char}`;
      if (ctx.measureText(testChunk).width <= maxWidth) {
        chunk = testChunk;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines;
};

const fitTextLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startFontSize: number,
  minFontSize: number
) => {
  const normalized = text.trim().toUpperCase();

  for (let size = startFontSize; size >= minFontSize; size -= 1) {
    ctx.font = `bold ${size}px sans-serif`;
    const lines = wrapText(ctx, normalized, maxWidth);
    if (lines.length <= maxLines) {
      return { fontSize: size, lines };
    }
  }

  ctx.font = `bold ${minFontSize}px sans-serif`;
  const lines = wrapText(ctx, normalized, maxWidth).slice(0, maxLines);
  if (lines.length === maxLines) {
    let lastLine = lines[maxLines - 1];
    while (lastLine.length > 1 && ctx.measureText(`${lastLine}...`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1).trim();
    }
    lines[maxLines - 1] = `${lastLine}...`;
  }

  return { fontSize: minFontSize, lines };
};

const formatParticipantType = (category: string) => {
  const normalized = category.trim().toUpperCase();
  if (!normalized) return '';

  if (normalized.startsWith('UTUSAN')) return 'UTUSAN';
  if (normalized.startsWith('PESERTA')) return 'PESERTA';
  if (normalized.startsWith('TAMU')) return 'TAMU';
  if (normalized.startsWith('PERHATI')) return 'PERHATI';
  if (normalized.startsWith('PANITIA')) return 'PANITIA';

  return normalized.split(/\s+/)[0];
};

export async function composeIdCard(
  templateSrc: string | undefined,
  photoSrc: string,
  name: string,
  category: string,
  qrText: string,
  photoYOffset = 0,
  nameYOffset = 0
) {
  const template = await loadImage(templateSrc || defaultTemplate);
  const photo = photoSrc ? await loadImage(photoSrc).catch(() => null) : null;
  const qrDataUrl = await QRCode.toDataURL(qrText || name || '', { margin: 1 });

  const width  = template.width;
  const height = template.height;
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // ── TEMPLATE ─────────────────────────────────────────────────────────────
  ctx.drawImage(template, 0, 0, width, height);

  // Header tinggi ~22% dari height
  const headerH  = Math.round(height * 0.22);
  const contentH = height - headerH;

  // ── 1. FOTO ──────────────────────────────────────────────────────────────
  // Kotak persegi, centered, dibuat lebih kecil agar nama panjang tetap punya ruang.
  const photoSize = Math.round(width * 0.34);
  const photoX    = Math.round((width - photoSize) / 2);
  const photoY    = headerH + Math.round(contentH * 0.015) + photoYOffset;

  // ── FRAME MOTIF BATIK KALTIM ─────────────────────────────────────────────
  const frameW    = Math.round(photoSize * 0.10); // tebal frame
  const frameX    = photoX - frameW;
  const frameY    = photoY - frameW;
  const frameFull = photoSize + frameW * 2;

  // Warna emas khas Kaltim
  const gold1 = '#8B5E1A';
  const gold2 = '#C9922A';
  const gold3 = '#F0C060';
  const dark  = '#3B1A05';

  // -- Background frame (coklat gelap)
  ctx.fillStyle = dark;
  ctx.fillRect(frameX, frameY, frameFull, frameFull);

  // -- Layer gradasi emas
  const grad = ctx.createLinearGradient(frameX, frameY, frameX + frameFull, frameY + frameFull);
  grad.addColorStop(0,   gold1);
  grad.addColorStop(0.3, gold3);
  grad.addColorStop(0.6, gold2);
  grad.addColorStop(1,   gold1);
  ctx.fillStyle = grad;
  ctx.fillRect(frameX, frameY, frameFull, frameFull);

  // Fungsi helper motif
  const drawDayakDiamond = (cx: number, cy: number, size: number) => {
    ctx.save();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size * 0.6, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size * 0.6, cy);
    ctx.closePath();
    ctx.fill();
    // inner highlight
    ctx.fillStyle = gold3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx + size * 0.28, cy);
    ctx.lineTo(cx, cy + size * 0.5);
    ctx.lineTo(cx - size * 0.28, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawTriangle = (cx: number, cy: number, size: number, up: boolean) => {
    ctx.save();
    ctx.fillStyle = dark;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size, cy + size);
      ctx.lineTo(cx - size, cy + size);
    } else {
      ctx.moveTo(cx, cy + size);
      ctx.lineTo(cx + size, cy - size);
      ctx.lineTo(cx - size, cy - size);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawSpiral = (cx: number, cy: number, r: number) => {
    ctx.save();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, Math.round(r * 0.25));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.4, cy - r * 0.4, r * 0.5, Math.PI, Math.PI * 2.5);
    ctx.stroke();
    ctx.restore();
  };

  // -- Motif pada 4 sisi frame
  const unit = frameW * 0.38;

  // SISI ATAS
  const topY = frameY + frameW / 2;
  const colsH = Math.floor(frameFull / (unit * 2.2));
  for (let i = 0; i <= colsH; i++) {
    const x = frameX + i * (frameFull / colsH);
    drawDayakDiamond(x, topY, unit * 0.8);
    if (i < colsH) {
      drawTriangle(x + frameFull / colsH / 2, topY, unit * 0.35, i % 2 === 0);
    }
  }

  // SISI BAWAH
  const botY = frameY + frameFull - frameW / 2;
  for (let i = 0; i <= colsH; i++) {
    const x = frameX + i * (frameFull / colsH);
    drawDayakDiamond(x, botY, unit * 0.8);
    if (i < colsH) {
      drawTriangle(x + frameFull / colsH / 2, botY, unit * 0.35, i % 2 !== 0);
    }
  }

  // SISI KIRI
  const leftX = frameX + frameW / 2;
  const rowsV = Math.floor(frameFull / (unit * 2.2));
  for (let i = 0; i <= rowsV; i++) {
    const y = frameY + i * (frameFull / rowsV);
    drawDayakDiamond(leftX, y, unit * 0.8);
    if (i < rowsV) {
      drawSpiral(leftX, y + frameFull / rowsV / 2, unit * 0.28);
    }
  }

  // SISI KANAN
  const rightX = frameX + frameFull - frameW / 2;
  for (let i = 0; i <= rowsV; i++) {
    const y = frameY + i * (frameFull / rowsV);
    drawDayakDiamond(rightX, y, unit * 0.8);
    if (i < rowsV) {
      drawSpiral(rightX, y + frameFull / rowsV / 2, unit * 0.28);
    }
  }

  // -- 4 Sudut: ornamen bunga/bintang Dayak
  const drawCornerOrnament = (cx: number, cy: number) => {
    const s = frameW * 0.42;
    ctx.save();
    // Lingkaran luar
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.fill();
    // Inner emas
    ctx.fillStyle = gold3;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Petal pattern (8 kelopak)
    for (let a = 0; a < 8; a++) {
      const angle = (a * Math.PI) / 4;
      const px = cx + Math.cos(angle) * s * 0.82;
      const py = cy + Math.sin(angle) * s * 0.82;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(px, py, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center dot
    ctx.fillStyle = gold1;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawCornerOrnament(frameX + frameW / 2,              frameY + frameW / 2);
  drawCornerOrnament(frameX + frameFull - frameW / 2,  frameY + frameW / 2);
  drawCornerOrnament(frameX + frameW / 2,              frameY + frameFull - frameW / 2);
  drawCornerOrnament(frameX + frameFull - frameW / 2,  frameY + frameFull - frameW / 2);

  // -- Garis border dalam frame (inner stroke)
  ctx.strokeStyle = dark;
  ctx.lineWidth   = Math.max(1, Math.round(frameW * 0.08));
  ctx.strokeRect(frameX, frameY, frameFull, frameFull);
  ctx.strokeStyle = gold3;
  ctx.lineWidth   = Math.max(1, Math.round(frameW * 0.04));
  ctx.strokeRect(photoX - 2, photoY - 2, photoSize + 4, photoSize + 4);

  // ── FOTO (di dalam frame) ─────────────────────────────────────────────────
  // Background putih foto
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX, photoY, photoSize, photoSize);

  // Gambar foto
  if (photo) {
    const minSide = Math.min(photo.width, photo.height);
    const sx = (photo.width  - minSide) / 2;
    const sy = (photo.height - minSide) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoSize, photoSize);
    ctx.clip();
    ctx.drawImage(photo, sx, sy, minSide, minSide, photoX, photoY, photoSize, photoSize);
    ctx.restore();
  }

  // ── 2. NAMA ──────────────────────────────────────────────────────────────
  const qrSize = Math.round(width * 0.20);
  const qrX = Math.round((width - qrSize) / 2);
  const qrY = Math.round(height * 0.765);
  const idLabelY = qrY - Math.round(contentH * 0.030);
  const dividerY = idLabelY - Math.round(contentH * 0.055);
  const catY = dividerY - Math.round(contentH * 0.014);

  const nameFontSize = Math.round(width * 0.046);
  const nameTop      = frameY + frameFull + Math.round(contentH * 0.035) + nameYOffset;
  const nameBlockH   = Math.max(Math.round(contentH * 0.080), catY - nameTop - Math.round(contentH * 0.030));
  const nameMaxWidth = Math.round(width * 0.74);
  const fittedName   = fitTextLines(ctx, name, nameMaxWidth, 3, nameFontSize, Math.round(width * 0.024));
  const nameLineH    = Math.round(fittedName.fontSize * 1.12);
  const nameStartY   = nameTop + Math.round((nameBlockH - (fittedName.lines.length - 1) * nameLineH) / 2);
  ctx.fillStyle  = '#0f172a';
  ctx.textAlign  = 'center';
  ctx.font       = `bold ${fittedName.fontSize}px sans-serif`;
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round((width - nameMaxWidth) / 2), nameTop - fittedName.fontSize, nameMaxWidth, nameBlockH + fittedName.fontSize);
  ctx.clip();
  fittedName.lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, nameStartY + index * nameLineH, nameMaxWidth);
  });
  ctx.restore();

  // ── 3. DIVIDER ───────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0)';
  ctx.lineWidth   = Math.max(1, Math.round(width * 0.0015));
  const divStart  = Math.round(width * 0.15);
  const divEnd    = width - divStart;
  ctx.beginPath();
  ctx.moveTo(divStart, dividerY);
  ctx.lineTo(divEnd, dividerY);
  ctx.stroke();

  // ── 4. KATEGORI ──────────────────────────────────────────────────────────
  const catFontSize = Math.round(width * 0.030);
  ctx.fillStyle = '#1f2937';
  ctx.font      = `${catFontSize}px sans-serif`;
  let fittedCatFontSize = catFontSize;
  const catMaxWidth = Math.round(width * 0.40);
  const participantType = formatParticipantType(category);
  while (fittedCatFontSize > Math.round(width * 0.018) && ctx.measureText(participantType).width > catMaxWidth) {
    fittedCatFontSize -= 1;
    ctx.font = `${fittedCatFontSize}px sans-serif`;
  }
  ctx.fillText(participantType, width / 2, catY);

  // ── 5. LABEL "ID REGISTRASI" ─────────────────────────────────────────────
  const idFontSize = Math.round(width * 0.022);
  ctx.fillStyle = '#374151';
  ctx.font      = `bold ${idFontSize}px sans-serif`;

  // ── 6. QR CODE (tanpa background, ukuran 50%) ────────────────────────────
  const qrImg      = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

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
