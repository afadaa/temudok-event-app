import React, { useEffect, useState } from 'react';
import { Users, Mail, Phone, Calendar, Search, ArrowLeft, Download, RefreshCw, BarChart, CheckCircle2, Clock, MapPin, Tag, Plus, Trash2, Edit, FileDown, Camera, BookOpen, LayoutGrid, X, CheckSquare, Square, Menu, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/material_green.css';
import { QRScanner } from './QRScanner';
import { Guestbook } from './Guestbook';

interface Registrant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  npa?: string;
  category: string;
  categoryId: string;
  branchId: string;
  status: string;
  amount: number;
  createdAt: string;
  paymentPhoto?: string;
  photoUrl?: string;
}

interface Branch { id: string; name: string; }
interface Category { id: string; name: string; price: number; }
interface Event { 
  id: string; 
  title: string; 
  description: string; 
  startDate: string; 
  endDate: string; 
  location: string; 
  address: string; 
  isActive: boolean; 
  categories: { id: string; name: string; price: number; }[];
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'registrations' | 'branches' | 'categories' | 'scanner' | 'guestbook' | 'events'>('registrations');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState('');
  const [emailActionLoadingId, setEmailActionLoadingId] = useState<string | null>(null);
  const [paymentUploadLoadingId, setPaymentUploadLoadingId] = useState<string | null>(null);

