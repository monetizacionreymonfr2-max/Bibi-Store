import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export type UserRole = 'superadmin' | 'admin' | 'cajero' | 'none';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: 'none', loading: true });

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      if (currUser) {
        const userEmail = (currUser.email || '').toLowerCase().trim();
        if (userEmail === 'monetizacionreymonfr2@gmail.com' || userEmail === 'floresrusmalby@gmail.com') {
          setRole('superadmin');
          setLoading(false);
          return;
        }

        // Fetch role
        const docRef = doc(db, 'usuarios', currUser.uid);
        const unsubscribeRole = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setRole(docSnap.data().rol as UserRole);
          } else {
            setRole('none');
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching role", error);
          setRole('none');
          setLoading(false);
        });
        return () => unsubscribeRole();
      } else {
        setRole('none');
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
