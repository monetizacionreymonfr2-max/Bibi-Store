import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useConfig } from '../contexts/ConfigContext';
import { Settings, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

  const guardarTasa = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const ref = doc(db, 'configuracion', 'general');
      const docSnap = await getDoc(ref);
      if (docSnap.exists()) {
        await updateDoc(ref, { tasa_dolar: Number(nuevaTasa) });
      } else {
        // En caso de que no exista aún (first run para Admin)
        if (role === 'admin') {
          await setDoc(ref, { tasa_dolar: Number(nuevaTasa) });
        } else {
          alert("El documento de configuración no existe y no tienes permisos para crearlo.");
        }
      }
      alert("Tasa actualizada correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la tasa.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-w-4xl mx-auto w-full border-x-2 border-black">
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
