import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface ProductoExportJSON {
  id: string;
  precio_usd: number;
  costo_usd: number;
  imagen_url: string;
}

/**
 * Obtiene todos los documentos de la colección 'productos' y 'costos_productos' de Firestore
 * y devuelve la estructura exacta solicitada para Supabase:
 * [
 *   {
 *     "id": "ID_DEL_PRODUCTO",
 *     "precio_usd": 2.50,
 *     "costo_usd": 1.20,
 *     "imagen_url": "URL_DE_LA_IMAGEN"
 *   }
 * ]
 */
export async function exportarProductosJSON(): Promise<ProductoExportJSON[]> {
  const prodSnap = await getDocs(collection(db, 'productos'));
  
  const costosMap: Record<string, number> = {};
  try {
    const costSnap = await getDocs(collection(db, 'costos_productos'));
    costSnap.forEach((docSnap) => {
      const data = docSnap.data();
      costosMap[docSnap.id] = typeof data.costo_usd === 'number' ? data.costo_usd : Number(data.costo || 0);
    });
  } catch (err) {
    console.warn("No se pudieron obtener costos_productos (posibles permisos de Firestore):", err);
  }

  const resultado: ProductoExportJSON[] = prodSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    
    // Mapeo de precio_usd / precio
    const precioRaw = data.precio_usd !== undefined ? data.precio_usd : (data.precio !== undefined ? data.precio : 0);
    const precio_usd = typeof precioRaw === 'number' ? precioRaw : Number(precioRaw) || 0;

    // Mapeo de costo_usd
    const costoRaw = costosMap[docSnap.id] !== undefined 
      ? costosMap[docSnap.id] 
      : (data.costo_usd !== undefined ? data.costo_usd : (data.costo !== undefined ? data.costo : 0));
    const costo_usd = typeof costoRaw === 'number' ? costoRaw : Number(costoRaw) || 0;

    return {
      id: docSnap.id,
      precio_usd,
      costo_usd,
      imagen_url: data.imagen_url || ''
    };
  });

  return resultado;
}

export function descargarJSON(data: any, filename: string = 'productos.json') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
