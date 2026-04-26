import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Hash, ChevronRight, Loader2, AlertCircle, Upload, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import Select from 'react-select';

interface RegistrationFormProps {
  onSuccess: (data: { fullName: string, email: string, category: string, orderId?: string }) => void;
  onPending: (data: { orderId: string }) => void;
  selectedEventId: string;
}

const Slide1Schema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(10, 'Nomor WhatsApp minimal 10 digit').max(15, 'Nomor WhatsApp maksimal 15 digit').regex(/^[0-9]+$/, 'Hanya boleh berisi angka'),
  npa: z.string().optional(),
  category: z.string().min(1, 'Pilih kategori keanggotaan'),
});

type FormErrors = Record<string, string>;

declare global {
  interface Window {
    snap: any;
  }
}

const KRITERIA_OPTIONS = [
  { value: 'PENGURUS IDI WILAYAH KALTIM', label: 'PENGURUS IDI WILAYAH KALTIM' },
  { value: 'ASAL IDI CABANG', label: 'ASAL IDI CABANG' },
  { value: 'PERHIMPUNAN DAN KESEMINATAN', label: 'PERHIMPUNAN DAN KESEMINATAN' },
  { value: 'MKEK', label: 'MKEK' }
];

const IDI_CABANG_OPTIONS = [
  { value: 'IDI CABANG PASER', label: 'IDI CABANG PASER' },
  { value: 'IDI CABANG PPU', label: 'IDI CABANG PPU' },
  { value: 'IDI CABANG BALIKPAPAN', label: 'IDI CABANG BALIKPAPAN' },
  { value: 'IDI CABANG KUTAI BARAT', label: 'IDI CABANG KUTAI BARAT' },
  { value: 'IDI CABANG MAHULU', label: 'IDI CABANG MAHULU' },
  { value: 'IDI CABANG KUTAI TIMUR', label: 'IDI CABANG KUTAI TIMUR' },
  { value: 'IDI CABANG KUTAI KARTANEGARA', label: 'IDI CABANG KUTAI KARTANEGARA' },
  { value: 'IDI CABANG BONTANG', label: 'IDI CABANG BONTANG' },
  { value: 'IDI CABANG BERAU', label: 'IDI CABANG BERAU' }
];

