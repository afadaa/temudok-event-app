import React, { useRef, useState } from 'react';
import { Download, CheckCircle2, Ticket, RefreshCw, Image as ImageIcon, Camera, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';
import { toast } from 'sonner';

interface TicketDownloadProps {
  data: {
    fullName: string;
    email: string;
    category: string;
    orderId?: string;
    photoUrl?: string;
    eventTitle?: string;
  };
  qrCodeUrl: string;
}

export function TicketDownload({ data, qrCodeUrl }: TicketDownloadProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(data.photoUrl || '');
  const [isUploading, setIsUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data.orderId) return;

    // Validation: Type (JPG, JPEG, PNG)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file harus JPG, JPEG, atau PNG');
      return;
    }

    // Validation: Size (Max 1MB)
    if (file.size > 1024 * 1024) {
      toast.error('Ukuran foto maksimal 1MB');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Photo = reader.result as string;
      try {
        const response = await fetch('/api/update-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId, photoUrl: base64Photo }),
        });

        if (response.ok) {
          setLocalPhotoUrl(base64Photo);
          toast.success('Foto berhasil diunggah');
        } else {
          toast.error('Gagal mengunggah foto');
        }
      } catch (error) {
        toast.error('Terjadi kesalahan saat mengunggah foto');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = async () => {
    if (!ticketRef.current) return;
    setIsExportingImg(true);
    try {
      const canvas = await toCanvas(ticketRef.current, {
        pixelRatio: 4,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `KARTU-PESERTA-${data.fullName.replace(/\s+/g, '-').toUpperCase()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (error) {
      console.error('Image Generation Error:', error);
      alert('Gagal mengunduh Gambar. Silakan coba lagi.');
    } finally {
      setIsExportingImg(false);
    }
  };

  const downloadPDF = async () => {
    if (!ticketRef.current) return;
    setIsExporting(true);

    try {
      // html-to-image is generally better at ignoring unsupported CSS functions or handling them gracefully
      const canvas = await toCanvas(ticketRef.current, {
        pixelRatio: 3, // High quality scale
        backgroundColor: '#ffffff',
        cacheBust: true,
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
            <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.25rem 0 0 0', textAlign: 'center', maxWidth: '90%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{data.eventTitle || 'MUSWIL IDI KALTIM 2026'}</h3>
          </div>

          {/* Content Body - Stacked Layout */}
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: 'calc(100% - 5rem)', textAlign: 'center' }}>
            
            {/* Participant Info */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div>
                <p style={{ fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.15em', marginBottom: '0.25rem', margin: 0 }}>Nama Lengkap</p>
                <p style={{ fontSize: '0.925rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', lineHeight: '1.2', margin: 0 }}>{data.fullName}</p>
              </div>

              <div>
                <p style={{ fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.15em', marginBottom: '0.25rem', margin: 0 }}>Kategori Peserta</p>
                <div style={{ display: 'inline-block', backgroundColor: '#ecfdf5', border: '1px solid #10b981', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 900, color: '#059669', textTransform: 'uppercase', margin: 0 }}>{data.category}</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div>
                  <p style={{ fontSize: '7.5px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.1em', marginBottom: '0.125rem', margin: 0 }}>ID Registrasi</p>
                  <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, color: '#475569', margin: 0 }}>{data.orderId || '00000'}</p>
                </div>
              </div>
            </div>

            {/* Photo & QR Code Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
              {localPhotoUrl ? (
                <div style={{ padding: '0.25rem', border: '1px solid #f1f5f9', borderRadius: '0.5rem', backgroundColor: '#ffffff', boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.05)' }}>
                  <img src={localPhotoUrl} alt="Photo" style={{ width: '5.25rem', height: '5.25rem', objectFit: 'cover', borderRadius: '0.375rem', display: 'block' }} />
                </div>
              ) : (
                <div style={{ width: '5.75rem', height: '5.75rem', border: '2px dashed #e2e8f0', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', padding: '0.25rem' }}>Foto Belum Diunggah</span>
                </div>
              )}
              <div style={{ padding: '0.25rem', border: '1px solid #f1f5f9', borderRadius: '0.5rem', backgroundColor: '#ffffff', boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.05)' }}>
                <img src={qrCodeUrl} alt="QR" style={{ width: '5.25rem', height: '5.25rem', display: 'block' }} />
              </div>
            </div>
            
            {/* Footer verified Access */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                 <div style={{ width: '0.25rem', height: '0.25rem', backgroundColor: '#10b981', borderRadius: '9999px' }}></div>
                 <p style={{ fontSize: '7.5px', fontWeight: 900, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Verified Access</p>
               </div>
            </div>
          </div>
          
          {/* Side Indicator */}
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: '3rem', width: '0.25rem', backgroundColor: '#10b981', borderTopRightRadius: '0.25rem', borderBottomRightRadius: '0.25rem' }}></div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {!localPhotoUrl && (
          <div className="mb-2">
            <label className="w-full flex items-center justify-center gap-3 bg-emerald-50 border-2 border-dashed border-emerald-200 py-4 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all group">
              {isUploading ? <RefreshCw size={20} className="animate-spin text-emerald-600" /> : <Camera size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />}
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Unggah Foto Peserta</span>
                <span className="text-[9px] font-bold text-emerald-500 uppercase">Wajib untuk kartu peserta</span>
              </div>
              <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handlePhotoUpload} disabled={isUploading} />
            </label>
          </div>
        )}

        <button 
          onClick={downloadPDF}
          disabled={isExporting || isExportingImg || isUploading || !localPhotoUrl}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <RefreshCw size={20} className="animate-spin" /> : <Download size={20} />}
          <span>{isExporting ? 'Menyiapkan PDF...' : 'Unduh Kartu Peserta (PDF)'}</span>
        </button>

        <button 
          onClick={downloadImage}
          disabled={isExporting || isExportingImg || isUploading || !localPhotoUrl}
          className="w-full bg-white border-2 border-slate-900 text-slate-900 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExportingImg ? <RefreshCw size={20} className="animate-spin" /> : <ImageIcon size={20} />}
          <span>{isExportingImg ? 'Menyiapkan Gambar...' : 'Unduh Kartu Peserta (PNG)'}</span>
        </button>
        
        {!localPhotoUrl ? (
          <p className="text-[10px] text-amber-600 text-center font-black px-4 bg-amber-50 py-2 rounded-lg border border-amber-100 uppercase tracking-tighter">
            Silakan unggah foto terlebih dahulu untuk mengunduh kartu.
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 text-center font-bold px-4">
            Simpan file PDF atau Gambar ini untuk ditukarkan dengan ID Card fisik di lokasi acara.
          </p>
        )}
      </div>
    </div>
  );
}
