import React, { useRef, useState } from 'react';
import { Download, CheckCircle2, Ticket } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [isExporting, setIsExporting] = useState(false);

  const downloadPDF = async () => {
    if (!ticketRef.current) return;
    setIsExporting(true);

    try {
      // Capture at high resolution for quality
      const canvas = await html2canvas(ticketRef.current, {
        scale: 4, // Higher scale for better print quality
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // B3 or custom size: 80x105 mm (Portrait)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 105]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 80, 105);
      pdf.save(`KARTU-PESERTA-${data.fullName.replace(/\s+/g, '-').toUpperCase()}.pdf`);
      setIsExporting(false);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Gagal mengunduh Kartu Peserta. Silakan coba lagi.');
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">Pendaftaran Selesai!</h2>
        <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto">
          Pembayaran Anda telah diverifikasi. Silakan unduh Kartu Peserta (Format 80x105 mm) di bawah ini.
        </p>
      </div>

      {/* Card Preview Container */}
      <div className="flex justify-center overflow-x-auto py-4">
        {/* The target for export (Hidden or styled as card) */}
        <div 
          ref={ticketRef}
          style={{ 
            width: '302px', // ~80mm at 96dpi
            height: '397px', // ~105mm at 96dpi
            backgroundColor: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
            borderRadius: '0.5rem', 
            fontFamily: "'Inter', sans-serif",
            flexShrink: 0,
            border: '1px solid #e2e8f0'
          }}
        >
          {/* Background Accents */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: '12rem', height: '12rem', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderRadius: '9999px', marginRight: '-6rem', marginTop: '-6rem' }}></div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '10rem', height: '10rem', backgroundColor: 'rgba(5, 150, 105, 0.05)', borderRadius: '9999px', marginLeft: '-5rem', marginBottom: '-5rem' }}></div>
          
          {/* Header */}
          <div style={{ backgroundColor: '#059669', height: '5rem', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-1rem', top: '-1rem', opacity: 0.1 }}>
              <Ticket size={80} style={{ color: '#ffffff', transform: 'rotate(-15deg)' }} />
            </div>
            <p style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.25em', color: 'rgba(255, 255, 255, 0.9)', textTransform: 'uppercase', margin: 0 }}>Kartu Peserta</p>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.25rem 0 0 0', textAlign: 'center' }}>MUSWIL IDI KALTIM 2026</h3>
          </div>

          {/* Content Body - Stacked Layout */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: 'calc(100% - 5rem)', textAlign: 'center' }}>
            
            {/* Participant Info */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
              <div>
                <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.15em', marginBottom: '0.375rem', margin: 0 }}>Nama Lengkap</p>
                <p style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', lineHeight: '1.2', margin: 0 }}>{data.fullName}</p>
              </div>

              <div>
                <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.15em', marginBottom: '0.375rem', margin: 0 }}>Kategori Peserta</p>
                <div style={{ display: 'inline-block', backgroundColor: '#ecfdf5', border: '1px solid #10b981', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#059669', textTransform: 'uppercase', margin: 0 }}>{data.category}</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                <div>
                  <p style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.1em', marginBottom: '0.125rem', margin: 0 }}>ID Registrasi</p>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#475569', margin: 0 }}>{data.orderId || '00000'}</p>
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.5rem', border: '1px solid #f1f5f9', borderRadius: '1rem', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <img src={qrCodeUrl} alt="QR" style={{ width: '6.5rem', height: '6.5rem', display: 'block' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                   <div style={{ width: '0.25rem', height: '0.25rem', backgroundColor: '#10b981', borderRadius: '9999px' }}></div>
                   <p style={{ fontSize: '8px', fontWeight: 900, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Verified Digital Token</p>
                 </div>
              </div>
            </div>

            {/* Footer Text */}
            <div style={{ width: '100%', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '7px', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Diterbitkan secara elektronik oleh Panitia Muswil IDI Kaltim 2026
              </p>
            </div>
          </div>
          
          {/* Side Indicator */}
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: '3rem', width: '0.25rem', backgroundColor: '#10b981', borderTopRightRadius: '0.25rem', borderBottomRightRadius: '0.25rem' }}></div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={downloadPDF}
          disabled={isExporting}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={20} />
          <span>{isExporting ? 'Menyiapkan Tiket...' : 'Unduh Kartu Peserta (PDF)'}</span>
        </button>
        
        <p className="text-[10px] text-slate-400 text-center font-medium">
          Simpan file PDF ini untuk ditukarkan dengan ID Card fisik di hari H.
        </p>
      </div>
    </div>
  );
}