export function RegistrationForm({ onSuccess, onPending, selectedEventId }: RegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentSlide, setCurrentSlide] = useState(1);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const [branches, setBranches] = useState<{id: string, name: string}[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string, price: number}[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    npa: '',
    category: '',
    branchId: '',
    
    kriteria: '',
    tipePeserta: '',
    suratMandatUrl: '',
    komisi: '',
    perhimpunanName: '',
    mkekBranch: '',
    bersedia: false,
  });

  useEffect(() => {
    setLoadingDefs(true);
    Promise.all([
      fetch('/api/branches'),
      fetch(`/api/events`)
    ])
      .then(async ([resB, resE]) => {
        if (resB.ok) setBranches(await resB.json());
        if (resE.ok) {
          const events: any[] = await resE.json();
          const event = events.find((e: any) => e.id === selectedEventId);
          if (event && event.categories) {
            setCategories(event.categories);
            if (event.categories.length > 0) {
              setFormData(p => ({ ...p, category: event.categories[0].id }));
            }
          }
        }
      })
      .finally(() => setLoadingDefs(false));
  }, [selectedEventId]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Reset dependent fields when kriteria changes
      if (field === 'kriteria') {
        newData.tipePeserta = '';
        newData.suratMandatUrl = '';
        newData.komisi = '';
        newData.perhimpunanName = '';
        newData.mkekBranch = '';
        newData.bersedia = false;
        newData.branchId = '';
      }
      
      return newData;
    });
    
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateSlide1 = () => {
    try {
      Slide1Schema.parse(formData);
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: FormErrors = {};
        err.issues.forEach((issue) => {
          if (issue.path[0]) fieldErrors[issue.path[0] as string] = issue.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateSlide2 = () => {
    const fieldErrors: FormErrors = {};
    
    if (!formData.kriteria) fieldErrors.kriteria = 'Pilih kriteria peserta';
    if (!formData.bersedia) fieldErrors.bersedia = 'Anda harus menyetujui pernyataan ini';

    if (formData.kriteria === 'ASAL IDI CABANG') {
      if (!formData.branchId) fieldErrors.branchId = 'Pilih asal IDI cabang';
      if (!formData.tipePeserta) fieldErrors.tipePeserta = 'Pilih tipe peserta';
      if (!formData.suratMandatUrl) fieldErrors.suratMandatUrl = 'Surat Mandat wajib diunggah';
      if (!formData.komisi) fieldErrors.komisi = 'Pilih sidang komisi';
    } else if (formData.kriteria === 'PERHIMPUNAN DAN KESEMINATAN') {
      if (!formData.perhimpunanName) fieldErrors.perhimpunanName = 'Nama perhimpunan wajib diisi';
    } else if (formData.kriteria === 'MKEK') {
      if (!formData.mkekBranch) fieldErrors.mkekBranch = 'Pilih asal cabang/wilayah MKEK';
    }

    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  const handleNextSlide = () => {
    if (validateSlide1()) {
      setCurrentSlide(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevSlide = () => {
    setCurrentSlide(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    setUploadingFile(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });
      const data = await res.json();
      if (res.ok) {
        handleChange('suratMandatUrl', data.url);
        toast.success('File berhasil diunggah');
      } else {
        toast.error(data.error || 'Gagal mengunggah file');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan saat mengunggah file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSlide2()) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, eventId: selectedEventId }),
      });

      const data = await response.json();
      const catName = categories.find(c => c.id === formData.category)?.name || formData.category;

      if (!response.ok) {
        toast.error(data.message || 'Gagal memproses pendaftaran. Silakan coba lagi.');
        setLoading(false);
        return;
      }
      
      if (data.isFree) {
        toast.success('Pendaftaran Berhasil! Tiket dikirim ke email Anda.');
        onSuccess({ ...formData, category: catName, orderId: data.orderId });
        return;
      }

      if (data.isDummy) {
        toast.success('Mode Demo: Pembayaran disimulasikan berhasil.');
        onSuccess({ ...formData, category: catName, orderId: data.orderId });
        return;
      }

      if (data.token) {
        window.snap.pay(data.token, {
          onSuccess: function (result: any) {
            onSuccess({ ...formData, category: catName, orderId: result.order_id });
          },
          onPending: function (result: any) {
            onPending({ orderId: result.order_id });
          },
          onError: function () {
            alert('Pembayaran gagal, silakan coba lagi.');
          },
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Terjadi kesalahan saat memproses pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingDefs) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-emerald-600" /></div>;
  }

  const selectedCategory = categories.find(c => c.id === formData.category);
  const priceText = selectedCategory?.price === 0 ? 'Gratis' : 'sebesar Rp 1.250.000,-';

  return (
    <div className="space-y-6 relative overflow-hidden">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className={`h-2 rounded-full transition-all duration-500 ${currentSlide === 1 ? 'w-16 bg-emerald-600' : 'w-8 bg-slate-200'}`} />
        <div className={`h-2 rounded-full transition-all duration-500 ${currentSlide === 2 ? 'w-16 bg-emerald-600' : 'w-8 bg-slate-200'}`} />
      </div>

      <div className={`transition-all duration-500 transform ${currentSlide === 1 ? 'translate-x-0 opacity-100' : '-translate-x-full absolute inset-0 opacity-0 pointer-events-none'}`}>
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Nama Lengkap & Gelar</label>
              <div className="relative">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${errors.fullName ? 'text-red-400' : 'text-slate-300'}`} size={16} />
                <input 
                  type="text"
                  placeholder="dr. Contoh, Sp.PD"
                  className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl focus:ring-1 outline-none transition-all font-medium text-sm ${
                    errors.fullName ? 'border-red-200 focus:border-red-600 focus:ring-red-600' : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-600'
                  }`}
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                />
              </div>
              {errors.fullName && (
                <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
                  <AlertCircle size={12} /><span>{errors.fullName}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Email Aktif</label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${errors.email ? 'text-red-400' : 'text-slate-300'}`} size={16} />
                <input 
                  type="email"
                  placeholder="nama@email.com"
                  className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl focus:ring-1 outline-none transition-all font-medium text-sm ${
                    errors.email ? 'border-red-200 focus:border-red-600 focus:ring-red-600' : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-600'
                  }`}
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>
              {errors.email && (
                <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
                  <AlertCircle size={12} /><span>{errors.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Nomor WhatsApp</label>
              <div className="relative">
                <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 ${errors.phone ? 'text-red-400' : 'text-slate-300'}`} size={16} />
                <input 
                  type="tel"
                  placeholder="0812xxxxxx"
                  className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl focus:ring-1 outline-none transition-all font-medium text-sm ${
                    errors.phone ? 'border-red-200 focus:border-red-600 focus:ring-red-600' : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-600'
                  }`}
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
              {errors.phone && (
                <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
                  <AlertCircle size={12} /><span>{errors.phone}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">NPA IDI (Opsional)</label>
                <a href="https://www.idionline.org/organisasi/info/diranggota" target="_blank" rel="noreferrer" className="text-[9px] font-bold text-emerald-600 hover:underline">
                  Cek NPA Disini
                </a>
              </div>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  type="text"
                  placeholder="Input NPA Anda"
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all font-medium text-sm"
                  value={formData.npa}
                  onChange={(e) => handleChange('npa', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Kategori Keanggotaan</label>
            {categories.length === 0 ? (
              <div className="text-sm font-medium text-slate-500">Tidak ada kategori tersedia saat ini.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {categories.map((cat) => (
                  <label 
                    key={cat.id}
                    className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                      formData.category === cat.id ? 'border-emerald-600 bg-emerald-50/30 shadow-sm' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                    }`}
                  >
                    <input 
                      type="radio"
                      name="category"
                      className="hidden"
                      value={cat.id}
                      checked={formData.category === cat.id}
                      onChange={(e) => handleChange('category', e.target.value)}
                    />
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        formData.category === cat.id ? 'border-emerald-600' : 'border-slate-300'
                      }`}>
                        {formData.category === cat.id && <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>}
                      </div>
                      <span className="font-bold text-slate-800 uppercase tracking-tight text-sm">{cat.name}</span>
                    </div>
                    <span className="font-black text-emerald-600 text-lg tracking-tight">{cat.price === 0 ? 'Gratis' : `Rp ${cat.price.toLocaleString('id-ID')}`}</span>
                  </label>
                ))}
              </div>
            )}
            {errors.category && (
              <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1 mt-1">
                <AlertCircle size={12} /><span>{errors.category}</span>
              </div>
            )}
          </div>

          <div className="pt-6">
            <button 
              type="button"
              onClick={handleNextSlide}
              className="w-full group flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all hover:bg-emerald-700 shadow-xl shadow-emerald-900/10 active:scale-[0.98]"
            >
              Selanjutnya
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className={`transition-all duration-500 transform ${currentSlide === 2 ? 'translate-x-0 opacity-100' : 'translate-x-full absolute inset-0 opacity-0 pointer-events-none'}`}>
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Kriteria Peserta Musyawarah Wilayah</label>
            <div className="relative">
              <Select
                options={KRITERIA_OPTIONS}
                placeholder="Pilih Kriteria Peserta"
                isSearchable={false}
                value={formData.kriteria ? { value: formData.kriteria, label: formData.kriteria } : null}
                onChange={(option) => handleChange('kriteria', option ? option.value : '')}
                menuPortalTarget={document.body}
                styles={{
                  menuPortal: base => ({ ...base, zIndex: 9999 }),
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: '#f8fafc',
                    borderColor: state.isFocused ? '#059669' : errors.kriteria ? '#fca5a5' : '#e2e8f0',
                    borderRadius: '0.75rem',
                    padding: '0.5rem',
                    boxShadow: state.isFocused ? '0 0 0 1px #059669' : 'none',
                    '&:hover': { borderColor: state.isFocused ? '#059669' : '#cbd5e1' }
                  }),
                }}
              />
            </div>
            {errors.kriteria && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.kriteria}</div>}
          </div>

          {/* Conditional Rendering based on Kriteria */}
          {formData.kriteria === 'ASAL IDI CABANG' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Asal IDI Cabang</label>
                <Select
                  options={IDI_CABANG_OPTIONS}
                  placeholder="Pilih IDI Cabang"
                  isSearchable
                  value={formData.branchId ? { value: formData.branchId, label: formData.branchId } : null}
                  onChange={(option) => handleChange('branchId', option ? option.value : '')}
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, borderRadius: '0.75rem', padding: '0.5rem', borderColor: errors.branchId ? '#fca5a5' : '#e2e8f0' }) }}
                />
                {errors.branchId && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.branchId}</div>}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Tipe Peserta</label>
                <div className="grid grid-cols-2 gap-3">
                  {['UTUSAN IDI CABANG', 'PENINJAU IDI CABANG'].map(tipe => (
                    <label key={tipe} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.tipePeserta === tipe ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'}`}>
                      <input type="radio" name="tipePeserta" className="hidden" value={tipe} checked={formData.tipePeserta === tipe} onChange={(e) => handleChange('tipePeserta', e.target.value)} />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.tipePeserta === tipe ? 'border-emerald-600' : 'border-slate-300'}`}>
                        {formData.tipePeserta === tipe && <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>}
                      </div>
                      <span className="font-bold text-slate-700 text-xs">{tipe}</span>
                    </label>
                  ))}
                </div>
                {errors.tipePeserta && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.tipePeserta}</div>}
              </div>

              {formData.tipePeserta && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Upload Surat Mandat Sebagai {formData.tipePeserta}</label>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center ${errors.suratMandatUrl ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    {formData.suratMandatUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="text-emerald-500" size={32} />
                        <span className="text-sm font-bold text-slate-700">File berhasil diunggah</span>
                        <button type="button" onClick={() => handleChange('suratMandatUrl', '')} className="text-xs text-red-500 font-bold hover:underline">Hapus / Ganti File</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="text-slate-400" size={24} />
                        <div>
                          <p className="text-sm font-bold text-slate-700">Klik untuk unggah Surat Mandat</p>
                          <p className="text-xs text-slate-500 mt-1">Maksimal 5MB (PDF/JPG/PNG)</p>
                        </div>
                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,image/*" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="mt-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 disabled:opacity-50">
                          {uploadingFile ? 'Mengunggah...' : 'Pilih File'}
                        </button>
                      </div>
                    )}
                  </div>
                  {errors.suratMandatUrl && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.suratMandatUrl}</div>}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Silakan Memilih Sidang Komisi Yang Akan Diikuti</label>
                <div className="grid gap-2">
                  {[
                    'SIDANG KOMISI A ( KEBIJAKAN ORGANISASI INTERNAL )',
                    'SIDANG KOMISI B ( PELAYANAN PROFESI KEDOKTERAN )',
                    'SIDANG KOMISI C ( PENDIDIKAN DOKTER DAN CPD )'
                  ].map(komisi => (
                    <label key={komisi} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.komisi === komisi ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'}`}>
                      <input type="radio" name="komisi" className="hidden" value={komisi} checked={formData.komisi === komisi} onChange={(e) => handleChange('komisi', e.target.value)} />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.komisi === komisi ? 'border-emerald-600' : 'border-slate-300'}`}>
                        {formData.komisi === komisi && <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>}
                      </div>
                      <span className="font-bold text-slate-700 text-xs">{komisi}</span>
                    </label>
                  ))}
                </div>
                {errors.komisi && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.komisi}</div>}
              </div>
            </div>
          )}

          {formData.kriteria === 'PERHIMPUNAN DAN KESEMINATAN' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Perhimpunan dan Keseminatan</label>
              <textarea 
                placeholder="CONTOH : POGI, PERDOSKI, PAPDI, PERDAMI, dll"
                className={`w-full p-4 bg-slate-50 border rounded-xl focus:ring-1 outline-none transition-all font-medium text-sm min-h-[100px] resize-none ${errors.perhimpunanName ? 'border-red-200 focus:border-red-600' : 'border-slate-200 focus:border-emerald-600'}`}
                value={formData.perhimpunanName}
                onChange={(e) => handleChange('perhimpunanName', e.target.value)}
              />
              {errors.perhimpunanName && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.perhimpunanName}</div>}
            </div>
          )}

          {formData.kriteria === 'MKEK' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Asal Cabang / Wilayah MKEK</label>
              <Select
                options={[
                  { value: 'PENGURUS IDI WILAYAH KALTIM', label: 'PENGURUS IDI WILAYAH KALTIM' },
                  ...IDI_CABANG_OPTIONS
                ]}
                placeholder="Pilih Asal MKEK"
                isSearchable
                value={formData.mkekBranch ? { value: formData.mkekBranch, label: formData.mkekBranch } : null}
                onChange={(option) => handleChange('mkekBranch', option ? option.value : '')}
                menuPortalTarget={document.body}
                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, borderRadius: '0.75rem', padding: '0.5rem', borderColor: errors.mkekBranch ? '#fca5a5' : '#e2e8f0' }) }}
              />
              {errors.mkekBranch && <div className="text-[10px] text-red-500 font-bold ml-1">{errors.mkekBranch}</div>}
            </div>
          )}

          {formData.kriteria && (
            <div className="mt-8 p-5 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="flex items-start gap-4 cursor-pointer">
                <div className="pt-1 shrink-0">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.bersedia ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300'}`}>
                    {formData.bersedia && <CheckCircle2 className="text-white" size={14} />}
                  </div>
                </div>
                <input type="checkbox" className="hidden" checked={formData.bersedia} onChange={(e) => handleChange('bersedia', e.target.checked)} />
                <span className="text-sm font-medium text-slate-700 leading-relaxed">
                  Dengan ini saya menyatakan bersedia untuk menjadi peserta Musyawarah Wilayah Kaltim dan membayar biaya Registrasi {priceText}
                </span>
              </label>
              {errors.bersedia && <div className="text-[10px] text-red-500 font-bold ml-9 mt-2">{errors.bersedia}</div>}
            </div>
          )}

          <div className="pt-6 flex gap-4">
            <button 
              type="button"
              onClick={handlePrevSlide}
              className="px-6 py-5 rounded-2xl font-black uppercase tracking-[0.1em] text-xs transition-all border-2 border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.98]"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={handleSubmit}
              disabled={loading || !formData.kriteria}
              type="button"
              className="flex-1 group flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all hover:bg-emerald-600 disabled:opacity-50 shadow-xl shadow-slate-900/10 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Buat Pesanan'}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}

