import jsPDF from 'jspdf';

const panitiaTemplate = '/Panitia.png';

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

export async function composePanitiaIdCard(name: string) {
  const template = await loadImage(panitiaTemplate);

  const width = template.width;
  const height = template.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(template, 0, 0, width, height);

  const nameText = name.trim().toUpperCase();
  const nameMaxWidth = Math.round(width * 0.68);
  const nameFontSize = fitSingleLine(ctx, nameText, nameMaxWidth, Math.round(width * 0.038) - 3, Math.round(width * 0.022));

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  ctx.fillText(nameText, width / 2, Math.round(height * 0.748), nameMaxWidth);

  return canvas;
}

export function downloadPanitiaCanvasAsPng(canvas: HTMLCanvasElement, filename = 'id-card-panitia.png') {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadPanitiaCanvasAsPdf(canvas: HTMLCanvasElement, filename = 'id-card-panitia.pdf') {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
