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
  let prodSnap;
  try {
    prodSnap = await getDocs(collection(db, 'productos'));
  } catch (err: any) {
    console.error("Error al obtener la colección 'productos' de Firestore:", err);
    throw new Error(`Error al leer productos de Firestore: ${err?.message || err}`);
  }
  
  const costosMap: Record<string, number> = {};
  try {
    const costSnap = await getDocs(collection(db, 'costos_productos'));
    costSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const val = data.costo_usd ?? data.costo ?? 0;
      costosMap[docSnap.id] = typeof val === 'number' ? val : (Number(val) || 0);
    });
  } catch (err) {
    console.warn("No se pudieron obtener costos_productos (usando fallback 0):", err);
  }

  const resultado: ProductoExportJSON[] = prodSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    
    // Mapeo flexible de precio
    const precioRaw = data.precio_usd ?? data.precio ?? data.precio_unitario_usd ?? 0;
    const precio_usd = typeof precioRaw === 'number' ? precioRaw : (Number(precioRaw) || 0);

    // Mapeo flexible de costo
    const costoRaw = costosMap[docSnap.id] ?? data.costo_usd ?? data.costo ?? 0;
    const costo_usd = typeof costoRaw === 'number' ? costoRaw : (Number(costoRaw) || 0);

    // Mapeo flexible de imagen
    const imagen_url = String(data.imagen_url ?? data.imagen ?? data.url_imagen ?? data.foto_url ?? data.image ?? '');

    return {
      id: docSnap.id,
      precio_usd,
      costo_usd,
      imagen_url
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
