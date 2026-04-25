import React, { useState } from 'react';
import { User, Mail, Phone, Hash, CreditCard, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';

interface RegistrationFormProps {
  onSuccess: (data: { fullName: string, email: string, category: string, orderId?: string }) => void;
  onPending: (data: { orderId: string }) => void;
}

const RegistrationSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(10, 'Nomor WhatsApp minimal 10 digit').max(15, 'Nomor WhatsApp maksimal 15 digit').regex(/^[0-9]+$/, 'Hanya boleh berisi angka'),
  npa: z.string().optional(),
  category: z.enum(['guest', 'delegate']),
});

type FormErrors = {
  [K in keyof z.infer<typeof RegistrationSchema>]?: string;
};

declare global {
  interface Window {
    snap: any;
  }
}

const CATEGORIES = [
  { id: 'guest', name: 'Tamu / Undangan', price: 'Rp 5.000' },
  { id: 'delegate', name: 'Utusan', price: 'Gratis' },
];

export function RegistrationForm({ onSuccess, onPending }: RegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    npa: '',
    category: 'guest' as any,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Gagal memproses pendaftaran. Silakan coba lagi.');
        setLoading(false);
        return;
      }
      
      if (data.isFree) {
        toast.success('Pendaftaran Berhasil! Tiket dikirim ke email Anda.');
        onSuccess({ ...formData, orderId: data.orderId });
        return;
      }

      if (data.isDummy) {
        toast.success('Mode Demo: Pembayaran disimulasikan berhasil.');
        onSuccess({ ...formData, orderId: data.orderId });
        return;
      }

      if (data.token) {
        window.snap.pay(data.token, {
          onSuccess: function (result: any) {
            onSuccess({ ...formData, orderId: result.order_id });
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

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    // Clear error for the field being typed
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

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

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">Kategori Keanggotaan</label>
        <div className="grid grid-cols-1 gap-2">
          {CATEGORIES.map((cat) => (
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
              <span className="font-black text-emerald-600 text-sm tracking-tight">{cat.price}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-6">
        <button 
          disabled={loading}
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
