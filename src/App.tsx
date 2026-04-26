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
    <div className="min-h-screen bg-idi-dark text-idi-cream font-sans flex flex-col bg-ornament">
      <nav className="h-24 border-b border-idi-gold/20 bg-idi-dark/80 backdrop-blur-md px-6 md:px-12 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <div className="relative group">
            <img
              src="/IDI.png"
              alt="IDI Logo"
              className="w-14 h-14 bg-white rounded-full shadow-lg object-contain border-2 border-idi-red p-1 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500"
            />
            <div className="absolute -inset-1 border border-idi-gold/30 rounded-full animate-pulse group-hover:animate-none group-hover:border-idi-accent transition-all duration-500"></div>
            </div>
          <div className="flex flex-col">
            <span className="font-serif-sc text-sm tracking-widest text-idi-gold leading-tight">Ikatan Dokter Indonesia</span>
            <span className="font-serif text-lg font-bold text-white tracking-tight leading-tight">Wilayah Kalimantan Timur</span>
          </div>
        </div>
        <div className="hidden lg:flex gap-10 text-[10px] font-black text-idi-cream/60 uppercase tracking-[0.3em]">
          <a href="#" className="text-idi-accent border-b border-idi-accent pb-1 uppercase">Beranda</a>
          <button onClick={() => openForm('status')} className="hover:text-idi-accent transition-colors uppercase">Cek Status</button>
          <a href="#agenda" className="hover:text-idi-accent transition-colors uppercase">Agenda</a>
          <a href="#lokasi" className="hover:text-idi-accent transition-colors uppercase">Lokasi</a>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => openForm('registration')}
            className="bg-idi-gold hover:bg-idi-accent text-idi-dark px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-idi-gold/20"
          >
            Pendaftaran
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full flex flex-col">
        {/* Curved Hero Wrapper */}
        <div className="relative overflow-hidden bg-idi-cream py-20 px-6 md:px-12 rounded-b-[4rem] md:rounded-b-[8rem] shadow-2xl mb-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            <div className="lg:col-span-12 text-center mb-12">
               <motion.div
                 initial={{ opacity: 0, y: -20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="inline-flex items-center gap-4 mb-6"
               >
                  <div className="h-px w-12 bg-idi-bronze"></div>
                  <span className="font-serif-sc text-idi-bronze tracking-[0.4em] text-xs font-bold uppercase">Musyawarah Wilayah</span>
                  <div className="h-px w-12 bg-idi-bronze"></div>
               </motion.div>
               <motion.h1 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.2 }}
                 className="text-4xl md:text-7xl font-serif font-black text-idi-dark leading-[0.9] tracking-tighter mb-8"
               >
                 Ikatan Dokter Indonesia<br/>
                 <span className="text-idi-bronze italic">Wilayah Kalimantan Timur</span>
               </motion.h1>
               
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 0.4 }}
                 className="flex flex-wrap justify-center gap-6 mb-12"
               >
                 <div className="flex items-center gap-3 bg-idi-dark text-idi-cream px-8 py-4 rounded-full shadow-xl">
                    <Calendar className="text-idi-gold" size={20} />
                    <span className="font-serif text-lg font-bold">
                      {activeEvent
                      ? `${new Date(activeEvent.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date(activeEvent.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : ''}
                    </span>
                 </div>
                 <div className="flex items-center gap-3 bg-white border-2 border-idi-gold/30 text-idi-dark px-8 py-4 rounded-full shadow-xl">
                  <MapPin className="text-idi-bronze" size={20} />
                  <span className="font-serif text-lg font-bold">
                    {activeEvent ? activeEvent.location : ''}
                  </span>
                 </div>
               </motion.div>
            </div>
            
            {loadingEvents ? (
              <div className="lg:col-span-12 flex justify-center py-20">
                <RefreshCw className="animate-spin text-idi-bronze" size={48} />
              </div>
            ) : events.length > 0 ? (
              <div className="lg:col-span-12">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeEvent.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-12"
                  >
                    <div className="bg-idi-dark text-idi-cream p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-idi-gold/10 rounded-full translate-x-8 -translate-y-8"></div>
                      <div className="relative z-10">
                        <h4 className="font-serif text-3xl font-bold mb-6 text-idi-gold">{activeEvent.title}</h4>
                        <p className="text-idi-cream/70 text-lg leading-relaxed mb-10 font-medium">
                          {activeEvent.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                       <h3 className="font-serif text-4xl font-black text-idi-dark mb-6 leading-tight">Berkarir, Berkolaborasi, & Bersinergi</h3>
                       <p className="text-idi-dark/60 text-lg mb-10 leading-relaxed font-medium">
                         Silakan mendaftar untuk menjadi bagian dari Musyawarah Wilayah IDI Kaltim 2026.
                       </p>
                       <button 
                         onClick={() => openForm('registration')}
                         className="bg-idi-dark hover:bg-idi-bronze text-white py-6 px-12 rounded-2xl font-black text-sm uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 group"
                       >
                         <span>Daftar Sekarang</span>
                         <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform" />
                       </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        </div>

        {/* Features / Info Section */}
        <section className="max-w-7xl mx-auto w-full p-6 md:p-12 grid md:grid-cols-3 gap-8">
          {[
            { id: 1, title: 'Pembayaran Digital', desc: 'Sistem pembayaran terintegrasi Midtrans yang aman dan praktis.', icon: CreditCard },
            { id: 2, title: 'E-Ticket QR', desc: 'Tiket digital dengan QR code unik untuk proses check-in yang efisien.', icon: Stethoscope },
            { id: 3, title: 'Agenda Terjadwal', desc: 'Akses agenda lengkap dan materi seminar langsung dari portal.', icon: Calendar },
          ].map((feature) => (
            <motion.div 
              whileHover={{ y: -10 }}
              key={feature.id} 
              className="bg-idi-cream/5 border border-idi-gold/20 p-8 rounded-[2.5rem] flex flex-col gap-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-idi-gold text-idi-dark flex items-center justify-center shadow-lg shadow-idi-gold/20">
                <feature.icon size={28} />
              </div>
              <div>
                <h4 className="font-serif text-xl font-black text-idi-gold mb-3 tracking-tight">{feature.title}</h4>
                <p className="text-idi-cream/60 leading-relaxed text-xs font-medium">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </section>
      </main>

      <footer className="bg-idi-dark border-t border-idi-gold/10 py-12 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left mt-auto">
        <div className="flex flex-col gap-4">
           <div className="font-serif text-2xl font-bold text-idi-gold tracking-tight">MUSWIL IDI KALTIM 2026</div>
           <p className="text-idi-cream/40 text-[10px] font-black uppercase tracking-[0.3em] max-w-sm">
             IDI berkarya, berkolaborasi, dan bersinergi untuk kesehatan bangsa
           </p>
        </div>
        
        <div className="flex flex-col gap-2 items-center md:items-end">
          <div className="text-[10px] font-black text-idi-cream/20 uppercase tracking-[0.2em]">
            © 2026 Ikatan Dokter Indonesia Wilayah Kalimantan Timur
          </div>
          <div className="text-[9px] font-bold text-idi-cream/40 uppercase tracking-widest">
            Made with <span className="text-idi-gold">TemudokTech</span>
          </div>
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
                          <h2 className="text-2xl font-black font-serif uppercase tracking-tight text-idi-dark mb-2">Form Pendaftaran</h2>
                          <div className="text-[10px] font-black text-idi-gold uppercase mb-4 tracking-[0.4em]">{activeEvent.title}</div>
                          <div className="w-12 h-1 bg-idi-gold mx-auto rounded-full"></div>
                        </div>
                        <RegistrationForm 
                          onSuccess={handleSuccess}
                          onPending={handlePending}
                          selectedEventId={activeEvent.id}
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
                    <span className="text-[10px] font-black uppercase text-idi-gold tracking-[0.2em]">Order ID</span>
                    <span className="font-bold text-xs text-idi-dark">{statusResultData.order_id}</span>
                  </div>
                  <div className="bg-idi-cream/10 p-4 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-idi-gold tracking-[0.2em]">Nama</span>
                    <span className="font-bold text-xs text-idi-dark">{statusResultData.custom_field1}</span>
                  </div>
                  <div className="bg-idi-cream/10 p-4 rounded-2xl flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-idi-gold tracking-[0.2em]">Total</span>
                    <span className="font-black text-idi-bronze">Rp {Number(statusResultData.gross_amount).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowStatusResult(false)}
                  className="w-full bg-idi-dark text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.4em] hover:bg-idi-bronze transition-all"
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

