import React, { useEffect, useState } from 'react';
import { Users, Mail, Phone, Calendar, Search, ArrowLeft, Download, RefreshCw, BarChart, CheckCircle2, Clock, MapPin, Tag, Plus, Trash2, Edit, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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
}

interface Branch { id: string; name: string; }
interface Category { id: string; name: string; price: number; }

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'registrations' | 'branches' | 'categories'>('registrations');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryPrice, setCategoryPrice] = useState<number>(0);

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
      const [resB, resC] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/categories')
      ]);
      if (resB.ok) setBranches(await resB.json());
      if (resC.ok) setCategories(await resC.json());
    } catch(e) {}
  };

  const handleLogin = async () => {
    await fetchRegistrants();
    if (isAuthorized) {
      await fetchBranchesAndCategories();
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
    try {
      const res = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) { toast.success('Terhapus'); fetchBranchesAndCategories(); }
    } catch(e) { toast.error('Error'); }
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
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) { toast.success('Terhapus'); fetchBranchesAndCategories(); }
    } catch(e) { toast.error('Error'); }
  };

  const filteredRegistrants = registrants.filter(r => {
    const matchSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || r.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategory === 'all' || r.categoryId === filterCategory;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const handleExport = () => {
    if (filteredRegistrants.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

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
    
    // Set column widths
    const wscols = [
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, 
      { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, 
      { wch: 15 }, { wch: 25 }
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `registrasi-muswil-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Data berhasil diekspor ke Excel');
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
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 z-10 shrink-0">
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
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={onBack} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">
            <ArrowLeft size={14} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-8 h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Data Pendaftar</h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-black text-emerald-600 uppercase tracking-widest hover:border-emerald-600 hover:bg-emerald-50 transition-all"
                  >
                    <FileDown size={14} /> Ekspor Excel
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
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="settlement">Berhasil (Paid)</option>
                  <option value="pending">Menunggu (Pending)</option>
                </select>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-x-auto min-h-[400px]">
                <table className="w-full text-left max-w-full">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 whitespace-nowrap">
                      <th className="px-6 py-4">Pendaftar</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4">Cabang</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {filteredRegistrants.map(r => {
                      const branchName = branches.find(b => b.id === r.branchId)?.name || r.branchId || '-';
                      return (
                      <tr key={r.id}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{r.fullName}</div>
                          <div className="text-[11px] text-slate-500">{r.email}</div>
                        </td>
                        <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase">{r.category}</span></td>
                        <td className="px-6 py-4 font-semibold text-slate-600">{branchName}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] uppercase font-black tracking-widest ${r.status === 'settlement' || r.status === 'capture' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
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
              <div className="bg-white rounded-[2xl] border border-slate-100 p-2">
                <table className="w-full text-left table-auto">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                      <th className="p-4 rounded-xl">Nama Cabang</th>
                      <th className="p-4 rounded-xl w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-sm text-slate-700">{b.name}</td>
                        <td className="p-4 flex items-center gap-2">
                          <button onClick={() => handleEditBranch(b)} className="text-amber-500 hover:text-amber-700 p-2 rounded-lg hover:bg-amber-50"><Edit size={16} /></button>
                          <button onClick={() => deleteBranch(b.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div className="bg-white rounded-[2xl] border border-slate-100 p-2">
                <table className="w-full text-left table-auto">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                      <th className="p-4 rounded-xl">Nama Kategori</th>
                      <th className="p-4 rounded-xl">Tarif (Rp)</th>
                      <th className="p-4 rounded-xl w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-sm text-slate-700">{c.name}</td>
                        <td className="p-4 font-mono text-sm text-slate-600">{c.price.toLocaleString()}</td>
                        <td className="p-4 flex items-center gap-2">
                          <button onClick={() => handleEditCategory(c)} className="text-amber-500 hover:text-amber-700 p-2 rounded-lg hover:bg-amber-50"><Edit size={16} /></button>
                          <button onClick={() => deleteCategory(c.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-6">
              {editingBranch ? 'Edit Cabang' : 'Tambah Cabang'}
            </h3>
            <form onSubmit={saveBranch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Nama Cabang IDI</label>
                <input 
                  type="text" 
                  value={branchName} 
                  onChange={e => setBranchName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold text-slate-800"
                  placeholder="Contoh: IDI Cabang Samarinda"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowBranchModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !branchName.trim()}
                  className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-6">
              {editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
            </h3>
            <form onSubmit={saveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Nama Kategori</label>
                <input 
                  type="text" 
                  value={categoryName} 
                  onChange={e => setCategoryName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold text-slate-800"
                  placeholder="Contoh: Utusan"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Tarif (Rp)</label>
                <input 
                  type="number" 
                  value={categoryPrice} 
                  onChange={e => setCategoryPrice(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-emerald-500 outline-none font-bold text-slate-800"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !categoryName.trim()}
                  className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

