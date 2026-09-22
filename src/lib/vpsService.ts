export interface VPSStatus {
  online: boolean;
  totalProductos?: number;
  mode?: string;
  error?: string;
}

export async function checkVPSOnline(): Promise<VPSStatus> {
  try {
    const res = await fetch('/api/vps/status', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return { online: false };
    const data = await res.json();
    return {
      online: true,
      totalProductos: data.totalProductos,
      mode: data.mode
    };
  } catch (err: any) {
    return { online: false, error: err.message };
  }
}

export async function migrarTodoAVPS(payload: {
  productos: any[];
  config?: any;
  fiados?: any[];
  ventas?: any[];
}): Promise<{ success: boolean; totalProductos: number; mensaje: string }> {
  const res = await fetch('/api/vps/migracion-completa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error del servidor VPS' }));
    throw new Error(err.error || 'Error al enviar datos a la VPS');
  }

  return await res.json();
}
