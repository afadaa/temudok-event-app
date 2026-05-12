import QRCode from 'qrcode';
import { transporter } from '../config/mail.ts';
import dotenv from 'dotenv';

dotenv.config();

export async function sendTicketEmail(data: any) {
  const { order_id } = data;
  const email = data.customer_details?.email;
  const name = data.custom_field1 || data.customer_details?.first_name || 'Peserta';
  const category = data.custom_field2 || 'Peserta';
  const eventTitle = data.custom_field3 || 'MUSWIL IDI KALTIM 2026';

  if (!email) {
    console.error('No email found for order', order_id);
    return;
  }

  // Generate QR Code with more detailed data
  const qrData = JSON.stringify({
    id: order_id,
    name: name,
    cat: category,
    event: eventTitle
  });
  
  const qrCodeDataUrl = await QRCode.toDataURL(qrData);

  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@idikaltim.org';
  const fromName = process.env.MAIL_FROM_NAME || 'Muswil IDI Kaltim';

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    subject: `E-Tiket ${eventTitle}`,
    attachments: [{
      filename: 'qrcode.png',
      path: qrCodeDataUrl,
      cid: 'qrcode-ticket'
    }],
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #0d9488; text-align: center;">E-TIKET RESMI</h2>
        <div style="background-color: #f0fdfa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0d9488;">
          <p style="margin: 0; color: #134e4a; font-weight: bold;">Status: Pembayaran Berhasil</p>
        </div>
        <p>Halo <strong>${name}</strong>,</p>
        <p>Terima kasih telah mendaftar di ${eventTitle}. Data pendaftaran Anda telah kami terima.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; margin: 25px 0; border: 1px dashed #cbd5e1;">
          <div style="text-align: center;">
            <p style="margin-bottom: 10px; font-size: 14px; color: #64748b; font-weight: bold; uppercase;">Scan QR Code saat Registrasi</p>
            <img src="cid:qrcode-ticket" alt="QR Code Tiket" style="width: 180px; height: 180px; border: 4px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
            <p style="font-family: monospace; margin-top: 15px; color: #0f172a; font-size: 16px; font-weight: bold;">${order_id}</p>
          </div>
          
          <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; pt: 15px;">
            <table style="width: 100%; font-size: 13px; color: #475569;">
              <tr>
                <td style="padding: 5px 0;">Kategori:</td>
                <td style="text-align: right; font-weight: bold; color: #0f172a;">${category}</td>
              </tr>
            </table>
          </div>
        </div>

        <p style="font-size: 14px; line-height: 1.6;">Silakan simpan e-tiket ini dan tunjukkan kepada panitia di lokasi acara untuk proses check-in.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            <strong>${eventTitle}</strong><br/>
            Pesan otomatis, mohon tidak membalas.
          </p>
        </div>
      </div>
    `,
  };

  try {
    if (!process.env.MAIL_USERNAME || process.env.MAIL_USERNAME === 'MY_EMAIL_USER') {
      console.log('Mode Demo/Placeholder: Email tidak benar-benar dikirim. Detail:', mailOptions.to, mailOptions.subject);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log('Ticket email sent successfully to', email);
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

export async function sendPanitiaApprovalEmail(data: any) {
  const orderId = data.order_id;
  const email = data.customer_details?.email;
  const name = data.custom_field1 || data.customer_details?.first_name || 'Panitia';
  const category = data.custom_field2 || 'Panitia';
  const eventTitle = data.custom_field3 || 'MUSWIL IDI KALTIM 2026';

  if (!email) {
    console.error('No email found for panitia approval', orderId);
    return;
  }

  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@idikaltim.org';
  const fromName = process.env.MAIL_FROM_NAME || 'Muswil IDI Kaltim';

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    subject: `Validasi Panitia Disetujui - ${eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #166534; text-align: center;">VALIDASI PANITIA DISETUJUI</h2>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
          <p style="margin: 0; color: #14532d; font-weight: bold;">Status: Anda telah disetujui sebagai Panitia</p>
        </div>
        <p>Halo <strong>${name}</strong>,</p>
        <p>Data Anda telah divalidasi oleh admin sebagai <strong>${category}</strong> untuk kegiatan <strong>${eventTitle}</strong>.</p>
        <p>Silakan buka menu <strong>Panitia</strong> pada website, masukkan email yang sama, lalu unggah foto peserta ukuran ideal 4x6 untuk mencetak kartu Panitia.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 10px; margin: 24px 0;">
          <p style="margin: 0; color: #475569; font-size: 13px;">ID Registrasi</p>
          <p style="margin: 6px 0 0; color: #0f172a; font-family: monospace; font-size: 16px; font-weight: bold;">${orderId}</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6;">Email ini bukan konfirmasi pembayaran. Panitia tidak perlu melakukan pembayaran dan hanya memerlukan validasi admin.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            <strong>${eventTitle}</strong><br/>
            Pesan otomatis, mohon tidak membalas.
          </p>
        </div>
      </div>
    `,
  };

  try {
    if (!process.env.MAIL_USERNAME || process.env.MAIL_USERNAME === 'MY_EMAIL_USER') {
      console.log('Mode Demo/Placeholder: Panitia approval email tidak benar-benar dikirim. Detail:', mailOptions.to, mailOptions.subject);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log('Panitia approval email sent successfully to', email);
  } catch (err) {
    console.error('Failed to send panitia approval email:', err);
  }
}

export async function sendBroadcastEmail(options: { emails: string[]; subject: string; html: string }) {
  const { emails, subject, html } = options;
  if (!emails || emails.length === 0) return;

  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@idikaltim.org';
  const fromName = process.env.MAIL_FROM_NAME || 'Muswil IDI Kaltim';

  const uniqueEmails = Array.from(new Set(emails.filter(e => !!e)));
  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    bcc: uniqueEmails.join(','),
    subject,
    html,
  } as any;

  try {
    if (!process.env.MAIL_USERNAME || process.env.MAIL_USERNAME === 'MY_EMAIL_USER') {
      console.log('Mode Demo/Placeholder: Broadcast email not actually sent. Recipients:', uniqueEmails.length, 'Subject:', subject);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log('Broadcast email sent to', uniqueEmails.length, 'recipients');
  } catch (err) {
    console.error('Failed to send broadcast email:', err);
  }
}
