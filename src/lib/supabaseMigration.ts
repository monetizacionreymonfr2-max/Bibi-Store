import { createClient } from '@supabase/supabase-js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface MigrationProgress {
  current: number;
  total: number;
  statusText: string;
  percent: number;
}

/**
 * Helper para convertir un data URL (base64) o URL a un Blob
 */
async function getBlobFromUrlOrBase64(urlOrBase64: string): Promise<{ blob: Blob; ext: string } | null> {
  if (!urlOrBase64 || typeof urlOrBase64 !== 'string') return null;

  try {
    if (urlOrBase64.startsWith('data:')) {
      const match = urlOrBase64.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      
      const response = await fetch(urlOrBase64);
      const blob = await response.blob();
      return { blob, ext };
    } else if (urlOrBase64.startsWith('http')) {
      const response = await fetch(urlOrBase64);
      if (!response.ok) return null;
      const blob = await response.blob();
      const contentType = blob.type || 'image/jpeg';
      let ext = contentType.split('/')[1] || 'jpg';
      if (ext.includes(';')) ext = ext.split(';')[0];
      return { blob, ext };
    }
  } catch (err) {
    console.warn("No se pudo descargar la imagen para migración:", err);
  }
  return null;
}

export async function handleAutomatedMigration(
  supabaseUrl: string,
  supabaseKey: string,
  tasaDolar: number = 1,
  onProgress?: (p: MigrationProgress) => void
) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Debe proporcionar la URL y la API Key de Supabase.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Obtener productos de Firestore
  onProgress?.({
    current: 0,
    total: 0,
    statusText: 'Obteniendo catálogo de Firestore...',
    percent: 5
  });

  const prodSnap = await getDocs(collection(db, 'productos'));
  
  const costosMap: Record<string, number> = {};
  try {
    const costSnap = await getDocs(collection(db, 'costos_productos'));
    costSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const val = data.costo_usd ?? data.costo ?? 0;
      costosMap[docSnap.id] = typeof val === 'number' ? val : (Number(val) || 0);
    });
  } catch (err) {
    console.warn("No se obtuvieron costos_productos (usando 0 por defecto):", err);
  }

  const productosLocales = prodSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      codigo_barra: String(data.codigo_barras || data.codigo_barra || docSnap.id),
      nombre: String(data.nombre || 'Producto sin nombre'),
      categoria: String(data.categoria || 'Sin Categoría'),
      precio_usd: Number(data.precio_usd ?? data.precio ?? 0),
      costo_usd: Number(costosMap[docSnap.id] ?? data.costo_usd ?? data.costo ?? 0),
      stock: Number(data.stock ?? 0),
      imagen_url: String(data.imagen_url ?? data.imagen ?? data.url_imagen ?? ''),
      activo: data.activo !== false
    };
  });

  const total = productosLocales.length;
  if (total === 0) {
    throw new Error('No hay productos en Firestore para migrar.');
  }

  const productosParaInsertar = [];

  for (let i = 0; i < total; i++) {
    const producto = productosLocales[i];
    const currentNum = i + 1;
    const progressPercent = Math.round(10 + (currentNum / total) * 70);

    onProgress?.({
      current: currentNum,
      total,
      statusText: `Procesando (${currentNum}/${total}): ${producto.nombre}`,
      percent: progressPercent
    });

    let finalPublicUrl = producto.imagen_url;

    // Step A & B: Subir imagen local/URL a Supabase Storage bucket 'productos'
    if (producto.imagen_url) {
      try {
        const imageData = await getBlobFromUrlOrBase64(producto.imagen_url);
        if (imageData) {
          const { blob, ext } = imageData;
          const cleanCodigo = producto.codigo_barra.replace(/[^a-zA-Z0-9_-]/g, '_');
          const fileName = `${cleanCodigo}.${ext}`;
          const filePath = `catálogo/${fileName}`;

          onProgress?.({
            current: currentNum,
            total,
            statusText: `Subiendo imagen para ${producto.nombre} a Supabase Storage...`,
            percent: progressPercent
          });

          const { error: storageError } = await supabase.storage
            .from('productos')
            .upload(filePath, blob, {
              upsert: true,
              contentType: blob.type || 'image/jpeg'
            });

          if (storageError) {
            console.warn(`Error al subir imagen de ${producto.nombre} a Supabase storage:`, storageError);
          } else {
            const { data: urlData } = supabase.storage
              .from('productos')
              .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
              finalPublicUrl = urlData.publicUrl;
            }
          }
        }
      } catch (imgErr) {
        console.warn(`Falló el procesamiento de imagen para ${producto.nombre}:`, imgErr);
      }
    }

    // Step C: Mapear el producto con su URL pública
    productosParaInsertar.push({
      codigo_barra: producto.codigo_barra,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precio_usd: producto.precio_usd,
      costo_usd: producto.costo_usd,
      precio_bs: Number((producto.precio_usd * tasaDolar).toFixed(2)),
      stock: producto.stock,
      imagen_url: finalPublicUrl,
      activo: producto.activo
    });
  }

  // Step D: Insertar / Actualizar en la base de datos Supabase
  onProgress?.({
    current: total,
    total,
    statusText: 'Insertando registros en la tabla "productos" de Supabase...',
    percent: 90
  });

  const { data, error: dbError } = await supabase
    .from('productos')
    .upsert(productosParaInsertar, { onConflict: 'codigo_barra' });

  if (dbError) {
    console.error('Error de Supabase DB:', dbError);
    throw new Error(`Error en base de datos Supabase: ${dbError.message}`);
  }

  onProgress?.({
    current: total,
    total,
    statusText: '¡Migración completada con éxito!',
    percent: 100
  });

  return {
    totalMigrados: productosParaInsertar.length,
    data
  };
}
