import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, writeBatch, query, limit, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { Producto } from '../types';
import { formatUSD, formatBs, cn } from '../lib/utils';
import { Plus, Edit2, Trash2, Search, X, Scan } from 'lucide-react';
import Scanner from '../components/Scanner';
import toast from 'react-hot-toast';

export default function Inventario() {
  const { role } = useAuth();
  const { tasaDolar } = useConfig();
  const [productos, setProductos] = useState<(Producto & { costo_usd?: number })[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  // Form state
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [margen, setMargen] = useState('');
  const [stock, setStock] = useState('');
  const [unidadMedida, setUnidadMedida] = useState<'unid' | 'kg'>('unid');
  const [codigo, setCodigo] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);

  const isAdmin = role === 'admin' || role === 'superadmin';

  const handleCostoChange = (val: string) => {
    setCosto(val);
    const c = parseFloat(val);
    const m = parseFloat(margen);
    if (!isNaN(c) && !isNaN(m)) {
      setPrecio((c + (c * m / 100)).toFixed(2));
    }
  };

  const handleMargenChange = (val: string) => {
    setMargen(val);
    const m = parseFloat(val);
    const c = parseFloat(costo);
    if (!isNaN(m) && !isNaN(c)) {
      setPrecio((c + (c * m / 100)).toFixed(2));
    }
  };

  const handlePrecioChange = (val: string) => {
    setPrecio(val);
    const p = parseFloat(val);
    const c = parseFloat(costo);
    if (!isNaN(p) && !isNaN(c) && c > 0) {
      setMargen((((p - c) / c) * 100).toFixed(2));
    } else {
      setMargen('');
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if(blob) {
            const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            setImagenArchivo(compressedFile);
            setImagenUrl(canvas.toDataURL('image/jpeg', 0.8));
          }
        }, 'image/jpeg', 0.8);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    // Escuchar productos con limite para optimizar cuota
    const q = query(collection(db, 'productos'), limit(100));
    const unsubProd = onSnapshot(q, (snap) => {
      const prodData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto));
      
      if (isAdmin) {
        const unsubCost = onSnapshot(collection(db, 'costos_productos'), (snapCost) => {
          const costData: Record<string, number> = {};
          snapCost.forEach(d => { costData[d.id] = d.data().costo_usd; });
          
          setProductos(prodData.map(p => ({ ...p, costo_usd: costData[p.id] || 0 })));
        });
        return () => { unsubCost(); };
      } else {
        setProductos(prodData);
      }
    });

    return () => unsubProd();
  }, [isAdmin]);

  const prodFiltrados = productos.filter(p => {
    const term = busqueda.toLowerCase();
    const matchNombre = p.nombre.toLowerCase().includes(term);
    const matchRef = p.codigo_barras && p.codigo_barras.toLowerCase().includes(term);
    return matchNombre || matchRef;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda && prodFiltrados.length === 0) {
        buscarRemoto();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [busqueda, prodFiltrados.length]);

  // Búsqueda profunda para códigos de barras no cargados en los primeros 100
  const buscarRemoto = async () => {
    if (!busqueda) return;
    const term = busqueda.toLowerCase();
    const matchLocal = productos.some(p => p.codigo_barras?.toLowerCase() === term);
    
    if (!matchLocal) {
      const q = query(collection(db, 'productos'), where('codigo_barras', '==', busqueda));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = snap.docs[0];
        const prod = { id: p.id, ...p.data() } as Producto;
        setProductos(prev => [prod, ...prev]);
        toast.success("Producto encontrado");
      }
    }
  };

  const abrirModal = (prod?: Producto & { costo_usd?: number }) => {
    setImagenArchivo(null);
    if (prod) {
      setEditandoId(prod.id);
      setNombre(prod.nombre);
      setPrecio(prod.precio_usd.toString());
      setCosto(prod.costo_usd?.toString() || '');
      setStock(prod.stock.toString());
      setUnidadMedida(prod.unidad_medida || 'unid');
      setCodigo(prod.codigo_barras);
      setImagenUrl(prod.imagen_url || '');

      if (prod.costo_usd && prod.costo_usd > 0) {
        setMargen((((prod.precio_usd - prod.costo_usd) / prod.costo_usd) * 100).toFixed(2));
      } else {
        setMargen('');
      }
    } else {
      setEditandoId(null);
      setNombre('');
      setPrecio('');
      setCosto('');
      setStock('');
      setUnidadMedida('unid');
      setCodigo('');
      setImagenUrl('');
      setMargen('');
    }
    setModalAbierto(true);
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(imagenArchivo ? "Subiendo foto optimizada..." : "Guardando producto...");
    setGuardando(true);
    
    try {
      let finalImagenUrl = imagenUrl;

      // Subir a Firebase Storage si hay un archivo nuevo
      if (imagenArchivo) {
        if (!navigator.onLine) {
          toast.error("Sin internet: La foto NO se guardará.", { duration: 3000 });
        } else {
          try {
            const storageRef = ref(storage, `productos/${Date.now()}_${imagenArchivo.name}`);
            const snapshot = await uploadBytes(storageRef, imagenArchivo);
            finalImagenUrl = await getDownloadURL(snapshot.ref);
            toast.loading("Guardando datos...", { id: loadingToast });
          } catch (storageError) {
            console.error("Storage upload failed:", storageError);
            toast.error("Error al subir imagen. Guardando sin foto.", { duration: 3000, id: loadingToast });
          }
        }
      }

      const payloadObj = {
        nombre: nombre.trim(),
        precio_usd: Number(precio) || 0,
        stock: Number(stock) || 0,
        unidad_medida: unidadMedida,
        codigo_barras: (codigo || "N/A").trim(),
        imagen_url: finalImagenUrl || ""
      };
      
      const batch = writeBatch(db);

      if (editandoId) {
        const prodRef = doc(db, 'productos', editandoId);
        batch.update(prodRef, payloadObj);
        
        // Cajeros can't update cost, only admins
        if (isAdmin) {
          const costoRef = doc(db, 'costos_productos', editandoId);
          batch.set(costoRef, { costo_usd: Number(costo) || 0 }, { merge: true });
        }
      } else {
        const newProdRef = doc(collection(db, 'productos'));
        batch.set(newProdRef, payloadObj);
        
        // When creating, anyone (admin or cajero) needs to set the initial cost
        const newCostoRef = doc(db, 'costos_productos', newProdRef.id);
        batch.set(newCostoRef, { costo_usd: Number(costo) || 0 });
      }
      
      batch.commit().then(() => {
        toast.success("Opciones sincronizadas.", { id: loadingToast, duration: 2000 });
      }).catch(err => {
        console.error("Batch fallback:", err);
        toast.error("Error de conexión: " + err.message, { id: loadingToast, duration: 5000 });
      });
      
      setModalAbierto(false);
    } catch (err) {
      console.error("Error detallado al guardar:", err);
      toast.error("Error inesperado al guardar.", { id: loadingToast, duration: 5000 });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (id: string) => {
    if(!confirm("¿Seguro que desea eliminar este producto?")) return;
    try {
      if (isAdmin) {
        await deleteDoc(doc(db, 'costos_productos', id));
      }
      await deleteDoc(doc(db, 'productos', id));
      toast.success("Producto eliminado");
    } catch (err) {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header and Search */}
      <div className="p-4 md:p-6 border-b border-black flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-gray-50/50">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest flex items-center gap-2">
            Catálogo
          </h1>
          <p className="text-[10px] font-mono uppercase text-gray-400 mt-1">{productos.length} Productos Registrados</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o barras..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-2 border-black rounded-none focus:outline-none focus:border-yellow-500 font-mono text-xs uppercase"
            />
          </div>
          {(isAdmin || role === 'cajero') && (
            <button 
              onClick={() => abrirModal()}
              className="bg-yellow-400 text-black border-2 border-black px-4 py-2 font-bold uppercase tracking-wider text-xs hover:bg-black hover:text-white transition-all flex items-center gap-2"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-20">
          {prodFiltrados.map(prod => (
            <div key={prod.id} className="bg-white border-2 border-black group flex flex-col p-3 md:p-5 hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all relative">
              {/* Product Image Fallback or Display */}
              <div className="h-24 md:h-32 mb-3 bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden relative">
                {prod.imagen_url ? (
                  <img src={prod.imagen_url} alt={prod.nombre} className="h-full w-full object-contain mix-blend-multiply" />
                ) : (
                  <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Sin Imagen</span>
                )}
                {/* Stock Badge Overlay */}
                <div className={cn(
                  "absolute bottom-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter border-l border-t border-black transition-colors",
                  prod.stock <= 5 ? "bg-red-500 text-white animate-pulse" : "bg-black text-white"
                )}>
                  {prod.unidad_medida === 'kg' ? `Stock: ${prod.stock.toFixed(3)} Kg` : `Stock: ${prod.stock}`}
                </div>
              </div>

              {/* Info Area */}
              <div className="flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[70%]">{prod.codigo_barras || 'N/A'}</span>
                  <div className="flex gap-2">
                    {(isAdmin || role === 'cajero') && (
                      <button onClick={() => abrirModal(prod)} className="text-gray-400 hover:text-black transition-colors"><Edit2 size={12} /></button>
                    )}
                    {isAdmin && (
                      <button onClick={() => eliminarProducto(prod.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                <h3 className="font-extrabold text-sm md:text-base leading-tight mb-2 line-clamp-2 min-h-[2.5rem]">{prod.nombre}</h3>
                
                <div className="mt-auto border-t border-dashed border-gray-200 pt-3 flex flex-col space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-lg md:text-xl font-black text-black">
                      {formatUSD(prod.precio_usd)}
                      <span className="text-[10px] ml-1 font-normal text-gray-500 uppercase">{prod.unidad_medida === 'kg' ? '/ Kg' : '/ Und'}</span>
                    </span>
                    {isAdmin && prod.costo_usd && (
                      <span className="text-[8px] font-black text-orange-400 uppercase tracking-tighter">C: {formatUSD(prod.costo_usd)}</span>
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs font-mono font-bold text-gray-400 bg-gray-50 px-2 py-0.5 border border-gray-100 self-start">
                    {formatBs(prod.precio_usd * tasaDolar)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {prodFiltrados.length === 0 && (
            <div className="col-span-full py-20 text-center font-bold text-gray-400 uppercase tracking-[0.2em] text-xs">Catalogo Vacio</div>
          )}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          {scannerAbierto && (
            <Scanner 
              onScan={(code) => setCodigo(code)} 
              onClose={() => setScannerAbierto(false)} 
              title="Inventario: Capturar Código" 
            />
          )}
          <div className="bg-white border-4 border-black w-full max-w-lg shadow-[8px_8px_0px_rgba(0,0,0,1)] relative flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setModalAbierto(false)}
              className="absolute top-4 right-4 text-black hover:text-red-600 transition-colors z-10"
            >
              <X size={24} />
            </button>
            <div className="p-4 md:p-6 border-b-2 border-black bg-yellow-400">
              <h2 className="text-xl font-black uppercase tracking-widest mr-8">{editandoId ? 'Editar Producto' : 'Crear Producto'}</h2>
            </div>
            
            <form onSubmit={guardarProducto} className="p-4 md:p-6 overflow-y-auto space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-center border-2 border-dashed border-gray-300 p-4 bg-gray-50 relative min-h-32">
                  {imagenUrl ? (
                    <div className="relative group">
                       <img src={imagenUrl} alt="Preview" className="h-32 w-auto object-contain" />
                       <button type="button" onClick={() => setImagenUrl('')} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 translate-x-1/2 -translate-y-1/2 shadow-lg">
                         <X size={14} />
                       </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase tracking-widest hover:text-black text-gray-400 border-2 border-gray-200 px-4 py-2 hover:border-black transition-all">Añadir Foto del Producto</button>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    className="hidden" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">Tipo de Venta / Unidad</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button" 
                      onClick={() => setUnidadMedida('unid')}
                      className={cn(
                        "py-3 font-black uppercase text-[10px] tracking-widest border-2 border-black transition-all",
                        unidadMedida === 'unid' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                      )}
                    >
                      Por Unidades
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setUnidadMedida('kg')}
                      className={cn(
                        "py-3 font-black uppercase text-[10px] tracking-widest border-2 border-black transition-all",
                        unidadMedida === 'kg' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                      )}
                    >
                      Deli / Kg
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">Nombre del Producto</label>
                  <input required type="text" value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full border-2 border-black p-3 font-bold text-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">Referencia / Código</label>
                  <div className="flex gap-2">
                    <input type="text" value={codigo || ''} onChange={e=>setCodigo(e.target.value)} className="flex-1 border-2 border-black p-3 font-mono text-sm uppercase" placeholder="Escanea o escribe..." />
                    <button 
                      type="button"
                      onClick={() => setScannerAbierto(true)}
                      className="bg-black text-white px-4 border-2 border-black hover:bg-yellow-400 hover:text-black transition-all flex items-center justify-center"
                      title="Escanear con Cámara"
                    >
                      <Scan size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest mb-1 text-orange-600">
                      {unidadMedida === 'kg' ? 'Costo por Kg' : 'Costo Unitario'} (USD)
                    </label>
                    <input required type="number" step="0.01" min="0" value={costo} onChange={e=>handleCostoChange(e.target.value)} disabled={!isAdmin && !!editandoId} className="w-full border-2 border-orange-500 p-3 font-mono font-bold bg-orange-50 text-sm disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest mb-1 text-blue-600">Margen %</label>
                    <input type="number" step="0.01" value={margen} onChange={e=>handleMargenChange(e.target.value)} disabled={!isAdmin && !!editandoId} className="w-full border-2 border-blue-500 p-3 font-mono font-bold bg-blue-50 text-sm disabled:opacity-50" placeholder="GAN" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[8px] font-black uppercase tracking-widest mb-1 text-green-600">
                      {unidadMedida === 'kg' ? 'Precio por Kg' : 'Precio Unitario'} (USD)
                    </label>
                    <input required type="number" step="0.01" min="0" value={precio} onChange={e=>handlePrecioChange(e.target.value)} disabled={!isAdmin && !!editandoId} className="w-full border-2 border-green-500 p-3 font-mono font-bold bg-green-50 text-sm disabled:opacity-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">
                    {unidadMedida === 'kg' ? 'Stock actual (Kilos)' : 'Stock actual (Unid)'}
                  </label>
                  <input required type="number" step={unidadMedida === 'kg' ? "0.001" : "1"} min="0" value={stock} onChange={e=>setStock(e.target.value)} className="w-full border-2 border-black p-3 font-mono font-bold text-sm" />
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setModalAbierto(false)} disabled={guardando} className="flex-1 p-4 font-black uppercase tracking-widest hover:bg-gray-100 border-2 border-black text-xs disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 p-4 font-black bg-yellow-400 text-black uppercase tracking-widest hover:bg-black hover:text-white transition-all border-2 border-black text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                  {guardando ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                      Espere...
                    </>
                  ) : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
