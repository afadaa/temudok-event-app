import React, { useState, useEffect } from 'react';
import { Camera, BookOpen, ArrowLeft, Lock, LayoutGrid, CheckCircle2, User, Clock } from 'lucide-react';
import { QRScanner } from './QRScanner';
import { Guestbook } from './Guestbook';
import { toast } from 'sonner';

export const KioskCheckin = ({ onBack }: { onBack: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'guestbook'>('scanner');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/registrations', {
        headers: {
          'x-admin-username': username,
          'x-admin-password': password
        }
      });
      if (response.ok) {
        setIsAuthorized(true);
        toast.success('Kiosk Mode Aktif');
      } else {
        toast.error('Kredensial tidak valid');
      }
    } catch (error) {
      toast.error('Kesalahan koneksi');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
          
          <div className="flex flex-col items-center mb-10 relative z-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-6 group hover:scale-110 transition-transform">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Kiosk Check-in</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Akses Terbatas Administrator</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                placeholder="Admin username"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 mt-4 active:scale-95"
            >
              Aktifkan Kiosk
            </button>
          </form>

          <button 
            onClick={onBack}
            className="w-full mt-6 py-4 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} /> Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="h-24 bg-white border-b border-slate-100 flex items-center justify-between px-8 md:px-12 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
            <Camera size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Kiosk Kehadiran</h1>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              System Online • Muswil IDI Kaltim 2026
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'scanner' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LayoutGrid size={14} /> Scanner
            </button>
            <button 
              onClick={() => setActiveTab('guestbook')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'guestbook' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <BookOpen size={14} /> Guestbook
            </button>
          </div>

          <button 
            onClick={onBack}
            className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all"
            title="Keluar Kiosk"
          >
            <ArrowLeft size={24} />
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className={`${activeTab === 'scanner' ? 'flex-1 overflow-hidden' : 'flex-1 p-6 md:p-12 pb-24 md:pb-12 overflow-y-auto'}`}>
        <div className={`${activeTab === 'scanner' ? 'h-full' : 'max-w-6xl mx-auto h-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start'}`}>
          
          {/* Left Side: Active Content */}
          <div className={activeTab === 'scanner' ? 'h-full' : 'md:col-span-12'}>
            {activeTab === 'scanner' ? (
              <div className="h-full">
                <QRScanner username={username} password={password} fullScreen />
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                <Guestbook username={username} password={password} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-white border border-slate-100 rounded-3xl p-2 shadow-2xl flex gap-2 z-50">
        <button 
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
          }`}
        >
          <Camera size={18} /> Scan
        </button>
        <button 
          onClick={() => setActiveTab('guestbook')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'guestbook' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
          }`}
        >
          <BookOpen size={18} /> Guests
        </button>
      </div>
    </div>
  );
};
