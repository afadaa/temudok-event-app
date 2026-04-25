import { Request, Response } from 'express';
import { getSnap, verifyNotification } from '../midtrans';
import { doc, updateDoc } from '../firestoreCompat';

export async function handleWebhook(req: Request, res: Response) {
  try {
    const rawBody = req.body as Buffer;
    let payload: any;
    try { payload = JSON.parse(rawBody.toString('utf8')); } catch (e) { return res.status(400).send('Invalid JSON'); }

    const verified = verifyNotification(rawBody, payload);
    if (!verified) return res.status(403).send('Invalid signature');

    const snap = getSnap();
    if (!snap) return res.status(200).send('OK');

    const statusResponse = await snap.transaction.notification(payload);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    console.log(`Transaction notification received. Order ID: ${orderId}. Status: ${transactionStatus}. Fraud: ${fraudStatus}`);

    await updateDoc(doc('registrations', orderId), { status: transactionStatus, updatedAt: new Date().toISOString() });

    if (transactionStatus === 'capture') {
      if (fraudStatus === 'challenge') {
        // TODO
      } else if (fraudStatus === 'accept') {
        // sendTicketEmail(statusResponse) - left to original mail service
      }
    } else if (transactionStatus === 'settlement') {
      // sendTicketEmail(statusResponse)
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).send('Error');
  }
}
