import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const peninjauTemplate = '/Peninjau.png';

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = (e) => reject(e);
  img.src = src;
});

const fitSingleLine = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startFontSize: number,
  minFontSize: number
) => {
  let fontSize = startFontSize;
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (fontSize > minFontSize && ctx.measureText(text).width > maxWidth) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  return fontSize;
};

export async function composePeninjauIdCard(photoSrc: string, name: string, qrText: string) {
  const template = await loadImage(peninjauTemplate);
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

  const nameText = name.trim().toUpperCase();
  const nameMaxWidth = Math.round(width * 0.62);
  const nameFontSize = fitSingleLine(ctx, nameText, nameMaxWidth, Math.round(width * 0.038) - 3, Math.round(width * 0.022));
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  ctx.fillText(nameText, width / 2, Math.round(height * 0.650), nameMaxWidth);

  const qrX = Math.round(width * 0.104);
  const qrY = Math.round(height * 0.780);
  const qrSize = Math.round(width * 0.225);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  return canvas;
}

export function downloadPeninjauCanvasAsPng(canvas: HTMLCanvasElement, filename = 'id-card-peninjau.png') {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadPeninjauCanvasAsPdf(canvas: HTMLCanvasElement, filename = 'id-card-peninjau.pdf') {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
