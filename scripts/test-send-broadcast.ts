import dotenv from 'dotenv';
dotenv.config();

import { sendBroadcastEmail } from '../server/services/MailService';

(async () => {
  try {
    await sendBroadcastEmail({
      emails: [process.env.MAIL_USERNAME || 'test@example.com'],
      subject: 'Test Broadcast',
      html: '<p>This is a test broadcast email.</p>'
    });
    console.log('Script finished');
  } catch (err) {
    console.error('Script error', err);
  }
})();
