import midtransClient from 'midtrans-client';
import dotenv from 'dotenv';

dotenv.config();

let snapInstance: any = null;

export function getSnap() {
  if (!snapInstance) {
    if (!process.env.MIDTRANS_SERVER_KEY) {
      throw new Error('MIDTRANS_SERVER_KEY is missing');
    }
    snapInstance = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    });
  }
  return snapInstance;
}
