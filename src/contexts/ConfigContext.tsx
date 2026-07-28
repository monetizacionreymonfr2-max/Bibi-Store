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
      const { data, error } = await supabase
        .from('configuracion')
        .select('*')
        .eq('id', 'general')
        .maybeSingle();

      if (!error && data && data.tasa_dolar) {
        setTasaDolar(data.tasa_dolar);
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

