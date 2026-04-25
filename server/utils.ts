import QRCode from 'qrcode';

export async function qrBufferFromObject(obj: any) {
  const dataUrl = await QRCode.toDataURL(typeof obj === 'string' ? obj : JSON.stringify(obj));
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}
