import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Hash, CreditCard, ChevronRight, Loader2, AlertCircle, MapPin, Camera, X } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import Select, { components } from 'react-select';

interface RegistrationFormProps {
  onSuccess: (data: { fullName: string, email: string, category: string, orderId?: string }) => void;
  onPending: (data: { orderId: string }) => void;
  selectedEventId: string;
}

const RegistrationSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(10, 'Nomor WhatsApp minimal 10 digit').max(15, 'Nomor WhatsApp maksimal 15 digit').regex(/^[0-9]+$/, 'Hanya boleh berisi angka'),
  npa: z.string().optional(),
  category: z.string().min(1, 'Pilih kategori keanggotaan'),
  branchId: z.string().optional(),
});

type FormErrors = {
  [K in keyof z.infer<typeof RegistrationSchema>]?: string;
};

declare global {
  interface Window {
    snap: any;
  }
}

export function RegistrationForm({ onSuccess, onPending, selectedEventId }: RegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [branches, setBranches] = useState<{id: string, name: string}[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string, price: number}[]>([]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    npa: '',
    category: '',
    branchId: '',
  });

  useEffect(() => {
    setLoadingDefs(true);
    // Fetch branches globally, but categories from event
    Promise.all([
      fetch('/api/branches'),
      fetch(`/api/events`) // We already have events in the parent, but let's re-fetch or use a more specific data source
    ])
      .then(async ([resB, resE]) => {
        if (resB.ok) setBranches(await resB.json());
        if (resE.ok) {
          const events: any[] = await resE.json();
          const event = events.find(e => e.id === selectedEventId);
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

  const validate = () => {
    try {
      RegistrationSchema.parse(formData);
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: FormErrors = {};
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[issue.path[0] as keyof FormErrors] = issue.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
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
          onError: function (result: any) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Nama Lengkap & Gelar</label>
          <div className="relative">
            <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${errors.fullName ? 'text-red-400' : 'text-slate-300'}`} size={16} />
            <input 
              type="text"
              placeholder="dr. Contoh, Sp.PD"
              className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl focus:ring-1 outline-none transition-all font-medium text-sm ${
                errors.fullName 
                ? 'border-red-200 focus:border-red-600 focus:ring-red-600' 
                : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-600'
              }`}
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
            />
          </div>
          {errors.fullName && (
            <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
              <AlertCircle size={12} />
              <span>{errors.fullName}</span>
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
                errors.email 
                ? 'border-red-200 focus:border-red-600 focus:ring-red-600' 
                : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-600'
              }`}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>
          {errors.email && (
            <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
              <AlertCircle size={12} />
              <span>{errors.email}</span>
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
                errors.phone 
                ? 'border-red-200 focus:border-red-600 focus:ring-red-600' 
                : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-600'
              }`}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
          {errors.phone && (
            <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
              <AlertCircle size={12} />
              <span>{errors.phone}</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">NPA IDI (Opsional)</label>
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

      <div className="grid md:grid-cols-2 gap-5 items-end">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Cabang IDI (Opsional)</label>
          <div className="relative">
            <Select
            options={branches.map(b => ({ value: b.id, label: b.name }))}
            placeholder="Pilih atau Cari Cabang IDI"
            isSearchable
            isClearable
            value={formData.branchId ? { value: formData.branchId, label: branches.find(b => b.id === formData.branchId)?.name || '' } : null}
            onChange={(option) => handleChange('branchId', option ? (option as any).value : '')}
            styles={{
              control: (base, state) => ({
                ...base,
                backgroundColor: '#f8fafc',
                borderColor: state.isFocused ? '#059669' : '#e2e8f0',
                borderRadius: '0.75rem',
                padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                boxShadow: state.isFocused ? '0 0 0 1px #059669' : 'none',
                '&:hover': {
                  borderColor: state.isFocused ? '#059669' : '#cbd5e1'
                }
              }),
              placeholder: (base) => ({
                ...base,
                color: '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: 500
              }),
              singleValue: (base) => ({
                ...base,
                color: '#334155',
                fontSize: '0.875rem',
                fontWeight: 500
              }),
              input: (base) => ({
                ...base,
                fontSize: '0.875rem',
                fontWeight: 500
              }),
              option: (base, state) => ({
                ...base,
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: state.isSelected ? '#059669' : state.isFocused ? '#ecfdf5' : 'white',
                color: state.isSelected ? 'white' : '#334155',
                '&:active': {
                  backgroundColor: '#059669'
                }
              })
            }}
            components={{
              DropdownIndicator: () => null,
              IndicatorSeparator: () => null,
              Control: ({ children, ...props }) => (
                <components.Control {...props}>
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none z-10" size={16} />
                  {children}
                </components.Control>
              )
            }}
          />
        </div>
      </div>
    </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Kategori Keanggotaan</label>
        {categories.length === 0 ? (
          <div className="text-sm font-medium text-slate-500">Tidak ada kategori tersedia saat ini.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {categories.map((cat) => (
              <label 
                key={cat.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.category === cat.id ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
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
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    formData.category === cat.id ? 'border-emerald-600' : 'border-slate-300'
                  }`}>
                    {formData.category === cat.id && <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></div>}
                  </div>
                  <span className="font-bold text-slate-700 uppercase tracking-tight text-[11px]">{cat.name}</span>
                </div>
                <span className="font-black text-emerald-600 text-sm tracking-tight">{cat.price === 0 ? 'Gratis' : `Rp ${cat.price.toLocaleString('id-ID')}`}</span>
              </label>
            ))}
          </div>
        )}
        {errors.category && (
          <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold ml-1">
            <AlertCircle size={12} />
            <span>{errors.category}</span>
          </div>
        )}
      </div>

      <div className="pt-6">
        <button 
          disabled={loading || categories.length === 0}
          type="submit"
          className="w-full group flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all hover:bg-emerald-600 disabled:opacity-50 shadow-xl shadow-slate-900/10 active:scale-[0.98]"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              Buat Pesanan
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
        <div className="mt-6 flex items-center justify-center gap-4 opacity-40">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Global Payment Partner</span>
          <div className="flex gap-2">
            <div className="w-8 h-4 bg-slate-200 rounded"></div>
            <div className="w-8 h-4 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    </form>
  );
}
