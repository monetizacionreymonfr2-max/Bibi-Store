import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useConfig } from '../contexts/ConfigContext';
import { Settings, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Ajustes() {
  const { tasaDolar, logoUrl } = useConfig();
  const { role } = useAuth();
  const [nuevaTasa, setNuevaTasa] = useState('');
  const [nuevoLogoUrl, setNuevoLogoUrl] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tasaDolar) {
      setNuevaTasa(tasaDolar.toString());
    }
    if (logoUrl) {
      setNuevoLogoUrl(logoUrl);
    }
  }, [tasaDolar, logoUrl]);

  const guardarTasa = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const loadingToast = toast.loading("Actualizando ajustes...");
    try {
      const ref = doc(db, 'configuracion', 'general');
      const docSnap = await getDoc(ref);
      const data = { 
        tasa_dolar: Number(nuevaTasa),
        logo_url: nuevoLogoUrl
      };

      if (docSnap.exists()) {
        await updateDoc(ref, data);
      } else {
        await setDoc(ref, data);
      }
      toast.success("Ajustes actualizados", { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar ajustes", { id: loadingToast });
    } finally {
      setGuardando(false);
    }
  };

  const manejarSubidaLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!navigator.onLine) {
      toast.error("No hay conexión a internet para subir el logo.");
      return;
    }

    setSubiendoLogo(true);
    const loadingToast = toast.loading("Subiendo logo... (esto puede tardar)");
    
    // Safety timeout for upload
    const uploadTimeout = setTimeout(() => {
      setSubiendoLogo(false);
      toast.error("La subida tardó demasiado. Verifique su conexión.", { id: loadingToast });
    }, 20000);

    try {
      console.log("Iniciando subida de logo:", file.name, file.size);
      // Path simplificado y uso de metadata para evitar problemas
      const storageRef = ref(storage, `config/business_logo_${Date.now()}`);
      
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type
      });
      
      console.log("Snapshot de subida obtenido, obteniendo URL...");
      const url = await getDownloadURL(snapshot.ref);
      
      console.log("URL de logo generada:", url);
      setNuevoLogoUrl(url);
      clearTimeout(uploadTimeout);
      toast.success("Logo cargado. Presione 'Actualizar' para guardar cambios.", { id: loadingToast });
    } catch (err) {
      clearTimeout(uploadTimeout);
      console.error("Error detallado en subida de logo:", err);
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
      
      if (errorMsg.includes("storage/unauthorized")) {
        toast.error("Error: Sin permisos para subir a Storage. Configure las reglas.", { id: loadingToast, duration: 6000 });
      } else {
        toast.error("Error al subir logo: " + errorMsg, { id: loadingToast });
      }
    } finally {
      setSubiendoLogo(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-w-4xl mx-auto w-full border-x-2 border-black overflow-y-auto pb-24">
      <div className="p-6 border-b-2 border-black flex items-center gap-3 bg-gray-50">
        <Settings size={32} />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-black">Ajustes del Sistema</h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mt-1">Configuración general de Bibi Store</p>
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">
        <form onSubmit={guardarTasa} className="space-y-6">
          <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] relative">
            <h2 className="text-xl font-extrabold text-black mb-4 uppercase tracking-tight">Identidad Visual</h2>
            
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
              <div className="w-32 h-32 border-4 border-black bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 relative group">
                {nuevoLogoUrl ? (
                  <img src={nuevoLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={48} className="text-gray-300" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                  <span className="text-[10px] font-bold text-white uppercase text-center">Cambiar Imagen</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-black">Logo del Negocio</h3>
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1">
                    Esta imagen se mostrará en el ticket, pantalla de inicio y reportes.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={manejarSubidaLogo}
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendoLogo}
                    className="bg-white border-2 border-black px-4 py-2 text-xs font-black uppercase flex items-center gap-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <Upload size={14} /> {subiendoLogo ? 'Subiendo...' : 'Subir Logo'}
                  </button>
                  {nuevoLogoUrl && (
                    <button 
                      type="button" 
                      onClick={() => setNuevoLogoUrl('')}
                      className="text-red-600 text-xs font-bold uppercase hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] relative">
            <label className="block text-xl font-extrabold text-black mb-2 uppercase tracking-tight">Tasa de Cambio (VED)</label>
            <p className="text-xs font-mono text-gray-500 mb-6 uppercase tracking-widest">Esta tasa se usará en toda la aplicación para calcular los precios en Bolívares.</p>
            
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">Valor Oficial / USD</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Bs.</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="1"
                    required
                    value={nuevaTasa}
                    onChange={e => setNuevaTasa(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 text-xl font-mono font-bold border-2 border-black rounded-none focus:outline-none focus:border-yellow-400 bg-gray-50 transition-colors"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={guardando || !nuevaTasa || Number(nuevaTasa) <= 0}
                className="w-full sm:w-auto bg-black text-white hover:bg-yellow-400 hover:text-black border-2 border-black disabled:bg-gray-400 font-bold px-8 py-4 uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {guardando ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <><Save size={20} /> Actualizar</>
                )}
              </button>
            </div>
          </section>
          
          {(role === 'admin' || role === 'superadmin') && (
            <section className="bg-gray-50 border-2 border-dashed border-gray-400 hover:border-black transition-colors p-6 flex flex-col gap-2">
              <h2 className="text-lg font-black uppercase tracking-widest text-black">Opciones de Administrador</h2>
              <p className="text-xs font-mono text-gray-600 uppercase tracking-widest">
                Esta es la vista de opciones avanzadas. El panel creador está disponible en otra pestaña exclusiva.
              </p>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}
