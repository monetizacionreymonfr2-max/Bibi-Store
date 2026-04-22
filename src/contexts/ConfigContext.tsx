import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface ConfigContextType {
  tasaDolar: number;
  logoUrl: string | null;
}

const ConfigContext = createContext<ConfigContextType>({ tasaDolar: 0, logoUrl: null });

export const ConfigProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [tasaDolar, setTasaDolar] = useState<number>(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'configuracion', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTasaDolar(data.tasa_dolar || 0);
        // Prioritize what's in DB, but fallback to the user's provided link if empty
        setLogoUrl(data.logo_url || "https://files.fm/u/nx6fjyav4y"); 
      } else {
        // If config doesn't exist yet, at least show the logo
        setLogoUrl("https://files.fm/u/nx6fjyav4y");
      }
    }, (err) => {
      console.error("Error reading configuracion", err);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ConfigContext.Provider value={{ tasaDolar, logoUrl }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
