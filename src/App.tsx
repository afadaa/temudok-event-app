import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Stethoscope, Calendar, MapPin, Users, CheckCircle2, ChevronRight, X, Mail, Phone, CreditCard, Search, ChevronLeft, RefreshCw } from 'lucide-react';
import { RegistrationForm } from './components/RegistrationForm';
import { CheckStatus } from './components/CheckStatus';
import { TicketDownload } from './components/TicketDownload';
import { AdminDashboard } from './components/AdminDashboard';
import { KioskCheckin } from './components/KioskCheckin';
import QRCode from 'qrcode';
import { Toaster, toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  address: string;
  categories: { id: string; name: string; price: number; }[];
}

function MainApp() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [view, setView] = useState<'registration' | 'status'>('registration');
  const [regData, setRegData] = useState<{ fullName: string, email: string, category: string, orderId?: string, photoUrl?: string, eventTitle?: string } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(undefined);

  const [showStatusResult, setShowStatusResult] = useState(false);
  const [statusResultData, setStatusResultData] = useState<any>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => {
        setEvents(data);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));
  }, []);

  const activeEvent = events[currentEventIdx];

  const nextEvent = () => {
    setCurrentEventIdx((prev) => (prev + 1) % events.length);
  };

  const prevEvent = () => {
    setCurrentEventIdx((prev) => (prev - 1 + events.length) % events.length);
  };

  const openForm = (v: 'registration' | 'status') => {
    setView(v);
    setShowForm(true);
    setPendingOrderId(undefined);
  };

  const handleSuccess = async (data: { fullName: string, email: string, category: string, orderId?: string, photoUrl?: string }) => {
    const eventTitle = activeEvent?.title || 'MUSWIL IDI KALTIM 2026';
    const regDataWithTitle = { ...data, eventTitle };
    setRegData(regDataWithTitle);
    
    const qrText = JSON.stringify({
      id: data.orderId,
      name: data.fullName,
      cat: data.category,
      event: eventTitle
    });
    
    try {
      const url = await QRCode.toDataURL(qrText);
      setQrCodeUrl(url);
      setIsSuccess(true);
    } catch (err) {
      console.error('QR Gen error', err);
      setIsSuccess(true);
    }
  };

  const handleStatusFound = async (data: any) => {
    // Hide status check modal first
    setShowForm(false);
    
    if (data.transaction_status === 'settlement' || data.transaction_status === 'capture') {
      const eventTitle = data.eventTitle || data.custom_field3 || 'MUSWIL IDI KALTIM 2026';
      setRegData({
        fullName: data.custom_field1 || 'Peserta',
        email: '',
        category: data.custom_field2 || 'Peserta',
        orderId: data.order_id,
        photoUrl: data.photoUrl,
        eventTitle: eventTitle
      });

      const qrText = JSON.stringify({
        id: data.order_id,
        name: data.custom_field1 || 'Peserta',
        cat: data.custom_field2 || 'Peserta',
        event: eventTitle
      });

      try {
        const url = await QRCode.toDataURL(qrText);
        setQrCodeUrl(url);
        setIsSuccess(true);
        setView('registration');
        setShowForm(true);
      } catch (err) {
        setIsSuccess(true);
        setView('registration');
        setShowForm(true);
      }
    } else {
      // For pending or other status, we show a simplified status info modal
      setStatusResultData(data);
      setShowStatusResult(true);
    }
  };

  const handlePending = (data: { orderId: string }) => {
    toast.info('Status pembayaran masih pending. Cek status melalui menu Cek Status.', {
      duration: 8000,
    });
    setPendingOrderId(data.orderId);
    setView('status');
  };

  const resetModals = () => {
    setShowForm(false);
    setIsSuccess(false);
    setRegData(null);
    setQrCodeUrl('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <nav className="h-20 border-b border-slate-200 bg-white px-6 md:px-12 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
            <Stethoscope size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 uppercase">IDI Kaltim</span>
        </div>
        <div className="hidden md:flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          <a href="#" className="text-emerald-600 border-b-2 border-emerald-600 pb-1">Beranda</a>
          <button onClick={() => openForm('status')} className="hover:text-slate-800 transition-colors uppercase font-bold text-xs tracking-[0.2em]">Cek Status</button>
          <a href="#agenda" className="hover:text-slate-800 transition-colors">Agenda</a>
          <a href="#lokasi" className="hover:text-slate-800 transition-colors">Lokasi</a>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => openForm('status')}
            className="hidden sm:flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            <Search size={14} />
            Status
          </button>
          <button 
            onClick={() => openForm('registration')}
            className="bg-slate-900 text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95"
          >
            Daftar
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-12 flex flex-col gap-12 md:gap-20">
        {loadingEvents ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="animate-spin text-emerald-600" size={48} />
          </div>
        ) : events.length > 0 ? (
          <div className="relative">
            {events.length > 1 && (
              <div className="absolute top-1/2 -left-4 -right-4 -translate-y-1/2 flex justify-between z-10 pointer-events-none">
                <button 
                  onClick={prevEvent} 
                  className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all pointer-events-auto active:scale-90"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={nextEvent} 
                  className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all pointer-events-auto active:scale-90"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeEvent.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-8"
              >
                <div className="md:col-span-7">
                  <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase tracking-tighter mb-6">
                    Muktamar & Seminar 2026
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight mb-6 tracking-tight">
                    {activeEvent.title.split('IDI').map((part, i, arr) => (
                      <span key={i}>
                        {part}
                        {i < arr.length - 1 && <span className="text-emerald-600">IDI</span>}
                      </span>
                    ))}
                  </h1>
                  <p className="text-slate-500 text-lg leading-relaxed max-w-xl mb-10">
                    {activeEvent.description}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center border-l-4 border-emerald-600 pl-6">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Tanggal</p>
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <Calendar size={16} className="text-emerald-600" />
                        <span>{new Date(activeEvent.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block w-px h-10 bg-slate-200"></div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Lokasi</p>
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <MapPin size={16} className="text-emerald-600" />
                        <span>{activeEvent.location}, {activeEvent.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16"></div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Registrasi Peserta</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-8">
                    Silakan pilih kategori pendaftaran untuk agenda ini.
                  </p>
                  
                  <div className="space-y-3 mb-8">
                    {activeEvent.categories?.map((item, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center transition-all hover:border-emerald-200 hover:bg-emerald-50/30">
                        <span className="text-slate-600 text-xs font-bold uppercase tracking-tight">{item.name}</span>
                        <span className="text-xl font-black text-emerald-600">
                          {item.price === 0 ? 'Gratis' : `Rp ${item.price.toLocaleString('id-ID')}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={() => openForm('registration')}
                      className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      <span>Daftar Sekarang</span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            
            {events.length > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {events.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentEventIdx(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === currentEventIdx ? 'w-8 bg-emerald-600' : 'bg-slate-300'}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:col-span-12 text-center py-20"
            >
              <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase tracking-tighter mb-6">
                Ikatan Dokter Indonesia
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight mb-6 tracking-tight">
                Wilayah <span className="text-emerald-600">Kalimantan Timur</span>
              </h1>
              <p className="text-slate-500 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                Selamat datang di portal informasi dan layanan publik IDI Wilayah Kalimantan Timur. Belum ada event atau agenda yang dapat ditampilkan saat ini. Silakan cek kembali di lain waktu.
              </p>
              <div className="flex justify-center gap-4">
                <button className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-emerald-500 transition-all">
                  <Mail size={16} /> Hubungi Kami
                </button>
              </div>
            </motion.div>
          </section>
        )}

        <section className="grid md:grid-cols-3 gap-8">
          {[
            { id: 1, title: 'Pembayaran Aman', desc: 'Integrasi Midtrans untuk berbagai pilihan metode pembayaran digital tanpa ribet.', icon: CreditCard },
            { id: 2, title: 'Notifikasi Email', desc: 'Konfirmasi otomatis dan rincian acara lengkap langsung dikirim ke inbox email Anda.', icon: Mail },
            { id: 3, title: 'QR Ticket Instan', desc: 'Dapatkan Barcode unik otomatis setelah pembayaran berhasil untuk Check-in cepat.', icon: Stethoscope },
          ].map((step) => (
            <div key={step.id} className="bg-white p-8 rounded-2xl border border-slate-200 flex gap-6 group hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xl shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <step.icon size={24} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 mb-2 uppercase text-xs tracking-[0.1em]">{step.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{step.desc}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="h-auto md:h-20 bg-slate-900 text-slate-500 px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between text-[10px] uppercase font-black tracking-[0.2em] shrink-0 mt-auto">
        <div className="flex flex-col gap-2 mb-6 md:mb-0 text-center md:text-left">
          <span>© 2026 Musyawarah Wilayah IDI Kalimantan Timur</span>
          <span className="text-slate-600">Powered by <span className="text-emerald-500/80">Temudok Tech</span></span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-12">
          <button 
            onClick={() => navigate('/dashboard')}
            className="hover:text-emerald-500 transition-colors uppercase"
          >
            Dashboard Admin
          </button>
          <a href="#" className="hover:text-emerald-500 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-emerald-500 transition-colors">Terms of Service</a>
          <span className="text-emerald-500">Official Partner of IDI</span>
        </div>
      </footer>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={resetModals}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all z-10"
              >
                <X size={20} />
              </button>

              <div className="max-h-[85vh] overflow-y-auto">
                <div className="p-10 md:p-12">
                  {view === 'registration' ? (
                    !isSuccess ? (
                      <>
                        <div className="mb-10 text-center">
                          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">Form Pendaftaran</h2>
                          <div className="text-xs font-bold text-emerald-600 uppercase mb-4 tracking-widest">{activeEvent.title}</div>
                          <div className="w-12 h-1 bg-emerald-600 mx-auto rounded-full"></div>
                        </div>
                        <RegistrationForm 
                          onSuccess={handleSuccess}
                          onPending={handlePending}
                          selectedEventId={activeEvent.id}
                          selectedEvent={activeEvent}
                        />
                      </>
                    ) : (
                      regData && <TicketDownload data={regData} qrCodeUrl={qrCodeUrl} />
                    )
                  ) : (
                    <CheckStatus 
                      onBack={() => setShowForm(false)} 
                      initialOrderId={pendingOrderId} 
                      onStatusSuccess={handleStatusFound}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showStatusResult && statusResultData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 relative"
            >
              <button 
                onClick={() => setShowStatusResult(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  {statusResultData.transaction_status === 'pending' ? (
                    <div className="w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
                  ) : (
                    <X className="text-red-500" size={32} />
                  )}
                </div>

                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Status Pembayaran</h3>
                <p className="text-sm text-slate-400 mb-8 uppercase font-bold tracking-widest">{statusResultData.transaction_status}</p>

                <div className="space-y-4 text-left mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Order ID</span>
                    <span className="font-bold text-xs">{statusResultData.order_id}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama</span>
                    <span className="font-bold text-xs">{statusResultData.custom_field1}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</span>
                    <span className="font-black text-emerald-600">Rp {Number(statusResultData.gross_amount).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowStatusResult(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/dashboard" element={<AdminDashboardWrapper />} />
        <Route path="/kiosk" element={<KioskCheckinWrapper />} />
      </Routes>
    </Router>
  );
}

function AdminDashboardWrapper() {
  const navigate = useNavigate();
  return <AdminDashboard onBack={() => navigate('/')} />;
}

function KioskCheckinWrapper() {
  const navigate = useNavigate();
  return <KioskCheckin onBack={() => navigate('/')} />;
}

