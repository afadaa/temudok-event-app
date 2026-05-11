import React, { useRef, useState } from 'react';
import { Download, CheckCircle2, Ticket, RefreshCw, Image as ImageIcon, Camera, Upload } from 'lucide-react';
import { composeIdCard, downloadCanvasAsPdf, downloadCanvasAsPng } from '../utils/idCard';
import { composeUtusanIdCard, downloadUtusanCanvasAsPdf, downloadUtusanCanvasAsPng } from '../utils/idCardUtusan';
import { composePeninjauIdCard, downloadPeninjauCanvasAsPdf, downloadPeninjauCanvasAsPng } from '../utils/idCardPeninjau';
import { composePanitiaIdCard, downloadPanitiaCanvasAsPdf, downloadPanitiaCanvasAsPng } from '../utils/idCardPanitia';
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
  allowPhotoUpload?: boolean;
}

export function TicketDownload({ data, qrCodeUrl }: TicketDownloadProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(data.photoUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const normalizedCategory = data.category.trim().toUpperCase();
  const isUtusan = normalizedCategory.startsWith('UTUSAN');
  const isPeninjau = normalizedCategory.startsWith('PENINJAU');
  const isPanitia = normalizedCategory.startsWith('PANITIA');
  const requiresPhoto = !isPanitia;

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
    if (!data.fullName) return;
    setIsExportingImg(true);
    try {
      const photoSrc = data.photoUrl || localPhotoUrl || '';
      const canvas = isPanitia
        ? await composePanitiaIdCard(data.fullName)
        : isPeninjau
          ? await composePeninjauIdCard(photoSrc, data.fullName, data.orderId || '')
          : isUtusan
            ? await composeUtusanIdCard(photoSrc, data.fullName, data.orderId || '', data.category)
            : await composeIdCard(undefined, photoSrc, data.fullName, data.category, data.orderId || '', 0, 0);
      const filename = `KARTU-PESERTA-${data.fullName.replace(/\s+/g, '-').toUpperCase()}.png`;
      if (isPanitia) {
        downloadPanitiaCanvasAsPng(canvas, filename);
      } else if (isPeninjau) {
        downloadPeninjauCanvasAsPng(canvas, filename);
      } else if (isUtusan) {
        downloadUtusanCanvasAsPng(canvas, filename);
      } else {
        downloadCanvasAsPng(canvas, filename);
      }
    } catch (error) {
      console.error('Image Generation Error:', error);
      alert('Gagal mengunduh Gambar. Silakan coba lagi.');
    } finally {
      setIsExportingImg(false);
    }
  };

  const downloadPDF = async () => {
    if (!data.fullName) return;
    setIsExporting(true);
    try {
      const photoSrc = data.photoUrl || localPhotoUrl || '';
      const canvas = isPanitia
        ? await composePanitiaIdCard(data.fullName)
        : isPeninjau
          ? await composePeninjauIdCard(photoSrc, data.fullName, data.orderId || '')
          : isUtusan
            ? await composeUtusanIdCard(photoSrc, data.fullName, data.orderId || '', data.category)
            : await composeIdCard(undefined, photoSrc, data.fullName, data.category, data.orderId || '', 0, 0);
      const filename = `KARTU-PESERTA-${data.fullName.replace(/\s+/g, '-').toUpperCase()}.pdf`;
      if (isPanitia) {
        downloadPanitiaCanvasAsPdf(canvas, filename);
      } else if (isPeninjau) {
        downloadPeninjauCanvasAsPdf(canvas, filename);
      } else if (isUtusan) {
        downloadUtusanCanvasAsPdf(canvas, filename);
      } else {
        downloadCanvasAsPdf(canvas, filename);
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Gagal mengunduh Kartu Peserta. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
  <div className="w-16 h-16 bg-idi-gold/10 text-idi-gold rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">Pendaftaran Selesai!</h2>
        <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto">
          Pembayaran Anda telah diverifikasi. Silakan unduh Kartu Peserta (Format 4x6 cm) di bawah ini.
        </p>
      </div>

      {/* Card Preview Container */}
      <div className="flex justify-center overflow-x-auto py-4">
        {/* The target for export (styled to match app theme) */}
        <div ref={ticketRef} className="w-[302px] h-[397px] bg-white relative overflow-hidden shadow-2xl rounded-2xl flex-shrink-0 border border-idi-gold/10">

          {/* Decorative accents similar to App.tsx */}
          <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-idi-gold/10"></div>
          <div className="absolute -left-20 -bottom-20 w-40 h-40 rounded-full bg-idi-gold/5"></div>

          {/* Header (app theme) */}
          <div className="bg-idi-dark h-20 w-full flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute -right-3 -top-3 opacity-10">
              <Ticket size={80} className="text-white transform -rotate-12" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-idi-cream/90 m-0">Kartu Peserta</p>
            <h3 className="text-sm font-black uppercase tracking-tight text-white mt-1 max-w-[90%] truncate">{data.eventTitle || 'MUSWIL IDI KALTIM 2026'}</h3>
          </div>

          {/* Content Body */}
          <div className="p-4 flex flex-col items-center justify-between h-[calc(100%-5rem)] text-center">
            {/* Participant Info */}
            <div className="w-full flex flex-col gap-3 mt-1">
              <div>
                <p className="text-[9px] font-black uppercase text-idi-cream/60 tracking-widest mb-1">Nama Lengkap</p>
                <p className="text-base font-black uppercase text-idi-dark leading-tight">{data.fullName}</p>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase text-idi-cream/60 tracking-widest mb-1">Kategori Peserta</p>
                <div className="inline-block bg-idi-gold/10 border border-idi-gold/20 px-3 py-1 rounded-full">
                  <p className="text-xs font-black uppercase text-idi-gold m-0">{data.category}</p>
                </div>
              </div>

              <div className="flex justify-center">
                <div>
                  <p className="text-[8px] font-black uppercase text-idi-cream/60 tracking-widest mb-1">ID Registrasi</p>
                  <p className="text-xs font-mono font-bold text-idi-dark m-0">{data.orderId || '00000'}</p>
                </div>
              </div>
            </div>

            {/* Photo & QR Section */}
            <div className="flex items-center gap-4 my-2">
              {localPhotoUrl ? (
                <div className="p-1 bg-white border border-slate-100 rounded-md shadow-sm">
                  <img src={localPhotoUrl} alt="Photo" className="w-20 h-24 object-cover rounded-md block" />
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-md flex items-center justify-center bg-slate-50">
                  <span className="text-[10px] font-black text-slate-400 uppercase text-center px-2">Foto Belum Diunggah</span>
                </div>
              )}

              <div className="p-1 bg-white border border-slate-100 rounded-md shadow-sm">
                <img src={qrCodeUrl} alt="QR" className="w-20 h-20 block" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-idi-gold" />
                <p className="text-[9px] font-black uppercase text-idi-gold tracking-wider m-0">Verified Access</p>
              </div>
            </div>
          </div>

          {/* Side indicator */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-12 w-1 bg-idi-gold rounded-tr-md rounded-br-md"></div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {requiresPhoto && !localPhotoUrl && (
          <div className="mb-2">
            <label className="w-full flex items-center justify-center gap-3 bg-idi-gold/10 border-2 border-dashed border-idi-gold/20 py-4 rounded-2xl cursor-pointer hover:bg-idi-gold/10 transition-all group">
              {isUploading ? <RefreshCw size={20} className="animate-spin text-idi-gold" /> : <Camera size={20} className="text-idi-gold group-hover:scale-110 transition-transform" />}
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[11px] font-black text-idi-gold uppercase tracking-wider">Unggah Foto Peserta</span>
                <span className="text-[9px] font-bold text-idi-gold/70 uppercase">Wajib untuk kartu peserta, ideal ukuran 4x6</span>
              </div>
              <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handlePhotoUpload} disabled={isUploading} />
            </label>
          </div>
        )}

        <button 
          onClick={downloadPDF}
          disabled={isExporting || isExportingImg || isUploading || (requiresPhoto && !(localPhotoUrl || data.photoUrl))}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-idi-goldd-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <RefreshCw size={20} className="animate-spin" /> : <Download size={20} />}
          <span>{isExporting ? 'Menyiapkan PDF...' : 'Unduh Kartu Peserta (PDF)'}</span>
        </button>

        <button 
          onClick={downloadImage}
          disabled={isExporting || isExportingImg || isUploading || (requiresPhoto && !(localPhotoUrl || data.photoUrl))}
          className="w-full bg-white border-2 border-slate-900 text-slate-900 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExportingImg ? <RefreshCw size={20} className="animate-spin" /> : <ImageIcon size={20} />}
          <span>{isExportingImg ? 'Menyiapkan Gambar...' : 'Unduh Kartu Peserta (PNG)'}</span>
        </button>
        
        {requiresPhoto && !localPhotoUrl ? (
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
