import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle2, XCircle, User, Activity } from 'lucide-react';
import { toast } from 'sonner';

export const QRScanner = () => {
  const [scanResult, setScanResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const startScanner = async () => {
    setIsCameraActive(true);
    setScanResult(null);

    // Give the DOM a moment to render the "reader" div
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0 // Square aspect ratio for the scan area
        };

        await html5QrCode.start(
          { facingMode: "user" }, // Usually kiosk uses front camera
          config,
          onScanSuccess,
          onScanFailure
        );
      } catch (err) {
        console.error("Failed to start scanner:", err);
        toast.error("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
        setIsCameraActive(false);
      }
    }, 200);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        // The div remains, we just stop the stream
        setIsCameraActive(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    } else {
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  async function onScanSuccess(decodedText: string) {
    try {
      const data = JSON.parse(decodedText);
      if (!data.id) throw new Error("Invalid QR Code");

      // Prevent duplicate scan in short time
      if (scanResult?.participant?.id === data.id && Date.now() - (scanResult?.timestamp || 0) < 5000) return;

      setIsLoading(true);

      const response = await fetch('/api/admin/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.id }),
      });

      const result = await response.json();

      if (response.ok) {
        setScanResult({ success: true, participant: result.participant, timestamp: Date.now() });
        toast.success(`Check-in berhasil: ${result.participant.fullName}`);
        
        // Auto clear result after 5 seconds but keep camera open
        setTimeout(() => {
           // We only clear if it's still the same result
           setScanResult((prev: any) => (prev?.participant?.id === result.participant.id ? null : prev));
        }, 5000);
      } else {
        setScanResult({ success: false, message: result.error, timestamp: Date.now() });
        toast.error(result.error);
        setTimeout(() => setScanResult(null), 3000);
      }
    } catch (err) {
      console.error("Scan Error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function onScanFailure() {
    // Silent
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl transition-all ${isCameraActive ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100 shadow-lg' : 'bg-indigo-50 text-indigo-600'}`}>
              <Camera size={28} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Terminal Check-in</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  {isCameraActive ? 'Kamera Aktif • Menunggu Scan' : 'Kamera Nonaktif'}
                </p>
              </div>
            </div>
          </div>

          {!isCameraActive ? (
            <button 
              onClick={startScanner}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              Buka Kamera
            </button>
          ) : (
            <button 
              onClick={stopScanner}
              className="px-8 py-4 bg-white border-2 border-red-100 text-red-600 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
            >
              Tutup Kamera
            </button>
          )}
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 border-8 border-slate-50 shadow-inner">
          {/* Scanner Container */}
          <div 
            id="reader" 
            className={`w-full transition-all duration-500 ${isCameraActive ? 'aspect-video md:aspect-[16/10] opacity-100' : 'h-0 opacity-0'}`}
          ></div>
          
          {/* Placeholder when camera off */}
          {!isCameraActive && (
            <div className="aspect-video md:aspect-[16/10] flex flex-col items-center justify-center p-12 cursor-pointer hover:bg-slate-800 transition-all group" onClick={startScanner}>
              <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-600 border border-slate-700 mb-6 group-hover:scale-110 transition-transform shadow-xl">
                <Camera size={40} />
              </div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Ketuk untuk Memulai Scanner</p>
            </div>
          )}

          {/* Scanner HUD Overlay */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-64 md:w-80 md:h-80 border-2 border-white/20 rounded-[2rem] relative">
                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-8 border-l-8 border-indigo-500 rounded-tl-3xl"></div>
                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-8 border-r-8 border-indigo-500 rounded-tr-3xl"></div>
                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-8 border-l-8 border-indigo-500 rounded-bl-3xl"></div>
                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-8 border-r-8 border-indigo-500 rounded-br-3xl"></div>
                
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-scan-line"></div>
              </div>
              <div className="mt-12 px-6 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Pusatkan QR Code</p>
              </div>
            </div>
          )}

          {/* Success/Error Toast Overlay */}
          {scanResult && (
            <div className={`absolute inset-x-0 bottom-0 p-8 transition-all animate-in slide-in-from-bottom-full duration-300 z-30`}>
               <div className={`p-6 rounded-3xl shadow-2xl flex items-center gap-6 border-2 ${scanResult.success ? 'bg-white border-emerald-500' : 'bg-white border-red-500'}`}>
                  <div className={`p-4 rounded-2xl ${scanResult.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {scanResult.success ? <CheckCircle2 size={36} /> : <XCircle size={36} />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${scanResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                      {scanResult.success ? 'Verifikasi Sukses' : 'Gagal Verifikasi'}
                    </p>
                    {scanResult.success ? (
                      <div>
                        <h4 className="text-xl font-black text-slate-900 uppercase leading-tight line-clamp-1">{scanResult.participant.fullName}</h4>
                        <div className="flex gap-2 mt-2">
                           <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase tracking-wider">{scanResult.participant.category}</span>
                        </div>
                      </div>
                    ) : (
                      <h4 className="text-lg font-black text-red-900 uppercase leading-tight">{scanResult.message}</h4>
                    )}
                  </div>
               </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-40 transition-all">
              <Activity className="text-white animate-bounce mb-4" size={48} />
              <p className="text-xs font-black text-white uppercase tracking-[0.4em]">Memproses Check-in...</p>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes scan-line {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
        #reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
    </div>
  );
};

