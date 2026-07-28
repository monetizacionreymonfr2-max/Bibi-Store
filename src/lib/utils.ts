import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Producto } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to format currency
export const formatUSD = (val: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
};

export const formatBs = (val: number) => {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(val || 0).replace('VES', 'Bs.');
};

export function normalizeProducto(raw: any): Producto {
  if (!raw) {
    return {
      id: '',
      nombre: '',
      precio_usd: 0,
      stock: 0,
      codigo_barras: 'N/A',
      imagen_url: '',
      unidad_medida: 'unid',
      categoria: 'Sin Categoría'
    };
  }

  // 1. Extract non-zero price candidates first
  let precioNum = 0;
  const priceCandidates = [
    raw.precio_usd,
    raw.precio,
    raw.precio_venta,
    raw.precio_dolar,
    raw.precio_unitario,
    raw.precio_detal,
    raw.precio_unid,
    raw.price,
    raw.monto_usd,
    raw.monto,
    raw.costo_usd,
    raw.costo,
    raw.val_usd
  ];

  for (const c of priceCandidates) {
    if (c !== undefined && c !== null && c !== '') {
      const num = Number(String(c).replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        precioNum = num;
        break;
      }
    }
  }

  // If no >0 found, accept 0
  if (precioNum === 0) {
    for (const c of priceCandidates) {
      if (c !== undefined && c !== null && c !== '') {
        const num = Number(String(c).replace(',', '.'));
        if (!isNaN(num)) {
          precioNum = num;
          break;
        }
      }
    }
  }

  // 2. Extract stock
  let stockNum = 0;
  const stockCandidates = [raw.stock, raw.existencia, raw.cantidad, raw.qty, raw.inventario];
  for (const c of stockCandidates) {
    if (c !== undefined && c !== null && c !== '') {
      const num = Number(String(c).replace(',', '.'));
      if (!isNaN(num)) {
        stockNum = num;
        break;
      }
    }
  }

  // 3. Extract Image
  let imgUrl = '';
  const imgCandidates = [
    raw.imagen_url,
    raw.imagen,
    raw.foto,
    raw.image_url,
    raw.url_imagen,
    raw.imagen_base64,
    raw.img,
    raw.image,
    raw.url
  ];
  for (const c of imgCandidates) {
    if (c && typeof c === 'string' && c.trim().length > 0 && c !== 'N/A' && c !== 'null') {
      imgUrl = c.trim();
      break;
    }
  }

  // 4. Barcode
  const barcode = (raw.codigo_barras || raw.codigo || raw.referencia || raw.barcode || raw.cod || 'N/A').toString().trim();

  // 5. Unit
  const rawUnit = String(raw.unidad_medida || raw.unidad || raw.medida || 'unid').toLowerCase();
  const unit = (rawUnit.includes('kg') || rawUnit.includes('kilo')) ? 'kg' : 'unid';

  // 6. Category
  const cat = (raw.categoria || raw.category || raw.departamento || 'Sin Categoría').toString().trim();

  return {
    id: String(raw.id || raw.uid || Math.random().toString(36).substring(2, 9)),
    nombre: (raw.nombre || raw.name || raw.titulo || 'Producto').toString().trim(),
    precio_usd: isNaN(precioNum) ? 0 : precioNum,
    stock: isNaN(stockNum) ? 0 : stockNum,
    codigo_barras: barcode,
    imagen_url: imgUrl,
    unidad_medida: unit,
    categoria: cat
  };
}

