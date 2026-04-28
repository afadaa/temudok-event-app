import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Stethoscope, Calendar, MapPin, Users, CheckCircle2, ChevronRight, X, Mail, Phone, CreditCard, Search, ChevronLeft, RefreshCw, Menu, X as XIcon } from 'lucide-react';
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

// Decorative components for Kalimantan feel
const DayakShield = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 200" className={className} fill="currentColor">
    <path d="M50 0 L90 30 L90 170 L50 200 L100 170 L10 170 L10 30 Z" opacity="0.1" />
    <path d="M50 10 L80 35 L80 165 L50 190 L20 165 L20 35 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M50 30 C30 50 20 80 50 110 C80 80 70 50 50 30" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M50 170 C30 150 20 120 50 90 C80 120 70 150 50 170" fill="none" stroke="currentColor" strokeWidth="1" />
    <circle cx="50" cy="100" r="5" />
  </svg>
);

const EnggangIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M20 50 C20 30 40 10 70 10 C80 10 90 20 90 30 C90 40 80 40 70 40 C60 40 50 50 50 60 C50 70 60 80 80 80 L80 90 C50 90 20 70 20 50" />
    <path d="M70 25 A5 5 0 1 0 70 26" fill="white" />
  </svg>
);

const BatikPattern = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor" opacity="0.05">
    <path d="M0 50 Q25 0 50 50 T100 50 T50 50 T0 50" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M50 0 Q100 25 50 50 T50 100 T50 50 T50 0" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const OrangutanIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M50 10 C30 10 10 30 10 50 C10 70 30 90 50 90 C70 90 90 70 90 50 C90 30 70 10 50 10 M50 20 C65 20 75 30 75 45 C75 60 65 70 50 70 C35 70 25 60 25 45 C25 30 35 20 50 20" />
    <circle cx="40" cy="40" r="3" fill="white" />
    <circle cx="60" cy="40" r="3" fill="white" />
    <path d="M40 55 Q50 60 60 55" fill="none" stroke="white" strokeWidth="2" />
  </svg>
);

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
  const [showWelcome, setShowWelcome] = useState(true);
  const [showAgenda, setShowAgenda] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-idi-dark text-idi-cream font-sans flex flex-col bg-ornament relative overflow-hidden">
      {/* Decorative Floating Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] left-[5%] text-idi-gold opacity-20"
        >
          <DayakShield className="w-32 h-64" />
        </motion.div>
        
        <motion.div 
          animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[20%] right-[3%] text-idi-gold opacity-20"
        >
          <DayakShield className="w-40 h-80" />
        </motion.div>

        <motion.div 
          animate={{ x: [0, 20, 0], y: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] right-[10%] text-idi-gold opacity-10"
        >
          <EnggangIcon className="w-48 h-48" />
        </motion.div>

        <motion.div 
          animate={{ y: [0, -40, 0], x: [0, 10, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-[15%] text-idi-gold opacity-5"
        >
          <OrangutanIcon className="w-32 h-32" />
        </motion.div>

        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <BatikPattern className="absolute top-20 left-1/4 w-64 h-64" />
          <BatikPattern className="absolute bottom-40 right-1/4 w-96 h-96" />
        </div>
      </div>

      <nav className="h-24 border-b border-idi-gold/20 bg-idi-dark/80 backdrop-blur-md px-6 md:px-12 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <div className="relative group">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-500 overflow-hidden">
              <img
              src="/IDI.png"
              alt="IDI Logo"
              className="w-10 h-10 object-contain"
              draggable={false}
              />
            </div>
            <div className="absolute -inset-1 border border-idi-gold/30 rounded-full animate-pulse"></div>
            </div>
          <div className="flex flex-col">
            <span className="font-serif-sc text-sm tracking-widest text-idi-gold leading-tight">Ikatan Dokter Indonesia</span>
            <span className="font-serif text-lg font-bold text-white tracking-tight leading-tight">Wilayah Kalimantan Timur</span>
          </div>
        </div>
        <div className="hidden lg:flex gap-10 text-[10px] font-black text-idi-cream/60 uppercase tracking-[0.3em]">
          <a href="#" className="text-idi-accent border-b border-idi-accent pb-1 uppercase">Beranda</a>
          <button onClick={() => openForm('status')} className="hover:text-idi-accent transition-colors uppercase">Cek Status</button>
          <button onClick={() => setShowAgenda(true)} className="hover:text-idi-accent transition-colors uppercase">Agenda</button>
          <a href="https://maps.app.goo.gl/3JXD2LiUgcdiua7K6" target="_blank" rel="noreferrer" className="hover:text-idi-accent transition-colors uppercase">Lokasi</a>
        </div>
        {/* Mobile Hamburger */}
        <div className="lg:hidden">
          <button onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" className="p-2 rounded-md bg-idi-dark/60">
            <Menu size={20} />
          </button>
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

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-60 bg-black/50 lg:hidden">
            <div className="absolute top-0 right-0 w-full max-w-sm h-full bg-idi-dark p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img src="/IDI.png" alt="IDI" className="w-10 h-10" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-idi-gold">Ikatan Dokter Indonesia</span>
                    <span className="text-sm font-black text-white">Wilayah Kaltim</span>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="p-2 rounded-md bg-slate-700 text-white">
                  <XIcon size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-4 text-sm font-black uppercase tracking-wider">
                <a href="#" onClick={() => setMobileMenuOpen(false)} className="text-idi-accent">Beranda</a>
                <button onClick={() => { setMobileMenuOpen(false); openForm('status'); }} className="text-left">Cek Status</button>
                <button onClick={() => { setMobileMenuOpen(false); setShowAgenda(true); }} className="text-left">Agenda</button>
                <a href="https://maps.app.goo.gl/3JXD2LiUgcdiua7K6" target="_blank" rel="noreferrer" onClick={() => setMobileMenuOpen(false)} className="text-left">Lokasi</a>
                <button onClick={() => { setMobileMenuOpen(false); openForm('registration'); }} className="mt-4 bg-idi-gold text-idi-dark px-4 py-3 rounded-full font-black">Pendaftaran</button>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                 {activeEvent && (
                   <>
                   <div className="flex items-center gap-3 bg-idi-dark text-idi-cream px-8 py-4 rounded-full shadow-xl">
                    <Calendar className="text-idi-gold" size={20} />
                    <span className="font-serif text-lg font-bold">
                      {new Date(activeEvent.startDate).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                      })}
                      {activeEvent.endDate && activeEvent.endDate !== activeEvent.startDate
                      ? ` - ${new Date(activeEvent.endDate).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                        })}`
                      : ''}
                    </span>
                   </div>
                   <div className="flex items-center gap-3 bg-white border-2 border-idi-gold/30 text-idi-dark px-8 py-4 rounded-full shadow-xl">
                    <MapPin className="text-idi-bronze" size={20} />
                    <span className="font-serif text-lg font-bold">
                      {activeEvent.location}
                    </span>
                   </div>
                   </>
                 )}
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
                      <div className="absolute inset-0 opacity-10 bg-ornament pointer-events-none"></div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-idi-gold/10 rounded-full translate-x-8 -translate-y-8"></div>
                      <div className="relative z-10">
                        <h4 className="font-serif text-3xl font-bold mb-6 text-idi-gold">{activeEvent.title}</h4>
                        <p className="text-idi-cream/70 text-lg leading-relaxed mb-10 font-medium">
                          {activeEvent.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                       <h3 className="font-serif text-4xl font-black text-idi-dark mb-6 leading-tight">Berkarya, Berkolaborasi, & Bersinergi</h3>
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
      </main>

      <footer className="bg-idi-dark border-t border-idi-gold/10 py-12 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left mt-auto">
        <div className="flex flex-col gap-4">
           <div className="font-serif text-2xl font-bold text-idi-gold tracking-tight">MUSWIL IDI KALTIM 2026</div>
           <p className="text-idi-cream/40 text-[10px] font-black uppercase tracking-[0.3em] max-w-sm">
             IDI berkarya, berkolaborasi, dan bersinergi untuk kesehatan bangsa
           </p>
        </div>
        
        <div className="flex flex-col gap-6 items-center md:items-end">
          <div className="text-[10px] font-black text-idi-cream/20 uppercase tracking-[0.2em]">
            © 2026 Ikatan Dokter Indonesia Wilayah Kalimantan Timur
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
                {/* stray buttons removed (close buttons belong to their own modals) */}

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
        {/* Agenda modal with two images */}
        <AnimatePresence>
          {showAgenda && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-[60vw] max-w-[900px] rounded-3xl shadow-2xl p-4 relative mx-auto">
                <button onClick={() => setShowAgenda(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900"><X size={20} /></button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <img src="/agenda1.png" alt="Agenda 1" className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
                  <img src="/agenda2.png" alt="Agenda 2" className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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