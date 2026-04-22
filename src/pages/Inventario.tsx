import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Producto, CostoProducto } from '../types';
import { formatUSD, cn } from '../lib/utils';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';

export default function Inventario() {
  const { role } = useAuth();
  const [productos, setProductos] = useState<(Producto & { costo_usd?: number })[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  // Form state
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stock, setStock] = useState('');
  const [codigo, setCodigo] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_DIM = 600;
        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setImagenUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    // Escuchar productos
    const unsubProd = onSnapshot(collection(db, 'productos'), (snap) => {
      const prodData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto));
      
      if (role === 'admin') {
        // También obtener costos si es admin (this can be optimized for larger databases, 
        // but for now we fetch all since we mapped it. A real app might stream them separate).
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
  }, [role]);

  const prodFiltrados = productos.filter(p => {
    const term = busqueda.toLowerCase();
    const matchNombre = p.nombre.toLowerCase().includes(term);
    const matchRef = p.codigo_barras && p.codigo_barras.toLowerCase().includes(term);
    return matchNombre || matchRef;
  });

  const abrirModal = (prod?: Producto & { costo_usd?: number }) => {
    if (prod) {
      setEditandoId(prod.id);
      setNombre(prod.nombre);
      setPrecio(prod.precio_usd.toString());
      setCosto(prod.costo_usd?.toString() || '');
      setStock(prod.stock.toString());
      setCodigo(prod.codigo_barras);
      setImagenUrl(prod.imagen_url || '');
    } else {
      setEditandoId(null);
      setNombre('');
      setPrecio('');
      setCosto('');
      setStock('');
      setCodigo('');
      setImagenUrl('');
    }
    setModalAbierto(true);
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payloadObj: any = {
        nombre,
        precio_usd: Number(precio),
        stock: Number(stock),
        codigo_barras: codigo || "N/A"
      };
      
      if (imagenUrl) {
        payloadObj.imagen_url = imagenUrl;
      }

      if (editandoId) {
        // Update
        await updateDoc(doc(db, 'productos', editandoId), payloadObj);
        if (role === 'admin') {
          await setDoc(doc(db, 'costos_productos', editandoId), { costo_usd: Number(costo) });
        }
      } else {
        // Create
        const docRef = await addDoc(collection(db, 'productos'), payloadObj);
        if (role === 'admin') {
          await setDoc(doc(db, 'costos_productos', docRef.id), { costo_usd: Number(costo) });
        }
      }
      setModalAbierto(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar producto.");
    }
  };

  const eliminarProducto = async (id: string) => {
    if(!confirm("¿Seguro que desea eliminar este producto?")) return;
    try {
      if (role === 'admin') {
        await deleteDoc(doc(db, 'costos_productos', id));
      }
      await deleteDoc(doc(db, 'productos', id));
    } catch (err) {
      alert("Error al eliminar.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header and Search */}
      <div className="p-4 md:p-6 border-b border-black flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest flex items-center gap-2">
            Catálogo
          </h1>
          <p className="text-xs font-mono uppercase text-gray-500 mt-1">{productos.length} Productos Registrados</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-black rounded-none focus:outline-none focus:border-yellow-500 font-mono text-sm uppercase"
            />
          </div>
          {role === 'admin' && (
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
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prodFiltrados.map(prod => (
            <div key={prod.id} className="bg-white border-2 border-black group flex flex-col p-5 hover:-translate-y-1 transition-transform relative">
              {/* Top labels */}
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase tracking-widest truncate max-w-[60%]">{prod.codigo_barras || 'S/N'}</span>
                {role === 'admin' ? (
                  <div className="flex gap-2">
                    <button onClick={() => abrirModal(prod)} className="text-gray-400 hover:text-black transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => eliminarProducto(prod.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                ) : (
                  <span className={`text-[10px] font-black uppercase tracking-widest ${prod.stock <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                    Stock: {prod.stock}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-extrabold text-xl leading-tight mb-4 flex-1">{prod.nombre}</h3>

              {/* Pricing & Stock block */}
              <div className="mt-auto border-t border-dashed border-gray-300 pt-4 flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Precio / Venta</span>
                  <span className="text-2xl font-black">{formatUSD(prod.precio_usd)}</span>
                </div>

                {role === 'admin' && (
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] text-orange-600 uppercase tracking-widest font-bold">Stock</span>
                     <span className={cn("text-lg font-black", prod.stock <= 5 ? 'text-red-600' : 'text-black')}>{prod.stock}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {prodFiltrados.length === 0 && (
            <div className="col-span-full py-20 text-center font-bold text-gray-400 uppercase tracking-[0.2em]">Catalogo Vacio</div>
          )}
        </div>
      </div>

      {/* Modal / Dialog (A simple implementation) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-lg shadow-[8px_8px_0px_rgba(0,0,0,1)] relative flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setModalAbierto(false)}
              className="absolute top-4 right-4 text-black hover:text-red-600 transition-colors z-10"
            >
              <X size={24} />
            </button>
            <div className="p-6 border-b-2 border-black bg-yellow-400">
              <h2 className="text-xl font-black uppercase tracking-widest mr-8">{editandoId ? 'Editar Producto' : 'Crear Producto'}</h2>
            </div>
            
              <form onSubmit={guardarProducto} className="p-6 overflow-y-auto space-y-6">
              
              <div className="space-y-4">
                  {/* Photo area */}
                  <div className="flex items-center justify-center border-2 border-dashed border-gray-300 p-4 bg-gray-50 mb-2 relative">
                    {imagenUrl ? (
                      <div className="relative group">
                         <img src={imagenUrl} alt="Preview" className="h-32 w-auto object-contain" />
                         <button type="button" onClick={() => setImagenUrl('')} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2 -translate-y-1/2">
                           <X size={14} />
                         </button>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold uppercase tracking-widest hover:text-black transition-colors underline underline-offset-4">Añadir Foto</button>
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
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">Nombre del Producto</label>
                  <input required type="text" value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full border-2 border-black p-3 rounded-none focus:outline-none focus:border-yellow-500 font-bold" />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">Código de Barras</label>
                  <input type="text" value={codigo} onChange={e=>setCodigo(e.target.value)} className="w-full border-2 border-black p-3 rounded-none focus:outline-none focus:border-yellow-500 font-mono text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1 text-orange-600">Precio Compra USD</label>
                    <input required type="number" step="0.01" min="0" value={costo} onChange={e=>setCosto(e.target.value)} className="w-full border-2 border-orange-500 p-3 rounded-none focus:outline-none focus:border-black font-mono font-bold bg-orange-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1 text-green-600">Precio Venta USD</label>
                    <input required type="number" step="0.01" min="0" value={precio} onChange={e=>setPrecio(e.target.value)} className="w-full border-2 border-green-500 p-3 rounded-none focus:outline-none focus:border-black font-mono font-bold bg-green-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1">Stock Actual</label>
                  <input required type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} className="w-full border-2 border-black p-3 rounded-none focus:outline-none focus:border-yellow-500 font-mono font-bold" />
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-0 border-t-2 border-black">
                <button type="button" onClick={() => setModalAbierto(false)} className="w-1/2 p-4 font-black uppercase tracking-widest hover:bg-gray-100 border-2 border-black border-r-0">Cancelar</button>
                <button type="submit" className="w-1/2 p-4 font-black bg-yellow-400 text-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors border-2 border-black">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
