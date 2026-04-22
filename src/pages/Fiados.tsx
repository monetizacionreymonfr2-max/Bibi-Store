import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Fiado } from '../types';
import { formatUSD, formatBs } from '../lib/utils';
import { Plus, Check, Search, X, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { format } from 'date-fns';

export default function Fiados() {
  const { role } = useAuth();
  const { tasaDolar } = useConfig();
  const [fiados, setFiados] = useState<Fiado[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cliente, setCliente] = useState('');
  const [montoUSD, setMontoUSD] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'fiados'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fiado));
      setFiados(data.sort((a,b) => b.fecha - a.fecha)); // sort desc
    });
    return () => unsub();
  }, []);

  const fiadosFiltrados = fiados.filter(f => f.cliente.toLowerCase().includes(busqueda.toLowerCase()));
  const totalPendiente = fiados.filter(f => f.estado === 'pendiente').reduce((acc, curr) => acc + curr.monto_usd, 0);

  const guardarFiado = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'fiados'), {
        cliente,
        monto_usd: Number(montoUSD),
        fecha: Date.now(),
        estado: 'pendiente'
      });
      setModalAbierto(false);
      setCliente('');
      setMontoUSD('');
    } catch (err) {
      console.error(err);
      alert("Error registrando fiado");
    }
  };

  const marcarPagado = async (id: string) => {
    if(!confirm("¿Confirmar pago de esta deuda?")) return;
    try {
      await updateDoc(doc(db, 'fiados', id), { estado: 'pagado' });
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la deuda");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black max-w-5xl mx-auto w-full">
      <div className="p-4 md:p-6 border-b-2 border-black flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 shrink-0">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-black flex items-center gap-2">
            <Users className="text-black" /> Fiados
          </h1>
          <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-widest">Total pendiente: <strong className="text-red-600">{formatUSD(totalPendiente)}</strong></p>
        </div>
        <button 
          onClick={() => setModalAbierto(true)}
          className="bg-black text-white flex items-center justify-center gap-2 px-6 py-4 font-black uppercase tracking-widest transition-all w-full md:w-auto hover:bg-yellow-400 hover:text-black border-2 border-black focus:outline-none"
        >
          <Plus size={18} />
          Nuevo
        </button>
      </div>

      <div className="p-4 border-b-2 border-black bg-white shrink-0">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="BUSCAR CLIENTE..." 
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-4 border-2 border-black rounded-none focus:outline-none focus:border-yellow-400 font-mono text-xs uppercase tracking-widest bg-gray-50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6 content-start">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fiadosFiltrados.map(f => (
            <div key={f.id} className={`p-5 flex flex-col border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform relative bg-white ${f.estado === 'pagado' ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-widest ${f.estado === 'pagado' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
                  {f.estado}
                </span>
                <div className="text-[10px] text-gray-500 font-mono tracking-widest">
                  {format(f.fecha, 'dd/MM/yy')}
                </div>
              </div>
              <h3 className="font-extrabold text-xl text-black mb-4 truncate">{f.cliente}</h3>
              
              <div className="mt-auto border-t-2 border-dashed border-gray-300 pt-4 flex flex-col gap-1 items-end">
                <div className="font-black text-2xl mb-0 leading-none">{formatUSD(f.monto_usd)}</div>
                <div className="text-[10px] text-gray-500 font-mono mb-4">{formatBs(f.monto_usd * tasaDolar).replace('Bs. ', '')} VED</div>
                
                {f.estado === 'pendiente' && (
                  <button 
                    onClick={() => marcarPagado(f.id)}
                    className="w-full flex items-center justify-center gap-2 text-xs font-black text-black border-2 border-black bg-yellow-400 py-3 uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                  >
                    <Check size={16} /> LIQUIDAR
                  </button>
                )}
              </div>
            </div>
          ))}
          {fiadosFiltrados.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 uppercase tracking-widest font-bold text-xs">
              No hay cuentas por cobrar.
            </div>
          )}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden relative">
            <button onClick={() => setModalAbierto(false)} className="absolute top-4 right-4 text-black hover:text-red-600 z-10 transition-colors">
              <X size={24} />
            </button>
            <div className="p-6 border-b-2 border-black bg-yellow-400">
              <h2 className="font-black text-xl uppercase tracking-widest mr-6">Nuevo Fiado</h2>
            </div>
            <form onSubmit={guardarFiado} className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">Nombre del Cliente</label>
                <input required type="text" value={cliente} onChange={e=>setCliente(e.target.value)} className="w-full border-2 border-black p-4 rounded-none focus:outline-none focus:border-yellow-400 font-bold" placeholder="EJ. JUAN PEREZ" />
              </div>
              <div className="bg-gray-50 p-4 border-2 border-black">
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">Monto de la Deuda (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                  <input required type="number" step="0.01" min="0" value={montoUSD} onChange={e=>setMontoUSD(e.target.value)} className="w-full pl-10 pr-4 py-4 border-2 border-black rounded-none focus:outline-none focus:border-red-600 font-mono font-bold text-lg" placeholder="0.00" />
                </div>
                <div className="text-[10px] font-mono text-gray-500 mt-3 uppercase tracking-widest flex justify-between border-t border-dashed border-gray-300 pt-3">
                  <span>Equivalente:</span>
                  <span className="font-black text-black">{formatBs((Number(montoUSD)||0) * tasaDolar)}</span>
                </div>
              </div>
              <div className="pt-4 flex border-t-2 border-black -mx-6 -mb-6">
                <button type="button" onClick={() => setModalAbierto(false)} className="w-1/2 py-4 font-black text-black uppercase tracking-widest hover:bg-gray-100 border-r-2 border-black">Cancelar</button>
                <button type="submit" className="w-1/2 py-4 font-black bg-yellow-400 text-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
