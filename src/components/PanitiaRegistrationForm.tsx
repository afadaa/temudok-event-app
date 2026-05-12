import React, { useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Clock, Download, Image as ImageIcon, Loader2, Mail, Search, Upload, User, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { composePanitiaIdCard, downloadPanitiaCanvasAsPdf, downloadPanitiaCanvasAsPng } from '../utils/idCardPanitia';

interface PanitiaRegistrationFormProps {
  selectedEventId: string;
  onPending: (data: { orderId: string }) => void;
}

interface PanitiaStatus {
  exists: boolean;
  isPanitia?: boolean;
  orderId?: string;
  fullName?: string;
  email?: string;
  status?: string;
  photoUploaded?: boolean;
  photoUrl?: string;
}

type Step = 'check' | 'register' | 'status';

const isApproved = (status?: string) => ['settlement', 'capture'].includes(String(status || '').toLowerCase());
const isRejected = (status?: string) => ['rejected', 'deny', 'cancel', 'expire', 'failure'].includes(String(status || '').toLowerCase());

export function PanitiaRegistrationForm({ selectedEventId }: PanitiaRegistrationFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('check');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [statusData, setStatusData] = useState<PanitiaStatus | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState<'pdf' | 'png' | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  const resetToCheck = () => {
    setStep('check');
    setStatusData(null);
    setFullName('');
    setPhotoUrl('');
    setPhotoName('');
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Foto harus JPG, JPEG, atau PNG');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Ukuran foto maksimal 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Format email tidak valid');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/panitia/status?eventId=${encodeURIComponent(selectedEventId)}&email=${encodeURIComponent(cleanEmail)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Endpoint Panitia tidak mengembalikan JSON');
      }
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || 'Gagal mengecek data panitia');
        return;
      }

      if (!data.exists) {
        setStatusData(null);
        setFullName('');
        setStep('register');
        return;
      }

      setStatusData(data);
      setFullName(data.fullName || '');
      setEmail(data.email || cleanEmail);
      setStep('status');
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengecek data panitia');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = fullName.trim();

    if (cleanName.length < 3) {
      toast.error('Nama lengkap minimal 3 karakter');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Format email tidak valid');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/panitia/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          fullName: cleanName,
          email: cleanEmail,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || data.error || 'Gagal mendaftar sebagai panitia');
        return;
      }

      toast.success('Data Panitia tersimpan. Menunggu validasi admin.');
      setStatusData({
        exists: true,
        isPanitia: true,
        orderId: data.orderId,
        fullName: cleanName,
        email: cleanEmail,
        status: 'pending',
        photoUploaded: false,
      });
      setStep('status');
    } catch (error) {
      toast.error('Terjadi kesalahan saat mendaftar panitia');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!statusData?.orderId) {
      toast.error('Data panitia belum valid');
      return;
    }
    if (!photoUrl) {
      toast.error('Foto peserta wajib diunggah');
      return;
    }

    setPhotoLoading(true);
    try {
      const response = await fetch('/api/panitia/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: statusData.orderId, photoUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || 'Gagal mengunggah foto panitia');
        return;
      }

      toast.success('Foto Panitia berhasil disimpan.');
      setStatusData((current) => current ? { ...current, photoUploaded: true, photoUrl } : current);
      setPhotoUrl('');
      setPhotoName('');
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengunggah foto panitia');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePrintCard = async (format: 'pdf' | 'png') => {
    const name = (statusData?.fullName || fullName).trim();
    if (!name) {
      toast.error('Nama Panitia tidak ditemukan');
      return;
    }
    if (!statusData?.photoUploaded && !statusData?.photoUrl) {
      toast.error('Simpan foto terlebih dahulu sebelum cetak kartu');
      return;
    }

    setCardLoading(format);
    try {
      const canvas = await composePanitiaIdCard(name);
      const filename = `KARTU-PANITIA-${name.replace(/\s+/g, '-').toUpperCase()}.${format}`;
      if (format === 'pdf') {
        downloadPanitiaCanvasAsPdf(canvas, filename);
      } else {
        downloadPanitiaCanvasAsPng(canvas, filename);
      }
    } catch (error) {
      console.error('Panitia Card Error:', error);
      toast.error('Gagal mencetak kartu Panitia');
    } finally {
      setCardLoading(null);
    }
  };

  if (step === 'check') {
    return (
      <form onSubmit={handleCheck} className="space-y-6">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Masukkan email untuk mengecek apakah data Panitia sudah terdaftar.
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Email Aktif</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-idi-cream/5 py-4 pl-11 pr-4 text-sm font-medium text-idi-dark outline-none transition-all focus:border-idi-gold focus:ring-1 focus:ring-idi-gold"
              placeholder="nama@email.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-idi-dark py-5 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-idi-bronze disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
          Cek Data Panitia
        </button>
      </form>
    );
  }

  if (step === 'register') {
    return (
      <form onSubmit={handleRegister} className="space-y-6">
        <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold leading-relaxed">Email belum terdaftar sebagai Panitia. Isi nama lengkap dan email, lalu tunggu validasi admin.</p>
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Nama Lengkap Panitia</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-idi-cream/5 py-4 pl-11 pr-4 text-sm font-medium text-idi-dark outline-none transition-all focus:border-idi-gold focus:ring-1 focus:ring-idi-gold"
              placeholder="dr. Nama Panitia"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Email Aktif</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-idi-cream/5 py-4 pl-11 pr-4 text-sm font-medium text-idi-dark outline-none transition-all focus:border-idi-gold focus:ring-1 focus:ring-idi-gold"
              placeholder="nama@email.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-[88px_1fr] gap-3">
          <button type="button" onClick={resetToCheck} className="rounded-2xl border border-slate-200 py-5 text-xs font-black uppercase tracking-wider text-slate-500 transition hover:bg-slate-50">
            Cek Lagi
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-3 rounded-2xl bg-idi-dark py-5 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-idi-bronze disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Daftar Panitia'}
          </button>
        </div>
      </form>
    );
  }

  const approved = isApproved(statusData?.status);
  const rejected = isRejected(statusData?.status);

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-4 ${approved ? 'bg-emerald-50 text-emerald-700' : rejected ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
        <div className="mb-2 flex items-center gap-2">
          {approved ? <CheckCircle2 size={18} /> : rejected ? <XCircle size={18} /> : <Clock size={18} />}
          <p className="text-xs font-black uppercase tracking-wider">
            {approved ? 'Panitia tervalidasi' : rejected ? 'Pendaftaran ditolak' : 'Menunggu validasi admin'}
          </p>
        </div>
        <p className="text-sm font-bold leading-relaxed">
          {approved
            ? 'Data Anda sudah divalidasi admin. Unggah foto peserta ukuran ideal 4x6 untuk melengkapi kartu Panitia.'
            : rejected
              ? 'Data Panitia Anda ditolak. Silakan hubungi admin acara untuk klarifikasi.'
              : 'Data Panitia sudah tersimpan dan sedang menunggu validasi admin.'}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Data Panitia</p>
        <p className="mt-2 text-sm font-black text-idi-dark">{statusData?.fullName || fullName}</p>
        <p className="mt-1 break-all text-xs font-bold text-slate-500">{statusData?.email || email}</p>
      </div>

      {approved && (
        <div className="space-y-3">
          <label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Foto Peserta untuk Kartu</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handlePhotoSelect} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-idi-gold/20 bg-idi-gold/10 px-4 py-5 text-idi-gold transition hover:bg-idi-gold/15"
          >
            {photoUrl || statusData?.photoUploaded ? <Camera size={20} /> : <Upload size={20} />}
            <span className="text-[11px] font-black uppercase tracking-wider">{photoUrl || statusData?.photoUploaded ? 'Ganti Foto 4x6' : 'Unggah Foto 4x6'}</span>
          </button>

          {(photoUrl || statusData?.photoUrl) && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <img src={photoUrl || statusData?.photoUrl} alt="Preview foto panitia" className="h-16 w-12 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-800">{photoName || 'Foto panitia tersimpan'}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400">Ideal ukuran foto 4x6</p>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={photoLoading || !photoUrl}
            onClick={handleUploadPhoto}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-idi-dark py-5 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-idi-bronze disabled:opacity-50"
          >
            {photoLoading ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Foto'}
          </button>

          {statusData?.photoUploaded && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={cardLoading !== null}
                onClick={() => handlePrintCard('pdf')}
                className="flex items-center justify-center gap-3 rounded-2xl bg-emerald-700 py-4 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {cardLoading === 'pdf' ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                Cetak PDF
              </button>
              <button
                type="button"
                disabled={cardLoading !== null}
                onClick={() => handlePrintCard('png')}
                className="flex items-center justify-center gap-3 rounded-2xl border-2 border-emerald-700 bg-white py-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                {cardLoading === 'png' ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                Cetak PNG
              </button>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={resetToCheck} className="w-full rounded-2xl border border-slate-200 py-4 text-xs font-black uppercase tracking-wider text-slate-500 transition hover:bg-slate-50">
        Cek Email Lain
      </button>
    </div>
  );
}
