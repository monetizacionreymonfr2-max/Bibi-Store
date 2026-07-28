import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface ConfigContextType {
  tasaDolar: number;
}

const ConfigContext = createContext<ConfigContextType>({ tasaDolar: 0 });

export const ConfigProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [tasaDolar, setTasaDolar] = useState<number>(0);

  useEffect(() => {
    const docRef = doc(db, 'configuracion', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTasaDolar(data.tasa_dolar || 0);
      }
    }, (err) => {
      console.error("Error reading configuracion", err);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ConfigContext.Provider value={{ tasaDolar }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
