import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock, Download, MapPin, RefreshCw, RotateCcw, Search, User, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface GuestbookProps {
  username?: string;
  password?: string;
}

const normalize = (value: unknown) => String(value || '').trim();

const compactKomisiLabel = (komisi: unknown) => {
  const text = normalize(komisi).toUpperCase();
  const match = text.match(/KOMISI\s+([A-Z])/);
  return match ? `KOMISI ${match[1]}` : text;
};

export const Guestbook = ({ username, password }: GuestbookProps) => {
  const [guests, setGuests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterKomisi, setFilterKomisi] = useState('all');
  const [filterDate, setFilterDate] = useState('all');

  const fetchGuests = async () => {
    try {
      const response = await fetch('/api/admin/guestbook', {
        headers: {
          ...(username && password ? {
            'x-admin-username': username,
            'x-admin-password': password,
          } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGuests(data);
        setErrorMessage('');
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data.error || 'Gagal mengambil data buku tamu');
      }
    } catch (error) {
      console.error('Failed to fetch guestbook:', error);
      setErrorMessage('Gagal mengambil data buku tamu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
    const interval = setInterval(fetchGuests, 10000);
    return () => clearInterval(interval);
  }, [username, password]);

  const categories = useMemo(() => (
    Array.from(new Set(guests.map(g => normalize(g.category)).filter(Boolean))).sort()
  ), [guests]);

  const branches = useMemo(() => (
    Array.from(new Set(guests.map(g => normalize(g.branchId)).filter(Boolean))).sort()
  ), [guests]);

  const komisies = useMemo(() => (
    Array.from(new Set(guests.map(g => normalize(g.komisi)).filter(Boolean))).sort()
  ), [guests]);

  const attendanceDates = useMemo(() => (
    Array.from(new Set(guests
      .map(g => g.checkedInAt ? format(new Date(g.checkedInAt), 'yyyy-MM-dd') : '')
      .filter(Boolean)
    )).sort().reverse()
  ), [guests]);

  const filteredGuests = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return guests.filter(guest => {
      const checkedDate = guest.checkedInAt ? format(new Date(guest.checkedInAt), 'yyyy-MM-dd') : '';
      const matchSearch = !search || [
        guest.fullName,
        guest.email,
        guest.phone,
        guest.id,
        guest.branchId,
        guest.category,
        guest.komisi,
      ].some(value => normalize(value).toLowerCase().includes(search));
      const matchCategory = filterCategory === 'all' || normalize(guest.category) === filterCategory;
      const matchBranch = filterBranch === 'all' || normalize(guest.branchId) === filterBranch;
      const matchKomisi = filterKomisi === 'all' || normalize(guest.komisi) === filterKomisi;
      const matchDate = filterDate === 'all' || checkedDate === filterDate;

      return matchSearch && matchCategory && matchBranch && matchKomisi && matchDate;
    });
  }, [guests, searchTerm, filterCategory, filterBranch, filterKomisi, filterDate]);

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      const rows = filteredGuests.map((guest, index) => ({
        No: index + 1,
        'ID Pesanan': guest.id,
        'Nama Lengkap': guest.fullName || '-',
        Email: guest.email || '-',
        WhatsApp: guest.phone || '-',
        Kategori: guest.category || '-',
        'Cabang IDI': guest.branchId || '-',
        'Sidang Komisi': guest.komisi || '-',
        'Waktu Check-in': guest.checkedInAt ? format(new Date(guest.checkedInAt), 'dd/MM/yyyy HH:mm:ss', { locale: id }) : '-',
        Status: guest.status || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Buku Tamu');
      XLSX.writeFile(workbook, `BUKU-TAMU-${format(new Date(), 'yyyyMMdd-HHmmss')}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const cancelCheckIn = async (guest: any) => {
    const ok = window.confirm(`Batalkan check-in untuk ${guest.fullName || guest.id}? Peserta ini bisa check-in ulang setelah dibatalkan.`);
    if (!ok) return;

    setCancelLoadingId(guest.id);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin/cancel-check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(username && password ? {
            'x-admin-username': username,
            'x-admin-password': password,
          } : {}),
        },
        body: JSON.stringify({ orderId: guest.id }),
      });

      if (response.ok) {
        setGuests(current => current.filter(item => item.id !== guest.id));
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data.error || 'Gagal membatalkan check-in');
      }
    } catch (error) {
      console.error('Failed to cancel check-in:', error);
      setErrorMessage('Gagal membatalkan check-in');
    } finally {
      setCancelLoadingId(null);
    }
  };

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
        <div className="p-6 border-b border-slate-50 flex flex-col gap-4 bg-slate-50/50 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Buku Tamu Digital</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {filteredGuests.length} dari {guests.length} peserta hadir
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchGuests}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={exportExcel}
              disabled={isExporting || filteredGuests.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Export Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="flex items-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 focus-within:border-emerald-500">
            <Search size={16} className="mr-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none"
            />
          </div>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-emerald-500">
            <option value="all">Semua Kategori</option>
            {categories.map(category => <option key={category} value={category}>{category}</option>)}
          </select>

          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-emerald-500">
            <option value="all">Semua Cabang</option>
            {branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}
          </select>

          <select value={filterKomisi} onChange={(e) => setFilterKomisi(e.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-emerald-500">
            <option value="all">Semua Komisi</option>
            {komisies.map(komisi => <option key={komisi} value={komisi}>{compactKomisiLabel(komisi)}</option>)}
          </select>

          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-emerald-500">
            <option value="all">Semua Tanggal</option>
            {attendanceDates.map(date => <option key={date} value={date}>{format(new Date(date), 'dd MMM yyyy', { locale: id })}</option>)}
          </select>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Peserta</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Kategori / Cabang</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Sidang</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Waktu Hadir</th>
                <th className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada peserta yang sesuai filter</p>
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
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
                          {guest.category || '-'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                          <MapPin size={10} className="text-slate-300" /> {guest.branchId || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-100 w-fit">
                        {compactKomisiLabel(guest.komisi) || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-300" />
                        <div>
                          <p className="text-[10px] font-black text-slate-700">
                            {guest.checkedInAt ? format(new Date(guest.checkedInAt), 'HH:mm:ss', { locale: id }) : '-'}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            {guest.checkedInAt ? format(new Date(guest.checkedInAt), 'dd MMM yyyy', { locale: id }) : '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => cancelCheckIn(guest)}
                        disabled={cancelLoadingId === guest.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-amber-700 transition-all hover:border-amber-200 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Batalkan check-in agar peserta bisa check-in ulang"
                      >
                        {cancelLoadingId === guest.id ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Batal Check-in
                      </button>
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
