import React, { useEffect, useState } from 'react';
import { BookOpen, MapPin, Clock, User, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export const Guestbook = () => {
  const [guests, setGuests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGuests = async () => {
    try {
      const response = await fetch('/api/admin/guestbook');
      if (response.ok) {
        const data = await response.json();
        setGuests(data);
      }
    } catch (error) {
      console.error("Failed to fetch guestbook:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
    const interval = setInterval(fetchGuests, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <BookOpen className="text-slate-200 animate-pulse mb-4" size={48} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Memuat Buku Tamu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Buku Tamu Digital</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{guests.length} Peserta Terdeteksi Hadir</p>
            </div>
          </div>
          <button 
            onClick={fetchGuests}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all text-slate-400 hover:text-slate-600"
          >
            <Clock size={16} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Peserta</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Kategori / Cabang</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Waktu Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada peserta yang hadir</p>
                  </td>
                </tr>
              ) : (
                guests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                          {guest.photoUrl ? (
                            <img src={guest.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User size={14} />
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-900 uppercase leading-tight line-clamp-1">{guest.fullName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{guest.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
                          {guest.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                          <MapPin size={10} className="text-slate-300" /> {guest.branchId || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-300" />
                        <div>
                          <p className="text-[10px] font-black text-slate-700">
                            {format(new Date(guest.checkedInAt), 'HH:mm:ss', { locale: id })}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            {format(new Date(guest.checkedInAt), 'dd MMM yyyy', { locale: id })}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
