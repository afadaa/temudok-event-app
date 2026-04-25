import midtransClient from 'midtrans-client';
import crypto from 'crypto';
import { config } from './config';

let snapInstance: any = null;
export function getSnap() {
  if (!snapInstance) {
    if (!config.MIDTRANS_SERVER_KEY) {
      // Leave as null; callers should handle dummy mode
      return null;
    }
    snapInstance = new midtransClient.Snap({
      isProduction: config.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: config.MIDTRANS_SERVER_KEY as string,
      clientKey: config.MIDTRANS_CLIENT_KEY || '',
    });
  }
  return snapInstance;
}

// Example verification: Midtrans may send signature_key in payload, otherwise compute sha512(order_id+status_code+gross_amount+serverKey)
export function verifyNotification(rawBody: Buffer, payload: any) {
  try {
    if (payload.signature_key) {
      const calculated = crypto.createHash('sha512').update(String(payload.order_id) + String(payload.status_code || '') + String(payload.gross_amount || '') + (config.MIDTRANS_SERVER_KEY || '')).digest('hex');
      return calculated === payload.signature_key;
    }
    // If no signature provided, fail closed
    return false;
  } catch (err) {
    return false;
  }
}
