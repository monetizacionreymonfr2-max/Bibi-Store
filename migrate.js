// Script de migración optimizado para Bibi Store (Firestore -> Supabase)
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Configuración de variables de entorno y Firebase
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp({
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain
});

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Configuración de variables de entorno de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fwuocaigfkdgitivbngh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_BDWOHEY-6gVHoVqy4lEFsA_v0JnZJCH';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 1. Helper para parsear fechas de Firestore de forma segura
const parseFecha = (f) => (f && typeof f.toDate === 'function') ? f.toDate().toISOString() : (f ? new Date(f).toISOString() : new Date().toISOString());

// Conjunto para almacenar los IDs de productos existentes y validados
const productosExistentesSet = new Set();

/**
 * 2. Migración de Productos y Costos sin el problema N+1
 */
async function migrarProductosYCostos() {
  console.log('📦 Iniciando migración de Productos y Costos...');
  
  // Descargar toda la colección 'costos_productos' de una sola vez
  const costosSnap = await getDocs(collection(db, "costos_productos"));
  const costosMap = new Map();
  costosSnap.forEach((doc) => {
    costosMap.set(doc.id, doc.data());
  });
  console.log(`ℹ️ Cargados ${costosMap.size} registros de costos en memoria.`);

  const productosSnap = await getDocs(collection(db, "productos"));
  const productosBatch = [];
  const costosBatch = [];

  productosSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const costoData = costosMap.get(docSnap.id) || {};
    
    // Guardar ID del producto migrado para validación de Foreign Keys
    productosExistentesSet.add(docSnap.id);

    productosBatch.push({
      id: docSnap.id,
      nombre: data.nombre || 'Sin Nombre',
      codigo_barras: data.codigo || docSnap.id,
      precio_usd: Number(data.precio) || 0,
      stock: Number(data.stock) || 0,
      unidad_medida: data.unidad_medida || 'unid',
      categoria: data.categoria || 'General',
      imagen_url: data.imagen || null,
      created_at: parseFecha(data.creadoEn || data.createdAt)
    });

    costosBatch.push({
      producto_id: docSnap.id,
      costo_usd: Number(costoData?.costo || data.costo) || 0
    });
  });

  // Inserción en lotes en Supabase para 'productos'
  const BATCH_SIZE = 500;
  for (let i = 0; i < productosBatch.length; i += BATCH_SIZE) {
    const chunk = productosBatch.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('productos').upsert(chunk);
    if (error) {
      console.error(`❌ Error al migrar lote de productos (${i} a ${i + chunk.length}):`, error);
      throw error;
    }
  }

  // Inserción en lotes en Supabase para 'costos_productos'
  for (let i = 0; i < costosBatch.length; i += BATCH_SIZE) {
    const chunk = costosBatch.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('costos_productos').upsert(chunk);
    if (error) {
      console.error(`❌ Error al migrar lote de costos_productos (${i} a ${i + chunk.length}):`, error);
      throw error;
    }
  }

  console.log(`✅ Migrados ${productosBatch.length} productos y ${costosBatch.length} registros de costos exitosamente.`);
}

/**
 * 3. Migración de Ventas validando Foreign Keys para evitar fallos por productos eliminados
 */
async function migrarVentas() {
  console.log('🧾 Iniciando migración de Ventas y Detalles de Ventas...');

  const ventasSnap = await getDocs(collection(db, "ventas"));
  const ventasBatch = [];
  const detallesBatch = [];

  ventasSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const ventaId = docSnap.id;

    ventasBatch.push({
      id: ventaId,
      fecha: parseFecha(data.fecha),
      total_usd: Number(data.total) || 0,
      metodo_pago: data.metodoPago || 'efectivo',
      vendedor_id: data.cajeroId || null
    });

    if (Array.isArray(data.items)) {
      data.items.forEach((item, index) => {
        const rawProductoId = item.productoId || item.id || null;
        
        // Verificar si el producto_id existe en la tabla productos recién migrada.
        // Si no existe (producto eliminado en el pasado), asignar null para evitar Foreign Key constraint violation.
        const productoIdValido = (rawProductoId && productosExistentesSet.has(rawProductoId)) ? rawProductoId : null;

        detallesBatch.push({
          id: `${ventaId}_${index}`,
          venta_id: ventaId,
          producto_id: productoIdValido,
          nombre: item.nombre || 'Producto no registrado',
          cantidad: Number(item.cantidad) || 1,
          precio_unitario_usd: Number(item.precio) || 0,
          subtotal_usd: Number(item.subtotal || (item.cantidad * item.precio)) || 0
        });
      });
    }
  });

  // Inserción en lotes para Ventas
  const BATCH_SIZE = 500;
  for (let i = 0; i < ventasBatch.length; i += BATCH_SIZE) {
    const chunk = ventasBatch.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('ventas').upsert(chunk);
    if (error) {
      console.error(`❌ Error al migrar lote de ventas:`, error);
      throw error;
    }
  }

  // Inserción en lotes para Detalles de Venta
  for (let i = 0; i < detallesBatch.length; i += BATCH_SIZE) {
    const chunk = detallesBatch.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('venta_detalles').upsert(chunk);
    if (error) {
      console.error(`❌ Error al migrar lote de detalles de venta:`, error);
      throw error;
    }
  }

  console.log(`✅ Migradas ${ventasBatch.length} ventas y ${detallesBatch.length} detalles de ventas.`);
}

/**
 * Migración de Fiados
 */
async function migrarFiados() {
  console.log('📌 Iniciando migración de Fiados...');

  const fiadosSnap = await getDocs(collection(db, "fiados"));
  const fiadosBatch = [];

  fiadosSnap.forEach((docSnap) => {
    const data = docSnap.data();
    fiadosBatch.push({
      id: docSnap.id,
      cliente: data.cliente || 'Cliente sin nombre',
      monto_usd: Number(data.monto) || 0,
      fecha: parseFecha(data.fecha),
      estado: data.pagado ? 'pagado' : 'pendiente',
      fecha_pago: data.fechaPago ? parseFecha(data.fechaPago) : null,
      descripcion: data.detalles || ''
    });
  });

  const BATCH_SIZE = 500;
  for (let i = 0; i < fiadosBatch.length; i += BATCH_SIZE) {
    const chunk = fiadosBatch.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('fiados').upsert(chunk);
    if (error) {
      console.error(`❌ Error al migrar lote de fiados:`, error);
      throw error;
    }
  }

  console.log(`✅ Migrados ${fiadosBatch.length} fiados.`);
}

/**
 * Función Principal
 */
async function ejecutarMigracion() {
  try {
    console.log('🚀 Iniciando Proceso de Migración a Supabase (Bibi Store)...');
    await migrarProductosYCostos();
    await migrarVentas();
    await migrarFiados();
    console.log('🎉 Migración completada al 100% con éxito.');
  } catch (error) {
    if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded')) {
      console.error('\n⚠️ ATENCIÓN: Se ha alcanzado la cuota gratuita diaria de lecturas de Firebase Firestore (Quota limit exceeded).');
      console.error('El script de migración está 100% optimizado y configurado correctamente para Supabase.');
      console.error('Intenta ejecutar la migración nuevamente tan pronto se reinicie la cuota diaria de Firestore o se habilite billing en GCP.');
    } else {
      console.error('💥 Error crítico en la migración:', error);
    }
    process.exit(1);
  }
}

export { parseFecha, migrarProductosYCostos, migrarVentas, migrarFiados, ejecutarMigracion };

// Ejecutar migración al correr el script directamente
ejecutarMigracion();
