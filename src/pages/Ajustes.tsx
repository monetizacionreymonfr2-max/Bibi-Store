import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useConfig } from '../contexts/ConfigContext';
import { Settings, Save, Download, Copy, FileCode, X, Check, Database, UploadCloud, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { exportarProductosJSON, descargarJSON, ProductoExportJSON } from '../lib/exportProductos';
import { handleAutomatedMigration, MigrationProgress } from '../lib/supabaseMigration';

export default function Ajustes() {
  const { tasaDolar } = useConfig();
  const { role } = useAuth();
  const [nuevaTasa, setNuevaTasa] = useState('');
  const [guardando, setGuardando] = useState(false);
  
  const [exportando, setExportando] = useState(false);
  const [exportData, setExportData] = useState<ProductoExportJSON[] | null>(null);
  const [modalExportAbierto, setModalExportAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Estados para Migración Automática Supabase
  const [supabaseUrl, setSupabaseUrl] = useState(() => 
    import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_mig_url') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(() => 
    import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_mig_key') || ''
  );
  const [migrando, setMigrando] = useState(false);
  const [progresoMigracion, setProgresoMigracion] = useState<MigrationProgress | null>(null);
  const [migracionExito, setMigracionExito] = useState<string | null>(null);
  const [migracionError, setMigracionError] = useState<string | null>(null);

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
      const ref = doc(db, 'configuracion', 'general');
      const docSnap = await getDoc(ref);
      const data = { 
        tasa_dolar: Number(nuevaTasa)
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

  const handleExportarJSON = async () => {
    setExportando(true);
    const loadingToast = toast.loading("Obteniendo productos y costos de Firestore...");
    try {
      const data = await exportarProductosJSON();
      setExportData(data);
      descargarJSON(data, 'productos.json');
      console.log("=== RESULTADO EXPORTACIÓN PRODUCTOS (SUPABASE) ===");
      console.log(JSON.stringify(data, null, 2));
      toast.success(`Exportados ${data.length} productos a productos.json`, { id: loadingToast });
      setModalExportAbierto(true);
    } catch (err: any) {
      console.error("Error en handleExportarJSON:", err);
      const errMsg = err?.message || "Error al exportar productos";
      toast.error(errMsg, { id: loadingToast });
    } finally {
      setExportando(false);
    }
  };

  const handleEjecutarMigracionSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      toast.error("Por favor ingresa la URL y API Key de Supabase.");
      return;
    }

    // Guardar credenciales en localStorage para conveniencia del usuario
    localStorage.setItem('supabase_mig_url', supabaseUrl.trim());
    localStorage.setItem('supabase_mig_key', supabaseKey.trim());

    setMigrando(true);
    setMigracionError(null);
    setMigracionExito(null);
    setProgresoMigracion({ current: 0, total: 0, statusText: 'Iniciando migración...', percent: 0 });

    const toastId = toast.loading("Iniciando migración a Supabase...");

    try {
      const res = await handleAutomatedMigration(
        supabaseUrl.trim(),
        supabaseKey.trim(),
        Number(nuevaTasa) || tasaDolar || 1,
        (progress) => {
          setProgresoMigracion(progress);
        }
      );

      const msj = `¡Migración completada con éxito! Se procesaron ${res.totalMigrados} productos en Supabase.`;
      setMigracionExito(msj);
      toast.success(msj, { id: toastId, duration: 6000 });
    } catch (err: any) {
      console.error("Error en migración a Supabase:", err);
      const errorMsg = err?.message || "Error desconocido al migrar a Supabase.";
      setMigracionError(errorMsg);
      toast.error(`Error al migrar catálogo: ${errorMsg}`, { id: toastId, duration: 8000 });
    } finally {
      setMigrando(false);
    }
  };

  const copiarAlPortapapeles = () => {
    if (!exportData) return;
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopiado(true);
    toast.success("JSON copiado al portapapeles");
    setTimeout(() => setCopiado(false), 2000);
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

          {/* Automated Migration Section for Supabase */}
          <section className="bg-blue-50 border-4 border-blue-600 p-6 flex flex-col gap-5 shadow-[8px_8px_0px_rgba(37,99,235,1)] relative">
            <div className="flex items-center gap-3">
              <Database className="text-blue-700" size={28} />
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-black">
                  Migración Automática a Supabase
                </h2>
                <p className="text-xs font-mono text-gray-700 uppercase tracking-widest mt-0.5">
                  Procesa el catálogo local (productos, precios, costos e imágenes) y lo sube automáticamente a Supabase Storage y Supabase Database.
                </p>
              </div>
            </div>

            {/* Inputs de credenciales Supabase */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 border-2 border-black">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  Supabase URL
                </label>
                <input 
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  disabled={migrando}
                  className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none focus:border-blue-600 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  Supabase Anon / Service Key
                </label>
                <input 
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                  disabled={migrando}
                  className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none focus:border-blue-600 bg-gray-50"
                />
              </div>
            </div>

            {/* Requisitos previos informativos */}
            <div className="text-[11px] font-mono text-gray-700 bg-blue-100/70 p-3 border border-blue-300 space-y-1">
              <p className="font-bold uppercase text-blue-950 flex items-center gap-1">
                <AlertCircle size={14} /> Requisitos Previos en Supabase:
              </p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li><span className="font-bold">Bucket Storage:</span> Debe existir un bucket público llamado <code className="bg-white px-1 border border-black font-bold">productos</code>.</li>
                <li><span className="font-bold">Tabla DB:</span> Tabla <code className="bg-white px-1 border border-black font-bold">productos</code> con permisos RLS de INSERT/UPDATE.</li>
              </ul>
            </div>

            {/* Barra de Progreso y Estado */}
            {migrando && progresoMigracion && (
              <div className="bg-white border-2 border-black p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono font-black uppercase">
                  <span className="text-blue-800">{progresoMigracion.statusText}</span>
                  <span className="bg-blue-600 text-white px-2 py-0.5 font-bold">{progresoMigracion.percent}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 border-2 border-black overflow-hidden relative">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progresoMigracion.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Alerta de Éxito o Error */}
            {migracionExito && (
              <div className="p-3 bg-emerald-100 border-2 border-emerald-600 text-emerald-950 text-xs font-mono font-bold flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                <span>{migracionExito}</span>
              </div>
            )}

            {migracionError && (
              <div className="p-3 bg-red-100 border-2 border-red-600 text-red-950 text-xs font-mono font-bold flex items-center gap-2">
                <AlertCircle className="text-red-600 shrink-0" size={18} />
                <span>Error al migrar catálogo: {migracionError}</span>
              </div>
            )}

            {/* Botón Principal de Migración */}
            <div className="flex flex-wrap gap-3">
              <button 
                type="button"
                disabled={migrando || !supabaseUrl.trim() || !supabaseKey.trim()}
                onClick={handleEjecutarMigracionSupabase}
                className="bg-blue-600 text-white hover:bg-black hover:text-white border-2 border-black font-black px-8 py-4 uppercase tracking-widest flex items-center justify-center gap-3 transition-all text-sm disabled:opacity-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                {migrando ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    <span>Migrando Catálogo... ({progresoMigracion?.percent || 0}%)</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={22} />
                    <span>Migrar Catálogo a Supabase</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Export section for Supabase Migration */}
          <section className="bg-emerald-50 border-4 border-emerald-600 p-6 flex flex-col gap-4 shadow-[8px_8px_0px_rgba(5,150,105,1)] relative">
            <h2 className="text-xl font-black uppercase tracking-widest text-black flex items-center gap-2">
              <FileCode className="text-emerald-700" size={24} /> Exportar Productos para Supabase
            </h2>
            <p className="text-xs font-mono text-gray-700 uppercase tracking-widest leading-relaxed">
              Obtiene los datos de <code className="bg-white px-1 py-0.5 border border-black font-bold">productos</code> y <code className="bg-white px-1 py-0.5 border border-black font-bold">costos_productos</code> desde Firestore y genera el archivo <code className="bg-white px-1 py-0.5 border border-black font-bold text-emerald-800">productos.json</code> con la estructura exacta:
              <br />
              <span className="font-mono text-[11px] text-emerald-900 font-bold block mt-1">
                [ &#123; id, precio_usd, costo_usd, imagen_url &#125; ]
              </span>
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <button 
                type="button"
                disabled={exportando}
                onClick={handleExportarJSON}
                className="bg-black text-white hover:bg-emerald-500 hover:text-black border-2 border-black font-bold px-6 py-4 uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                {exportando ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <><Download size={20} /> Exportar y Descargar productos.json</>
                )}
              </button>

              {exportData && (
                <button
                  type="button"
                  onClick={() => setModalExportAbierto(true)}
                  className="bg-white text-black hover:bg-black hover:text-white border-2 border-black font-bold px-6 py-4 uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-sm"
                >
                  Ver / Copiar JSON
                </button>
              )}
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

      {/* Modal Visualizador / Copiador de JSON */}
      {modalExportAbierto && exportData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white border-4 border-black w-full max-w-3xl max-h-[85vh] flex flex-col shadow-[12px_12px_0px_rgba(0,0,0,1)]">
            <div className="p-4 border-b-2 border-black bg-emerald-400 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-wider text-black flex items-center gap-2">
                <FileCode size={20} /> productos.json ({exportData.length} ítems)
              </h3>
              <button 
                onClick={() => setModalExportAbierto(false)}
                className="bg-black text-white p-1 hover:bg-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-gray-900">
              <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(exportData, null, 2)}
              </pre>
            </div>

            <div className="p-4 border-t-2 border-black bg-gray-100 flex flex-wrap gap-3 justify-between items-center">
              <p className="text-xs font-mono text-gray-600 uppercase">
                {exportData.length} productos listos para Supabase
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copiarAlPortapapeles}
                  className="bg-black text-white border-2 border-black px-4 py-2 font-bold uppercase text-xs hover:bg-yellow-400 hover:text-black transition-all flex items-center gap-2"
                >
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                  {copiado ? "Copiado!" : "Copiar JSON"}
                </button>
                <button
                  onClick={() => descargarJSON(exportData, 'productos.json')}
                  className="bg-emerald-500 text-black border-2 border-black px-4 py-2 font-bold uppercase text-xs hover:bg-black hover:text-white transition-all flex items-center gap-2"
                >
                  <Download size={16} /> Volver a Descargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

