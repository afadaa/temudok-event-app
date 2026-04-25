import React, { useEffect, useState } from 'react';
import { Users, Mail, Phone, Calendar, Search, ArrowLeft, Download, RefreshCw, BarChart, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Registrant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  category: string;
  status: string;
  amount: number;
  createdAt: string;
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRegistrants = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/registrations', {
        headers: { 
          'x-admin-username': username,
          'x-admin-password': password
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRegistrants(data);
        setIsAuthorized(true);
        toast.success('Data registrasi berhasil dimuat');
      } else {
        toast.error('Gagal memuat data. Username atau password salah.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistrants = registrants.filter(r => 
    r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: registrants.length,
    paid: registrants.filter(r => r.status === 'settlement' || r.status === 'capture').length,
    pending: registrants.filter(r => r.status === 'pending').length,
    revenue: registrants.filter(r => r.status === 'settlement' || r.status === 'capture').reduce((acc, curr) => acc + curr.amount, 0)
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="p-10 w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center space-y-8 relative overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-50 blur-3xl rounded-full opacity-50 -z-10" />
          
          <div className="w-20 h-20 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-3xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-slate-900/20 rotate-3">
            <Users size={36} className="-rotate-3" />
          </div>
          
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">Admin Panel</h2>
            <p className="text-slate-500 text-sm font-medium">Masukan username dan kata sandi administrator untuk mengakses data pendaftaran.</p>
          </div>

          <div className="space-y-4 pt-4">
            <input 
              type="text" 
              placeholder="Username Admin"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white rounded-2xl outline-none transition-all text-center font-bold text-slate-800"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRegistrants()}
            />
            <input 
              type="password" 
              placeholder="••••••••"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white rounded-2xl outline-none transition-all text-center tracking-[0.3em] font-bold text-slate-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRegistrants()}
            />
            <button 
              onClick={fetchRegistrants}
              disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Masuk Panel'}
            </button>
            <button onClick={onBack} className="block w-full text-slate-400 text-[10px] uppercase font-black tracking-widest hover:text-slate-900 transition-colors pt-4">
              ← Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest mb-4 transition-all">
            <ArrowLeft size={14} /> Kembali
          </button>
          <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">Dashboard Admin</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Status Real-time Pendaftaran Muswil IDI Kaltim 2026</p>
        </div>
        <button 
          onClick={fetchRegistrants}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-white border-2 border-slate-100 px-6 py-4 md:py-3 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pendaftar', value: stats.total, icon: Users, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
          { label: 'Lunas / Berhasil', value: stats.paid, icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Menunggu Bayar', value: stats.pending, icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
          { label: 'Total Pendapatan', value: `Rp ${stats.revenue.toLocaleString()}`, icon: BarChart, bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' }
        ].map((stat, i) => (
          <div key={i} className={`bg-white p-6 rounded-[2rem] border ${stat.border} shadow-sm overflow-hidden relative`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${stat.bg} opacity-50 blur-2xl`}></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className={`${stat.bg} ${stat.text} p-4 rounded-2xl`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                {loading ? (
                  <div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center bg-white">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center w-full max-w-md focus-within:border-slate-300 focus-within:bg-white transition-all">
            <Search size={18} className="text-slate-400 mr-3" />
            <input 
              type="text" 
              placeholder="Cari nama, email, atau ID..."
              className="bg-transparent border-none outline-none w-full text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="px-8 py-5 whitespace-nowrap">Pendaftar</th>
                <th className="px-8 py-5 whitespace-nowrap">Kategori</th>
                <th className="px-8 py-5 whitespace-nowrap">Waktu</th>
                <th className="px-8 py-5 whitespace-nowrap">Status</th>
                <th className="px-8 py-5 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-8 py-5">
                      <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse"></div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="h-6 w-6 bg-slate-200 rounded animate-pulse ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredRegistrants.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-5">
                      <div className="font-bold text-slate-800 text-sm">{reg.fullName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                        <Mail size={10} /> {reg.email}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${reg.category === 'guest' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {reg.category === 'guest' ? 'Tamu/Undangan' : 'Utusan'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-slate-600 text-xs font-medium">
                        {new Date(reg.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                         {new Date(reg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
                         reg.status === 'settlement' || reg.status === 'capture' ? 'text-emerald-600' : 
                         reg.status === 'pending' ? 'text-amber-600' : 'text-slate-400'
                       }`}>
                         <div className={`w-1.5 h-1.5 rounded-full ${
                            reg.status === 'settlement' || reg.status === 'capture' ? 'bg-emerald-500 animate-pulse' : 
                            reg.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
                         }`}></div>
                         {reg.status}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-slate-400 hover:text-slate-900 transition-all">
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!loading && filteredRegistrants.length === 0 && (
            <div className="py-20 text-center text-slate-400 text-sm font-medium">
              Tidak ada data pendaftaran ditemukan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
