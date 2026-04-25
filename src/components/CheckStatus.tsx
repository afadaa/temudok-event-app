import React, { useState } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TicketDownload } from './TicketDownload';
import QRCode from 'qrcode';

interface CheckStatusProps {
  onBack: () => void;
  initialOrderId?: string;
}

export function CheckStatus({ onBack, initialOrderId }: CheckStatusProps) {
  const [orderId, setOrderId] = useState(initialOrderId || '');
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

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
    if (!orderId.trim()) return;

    setLoading(true);
    setError(null);
    setStatusData(null);
    setShowTicket(false);

    try {
      const response = await fetch(`/api/payment-status/${orderId.trim()}`);
      if (!response.ok) {
        throw new Error('Order ID tidak ditemukan atau terjadi kesalahan.');
      }
      const data = await response.json();
      setStatusData(data);
      
      // If paid, prep QR code
      if (data.transaction_status === 'settlement' || data.transaction_status === 'capture') {
        const qrText = JSON.stringify({
          id: data.order_id,
          name: data.custom_field1 || 'Peserta',
          cat: data.custom_field2 || 'delegate',
          event: 'MUSWIL IDI KALTIM 2026'
        });
        const url = await QRCode.toDataURL(qrText);
        setQrCodeUrl(url);
      }
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
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-slate-800">Cek Status Pembayaran</h2>
      </div>

      <form onSubmit={fetchStatus} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Order ID / ID Pesanan</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input 
              type="text"
              placeholder="Contoh: MUSWIL-IDI-171..."
              className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all font-medium text-sm"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
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
                   className="absolute top-0 left-0 p-2 text-slate-400 hover:text-slate-600 z-10"
                 >
                   <ArrowLeft size={16} />
                 </button>
                 <TicketDownload 
                    data={{
                      fullName: statusData.custom_field1 || 'Peserta',
                      email: '', // Not returned by status API usually in notification logic context
                      category: statusData.custom_field2 || 'delegate',
                      orderId: statusData.order_id
                    }} 
                    qrCodeUrl={qrCodeUrl} 
                 />
               </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-4">
                <div className="flex justify-center">
                  {getStatusIcon(statusData.transaction_status)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {getStatusLabel(statusData.transaction_status)}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">ID Pesanan: {statusData.order_id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left border-t border-slate-200 pt-4 mt-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bayar</p>
                    <p className="text-sm font-bold text-slate-700">Rp {parseInt(statusData.gross_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode</p>
                    <p className="text-sm font-bold text-slate-700 uppercase">{statusData.payment_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu Transaksi</p>
                    <p className="text-sm font-bold text-slate-700">{new Date(statusData.transaction_time).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fraud Status</p>
                    <p className={`text-sm font-bold uppercase ${statusData.fraud_status === 'accept' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {statusData.fraud_status}
                    </p>
                  </div>
                </div>

                {(statusData.transaction_status === 'settlement' || statusData.transaction_status === 'capture') && (
                  <div className="pt-4 space-y-3">
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700 text-[11px] font-medium leading-relaxed">
                      Tiket telah dikirim ke email pendaftar. Anda juga dapat mengunduh tiket digital langsung di sini.
                    </div>
                    <button 
                      onClick={() => setShowTicket(true)}
                      className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/10"
                    >
                      <Download size={16} />
                      Lihat & Unduh Tiket
                    </button>
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
