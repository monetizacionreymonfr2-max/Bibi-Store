import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { formatUSD, formatBs } from '../lib/utils';
import { Producto, VentaItem } from '../types';
import { Search } from 'lucide-react';

export default function Vender() {
  const { tasaDolar } = useConfig();
  const { user } = useAuth();
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState<VentaItem[]>([]);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto));
      setProductos(data);
    });
    return () => unsub();
  }, []);

  const prodFiltrados = productos.filter(p => {
    const term = busqueda.toLowerCase();
    const matchNombre = p.nombre.toLowerCase().includes(term);
    const matchRef = p.codigo_barras && p.codigo_barras.toLowerCase().includes(term);
    return matchNombre || matchRef;
  });

  const agregarAlCarrito = (prod: Producto) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.productoId === prod.id);
      if (ex) {
        if (ex.cantidad >= prod.stock) return prev; // check stock
        return prev.map(i => i.productoId === prod.id ? { ...i, cantidad: i.cantidad + 1, subtotal_usd: (i.cantidad + 1) * i.precio_unitario_usd } : i);
      }
      return [...prev, { productoId: prod.id, nombre: prod.nombre, cantidad: 1, precio_unitario_usd: prod.precio_usd, subtotal_usd: prod.precio_usd }];
    });
  };

  const modificarCantidad = (prodId: string, delta: number) => {
    setCarrito(prev => prev.map(i => {
      if (i.productoId !== prodId) return i;
      const nw = i.cantidad + delta;
      if (nw <= 0) return i;
      const stockMax = productos.find(p => p.id === prodId)?.stock || 0;
      if (nw > stockMax) return i;
      return { ...i, cantidad: nw, subtotal_usd: nw * i.precio_unitario_usd };
    }));
  };

  const totalUSD = carrito.reduce((acc, curr) => acc + curr.subtotal_usd, 0);
  const totalVED = totalUSD * tasaDolar;

  const procesarVenta = async () => {
    if (carrito.length === 0 || procesando) return;
    setProcesando(true);
    try {
      const batch = writeBatch(db);
      
      const repVenta = doc(collection(db, 'ventas'));
      batch.set(repVenta, {
        total_usd: totalUSD,
        total_ved: totalVED,
        fecha: Date.now(),
        vendedor_id: user!.uid,
        items: carrito.map(i => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          precio_unitario_usd: i.precio_unitario_usd
        }))
      });

      // Update Stock
      for (const item of carrito) {
        const prod = productos.find(p => p.id === item.productoId);
        if (prod) {
          const pref = doc(db, 'productos', item.productoId);
          batch.update(pref, { stock: prod.stock - item.cantidad });
        }
      }

      await batch.commit();
      setCarrito([]);
      alert("Venta registrada con éxito");
    } catch (err) {
      console.error(err);
      alert("Error procesando la venta");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
      {/* Product Selection */}
      <section className="flex-1 p-4 md:p-6 flex flex-col space-y-6 overflow-hidden border-r border-gray-100">
        <div className="flex space-x-4 items-center">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Buscar producto por nombre o código..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:border-yellow-500 text-sm"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
              <Search size={18} />
            </div>
          </div>
          <button className="bg-black text-white px-6 py-3 font-bold text-sm uppercase tracking-wider hover:bg-zinc-800 transition-colors hidden sm:block">
            Escanear
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto scroll-hide pb-10">
          {prodFiltrados.map(prod => (
            <div 
              key={prod.id} 
              onClick={() => { if (prod.stock > 0) agregarAlCarrito(prod); }}
              className={`border-2 border-gray-100 p-4 transition-all group flex flex-col ${prod.stock === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:border-black cursor-pointer'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] bg-gray-100 px-2 py-0.5 font-bold uppercase tracking-tighter truncate max-w-[50%]">Cat: Varios</span>
                <span className={`text-[10px] font-bold uppercase ${prod.stock === 0 ? 'text-gray-400' : (prod.stock <= 5 ? 'text-red-600' : 'text-green-600')}`}>
                  {prod.stock === 0 ? 'Agotado' : (prod.stock <= 5 ? `Stock bajo: ${prod.stock}` : `Stock: ${prod.stock}`)}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1 leading-tight flex-1">{prod.nombre}</h3>
              <p className="text-xs text-gray-500 mb-3 truncate">Ref: {prod.codigo_barras || 'S/N'}</p>
              
              {prod.imagen_url && (
                <div className="flex justify-center mb-4 h-24">
                   <img src={prod.imagen_url} alt={prod.nombre} className="h-full w-auto object-contain border-2 border-transparent mix-blend-multiply" />
                </div>
              )}
              
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold">{formatUSD(prod.precio_usd)}</span>
                  <span className="text-[10px] font-mono text-gray-400">{formatBs(prod.precio_usd * tasaDolar).replace('Bs. ', '')} VED</span>
                </div>
                
                {prod.stock > 0 ? (
                  <div className="p-2 bg-yellow-400 group-hover:bg-black group-hover:text-white transition-colors flex shrink-0 items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                ) : (
                  <div className="p-2 bg-gray-200 text-gray-400 flex shrink-0 items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {prodFiltrados.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 font-bold tracking-widest uppercase">
              No se encontraron productos.
            </div>
          )}
        </div>
      </section>

      {/* Cart View */}
      <aside className="w-full md:w-80 lg:w-96 bg-gray-50 flex flex-col border-l border-gray-200 shrink-0 h-1/2 md:h-full">
        <div className="p-4 md:p-6 flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center border-b border-black pb-2 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] m-0">Carrito de Venta</h2>
            <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded-sm">{carrito.length} Items</span>
          </div>
          
          <div className="flex-1 overflow-y-auto scroll-hide space-y-4 pr-1">
            {carrito.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col text-gray-400 opacity-50 space-y-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="font-bold tracking-widest uppercase text-xs">Añade productos</p>
              </div>
            ) : (
              carrito.map((item, idx) => (
                <div key={item.productoId} className={`flex justify-between text-sm items-center ${idx > 0 && 'border-t border-gray-200 pt-3'}`}>
                  <div className="flex flex-col flex-1 pr-2">
                    <strong className="leading-tight truncate">{item.cantidad}x {item.nombre}</strong>
                    <div className="flex space-x-2 mt-1">
                      <button onClick={() => modificarCantidad(item.productoId, -1)} className="text-[10px] font-bold uppercase text-gray-400 hover:text-black">-1</button>
                      <button onClick={() => modificarCantidad(item.productoId, 1)} className="text-[10px] font-bold uppercase text-gray-400 hover:text-black">+1</button>
                      <span className="text-[10px] text-gray-500 font-mono ml-auto">@ {formatUSD(item.precio_unitario_usd)}</span>
                    </div>
                  </div>
                  <span className="font-bold shrink-0">{formatUSD(item.subtotal_usd)}</span>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 space-y-2 border-t-2 border-black pt-4 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Subtotal (USD)</span>
              <span className="font-bold text-lg">{formatUSD(totalUSD)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-dashed border-gray-300 pb-2 mb-2">
              <span className="text-sm text-gray-600">Impuestos (0%)</span>
              <span className="font-bold">$0.00</span>
            </div>
            
            <div className="flex justify-between items-end pb-2">
              <span className="text-xl font-black">TOTAL</span>
              <div className="text-right">
                <p className="text-3xl font-black leading-none">{formatUSD(totalUSD)}</p>
                <p className="text-xs font-mono text-gray-500 mt-1 uppercase">{formatBs(totalVED).replace('Bs. ', '')} VED</p>
              </div>
            </div>
            
            <button 
              onClick={procesarVenta}
              disabled={carrito.length === 0 || procesando}
              className="w-full bg-yellow-400 py-4 mt-2 font-black text-lg uppercase tracking-tighter shadow-md hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:hover:bg-yellow-400"
            >
              {procesando ? 'Procesando...' : 'Registrar Venta'}
            </button>
            
            {/* Opcional: un botón placeholder o acción rápida */}
            <button disabled className="w-full border-2 border-black py-2 mt-2 font-bold text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all opacity-30 cursor-not-allowed">
              Opciones de Pago
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
