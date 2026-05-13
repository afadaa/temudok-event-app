import React, { useState } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, ArrowLeft, Download, Upload, X, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TicketDownload } from './TicketDownload';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface CheckStatusProps {
  onBack: () => void;
  initialOrderId?: string;
  onStatusSuccess?: (data: any) => void;
}

export function CheckStatus({ onBack, initialOrderId, onStatusSuccess }: CheckStatusProps) {
  const [orderId, setOrderId] = useState(initialOrderId || '');
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Auto-fetch if initialOrderId is present
  React.useEffect(() => {
    if (initialOrderId) {
      // Simulate form submission to use existing fetchStatus logic nicely
      const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
      fetchStatus(syntheticEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  const fetchStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = orderId.trim();
    if (!input) return;

    setLoading(true);
    setError(null);
    setStatusData(null);
    setShowTicket(false);

    try {
      // Detect if input looks like an email address
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

      let resolvedOrderId = input;

      if (isEmail) {
        // Look up registrations by email to get orderId
        const emailRes = await fetch(`/api/payment-status/by-email?email=${encodeURIComponent(input)}`);
        if (!emailRes.ok) throw new Error('Gagal mencari data berdasarkan email.');
        const emailData = await emailRes.json();
        if (!emailData.results || emailData.results.length === 0) {
          throw new Error('Tidak ada pendaftaran ditemukan untuk email ini.');
        }
        // Pick the most recent registration
        const sorted = [...emailData.results].sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        resolvedOrderId = sorted[0].orderId;
        if (!resolvedOrderId) throw new Error('Order ID tidak ditemukan untuk email ini.');
      }

      const response = await fetch(`/api/payment-status/${resolvedOrderId}`);
      if (!response.ok) {
        throw new Error('Order ID tidak ditemukan atau terjadi kesalahan.');
      }
      const data = await response.json();
      
      if (onStatusSuccess) {
        onStatusSuccess(data);
        return;
      }

      setStatusData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'settlement':
      case 'capture':
        return <CheckCircle2 className="text-emerald-500" size={48} />;
      case 'pending':
        return <Clock className="text-amber-500" size={48} />;
      case 'expire':
      case 'cancel':
      case 'deny':
        return <XCircle className="text-red-500" size={48} />;
      default:
        return <AlertCircle className="text-slate-400" size={48} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'settlement':
      case 'capture':
        return 'Pembayaran Berhasil';
      case 'pending':
        return 'Menunggu Pembayaran';
      case 'expire':
        return 'Sesi Berakhir';
      case 'cancel':
        return 'Dibatalkan';
      case 'deny':
        return 'Ditolak';
      default:
        return 'Status Tidak Diketahui';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-idi-cream/10 rounded-full transition-colors text-idi-cream/80"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-idi-dark">Cek Status Pembayaran</h2>
      </div>

      <form onSubmit={fetchStatus} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Order ID / Email Peserta</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text"
                placeholder="Order ID atau email pendaftar..."
                className="w-full pl-11 pr-4 py-4 bg-idi-cream/5 border border-slate-200 rounded-xl focus:border-idi-gold focus:ring-1 focus:ring-idi-gold outline-none transition-all font-medium text-sm text-idi-dark"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-idi-gold hover:bg-idi-accent text-idi-dark font-bold py-4 rounded-xl transition-all shadow-lg shadow-idi-gold/20 flex items-center justify-center gap-2"
        >
        {loading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <>
            <Search size={20} />
            Cek Status
          </>
        )}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm"
          >
            <AlertCircle size={20} />
            <p>{error}</p>
          </motion.div>
        )}

        {statusData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {showTicket ? (
               <div className="relative">
                 <button 
                   onClick={() => setShowTicket(false)}
                   className="absolute top-0 left-0 p-2 text-idi-cream/80 hover:text-idi-dark z-10"
                 >
                    <ArrowLeft size={16} />
                 </button>
                 <TicketDownload 
                    data={{
                      fullName: statusData.custom_field1 || 'Peserta',
                      email: '', // Not returned by status API usually in notification logic context
                      category: statusData.custom_field2 || 'delegate',
                      orderId: statusData.order_id,
                      photoUrl: statusData.photoUrl,
                      branchName: statusData.branchName,
                      branchId: statusData.branchId,
                      kriteria: statusData.kriteria,
                    }} 
                    qrCodeUrl={qrCodeUrl} 
                 />
               </div>
            ) : (
              <div className="bg-idi-cream/5 border border-slate-100 rounded-2xl p-6 text-center space-y-4">
                <div className="flex justify-center">
                  {getStatusIcon(statusData.transaction_status)}
                </div>
                <div>
                  <h3 className="font-bold text-idi-dark text-lg">
                      {getStatusLabel(statusData.transaction_status)}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">ID Pesanan: {statusData.order_id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left border-t border-slate-200 pt-4 mt-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bayar</p>
                      <p className="text-sm font-bold text-idi-dark">Rp {parseInt(statusData.gross_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode</p>
                      <p className="text-sm font-bold text-idi-dark uppercase">{statusData.payment_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu Transaksi</p>
                      <p className="text-sm font-bold text-idi-dark">{new Date(statusData.transaction_time).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fraud Status</p>
                      <p className={`text-sm font-bold uppercase ${statusData.fraud_status === 'accept' ? 'text-idi-gold' : 'text-amber-600'}`}>
                      {statusData.fraud_status}
                    </p>
                  </div>
                </div>

                {(statusData.transaction_status === 'settlement' || statusData.transaction_status === 'capture') && (
                  <div className="pt-4 space-y-3">
                    <div className="p-3 bg-idi-gold/10 rounded-lg text-idi-dark text-[11px] font-medium leading-relaxed">
                      Tiket telah dikirim ke email pendaftar. Anda juga dapat mengunduh tiket digital langsung di sini.
                    </div>
                      <button 
                        onClick={() => setShowTicket(true)}
                        className="w-full flex items-center justify-center gap-2 bg-idi-dark text-idi-cream py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-idi-gold transition-all shadow-lg shadow-idi-dark/10"
                      >
                      <Download size={16} />
                      Lihat & Unduh Tiket
                    </button>
                  </div>
                )}
                {statusData.transaction_status === 'pending' && (
                  <div className="pt-4 space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-[11px] font-medium leading-relaxed">
                      Pesanan Anda berstatus <strong>pending</strong>. Jika sudah melakukan transfer, unggah bukti pembayaran di bawah ini untuk mempercepat verifikasi.
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-idi-gold">Upload Bukti Transfer</p>

                      {/* Preview */}
                      {previewUrl && (
                        <div className="relative mb-2">
                          {selectedFile?.type === 'application/pdf' ? (
                            <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">
                              PDF: {selectedFile.name}
                            </div>
                          ) : (
                            <img
                              src={previewUrl}
                              alt="preview bukti transfer"
                              className="w-full h-40 object-cover rounded-xl border border-slate-200"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => { setSelectedFile(null); setPreviewUrl(null); if (fileRef.current) fileRef.current.value = ''; }}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf,.pdf"
                        className="hidden"
                        ref={fileRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!['image/jpeg','image/png','image/jpg','application/pdf'].includes(file.type)) {
                            toast.error('Hanya menerima file JPEG/PNG/PDF');
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('Ukuran file maksimal 5MB');
                            return;
                          }
                          setSelectedFile(file);
                          setPreviewUrl(URL.createObjectURL(file));
                          setError(null);
                        }}
                      />

                      {!previewUrl ? (
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-idi-gold hover:text-idi-gold transition-all"
                        >
                          <Upload size={28} />
                          <span className="text-[11px] font-black uppercase tracking-wider">Pilih Bukti Transfer</span>
                          <span className="text-[10px] text-slate-400">JPEG / PNG / PDF, maks 5MB</span>
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                          >
                            <ImageIcon size={14} />
                            Ganti Bukti
                          </button>
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={async () => {
                              if (!selectedFile) return;
                              setUploading(true);
                              try {
                                const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
                                  const reader = new FileReader();
                                  reader.onload = () => resolve(reader.result as string);
                                  reader.onerror = (e) => reject(e);
                                  reader.readAsDataURL(f);
                                });
                                const dataUrl = await toDataUrl(selectedFile);
                                const res = await fetch('/api/update-payment-base64', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ orderId: orderId.trim(), data: dataUrl, filename: selectedFile.name })
                                });
                                const json = await res.json();
                                if (res.ok) {
                                  toast.success('Bukti pembayaran berhasil dikirim! Tim kami akan memverifikasi segera.');
                                  setSelectedFile(null);
                                  setPreviewUrl(null);
                                  if (fileRef.current) fileRef.current.value = '';
                                  // refresh status
                                  await fetchStatus({ preventDefault: () => {} } as React.FormEvent);
                                } else {
                                  toast.error(json.error || 'Gagal mengunggah bukti pembayaran');
                                }
                              } catch (err: any) {
                                toast.error(err.message || 'Terjadi kesalahan saat mengunggah');
                              } finally {
                                setUploading(false);
                                if (fileRef.current) fileRef.current.value = '';
                              }
                            }}
                            className="flex-1 py-3 bg-idi-gold text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-idi-accent disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                          >
                            {uploading ? (
                              <><Loader2 size={14} className="animate-spin" /> Mengunggah...</>
                            ) : (
                              <><Upload size={14} /> Kirim Bukti</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
