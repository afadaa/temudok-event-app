import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const utusanTemplate = '/Utusan.png';

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
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
};

const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startFontSize: number,
  minFontSize: number
) => {
  const normalized = text.trim().toUpperCase();

  for (let fontSize = startFontSize; fontSize >= minFontSize; fontSize -= 1) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    const lines = wrapText(ctx, normalized, maxWidth);
    if (lines.length <= maxLines) {
      return { fontSize, lines };
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

export async function composeUtusanIdCard(
  photoSrc: string,
  name: string,
  qrText: string
) {
  const template = await loadImage(utusanTemplate);
  const photo = photoSrc ? await loadImage(photoSrc).catch(() => null) : null;
  const qrDataUrl = await QRCode.toDataURL(qrText || name || '', { margin: 1 });
  const qrImg = await loadImage(qrDataUrl);

  const width = template.width;
  const height = template.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(template, 0, 0, width, height);

  // Photo frame in Utusan.png template.
  const photoX = Math.round(width * 0.312);
  const photoY = Math.round(height * 0.240);
  const photoW = Math.round(width * 0.376);
  const photoH = Math.round(height * 0.345);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX, photoY, photoW, photoH);

  if (photo) {
    const sourceRatio = photo.width / photo.height;
    const targetRatio = photoW / photoH;
    let sx = 0;
    let sy = 0;
    let sw = photo.width;
    let sh = photo.height;

    if (sourceRatio > targetRatio) {
      sw = photo.height * targetRatio;
      sx = (photo.width - sw) / 2;
    } else {
      sh = photo.width / targetRatio;
      sy = (photo.height - sh) / 2;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    ctx.drawImage(photo, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
    ctx.restore();
  }

  // Name sits inside the pink band above the built-in UTUSAN label.
  const nameMaxWidth = Math.round(width * 0.62);
  const nameBoxTop = Math.round(height * 0.620);
  const nameBoxHeight = Math.round(height * 0.062);
  const nameText = name.trim().toUpperCase();
  let nameFontSize = Math.round(width * 0.038) - 3;
  const minNameFontSize = Math.round(width * 0.022);
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  while (nameFontSize > minNameFontSize && ctx.measureText(nameText).width > nameMaxWidth) {
    nameFontSize -= 1;
    ctx.font = `bold ${nameFontSize}px sans-serif`;
  }
  const baseline = nameBoxTop + Math.round(nameBoxHeight * 0.58);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  ctx.fillText(nameText, width / 2, baseline, nameMaxWidth);

  // QR code is intentionally left-aligned to the white QR box in Utusan.png.
  const qrX = Math.round(width * 0.104);
  const qrY = Math.round(height * 0.780);
  const qrSize = Math.round(width * 0.225);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  return canvas;
}

export function downloadUtusanCanvasAsPng(canvas: HTMLCanvasElement, filename = 'id-card-utusan.png') {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadUtusanCanvasAsPdf(canvas: HTMLCanvasElement, filename = 'id-card-utusan.pdf') {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
