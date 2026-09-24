import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Scan, Sparkles, Loader2, RefreshCw, Zap, ZapOff, Upload, Check, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface ScannerProps {
  onScan: (text: string) => void;
  onClose: () => void;
  title?: string;
}

// Audio beep using Web Audio API for retail POS feedback
const playScannerBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch {}
  try {
    if (navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch {}
};

export default function Scanner({ onScan, onClose, title = "Escanear Código" }: ScannerProps) {
  const [mode, setMode] = useState<'barcode' | 'smart' | 'manual'>('barcode');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  
  // Smart scan state
  const [loadingSmart, setLoadingSmart] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const smartStreamRef = useRef<MediaStream | null>(null);

  // Html5Qrcode instance
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef(`reader-container-${Math.random().toString(36).substring(2, 9)}`).current;
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSuccessfulScan = useCallback((decodedText: string) => {
    playScannerBeep();
    onScan(decodedText.trim());
    onClose();
  }, [onScan, onClose]);

  // Clean stop for Html5Qrcode
  const stopHtml5Scanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Aviso al detener escáner:", err);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  // Stop smart scan camera
  const stopSmartCamera = () => {
    if (smartStreamRef.current) {
      smartStreamRef.current.getTracks().forEach(track => track.stop());
      smartStreamRef.current = null;
    }
  };

  // Start Barcode Scanner
  const startBarcodeScanner = useCallback(async (cameraIdToUse?: string) => {
    if (!isMountedRef.current) return;
    setError(null);
    setIsStartingCamera(true);

    await stopHtml5Scanner();

    try {
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ];

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        }
      });
      scannerRef.current = html5QrCode;

      // Scan box configuration
      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const w = Math.min(Math.floor(viewfinderWidth * 0.88), 380);
        const h = Math.min(Math.floor(viewfinderHeight * 0.45), 200);
        return { width: Math.max(w, 200), height: Math.max(h, 110) };
      };

      const scanConfig = {
        fps: 15,
        qrbox: qrboxFunction,
        aspectRatio: 1.0,
        disableFlip: false,
      };

      // Determine camera target
      let cameraConfig: any = cameraIdToUse ? cameraIdToUse : { facingMode: { ideal: "environment" } };

      try {
        await html5QrCode.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            if (isMountedRef.current) {
              handleSuccessfulScan(decodedText);
            }
          },
          () => {} // silent frame scanning
        );
      } catch (firstErr: any) {
        console.warn("Fallo con cámara trasera/específica, intentando cámara frontal/por defecto:", firstErr);
        // Fallback to user facing or default camera
        await html5QrCode.start(
          { facingMode: "user" },
          scanConfig,
          (decodedText) => {
            if (isMountedRef.current) {
              handleSuccessfulScan(decodedText);
            }
          },
          () => {}
        );
      }

      if (isMountedRef.current) {
        setIsScanning(true);
        // Check for torch support
        try {
          const track = html5QrCode.getRunningTrackCapabilities?.() as any;
          if (track && track.torch) {
            setHasTorch(true);
          }
        } catch {}
      }
    } catch (err: any) {
      console.error("Error al iniciar lector de código:", err);
      if (isMountedRef.current) {
        setIsScanning(false);
        const errStr = (err?.message || err?.name || '').toLowerCase();
        if (errStr.includes("permission") || errStr.includes("notallowed")) {
          setError("Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador.");
        } else if (errStr.includes("notfound") || errStr.includes("devicesnotfound")) {
          setError("No se detectó ninguna cámara en este dispositivo.");
        } else if (errStr.includes("notreadable") || errStr.includes("trackstart")) {
          setError("La cámara está siendo usada por otra aplicación o pestaña.");
        } else {
          setError("No se pudo iniciar la cámara. Puedes subir una foto o escribir el código manualmente.");
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsStartingCamera(false);
      }
    }
  }, [containerId, handleSuccessfulScan]);

  // Query available cameras on mount
  useEffect(() => {
    isMountedRef.current = true;

    Html5Qrcode.getCameras()
      .then(cams => {
        if (!isMountedRef.current) return;
        if (cams && cams.length > 0) {
          setCameras(cams);
          // Prefer back/rear camera
          const back = cams.find(c => /back|rear|trasera|environment/i.test(c.label));
          const chosen = back ? back.id : cams[cams.length - 1].id;
          setActiveCameraId(chosen);
        }
      })
      .catch(err => {
        console.warn("Aviso obteniendo lista de cámaras:", err);
      });

    return () => {
      isMountedRef.current = false;
      stopHtml5Scanner();
      stopSmartCamera();
    };
  }, []);

  // Mode changes
  useEffect(() => {
    if (mode === 'barcode') {
      stopSmartCamera();
      // Delay slightly to ensure DOM element is ready
      const t = setTimeout(() => {
        startBarcodeScanner(activeCameraId || undefined);
      }, 100);
      return () => clearTimeout(t);
    } else if (mode === 'smart') {
      stopHtml5Scanner();
      setIsScanning(false);
      
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } } })
        .then(stream => {
          if (!isMountedRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          smartStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsScanning(true);
          }
        })
        .catch(err => {
          console.error("Error iniciando cámara smart:", err);
          if (isMountedRef.current) {
            setError("No se pudo acceder a la cámara para el escaneo inteligente.");
          }
        });

      return () => {
        stopSmartCamera();
      };
    } else {
      // Manual mode
      stopHtml5Scanner();
      stopSmartCamera();
      setIsScanning(false);
    }
  }, [mode, activeCameraId, startBarcodeScanner]);

  // Switch camera toggle
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setActiveCameraId(nextCamId);
    startBarcodeScanner(nextCamId);
  };

  // Toggle torch
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any]
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn("Torch no soportado:", e);
    }
  };

  // Scan from uploaded file / photo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsStartingCamera(true);

    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;
      }

      // Stop video scan if running
      if (scanner.isScanning) {
        await scanner.stop();
      }

      const result = await scanner.scanFileV2(file, true);
      if (result && result.decodedText) {
        handleSuccessfulScan(result.decodedText);
      } else {
        setError("No se detectó ningún código de barras en la imagen seleccionada.");
      }
    } catch (err: any) {
      console.warn("Error leyendo imagen de código:", err);
      setError("No se pudo detectar código en la foto. Intenta con otra o escribe el código manualmente.");
    } finally {
      setIsStartingCamera(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Gemini Smart Scan
  const captureSmartScan = async () => {
    if (!videoRef.current || loadingSmart) return;
    
    setLoadingSmart(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No se pudo obtener el contexto del canvas");
      
      ctx.drawImage(videoRef.current, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No se ha configurado la clave de Gemini API para el modo inteligente. Puedes usar el modo Código de Barras o Entrada Manual.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      };
      
      const prompt = "Identify the product barcode number or reference code visible on the product in this image. Only output the exact code or number, with no punctuation or extra words. If none is found, reply with 'NOT_FOUND'.";
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, { text: prompt }] },
      });

      const text = response.text?.trim() || 'NOT_FOUND';
      if (text === 'NOT_FOUND' || text.length === 0) {
        setError("No se detectó ningún código o número en la imagen. Intenta de nuevo.");
      } else {
        const cleaned = text.replace(/[^a-zA-Z0-9_-]/g, '');
        handleSuccessfulScan(cleaned);
      }
    } catch (err: any) {
      console.error("Error en Gemini Smart Scan:", err);
      setError(err?.message || "Error al procesar escaneo con IA.");
    } finally {
      setLoadingSmart(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessfulScan(manualCode.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-black border-b border-yellow-400/30">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-yellow-400 rounded-full animate-ping" />
          <h2 className="text-white font-black uppercase tracking-widest text-sm sm:text-base">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'barcode' && cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="bg-white/10 hover:bg-white/20 text-white p-2 border border-white/20 flex items-center gap-1 text-xs font-bold uppercase transition-all"
              title="Cambiar de cámara"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Girar</span>
            </button>
          )}

          {mode === 'barcode' && hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 border transition-all text-xs font-bold uppercase flex items-center gap-1 ${
                torchOn ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white/10 text-white border-white/20'
              }`}
              title="Linterna"
            >
              {torchOn ? <ZapOff size={16} /> : <Zap size={16} />}
              <span className="hidden sm:inline">Flash</span>
            </button>
          )}

          <button 
            onClick={onClose} 
            className="text-white p-2 hover:bg-red-600 border border-white/20 hover:border-red-600 transition-colors"
            title="Cerrar escáner"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {mode === 'barcode' && (
          <div className="w-full max-w-md h-full max-h-[460px] relative flex flex-col items-center justify-center">
            {/* The container required by Html5Qrcode */}
            <div 
              id={containerId} 
              className="w-full h-full bg-black rounded border-2 border-white/20 overflow-hidden flex items-center justify-center relative [&>video]:w-full [&>video]:h-full [&>video]:object-cover" 
            />

            {/* Visual Guide Overlay (Red Laser line & Target corners) */}
            {isScanning && !error && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="w-full max-w-[280px] h-[140px] border-2 border-yellow-400/80 rounded relative shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                  {/* Laser beam */}
                  <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-yellow-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-yellow-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-yellow-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-yellow-400" />
                </div>
              </div>
            )}

            {isStartingCamera && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-yellow-400" size={36} />
                <p className="text-yellow-400 font-bold uppercase tracking-widest text-xs">
                  Iniciando cámara...
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'smart' && (
          <div className="w-full max-w-md h-full max-h-[460px] relative flex flex-col items-center justify-center bg-black border-2 border-white/20 rounded overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 border-[40px] border-black/60 pointer-events-none flex items-center justify-center">
              <div className="w-full h-full border-2 border-yellow-400 border-dashed animate-pulse relative flex items-center justify-center">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,1)]" />
              </div>
            </div>
            
            <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4">
              <button 
                onClick={captureSmartScan}
                disabled={loadingSmart}
                className="bg-yellow-400 text-black px-6 py-3 font-black uppercase tracking-widest flex items-center gap-2 border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 text-xs"
              >
                {loadingSmart ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                Capturar y Leer con IA
              </button>
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div className="w-full max-w-md bg-zinc-900 border-2 border-white/20 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <Scan size={24} />
              <h3 className="font-black uppercase tracking-wider text-sm">Entrada Manual de Código</h3>
            </div>
            <p className="text-xs text-gray-300 font-mono">
              Escribe el número de código de barras o referencia del producto (ej: 759100123456):
            </p>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input 
                type="text" 
                autoFocus
                placeholder="Escribe el código..." 
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="w-full p-3 font-mono font-bold text-lg bg-black text-white border-2 border-yellow-400 focus:outline-none uppercase"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="flex-1 bg-yellow-400 text-black p-3 font-black uppercase tracking-widest text-xs hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Usar Código
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error Notification Banner */}
        {error && (
          <div className="absolute top-4 left-4 right-4 max-w-md mx-auto bg-red-600 text-white p-3 border-2 border-white text-xs font-bold uppercase tracking-wider shadow-2xl flex items-start gap-2 animate-in slide-in-from-top-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button 
                  onClick={() => startBarcodeScanner(activeCameraId || undefined)} 
                  className="bg-white text-black px-2 py-1 text-[10px] font-black uppercase hover:bg-gray-200"
                >
                  Reintentar Cámara
                </button>
                <button 
                  onClick={() => setMode('manual')} 
                  className="bg-yellow-400 text-black px-2 py-1 text-[10px] font-black uppercase hover:bg-yellow-300"
                >
                  Escribir Código
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Quick Manual Input & Subir Imagen */}
      <div className="bg-black/90 border-t border-white/20 p-3 sm:p-4 space-y-3">
        {mode !== 'manual' && (
          <form onSubmit={handleManualSubmit} className="max-w-md mx-auto flex gap-2">
            <input 
              type="text"
              placeholder="O escribe el código aquí..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              className="flex-1 bg-zinc-900 border border-white/30 text-white px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-yellow-400"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim()}
              className="bg-yellow-400 text-black px-4 py-2 text-xs font-black uppercase hover:bg-white transition-all disabled:opacity-50 shrink-0"
            >
              Listo
            </button>
          </form>
        )}

        {/* Mode Selector Tabs & Upload Button */}
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <button 
            type="button"
            onClick={() => setMode('barcode')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 border text-[10px] font-black uppercase tracking-wider transition-all ${
              mode === 'barcode' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/30 hover:border-white'
            }`}
          >
            <Scan size={15} />
            <span>Cámara</span>
          </button>

          <label 
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 border border-white/30 text-white hover:border-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer bg-zinc-900 hover:bg-zinc-800"
            title="Subir imagen con código de barras"
          >
            <Upload size={15} />
            <span>Subir Foto</span>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </label>

          <button 
            type="button"
            onClick={() => setMode('smart')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 border text-[10px] font-black uppercase tracking-wider transition-all ${
              mode === 'smart' ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-transparent text-white border-white/30 hover:border-white'
            }`}
          >
            <Sparkles size={15} />
            <span>IA OCR</span>
          </button>

          <button 
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 border text-[10px] font-black uppercase tracking-wider transition-all ${
              mode === 'manual' ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-transparent text-white border-white/30 hover:border-white'
            }`}
          >
            <Check size={15} />
            <span>Manual</span>
          </button>
        </div>

        <p className="text-[10px] text-gray-400 font-mono text-center uppercase tracking-wider">
          {mode === 'barcode' && "Apunta al código de barras tradicional o QR."}
          {mode === 'smart' && "Fotografía números de referencia o precios con Gemini."}
          {mode === 'manual' && "Escribe el código numérico para ingresarlo directamente."}
        </p>
      </div>
    </div>
  );
}
