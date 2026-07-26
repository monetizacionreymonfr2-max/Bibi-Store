import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Plus, Trash2, KeyRound, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface CodigoAcceso {
  id: string;
  rol: 'admin' | 'cajero';
  usado: boolean;
  usadoPor?: string;
  creadoPor: string;
  creadoEn: number;
}

export default function PanelCreador() {
  const { role, user } = useAuth();
  const [codigos, setCodigos] = useState<CodigoAcceso[]>([]);
  const [generando, setGenerando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const esAutorizado = role === 'superadmin' || role === 'admin';

  useEffect(() => {
    if (!esAutorizado) return;

    const unsub = onSnapshot(collection(db, 'codigos'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CodigoAcceso));
      setCodigos(data.sort((a,b) => b.creadoEn - a.creadoEn));
    });

    return () => unsub();
  }, [esAutorizado]);

  const crearCodigo = async (rol: 'admin' | 'cajero') => {
    if (!user) return;
    setGenerando(true);
    const loadingToast = toast.loading("Generando código de acceso...");
    try {
      const codeClean = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      await setDoc(doc(db, 'codigos', codeClean), {
        rol,
        usado: false,
        creadoPor: user.uid,
        creadoEn: Date.now()
      });

      toast.success(`Código ${codeClean} generado con éxito`, { id: loadingToast, duration: 4000 });
    } catch (err: any) {
      console.error(err);
      toast.error("Error al generar código: " + (err?.message || "Sin permisos"), { id: loadingToast });
    } finally {
      setGenerando(false);
    }
  };

  const copiarCodigo = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiadoId(code);
    toast.success(`Código ${code} copiado`);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const eliminarCodigo = async (id: string) => {
    if (!confirm(`¿Seguro que desea eliminar el código ${id}?`)) return;
    try {
      await deleteDoc(doc(db, 'codigos', id));
      toast.success("Código eliminado");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar código.");
    }
  };

  if (!esAutorizado) {
    return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest">ACCESO DENEGADO</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 overflow-y-auto w-full max-h-screen">
      <div className="flex items-center gap-3 text-red-600 border-b-2 border-black pb-4">
        <ShieldAlert size={32} />
        <h1 className="text-2xl font-extrabold tracking-tighter text-gray-900 uppercase">Gestión de Códigos de Acceso</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generar Código Administradora */}
        <div className="bg-white p-6 border-2 border-black flex flex-col gap-4 group hover:bg-orange-50 transition-colors">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-lg uppercase tracking-wider">Código para Administradora / Dueña</h2>
            <KeyRound className="text-orange-500" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Genera un código de un solo uso para asignar rol de Administrador (acceso total a inventario, estadísticas y ventas).
          </p>
          <button
            onClick={() => crearCodigo('admin')}
            disabled={generando}
            className="mt-auto bg-black text-white hover:bg-yellow-400 hover:text-black border-2 border-black font-bold py-3 uppercase tracking-widest flex justify-center items-center gap-2 transition-all disabled:opacity-50"
          >
            <Plus size={18} /> Crear Código Administrador
          </button>
        </div>

        {/* Generar Código Cajera */}
        <div className="bg-white p-6 border-2 border-black flex flex-col gap-4 group hover:bg-gray-50 transition-colors">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-lg uppercase tracking-wider">Código para Cajera</h2>
            <KeyRound className="text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Genera un código de un solo uso para dar permisos de Cajera (módulo de punto de venta y catálogo).
          </p>
          <button
            onClick={() => crearCodigo('cajero')}
            disabled={generando}
            className="mt-auto border-2 border-black bg-white text-black hover:bg-black hover:text-white font-bold py-3 uppercase tracking-widest flex justify-center items-center gap-2 transition-all disabled:opacity-50"
          >
            <Plus size={18} /> Crear Código Cajero
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-black flex-1 flex flex-col mt-4">
        <div className="p-4 border-b border-black flex justify-between items-center bg-gray-50">
          <h2 className="font-black uppercase tracking-widest text-sm">Códigos Emitidos</h2>
          <span className="font-mono text-xs bg-black text-white px-2 py-1">{codigos.length}</span>
        </div>
        <div className="overflow-x-auto min-h-[300px] p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-gray-200 text-gray-500 uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-4 font-bold">Código (Token)</th>
                <th className="p-4 font-bold">Rol</th>
                <th className="p-4 font-bold">Estado</th>
                <th className="p-4 font-bold">Fecha</th>
                <th className="p-4 font-bold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codigos.map(cod => (
                <tr key={cod.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-lg text-gray-900 tracking-wider flex items-center gap-2">
                    <span className="bg-yellow-100 px-2 py-1 border border-black">{cod.id}</span>
                    <button
                      onClick={() => copiarCodigo(cod.id)}
                      className="p-1.5 text-gray-500 hover:text-black border border-gray-300 hover:border-black bg-white transition-all rounded"
                      title="Copiar código"
                    >
                      {copiadoId === cod.id ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 font-black uppercase text-[10px] tracking-widest ${cod.rol === 'admin' ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                      {cod.rol === 'admin' ? 'ADMIN' : 'CAJERA'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 font-bold uppercase text-[10px] tracking-widest ${cod.usado ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'}`}>
                      {cod.usado ? 'USADO' : 'DISPONIBLE'}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-500 font-mono">{format(cod.creadoEn, 'dd/MM/yy HH:mm')}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => eliminarCodigo(cod.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {codigos.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400 uppercase tracking-widest font-bold text-xs">Aún no has generado códigos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
