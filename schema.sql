-- Script DDL para crear las tablas en Supabase (Bibi Store)

CREATE TABLE IF NOT EXISTS public.productos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo_barras TEXT,
  precio_usd NUMERIC(12,2) DEFAULT 0,
  stock NUMERIC(12,2) DEFAULT 0,
  unidad_medida TEXT DEFAULT 'unid',
  categoria TEXT DEFAULT 'General',
  imagen_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.costos_productos (
  producto_id TEXT PRIMARY KEY REFERENCES public.productos(id) ON DELETE CASCADE,
  costo_usd NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.ventas (
  id TEXT PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  total_usd NUMERIC(12,2) DEFAULT 0,
  metodo_pago TEXT DEFAULT 'efectivo',
  vendedor_id TEXT
);

CREATE TABLE IF NOT EXISTS public.venta_detalles (
  id TEXT PRIMARY KEY,
  venta_id TEXT NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id TEXT REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  cantidad NUMERIC(12,2) DEFAULT 1,
  precio_unitario_usd NUMERIC(12,2) DEFAULT 0,
  subtotal_usd NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.fiados (
  id TEXT PRIMARY KEY,
  cliente TEXT NOT NULL,
  monto_usd NUMERIC(12,2) DEFAULT 0,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  estado TEXT DEFAULT 'pendiente',
  fecha_pago TIMESTAMPTZ,
  descripcion TEXT
);

-- Habilitar permisos de lectura/escritura pública temporalmente para la migración
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo en productos" ON public.productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en costos_productos" ON public.costos_productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en ventas" ON public.ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en venta_detalles" ON public.venta_detalles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en fiados" ON public.fiados FOR ALL USING (true) WITH CHECK (true);
