import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Venta } from '../types';
import { formatUSD, formatBs, cn } from '../lib/utils';
import { useConfig } from '../contexts/ConfigContext';
import { BarChart, DollarSign, TrendingUp, PackageSearch, Download, ChevronDown, ChevronUp, FileDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Estadisticas() {
  const { role } = useAuth();
  const { tasaDolar } = useConfig();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [costos, setCostos] = useState<Record<string, number>>({});
  const [expandedVenta, setExpandedVenta] = useState<string | null>(null);

  const isAdmin = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
    const unsubVentas = onSnapshot(q, (snap) => {
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
  }, [isAdmin]);

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

  const eliminarVenta = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar esta venta? Esta acción no se puede deshacer y afectará los reportes.")) return;
    try {
      await deleteDoc(doc(db, 'ventas', id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la venta.");
    }
  };

  const descargarFactura = (venta: Venta) => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text('BIBI STORE', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text('Sistema de Ventas & Inventario', 105, 28, { align: 'center' });
      
      doc.line(20, 35, 190, 35);
      
      // Sale Info
      doc.setFontSize(12);
      doc.text(`ID de Venta: ${venta.id}`, 20, 45);
      doc.text(`Fecha: ${format(venta.fecha, 'dd/MM/yyyy HH:mm')}`, 20, 52);
      doc.text(`Cajero ID: ${venta.vendedor_id}`, 20, 59);
      
      // Items Table
      const tableData = (venta.items || []).map(item => [
        item.nombre || 'Producto',
        item.cantidad,
        formatUSD(item.precio_unitario_usd),
        formatUSD(item.cantidad * item.precio_unitario_usd)
      ]);
      
      autoTable(doc, {
        startY: 70,
        head: [['Descripción', 'Cant.', 'P. Unitario', 'Subtotal']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [255, 222, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
      });
      
      // Totals
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text(`TOTAL USD: ${formatUSD(venta.total_usd)}`, 190, finalY, { align: 'right' });
      doc.setFontSize(10);
      doc.text(`TOTAL VED: ${formatBs(venta.total_ved || (venta.total_usd * tasaDolar))}`, 190, finalY + 7, { align: 'right' });
      
      // Footer
      doc.setFontSize(8);
      doc.text('¡Gracias por su compra!', 105, 280, { align: 'center' });
      
      doc.save(`Factura_BibiStore_${venta.id}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Hubo un error al generar la factura. Si estás en móvil, intenta usar un navegador como Chrome o Safari.");
    }
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest">No tienes permisos para ver esta sección.</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full border-x-2 border-black h-full overflow-y-auto pb-24">
      <div className="flex items-center gap-3 p-6 border-b-2 border-black bg-gray-50">
        <BarChart size={32} className="text-black" />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-black">Reportes Globales</h1>
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
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-500 font-mono italic">
              {formatBs(stats.ingresosBrutos * tasaDolar)}
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-black">
            <p className="text-xs font-black uppercase tracking-widest text-black">Ganancia Neta</p>
            <TrendingUp size={20} className="text-yellow-500" />
          </div>
          <p className="text-3xl font-black text-black leading-none mb-1">{formatUSD(stats.gananciaNeta)}</p>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-500 font-mono italic">
              {formatBs(stats.gananciaNeta * tasaDolar)}
            </p>
          </div>
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

      <div className="bg-white border-y-2 border-black flex-1 flex flex-col mt-4 mx-6">
        <div className="p-4 bg-gray-50 border-b-2 border-black flex items-center justify-between shadow-inner">
          <h2 className="font-black text-xs uppercase tracking-widest">Historial de Ventas Detallado</h2>
          <span className="font-mono text-[10px] bg-black text-white px-2 py-0.5">{ventas.length} FACTURAS</span>
        </div>
        <div className="overflow-x-auto">
          {ventas.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Aún no hay ventas registradas.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b-2 border-black">
                <tr>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black w-10"></th>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black">Fecha</th>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black">Total</th>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black">Items</th>
                  <th className="p-4 font-black uppercase tracking-widest text-[10px] text-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ventas.map((v) => (
                  <React.Fragment key={v.id}>
                    <tr className={cn("hover:bg-gray-50 transition-colors", expandedVenta === v.id && "bg-yellow-50/50")}>
                      <td className="p-4">
                        <button onClick={() => setExpandedVenta(expandedVenta === v.id ? null : v.id)} className="text-black">
                          {expandedVenta === v.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">{format(v.fecha, 'dd MMM, yyyy')}</span>
                          <span className="text-[10px] font-mono text-gray-500">{format(v.fecha, 'HH:mm')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-black text-black">{formatUSD(v.total_usd)}</span>
                          <span className="text-[10px] font-mono text-gray-400 uppercase">{formatBs(v.total_ved || (v.total_usd * tasaDolar))}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="bg-zinc-100 px-2 py-1 text-[10px] font-black border border-zinc-200 uppercase tracking-tighter">
                          {v.items?.reduce((a,c)=>a+c.cantidad, 0) || 0} Prod.
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => descargarFactura(v)}
                            className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all group"
                            title="Descargar Factura PDF"
                          >
                            <FileDown size={16} className="group-hover:scale-110 transition-transform" />
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => eliminarVenta(v.id)}
                              className="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all group"
                              title="Eliminar Venta"
                            >
                              <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedVenta === v.id && (
                      <tr className="bg-gray-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        <td colSpan={5} className="p-4 border-b-2 border-black">
                          <div className="flex flex-col bg-white border-2 border-black p-4 space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">Artículos Vendidos</h3>
                            <div className="space-y-2">
                              {v.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono bg-black text-white px-2 py-0.5 rounded-sm">{item.cantidad}x</span>
                                    <span className="font-bold text-black">{item.nombre || 'Producto Desconocido'}</span>
                                  </div>
                                  <div className="font-mono text-gray-500">
                                    {formatUSD(item.precio_unitario_usd)} c/u → 
                                    <span className="font-bold text-black ml-2">{formatUSD(item.cantidad * item.precio_unitario_usd)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-dashed border-gray-300 flex justify-between items-end">
                              <span className="text-[9px] font-mono text-gray-400">VENDEDOR ID: {v.vendedor_id}</span>
                              <div className="text-right">
                                <span className="text-[10px] font-black uppercase tracking-widest mr-2">Total de esta factura:</span>
                                <span className="text-sm font-black">{formatUSD(v.total_usd)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
