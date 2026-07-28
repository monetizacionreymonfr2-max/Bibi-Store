import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ConfigContextType {
  tasaDolar: number;
}

const ConfigContext = createContext<ConfigContextType>({ tasaDolar: 0 });

export const ConfigProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [tasaDolar, setTasaDolar] = useState<number>(0);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.from('configuracion').select('*');
        if (!error && data && data.length > 0) {
          const confRow = data.find((c: any) => c.id === 'general') || data[0];
          const val = Number(
            confRow.tasa_dolar ?? confRow.tasa ?? confRow.tasa_bcv ?? confRow.tasaDolar ?? confRow.valor_dolar ?? 0
          );
          if (val > 0) {
            setTasaDolar(val);
          }
        }
      } catch (err) {
        console.error("Error cargando configuración:", err);
      }
    };

    fetchConfig();

    const channel = supabase
      .channel('configuracion_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracion' },
        (payload) => {
          if (payload.new && (payload.new as any).tasa_dolar) {
            setTasaDolar((payload.new as any).tasa_dolar);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <ConfigContext.Provider value={{ tasaDolar }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);

