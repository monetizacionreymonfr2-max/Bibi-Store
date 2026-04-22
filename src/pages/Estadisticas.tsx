import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Venta } from '../types';
import { formatUSD, formatBs } from '../lib/utils';
import { useConfig } from '../contexts/ConfigContext';
import { BarChart, DollarSign, TrendingUp, PackageSearch } from 'lucide-react';
import { format } from 'date-fns';

export default function Estadisticas() {
  const { role } = useAuth();
  const { tasaDolar } = useConfig();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [costos, setCostos] = useState<Record<string, number>>({});

  useEffect(() => {
    if (role !== 'admin') return;

    const unsubVentas = onSnapshot(collection(db, 'ventas'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Venta));
      setVentas(data);
    });

    const unsubCostos = onSnapshot(collection(db, 'costos_productos'), (snap) => {
      const costs: Record<string, number> = {};
      snap.docs.forEach(d => {
        costs[d.id] = d.data().costo_usd;
      });
      setCostos(costs);
    });

    return () => {
      unsubVentas();
      unsubCostos();
    };
  }, [role]);

  // Compute metrics
  const stats = useMemo(() => {
    let ingresosBrutos = 0;
    let gananciaNeta = 0;
    let productosVendidos = 0;

    for (const v of ventas) {
      ingresosBrutos += v.total_usd;
      if (v.items) {
        for (const item of v.items) {
          productosVendidos += item.cantidad;
          const costoUnidad = costos[item.productoId] || 0;
          const gananciaThisItem = (item.precio_unitario_usd - costoUnidad) * item.cantidad;
          gananciaNeta += gananciaThisItem;
        }
      }
    }

    return { ingresosBrutos, gananciaNeta, productosVendidos };
  }, [ventas, costos]);

  if (role !== 'admin') {
    return <div className="p-8 text-center text-gray-500">No tienes permisos para ver esta sección.</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full border-x-2 border-black min-h-full">
      <div className="flex items-center gap-3 p-6 border-b-2 border-black bg-gray-50">
        <BarChart size={32} className="text-black" />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-black">Reportes</h1>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1">Visión general del desempeño del negocio.</p>
        </div>
      </div>

      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-black">
            <p className="text-xs font-black uppercase tracking-widest text-black">Ingresos Brutos</p>
            <DollarSign size={20} className="text-green-600" />
          </div>
          <p className="text-3xl font-black text-black leading-none mb-1">{formatUSD(stats.ingresosBrutos)}</p>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Volumen total vendido</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-black">
            <p className="text-xs font-black uppercase tracking-widest text-black">Ganancia Neta</p>
            <TrendingUp size={20} className="text-yellow-500" />
          </div>
          <p className="text-3xl font-black text-black leading-none mb-1">{formatUSD(stats.gananciaNeta)}</p>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Utilidad estimada</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-black">
            <p className="text-xs font-black uppercase tracking-widest text-black">Unidades</p>
            <PackageSearch size={20} className="text-black" />
          </div>
          <p className="text-3xl font-black text-black leading-none mb-1">{stats.productosVendidos}</p>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Despachadas</p>
        </div>
      </div>

      <div className="bg-white border-y-2 border-black flex-1 flex flex-col mt-4">
        <div className="p-4 bg-gray-50 border-b-2 border-black flex items-center justify-between">
          <h2 className="font-black text-xs uppercase tracking-widest">Últimas Ventas</h2>
          <span className="font-mono text-[10px] bg-black text-white px-2 py-0.5">{ventas.length} REGISTROS</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {ventas.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Aún no hay ventas registradas.</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white sticky top-0 border-b-2 border-black z-10">
                <tr>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black w-24">Fecha / Hora</th>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black">Total Ingreso</th>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black">Artículos</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-dashed divide-gray-200">
                {ventas.sort((a,b) => b.fecha - a.fecha).map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="p-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest">{format(v.fecha, 'dd/MM/yy HH:mm')}</td>
                    <td className="p-4 flex flex-col">
                      <span className="font-black text-lg">{formatUSD(v.total_usd)}</span>
                      <span className="font-mono text-[10px] text-gray-500 tracking-widest uppercase">{formatBs(v.total_ved || (v.total_usd * tasaDolar))}</span>
                    </td>
                    <td className="p-4 font-mono font-bold text-lg">{v.items?.reduce((a,c)=>a+c.cantidad, 0) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