  // Modal State
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryPrice, setCategoryPrice] = useState<number>(0);

  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isOneDay, setIsOneDay] = useState(false);
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    address: '',
    isActive: true,
    categories: [] as { id: string; name: string; price: number; }[]
  });

  const [eventSearch, setEventSearch] = useState('');
  const [eventSort, setEventSort] = useState<'date-desc' | 'date-asc' | 'status-active' | 'status-inactive'>('date-desc');
  const [branchSearch, setBranchSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');

  const authHeaders = { 'x-admin-username': username, 'x-admin-password': password };

  const fetchRegistrants = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/registrations', { headers: authHeaders });
      if (response.ok) {
        setRegistrants(await response.json());
        setIsAuthorized(true);
      } else {
        toast.error('Gagal memuat data.');
      }
    } catch (error) { toast.error('Terjadi kesalahan jaringan.'); }
    finally { setLoading(false); }
  };

  const fetchBranchesAndCategories = async () => {
    try {
      const [resB, resC, resE] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/categories'),
        fetch('/api/admin/events', { headers: authHeaders })
      ]);
      if (resB.ok) setBranches(await resB.json());
      if (resC.ok) setCategories(await resC.json());
      if (resE.ok) setEvents(await resE.json());
    } catch(e) {}
  };

  useEffect(() => {
    if (isAuthorized) {
      if (activeTab === 'events' || activeTab === 'branches' || activeTab === 'categories') {
        fetchBranchesAndCategories();
      }
      if (activeTab === 'registrations') {
        fetchRegistrants();
      }
    }
  }, [activeTab, isAuthorized]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/registrations', { headers: authHeaders });
      if (response.ok) {
        setRegistrants(await response.json());
        setIsAuthorized(true);
        await fetchBranchesAndCategories();
      } else {
        toast.error('Gagal memuat data. Periksa username dan password.');
      }
    } catch (error) { 
      toast.error('Terjadi kesalahan jaringan.'); 
    } finally { 
      setLoading(false); 
    }
  };

  // Branch Handlers
  const handleAddBranch = () => {
    setEditingBranch(null);
    setBranchName('');
    setShowBranchModal(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
    setShowBranchModal(true);
  };

  const saveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    setLoading(true);
    try {
      const url = editingBranch ? `/api/admin/branches/${editingBranch.id}` : '/api/admin/branches';
      const method = editingBranch ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: branchName })
      });
      if (res.ok) { 
        toast.success(editingBranch ? 'Cabang diperbarui' : 'Cabang ditambahkan'); 
        setShowBranchModal(false);
        fetchBranchesAndCategories(); 
      }
      else toast.error('Gagal menyimpan');
    } catch(e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const deleteBranch = async (id: string) => {
    if (!window.confirm("Hapus cabang ini?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) { toast.success('Terhapus'); fetchBranchesAndCategories(); }
    } catch(e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  // Category Handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryPrice(0);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryPrice(cat.price);
    setShowCategoryModal(true);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setLoading(true);
    try {
      const url = editingCategory ? `/api/admin/categories/${editingCategory.id}` : '/api/admin/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName, price: Number(categoryPrice) })
      });
      if (res.ok) { 
        toast.success(editingCategory ? 'Kategori diperbarui' : 'Kategori ditambahkan'); 
        setShowCategoryModal(false);
        fetchBranchesAndCategories(); 
      }
      else toast.error('Gagal menyimpan');
    } catch(e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm("Hapus kategori ini?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) { toast.success('Terhapus'); fetchBranchesAndCategories(); }
    } catch(e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  // Event Handlers
  const handleAddEvent = () => {
    setEditingEvent(null);
    setIsOneDay(false);
    setEventData({
      title: '',
      description: '',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      location: '',
      address: '',
      isActive: true,
      categories: categories.map(c => ({ id: c.id, name: c.name, price: c.price }))
    });
    setShowEventModal(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    const startStr = event.startDate || new Date().toISOString();
    const endStr = event.endDate || new Date().toISOString();
    setIsOneDay(event.startDate?.split('T')[0] === event.endDate?.split('T')[0]);
    setEventData({
      title: event.title,
      description: event.description || '',
      startDate: startStr,
      endDate: endStr,
      location: event.location || '',
      address: event.address || '',
      isActive: event.isActive,
      categories: event.categories || []
    });
    setShowEventModal(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : '/api/admin/events';
      const method = editingEvent ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      if (res.ok) { 
        toast.success(editingEvent ? 'Event diperbarui' : 'Event ditambahkan'); 
        setShowEventModal(false);
        setEditingEvent(null);
        await fetchBranchesAndCategories(); 
      }
      else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Gagal menyimpan');
      }
    } catch(e) { 
      console.error('Save event error:', e);
      toast.error('Gagal menyimpan event'); 
    }
    finally { setLoading(false); }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteEvent = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { 
        method: 'DELETE', 
        headers: authHeaders 
      });
      
      if (res.ok) { 
        toast.success('Event berhasil dihapus'); 
        setDeleteConfirmId(null);
        await fetchBranchesAndCategories(); 
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(`Gagal menghapus: ${data.error || res.statusText}`);
      }
    } catch(e) { 
      toast.error('Terjadi kesalahan saat menghapus event'); 
    } finally { 
      setLoading(false); 
    }
  };

  const filteredRegistrants = registrants.filter(r => {
    const matchSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || r.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategory === 'all' || r.categoryId === filterCategory;
    const matchBranch = filterBranch === 'all' || r.branchId === filterBranch;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchCat && matchBranch && matchStatus;
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRegistrants.length / pageSize));
  const pagedRegistrants = filteredRegistrants.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterCategory, filterBranch, filterStatus]);

  // Image modal
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const openImage = (url: string) => {
    setImageModalUrl(url);
    setImageModalOpen(true);
  };
  const closeImage = () => { setImageModalOpen(false); setImageModalUrl(null); };

  const markAsPaid = async (orderId: string) => {
    if (!window.confirm('Tandai pesanan ini sebagai LUNAS?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mark-paid', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
      if (res.ok) {
        toast.success('Status pembayarannya diperbarui');
        await fetchRegistrants();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal memperbarui status');
      }
    } catch (e) { toast.error('Terjadi kesalahan jaringan'); }
    finally { setLoading(false); }
  };

  const startEditEmail = (registrant: Registrant) => {
    setEditingEmailId(registrant.id);
    setEditingEmailValue(registrant.email);
  };

  const cancelEditEmail = () => {
    setEditingEmailId(null);
    setEditingEmailValue('');
  };

  const updateRegistrantEmail = async (registrant: Registrant) => {
    const email = editingEmailValue.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Format email tidak valid');
      return;
    }
    if (email === registrant.email.toLowerCase()) {
      cancelEditEmail();
      return;
    }

    setEmailActionLoadingId(registrant.id);
    try {
      const res = await fetch(`/api/admin/registrations/${encodeURIComponent(registrant.id)}/email`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Gagal memperbarui email');
        return;
      }

      setRegistrants(prev => prev.map(item => item.id === registrant.id ? { ...item, email } : item));
      toast.success('Email peserta diperbarui');
      cancelEditEmail();
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setEmailActionLoadingId(null);
    }
  };

  const resendRegistrantEmail = async (registrant: Registrant) => {
    if (!window.confirm(`Kirim ulang e-tiket ke ${registrant.email}?`)) return;

    setEmailActionLoadingId(registrant.id);
    try {
      const res = await fetch('/api/admin/resend-email', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: registrant.id })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || 'Email berhasil dikirim ulang');
      } else {
        toast.error(data.error || 'Gagal mengirim ulang email');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setEmailActionLoadingId(null);
    }
  };

  const uploadPaymentProof = async (registrant: Registrant, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Bukti pembayaran harus berupa gambar atau PDF');
      return;
    }

    const formData = new FormData();
    formData.append('orderId', registrant.id);
    formData.append('paymentPhoto', file);

    setPaymentUploadLoadingId(registrant.id);
    try {
      const res = await fetch('/api/update-payment', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || 'Gagal mengunggah bukti pembayaran');
        return;
      }

      const paymentPhoto = data.fileUrl || data.fileUrlFull;
      if (paymentPhoto) {
        setRegistrants(prev => prev.map(item => item.id === registrant.id ? { ...item, paymentPhoto } : item));
      }
      toast.success('Bukti pembayaran berhasil diunggah');
    } catch (e) {
      toast.error('Terjadi kesalahan saat mengunggah bukti pembayaran');
    } finally {
      setPaymentUploadLoadingId(null);
    }
  };

  const handleExport = async () => {
    if (filteredRegistrants.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    setLoadingExport(true);
    // Give a small delay to allow spinner to show
    await new Promise(r => setTimeout(r, 500));

    try {
      const dataToExport = filteredRegistrants.map(r => ({
        'ID Pesanan': r.id,
        'Nama Lengkap': r.fullName,
        'Email': r.email,
        'WhatsApp': r.phone,
        'NPA IDI': r.npa || '-',
        'Kategori': r.category,
        'Cabang IDI': branches.find(b => b.id === r.branchId)?.name || r.branchId || '-',
        'Status': r.status,
        'Total Bayar': r.amount,
        'Tgl Daftar': new Date(r.createdAt).toLocaleString('id-ID')
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrants');
      
      const wscols = [
        { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, 
        { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, 
        { wch: 15 }, { wch: 25 }
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `registrasi-muswil-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Data berhasil diekspor ke Excel');
    } catch (e) {
      toast.error('Gagal mengekspor data');
    } finally {
      setLoadingExport(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="p-10 w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-50 blur-3xl rounded-full opacity-50 -z-10" />
          <div className="w-20 h-20 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-3xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-slate-900/20 rotate-3">
            <Users size={36} className="-rotate-3" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">Admin Panel</h2>
          </div>
          <div className="space-y-4 pt-4">
            <input 
              type="text" placeholder="Username Admin"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl outline-none text-center font-bold"
              value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <input 
              type="password" placeholder="••••••••"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl outline-none text-center tracking-[0.3em] font-bold"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin} disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Masuk Panel'}
            </button>
            <button onClick={onBack} className="block w-full text-slate-400 text-[10px] uppercase font-black tracking-widest pt-4 hover:text-slate-900">
              ← Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 min-h-screen">
  {/* Sidebar (desktop) */}
  <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col fixed inset-y-0 z-10 shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-xl flex items-center justify-center rotate-3">
            <Users size={20} className="-rotate-3" />
          </div>
          <div>
            <div className="font-black text-xs uppercase tracking-widest text-slate-900">Muswil Admin</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IDI Kaltim</div>
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button 
            onClick={() => setActiveTab('registrations')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'registrations' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <BarChart size={16} /> Data Registrations
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'events' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Calendar size={16} /> Event Manager
          </button>
          <button 
            onClick={() => setActiveTab('branches')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'branches' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <MapPin size={16} /> Cabang IDI
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'categories' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Tag size={16} /> Kategori
          </button>

          <div className="pt-4 pb-2 px-4">
             <div className="h-px bg-slate-100 w-full mb-4"></div>
             <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Check-in System</div>
          </div>

          <button 
            onClick={() => setActiveTab('scanner')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'scanner' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Camera size={16} /> Scan Kehadiran
          </button>

          <button 
            onClick={() => setActiveTab('guestbook')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'guestbook' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <BookOpen size={16} /> Buku Tamu
          </button>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button 
              onClick={() => window.open('/kiosk', '_blank')}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"
            >
              <LayoutGrid size={14} /> Open Kiosk Mode
            </button>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] text-center mt-3">Separate check-in station</p>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={onBack} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">
            <ArrowLeft size={14} /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-md bg-slate-50">
            <Menu size={18} />
          </button>
          <div className="text-sm font-black">Admin Panel</div>
        </div>
        <div>
          <button onClick={onBack} className="text-slate-500 text-xs uppercase font-black">Keluar</button>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 p-4 md:hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-xl flex items-center justify-center rotate-3">
                  <Users size={20} className="-rotate-3" />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-widest text-slate-900">Muswil Admin</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IDI Kaltim</div>
                </div>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-2 rounded-md bg-slate-50"><X size={18} /></button>
            </div>
            <nav className="space-y-2">
              <button onClick={() => { setActiveTab('registrations'); setMobileSidebarOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase">Data Registrations</button>
              <button onClick={() => { setActiveTab('events'); setMobileSidebarOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase">Event Manager</button>
              <button onClick={() => { setActiveTab('branches'); setMobileSidebarOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase">Cabang IDI</button>
              <button onClick={() => { setActiveTab('categories'); setMobileSidebarOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase">Kategori</button>
              <div className="pt-4 border-t mt-4">
                <button onClick={() => { setActiveTab('scanner'); setMobileSidebarOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase">Scan Kehadiran</button>
                <button onClick={() => { setActiveTab('guestbook'); setMobileSidebarOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase">Buku Tamu</button>
                <div className="pt-4">
                  <button onClick={() => { window.open('/kiosk', '_blank'); setMobileSidebarOpen(false); }} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-2xl text-xs font-black uppercase">Open Kiosk Mode</button>
                </div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="md:ml-64 flex-1 p-4 md:p-8 pt-20 md:pt-8 h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Data Pendaftar</h2>
                <div className="flex items-center gap-3">
                  <button 
                    disabled={loadingExport}
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-black text-emerald-600 uppercase tracking-widest hover:border-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"
                  >
                    {loadingExport ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />} 
                    {loadingExport ? 'Mengekspor...' : 'Ekspor Excel'}
                  </button>
                  <button onClick={fetchRegistrants} className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-black text-slate-600 uppercase tracking-widest hover:border-slate-300">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex items-center focus-within:border-slate-300">
                  <Search size={16} className="text-slate-400 mr-3" />
                  <input 
                    type="text" placeholder="Cari nama, email, atau ID..."
                    className="bg-transparent border-none outline-none w-full text-sm font-semibold"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none text-slate-600 focus:border-emerald-500"
                  value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select 
                  className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none text-slate-600 focus:border-emerald-500"
                  value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
                >
                  <option value="all">Semua Cabang</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select 
                  className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none text-slate-600 focus:border-emerald-500"
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="settlement">Berhasil (Paid)</option>
                  <option value="pending">Menunggu (Pending)</option>
                </select>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                {filteredRegistrants.length > 0 ? (
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 whitespace-nowrap">
                        <th className="w-[11%] px-4 py-4">Bukti</th>
                        <th className="w-[20%] px-4 py-4">Pendaftar</th>
                        <th className="w-[24%] px-4 py-4">Kontak</th>
                        <th className="w-[21%] px-4 py-4">Detail Peserta</th>
                        <th className="w-[12%] px-4 py-4">Status</th>
                        <th className="w-[12%] px-4 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {pagedRegistrants.map(r => {
                        const branchName = branches.find(b => b.id === r.branchId)?.name || r.branchId || '-';
                        return (
                        <tr key={r.id}>
                          <td className="px-4 py-4 align-top">
                            <label
                              title={r.paymentPhoto ? 'Ganti bukti pembayaran' : 'Upload bukti pembayaran'}
                              className={`mb-2 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 ${paymentUploadLoadingId === r.id ? 'pointer-events-none opacity-60' : ''}`}
                            >
                              {paymentUploadLoadingId === r.id ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                              {r.paymentPhoto ? 'Ganti' : 'Upload'}
                              <input
                                type="file"
                                accept="image/*,application/pdf,.pdf"
                                className="hidden"
                                disabled={paymentUploadLoadingId === r.id}
                                onChange={(e) => {
                                  uploadPaymentProof(r, e.target.files?.[0]);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>
                            {r.paymentPhoto ? (() => {
                              // support: data URLs (base64), absolute URLs, or stored filename
                              let photoUrl = r.paymentPhoto;
                              if (!photoUrl.startsWith('data:') && !photoUrl.startsWith('http') && !photoUrl.startsWith('/')) {
                                photoUrl = `/uploads/${photoUrl}`;
                              }
                              const isPdf = photoUrl.toLowerCase().includes('.pdf') || photoUrl.startsWith('data:application/pdf');
                              return (
                                isPdf ? (
                                  <button onClick={() => window.open(photoUrl, '_blank')} className="w-16 h-12 rounded-md border bg-slate-50 text-[10px] font-black text-slate-500" title="Lihat PDF">
                                    PDF
                                  </button>
                                ) : (
                                  <button onClick={() => openImage(photoUrl)} className="p-0 border-0 bg-transparent rounded-md overflow-hidden" title="Lihat bukti">
                                    <img src={photoUrl} alt={`bukti-${r.id}`} className="w-16 h-12 object-cover rounded-md border" />
                                  </button>
                                )
                              );
                            })() : (
                              <div className="w-16 h-12 bg-slate-50 rounded-md flex items-center justify-center text-slate-300">-</div>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="font-bold text-slate-800 leading-snug break-words">{r.fullName}</div>
                            <div className="text-[11px] text-slate-500">ID: {r.id}</div>
                          </td>
                          <td className="px-4 py-4 align-top text-[13px] text-slate-600">
                            {editingEmailId === r.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="email"
                                  value={editingEmailValue}
                                  onChange={(e) => setEditingEmailValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateRegistrantEmail(r);
                                    if (e.key === 'Escape') cancelEditEmail();
                                  }}
                                  className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  title="Simpan email"
                                  disabled={emailActionLoadingId === r.id}
                                  onClick={() => updateRegistrantEmail(r)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {emailActionLoadingId === r.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                </button>
                                <button
                                  type="button"
                                  title="Batal"
                                  onClick={cancelEditEmail}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-900"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="break-all">{r.email}</span>
                                <button
                                  type="button"
                                  title="Edit email peserta"
                                  onClick={() => startEditEmail(r)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-emerald-600"
                                >
                                  <Edit size={14} />
                                </button>
                                </div>
                                <div className="text-[12px] font-semibold text-slate-500">{r.phone || '-'}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <span className="inline-flex max-w-full px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase leading-snug break-words">{r.category}</span>
                              <div className="text-[12px] font-semibold text-slate-600 leading-snug break-words">{branchName}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex min-w-0 flex-col items-start gap-2">
                              <span className={`max-w-full break-words px-2 py-1 rounded text-[10px] uppercase font-black tracking-widest ${r.status === 'settlement' || r.status === 'capture' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                                {r.status}
                              </span>
                              {r.status !== 'settlement' && r.status !== 'capture' && (
                                <button onClick={() => markAsPaid(r.id)} className="max-w-full break-words text-[10px] font-black text-white bg-emerald-600 px-2 py-1 rounded-full hover:bg-emerald-700">Tandai Lunas</button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title="Kirim ulang e-tiket ke email peserta"
                                disabled={emailActionLoadingId === r.id || (r.status !== 'settlement' && r.status !== 'capture')}
                                onClick={() => resendRegistrantEmail(r)}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-slate-200 px-2 py-2 text-[10px] font-black uppercase leading-tight tracking-widest text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {emailActionLoadingId === r.id ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
                                Kirim Ulang
                              </button>
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                      <Search size={32} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tidak ada data pendaftar</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase mt-1">Belum ada peserta yang mendaftar atau sesuaikan filter Anda.</p>
                  </div>
                )}
              </div>
              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-slate-500">Halaman {page} dari {totalPages}</div>
                <div className="flex items-center gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-2 bg-white border rounded-lg text-sm">Prev</button>
                  <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-2 bg-white border rounded-lg text-sm">Next</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Cabang IDI</h2>
                <button onClick={handleAddBranch} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700">
                  <Plus size={14} /> Tambah
                </button>
              </div>
              <div className="flex bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center flex-1 max-w-md">
                    <Search size={14} className="text-slate-400 mr-2" />
                    <input 
                      type="text" placeholder="Cari cabang..."
                      className="bg-transparent border-none outline-none w-full text-[11px] font-bold uppercase tracking-wider"
                      value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total: {branches.length} Cabang
                </div>
              </div>
              <div className="bg-white rounded-[2xl] border border-slate-100 p-2 overflow-hidden shadow-sm">
                {branches.length > 0 ? (
                  <table className="w-full text-left table-auto">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                        <th className="p-4 rounded-tl-xl text-[9px]">Nama Cabang</th>
                        <th className="p-4 rounded-tr-xl w-32 text-right text-[9px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-sm text-slate-700">{b.name}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEditBranch(b)} className="text-amber-500 hover:text-amber-700 p-2 rounded-lg hover:bg-amber-50 transition-all" title="Edit"><Edit size={16} /></button>
                              <button onClick={() => deleteBranch(b.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all" title="Hapus"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                      <MapPin size={28} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Data cabang masih kosong</h3>
                    <button onClick={handleAddBranch} className="mt-4 flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-emerald-100">
                      <Plus size={14} /> Buat Cabang Sekarang
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Kategori Keanggotaan</h2>
                <button onClick={handleAddCategory} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700">
                  <Plus size={14} /> Tambah
                </button>
              </div>
              <div className="flex bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center flex-1 max-w-md">
                    <Search size={14} className="text-slate-400 mr-2" />
                    <input 
                      type="text" placeholder="Cari kategori..."
                      className="bg-transparent border-none outline-none w-full text-[11px] font-bold uppercase tracking-wider"
                      value={catSearch} onChange={(e) => setCatSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total: {categories.length} Kategori
                </div>
              </div>
              <div className="bg-white rounded-[2xl] border border-slate-100 p-2 overflow-hidden shadow-sm">
                {categories.length > 0 ? (
                  <table className="w-full text-left table-auto">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                        <th className="p-4 rounded-tl-xl text-[9px]">Nama Kategori</th>
                        <th className="p-4 text-[9px]">Tarif (Rp)</th>
                        <th className="p-4 rounded-tr-xl w-32 text-right text-[9px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-sm text-slate-700">{c.name}</td>
                          <td className="p-4">
                            <span className="font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg text-xs">
                              {`Rp ${c.price.toLocaleString('id-ID')}`}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEditCategory(c)} className="text-amber-500 hover:text-amber-700 p-2 rounded-lg hover:bg-amber-50 transition-all" title="Edit"><Edit size={16} /></button>
                              <button onClick={() => deleteCategory(c.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all" title="Hapus"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                      <Tag size={28} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Data kategori masih kosong</h3>
                    <button onClick={handleAddCategory} className="mt-4 flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-emerald-100">
                      <Plus size={14} /> Buat Kategori Sekarang
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Event Portal</h2>
                <button onClick={handleAddEvent} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700">
                  <Plus size={14} /> Tambah Event
                </button>
              </div>
              <div className="flex bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center flex-1 max-w-md">
                    <Search size={14} className="text-slate-400 mr-2" />
                    <input 
                      type="text" placeholder="Cari nama event..."
                      className="bg-transparent border-none outline-none w-full text-[11px] font-bold uppercase tracking-wider"
                      value={eventSearch} onChange={(e) => setEventSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">
                    Urutkan:
                  </div>
                  <select 
                    value={eventSort}
                    onChange={(e) => setEventSort(e.target.value as any)}
                    className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="date-desc">Terbaru</option>
                    <option value="date-asc">Terlama</option>
                    <option value="status-active">Aktif Dahulu</option>
                    <option value="status-inactive">Nonaktif Dahulu</option>
                  </select>
                  <div className="h-8 w-[1px] bg-slate-100 mx-2"></div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {events.length} Agenda
                  </div>
                </div>
              </div>
              {events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events
                    .filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()))
                    .sort((a, b) => {
                      if (eventSort === 'date-desc') return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                      if (eventSort === 'date-asc') return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                      if (eventSort === 'status-active') {
                        if (a.isActive === b.isActive) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                        return a.isActive ? -1 : 1;
                      }
                      if (eventSort === 'status-inactive') {
                        if (a.isActive === b.isActive) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                        return a.isActive ? 1 : -1;
                      }
                      return 0;
                    })
                    .map(event => (
                    <div key={event.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col group">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${event.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {event.isActive ? 'Aktif' : 'Nonaktif'}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleEditEvent(event)} className="p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-lg"><Edit size={16} /></button>
                          <button onClick={() => setDeleteConfirmId(event.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2 line-clamp-2 leading-relaxed">{event.title}</h3>
                      <div className="space-y-2 mb-4 flex-1">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                          <Calendar size={12} className="text-emerald-500" /> 
                          {new Date(event.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                          <MapPin size={12} className="text-emerald-500" /> {event.location}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{event.categories?.length || 0} Tiket</span>
                        <div className="flex items-center gap-1.5">
                           <button onClick={() => handleEditEvent(event)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Kelola Agenda</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
                    <Calendar size={40} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Portal Event Masih Kosong</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 max-w-xs leading-relaxed">Mulai buat agenda Musyawarah atau Seminar Anda dan terbitkan di halaman depan.</p>
                  <button onClick={handleAddEvent} className="mt-8 flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200">
                    <Plus size={16} /> Buat Agenda Sekarang
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'scanner' && <QRScanner />}
          {activeTab === 'guestbook' && <Guestbook />}

        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden border border-slate-100">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
            
            <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={40} className="text-rose-500" />
            </div>

            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 text-center mb-2">Hapus Agenda?</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center leading-relaxed px-4 mb-8">
              Tindakan ini tidak dapat dibatalkan. Pendaftaran & data terkait event ini akan <span className="text-rose-500 font-black">terhapus permanen</span>.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => deleteEvent(deleteConfirmId)}
                disabled={loading}
                className="w-full bg-rose-600 text-white px-8 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-rose-100"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Ya, Hapus Sekarang
              </button>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="w-full bg-white text-slate-400 border border-slate-100 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all text-center"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModalOpen && imageModalUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white max-w-4xl w-full rounded-2xl p-4 relative">
            <div className="absolute top-4 right-4">
              <button onClick={closeImage} className="p-2 rounded-full bg-slate-50 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center justify-center">
              <img src={imageModalUrl} alt="bukti" className="max-h-[80vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>
            <div className="absolute top-8 right-8">
               <button onClick={() => setShowBranchModal(false)} className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all">
                  <X size={20} />
               </button>
            </div>
            
            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
              <MapPin size={32} className="text-slate-900" />
            </div>

            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">
              {editingBranch ? 'Perbarui Cabang' : 'Cabang Utama Baru'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Informasi Identitas Cabang organisasi</p>

            <form onSubmit={saveBranch} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Nama Resmi Cabang IDI</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={14} />
                  </div>
                  <input 
                    type="text" 
                    value={branchName} 
                    onChange={e => setBranchName(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-slate-900 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300"
                    placeholder="Contoh: IDI Cabang Samarinda"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  disabled={loading || !branchName.trim()}
                  className="flex-1 bg-slate-900 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                >
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  {editingBranch ? 'Simpan Perubahan' : 'Terbitkan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
            <div className="absolute top-8 right-8">
               <button onClick={() => setShowCategoryModal(false)} className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all">
                  <X size={20} />
               </button>
            </div>

            <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6">
              <Tag size={32} className="text-emerald-600" />
            </div>

            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-1">
              {editingCategory ? 'Kelola Kategori' : 'Kategori Tiket Baru'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Definisikan tipe peserta & tarif dasar</p>

            <form onSubmit={saveCategory} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Label Kategori</label>
                <input 
                  type="text" 
                  value={categoryName} 
                  onChange={e => setCategoryName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300"
                  placeholder="Nama pendaftar (e.g. Peserta Umum)"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Tarif Standar (Rp)</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 group-focus-within:text-emerald-600 transition-colors">Rp</span>
                  </div>
                  <input 
                    type="number" 
                    value={categoryPrice} 
                    onChange={e => setCategoryPrice(Number(e.target.value))}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300"
                    placeholder="0"
                  />
                  {categoryPrice === 0 && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-md">Free</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex pt-4">
                <button 
                  type="submit" 
                  disabled={loading || !categoryName.trim()}
                  className="w-full bg-slate-900 text-white px-8 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                >
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  {editingCategory ? 'Perbarui Kategori' : 'Buat Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <div className="absolute top-8 right-8">
               <button onClick={() => setShowEventModal(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={24} />
               </button>
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-8">
              {editingEvent ? 'Edit Event' : 'Tambah Event Baru'}
            </h3>
            <form onSubmit={saveEvent} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Judul Event</label>
                  <input type="text" value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold" placeholder="Judul Muswil / Event" required />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Deskripsi Singkat</label>
                  <textarea value={eventData.description} onChange={e => setEventData({...eventData, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold h-32" placeholder="Jelaskan mengenai agenda ini..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Tanggal Mulai</label>
                  <Flatpickr
                    value={eventData.startDate}
                    onChange={([date]) => {
                      const newStart = date.toISOString();
                      setEventData(prev => ({
                        ...prev,
                        startDate: newStart,
                        endDate: isOneDay ? newStart : prev.endDate
                      }));
                    }}
                    options={{ dateFormat: 'd M Y', enableTime: false }}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Tanggal Selesai</label>
                  <div className="relative">
                    <Flatpickr
                      value={eventData.endDate}
                      disabled={isOneDay}
                      onChange={([date]) => setEventData({...eventData, endDate: date.toISOString()})}
                      options={{ dateFormat: 'd M Y', enableTime: false }}
                      className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold ${isOneDay ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center justify-end px-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      const newOneDay = !isOneDay;
                      setIsOneDay(newOneDay);
                      if (newOneDay) {
                        setEventData(prev => ({ ...prev, endDate: prev.startDate }));
                      }
                    }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    {isOneDay ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} />}
                    Hanya 1 Hari Event
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Lokasi (Hotel/Gedung)</label>
                  <input type="text" value={eventData.location} onChange={e => setEventData({...eventData, location: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold" placeholder="Contoh: Hotel Gran Senyiur" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Alamat/Kota</label>
                  <input type="text" value={eventData.address} onChange={e => setEventData({...eventData, address: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold" placeholder="Contoh: Balikpapan" />
                </div>
                <div className="md:col-span-2 flex items-center gap-3 bg-slate-50 p-4 rounded-2xl">
                  <input type="checkbox" id="isActive" checked={eventData.isActive} onChange={e => setEventData({...eventData, isActive: e.target.checked})} className="w-5 h-5 accent-emerald-600" />
                  <label htmlFor="isActive" className="text-xs font-black uppercase text-slate-900 cursor-pointer">Publikasikan Event (Aktifkan di Landing Page)</label>
                </div>

                <div className="md:col-span-2 space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black uppercase tracking-tight text-slate-900">Agenda & Tiket Terpadu</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aktifkan tipe peserta dan sesuaikan tarif delegasi</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {categories.map(masterCat => {
                      const eventCat = eventData.categories.find(c => c.id === masterCat.id);
                      const isSelected = !!eventCat;
                      
                      return (
                        <div key={masterCat.id} className={`relative flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-[2rem] border transition-all duration-300 ${isSelected ? 'border-emerald-200 bg-emerald-50/20 shadow-sm ring-1 ring-emerald-100' : 'border-slate-100 bg-slate-50/30 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'}`}>
                          <div className="flex items-center gap-4 flex-1">
                            <button 
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setEventData(prev => ({
                                    ...prev,
                                    categories: prev.categories.filter(c => c.id !== masterCat.id)
                                  }));
                                } else {
                                  setEventData(prev => ({
                                    ...prev,
                                    categories: [...prev.categories, { id: masterCat.id, name: masterCat.name, price: masterCat.price }]
                                  }));
                                }
                              }}
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-300 border border-slate-100'}`}
                            >
                              {isSelected ? <CheckCircle2 size={24} /> : <Plus size={24} />}
                            </button>
                            
                            <div className="flex-1">
                              <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-900 leading-none mb-1.5">{masterCat.name}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Tarif Master</span>
                                <span className="text-[10px] text-slate-500 font-bold">Rp {masterCat.price.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="w-full sm:w-64 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-emerald-100 sm:pl-6">
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black uppercase tracking-widest text-emerald-600 ml-1">Tarif Khusus Event Ini</label>
                                <div className="relative">
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                                    <span className="text-[10px] font-black text-emerald-300">Rp</span>
                                  </div>
                                  <input 
                                    type="number"
                                    value={eventCat.price}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setEventData(prev => ({
                                        ...prev,
                                        categories: prev.categories.map(c => c.id === masterCat.id ? { ...c, price: val } : c)
                                      }));
                                    }}
                                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-emerald-100 rounded-2xl outline-none text-sm font-black text-emerald-700 focus:border-emerald-500 transition-all shadow-inner"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {categories.length === 0 && (
                      <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100">
                          <Tag size={24} />
                        </div>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1">Master Kategori Kosong</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">
                          Anda harus menambahkan minimal satu kategori di menu <span className="text-indigo-600">Kategori Master</span> sebelum bisa mengonfigurasi tiket event.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50">Batal</button>
                <button type="submit" disabled={loading} className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Simpan Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

