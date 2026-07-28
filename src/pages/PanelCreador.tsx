import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Plus, Trash2, KeyRound, Copy, Check, ToggleLeft, ToggleRight, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CodigoAcceso } from '../types';

export default function PanelCreador() {
  const { role, user } = useAuth();
  const [codigos, setCodigos] = useState<CodigoAcceso[]>([]);
  const [generando, setGenerando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [nombreNota, setNombreNota] = useState('');

  const esAutorizado = role === 'superadmin' || role === 'admin';

  const fetchCodigos = async () => {
    try {
      // Fetch from codigos_acceso and fallback/combine with codigos
      const { data: dataAcceso } = await supabase.from('codigos_acceso').select('*');
      const { data: dataCodigos } = await supabase.from('codigos').select('*');

      const combined: Record<string, CodigoAcceso> = {};

      if (dataCodigos) {
        dataCodigos.forEach((item: any) => {
          const codeKey = item.codigo || item.id;
          combined[codeKey] = {
            id: codeKey,
            codigo: codeKey,
            rol: item.rol || 'cajero',
            activo: item.activo !== false,
            usado: item.usado === true,
            usadoPor: item.usadoPor,
            creadoPor: item.creadoPor,
            creadoEn: item.creadoEn || (item.created_at ? new Date(item.created_at).getTime() : Date.now()),
            nombre: item.nombre || item.descripcion || 'Código de Acceso'
          };
        });
      }

      if (dataAcceso) {
        dataAcceso.forEach((item: any) => {
          const codeKey = item.codigo || item.id;
          combined[codeKey] = {
            id: codeKey,
            codigo: codeKey,
            rol: item.rol || 'cajero',
            activo: item.activo !== false,
            usado: item.usado === true,
            usadoPor: item.usadoPor,
            creadoPor: item.creadoPor,
            creadoEn: item.creadoEn || (item.created_at ? new Date(item.created_at).getTime() : Date.now()),
            nombre: item.nombre || item.descripcion || 'Código de Acceso'
          };
        });
      }

      const list = Object.values(combined).sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
      setCodigos(list);
    } catch (err) {
      console.error("Error fetching codigos:", err);
    }
  };

  useEffect(() => {
    if (!esAutorizado) return;

    fetchCodigos();

    const channel1 = supabase
      .channel('codigos_acceso_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'codigos_acceso' }, () => {
        fetchCodigos();
      })
      .subscribe();

    const channel2 = supabase
      .channel('codigos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'codigos' }, () => {
        fetchCodigos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [esAutorizado]);

  const crearCodigo = async (rol: 'superadmin' | 'admin' | 'cajero') => {
    setGenerando(true);
    const loadingToast = toast.loading(`Generando código para ${rol.toUpperCase()}...`);
    try {
      const codeClean = Math.random().toString(36).substring(2, 8).toUpperCase();
      const notaFinal = nombreNota.trim() || `Código asignado para ${rol.toUpperCase()}`;

      const payload = {
        id: codeClean,
        codigo: codeClean,
        rol,
        activo: true,
        usado: false,
        nombre: notaFinal,
        descripcion: notaFinal,
        creadoPor: user?.id || user?.uid || 'superadmin',
        creadoEn: Date.now(),
        created_at: new Date().toISOString()
      };

      // Save to both tables for compatibility
      await supabase.from('codigos').upsert(payload);
      await supabase.from('codigos_acceso').upsert(payload);

      setNombreNota('');
      await fetchCodigos();
      toast.success(`¡Código ${codeClean} generado con éxito!`, { id: loadingToast, duration: 5000 });
    } catch (err: any) {
      console.error(err);
      toast.error("Error al generar código: " + (err?.message || "Ocurrió un error"), { id: loadingToast });
    } finally {
      setGenerando(false);
    }
  };

  const toggleEstadoCodigo = async (cod: CodigoAcceso) => {
    const nuevoEstado = !cod.activo;
    const loadingToast = toast.loading(nuevoEstado ? "Activando código..." : "Desactivando código...");
    try {
      const payload = { activo: nuevoEstado, inactivo: !nuevoEstado };
      
      await supabase.from('codigos').update(payload).or(`id.eq.${cod.id},codigo.eq.${cod.id}`);
      await supabase.from('codigos_acceso').update(payload).or(`id.eq.${cod.id},codigo.eq.${cod.id}`);

      await fetchCodigos();
      toast.success(nuevoEstado ? "Código activado con éxito" : "Código desactivado/revocado", { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      toast.error("Error al actualizar estado del código", { id: loadingToast });
    }
  };

  const copiarCodigo = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiadoId(code);
    toast.success(`Código ${code} copiado al portapapeles`);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const eliminarCodigo = async (id: string) => {
    if (!confirm(`¿Seguro que desea eliminar permanentemente el código ${id}?`)) return;
    const loadingToast = toast.loading("Eliminando código...");
    try {
      await supabase.from('codigos').delete().or(`id.eq.${id},codigo.eq.${id}`);
      await supabase.from('codigos_acceso').delete().or(`id.eq.${id},codigo.eq.${id}`);

      await fetchCodigos();
      toast.success("Código eliminado de la base de datos", { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar código.", { id: loadingToast });
    }
  };

  if (!esAutorizado) {
    return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest">ACCESO DENEGADO</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 overflow-y-auto w-full max-h-screen">
      <div className="flex items-center gap-3 text-red-600 border-b-2 border-black pb-4">
        <ShieldAlert size={32} />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-gray-900 uppercase">Gestión de Códigos de Acceso</h1>
          <p className="text-xs text-gray-500 font-mono">Control y creación de códigos en tiempo real (Supabase)</p>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-black p-4 flex flex-col gap-2">
        <label className="text-xs font-black uppercase tracking-widest text-black">
          Nombre o Nota Opcional para el Código
        </label>
        <input
          type="text"
          placeholder="Ej: Turno Mañana Cajera / Administradora Local 1"
          value={nombreNota}
          onChange={e => setNombreNota(e.target.value)}
          className="bg-white border-2 border-black p-2.5 text-xs font-mono tracking-wider focus:outline-none focus:border-yellow-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generar Código Administradora */}
        <div className="bg-white p-6 border-2 border-black flex flex-col gap-4 group hover:bg-orange-50 transition-colors shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-lg uppercase tracking-wider">Código para Administradora</h2>
            <KeyRound className="text-orange-500" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Genera un código dinámico para asignar acceso de **Administradora** (inventario, costos, reportes y ventas).
          </p>
          <button
            onClick={() => crearCodigo('admin')}
            disabled={generando}
            className="mt-auto bg-black text-white hover:bg-yellow-400 hover:text-black border-2 border-black font-bold py-3 uppercase tracking-widest flex justify-center items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus size={18} /> Crear Código Administradora
          </button>
        </div>

        {/* Generar Código Cajera */}
        <div className="bg-white p-6 border-2 border-black flex flex-col gap-4 group hover:bg-gray-50 transition-colors shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-lg uppercase tracking-wider">Código para Cajera</h2>
            <KeyRound className="text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Genera un código dinámico para asignar acceso de **Cajera** (punto de venta y fiados).
          </p>
          <button
            onClick={() => crearCodigo('cajero')}
            disabled={generando}
            className="mt-auto border-2 border-black bg-white text-black hover:bg-black hover:text-white font-bold py-3 uppercase tracking-widest flex justify-center items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus size={18} /> Crear Código Cajera
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-black flex-1 flex flex-col mt-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
        <div className="p-4 border-b-2 border-black flex justify-between items-center bg-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-black" />
            <h2 className="font-black uppercase tracking-widest text-sm">Códigos Registrados en Supabase</h2>
          </div>
          <span className="font-mono text-xs bg-black text-white px-2.5 py-1 font-bold">{codigos.length} códigos</span>
        </div>
        <div className="overflow-x-auto min-h-[300px] p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b-2 border-black bg-gray-50 text-gray-600 uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-4 font-bold">Código (Token)</th>
                <th className="p-4 font-bold">Descripción / Nombre</th>
                <th className="p-4 font-bold">Rol Asignado</th>
                <th className="p-4 font-bold">Estado</th>
                <th className="p-4 font-bold">Fecha</th>
                <th className="p-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {codigos.map(cod => {
                const esActivo = cod.activo !== false;
                return (
                  <tr key={cod.id} className="hover:bg-yellow-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-base text-gray-900 tracking-wider">
                      <div className="flex items-center gap-2">
                        <span className="bg-yellow-100 px-2.5 py-1 border border-black">{cod.codigo || cod.id}</span>
                        <button
                          onClick={() => copiarCodigo(cod.codigo || cod.id)}
                          className="p-1.5 text-gray-600 hover:text-black border border-gray-400 hover:border-black bg-white transition-all rounded cursor-pointer"
                          title="Copiar código"
                        >
                          {copiadoId === (cod.codigo || cod.id) ? <Check size={16} className="text-green-600 font-bold" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-gray-700">
                      {cod.nombre || 'Sin descripción'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 font-black uppercase text-[10px] tracking-widest ${
                        cod.rol === 'superadmin' ? 'bg-purple-100 text-purple-900 border border-purple-400' :
                        cod.rol === 'admin' ? 'bg-orange-100 text-orange-900 border border-orange-400' :
                        'bg-blue-100 text-blue-900 border border-blue-400'
                      }`}>
                        {cod.rol === 'superadmin' ? 'SUPERADMIN' : cod.rol === 'admin' ? 'ADMINISTRADORA' : 'CAJERA'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 font-bold uppercase text-[10px] tracking-widest ${
                          !esActivo ? 'bg-red-100 text-red-800 border border-red-400' :
                          cod.usado ? 'bg-amber-100 text-amber-800 border border-amber-400' :
                          'bg-green-100 text-green-800 border border-green-400'
                        }`}>
                          {!esActivo ? 'DESACTIVADO' : cod.usado ? 'USADO' : 'ACTIVO'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-mono">
                      {cod.creadoEn ? format(cod.creadoEn, 'dd/MM/yy HH:mm') : 'N/A'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleEstadoCodigo(cod)}
                          className={`p-1.5 border border-black font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            esActivo ? 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white' : 'bg-green-50 text-green-700 hover:bg-green-600 hover:text-white'
                          }`}
                          title={esActivo ? "Desactivar / Revocar código" : "Activar código"}
                        >
                          {esActivo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {esActivo ? "Desactivar" : "Activar"}
                        </button>

                        <button
                          onClick={() => eliminarCodigo(cod.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-all cursor-pointer"
                          title="Eliminar código"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {codigos.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 uppercase tracking-widest font-bold text-xs">
                    No hay códigos registrados en Supabase.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
