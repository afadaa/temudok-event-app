import React, { useRef } from 'react';
import { Download, Printer, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

interface TicketDownloadProps {
  data: {
    fullName: string;
    email: string;
    category: string;
    orderId?: string;
  };
  qrCodeUrl: string;
}

export function TicketDownload({ data, qrCodeUrl }: TicketDownloadProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!ticketRef.current) return;

    try {
      const imgData = await toPng(ticketRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Ticket-${data.orderId || 'MUSWIL'}.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Gagal mengunduh PDF. Silakan coba lagi.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">Pendaftaran Berhasil!</h2>
        <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto">
          Terima kasih, pendaftaran Anda telah dikonfirmasi. Silakan unduh tiket digital Anda di bawah ini.
        </p>
      </div>

      {/* Visible Ticket Preview */}
      <div className="flex justify-center">
        <div 
          ref={ticketRef}
          style={{ 
            fontFamily: "'Inter', sans-serif", 
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '1.5rem',
            width: '100%',
            maxWidth: '350px',
            overflow: 'hidden'
          }}
        >
          <div style={{ backgroundColor: '#059669', padding: '1.5rem', color: '#ffffff', textAlign: 'center' }}>
            <h3 className="text-lg font-black uppercase tracking-widest">E-TIKET RESMI</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1" style={{ opacity: 0.8 }}>Muswil IDI Kalimantan Timur 2026</p>
          </div>

          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
               <div style={{ padding: '0.5rem', border: '2px solid #f1f5f9', borderRadius: '1rem', backgroundColor: '#f8fafc' }}>
                <img src={qrCodeUrl} alt="Ticket QR Code" style={{ width: '10rem', height: '10rem', display: 'block' }} />
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#94a3b8', margin: 0 }}>Nama Peserta</p>
                <p className="font-bold uppercase text-sm" style={{ color: '#1e293b', margin: 0 }}>{data.fullName}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', textAlign: 'center' }}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#94a3b8', margin: 0 }}>Kategori</p>
                  <p className="font-bold text-[11px] uppercase" style={{ color: '#334155', margin: 0 }}>{data.category === 'guest' ? 'Tamu/Undangan' : 'Utusan'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#94a3b8', margin: 0 }}>ID Pesanan</p>
                  <p className="font-mono font-bold text-[11px]" style={{ color: '#334155', margin: 0 }}>{data.orderId || 'PENDING'}</p>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
               <CheckCircle2 size={12} color="#10b981" />
               <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#059669' }}>Terverifikasi oleh Panitia</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
             <p className="text-[8px] text-center font-bold uppercase tracking-[0.2em]" style={{ color: '#94a3b8', margin: 0 }}>Sila tunjukkan QR Code ini saat registrasi ulang</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={downloadPDF}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          <Download size={18} />
          <span>Unduh Tiket (PDF)</span>
        </button>
        
        <p className="text-[10px] text-slate-400 text-center font-medium">
          Salinan tiket juga telah dikirimkan ke email <strong>{data.email}</strong>
        </p>
      </div>
    </div>
  );
}
