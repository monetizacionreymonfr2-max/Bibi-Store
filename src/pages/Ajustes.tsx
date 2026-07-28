import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useConfig } from '../contexts/ConfigContext';
import { Settings, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Ajustes() {
  const { tasaDolar } = useConfig();
  const { role } = useAuth();
  const [nuevaTasa, setNuevaTasa] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (tasaDolar) {
      setNuevaTasa(tasaDolar.toString());
    }
  }, [tasaDolar]);

  const guardarAjustes = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const loadingToast = toast.loading("Actualizando ajustes...");
    try {
      const { error } = await supabase.from('configuracion').upsert({
        id: 'general',
        tasa_dolar: Number(nuevaTasa),
        fecha_actualizacion: Date.now()
      });

      if (error) throw error;
      toast.success("Ajustes actualizados", { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      toast.error("Error al actualizar ajustes", { id: loadingToast });
    } finally {
      setGuardando(false);
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
        <form onSubmit={guardarAjustes} className="space-y-6">
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
                  <><Save size={20} /> Guardar</>
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

          <section className="bg-yellow-50 border-4 border-yellow-400 p-6 flex flex-col gap-4 shadow-[8px_8px_0px_rgba(250,204,21,1)] relative group">
             <h2 className="text-xl font-black uppercase tracking-widest text-black flex items-center gap-2">
                🛍️ Catálogo Online
             </h2>
             <p className="text-xs font-mono text-gray-600 uppercase tracking-widest flex items-center gap-1">
                Comparte este enlace con tus clientes para ventas online por WhatsApp.
             </p>
             <div className="flex flex-col sm:flex-row gap-3">
               <input 
                 readOnly 
                 value={`${window.location.origin}/tienda`}
                 className="flex-1 bg-white border-2 border-yellow-400 p-3 font-mono text-sm focus:outline-none focus:border-black transition-colors text-black"
               />
               <div className="flex gap-2">
                 <button 
                    type="button"
                    onClick={() => {
                       navigator.clipboard.writeText(`${window.location.origin}/tienda`);
                       toast.success("Enlace copiado");
                    }}
                    className="flex-1 sm:flex-none justify-center font-bold px-6 py-3 uppercase tracking-widest border-2 border-black bg-white hover:bg-black hover:text-white transition-all text-sm"
                 >
                   Copiar
                 </button>
                 <a 
                   href="/tienda" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="flex-1 sm:flex-none flex items-center justify-center font-bold px-6 py-3 uppercase tracking-widest border-2 border-black bg-yellow-400 hover:bg-black hover:text-white transition-all text-sm"
                 >
                   Abrir
                 </a>
               </div>
             </div>
          </section>
        </form>
      </div>
    </div>
  );
}
