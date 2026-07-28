import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'superadmin' | 'admin' | 'cajero' | 'none';

export interface UserProfile {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  loading: boolean;
  loginWithCode: (code: string) => Promise<{ success: boolean; message: string; role?: UserRole }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'none',
  loading: true,
  loginWithCode: async () => ({ success: false, message: 'No inicializado' }),
  signOut: () => {}
});

const SUPERADMIN_CODES = [
  'SUPERADMIN',
  'MONETIZACION',
  'SUPERBIBI',
  'BIBI2026',
  'REMON2026',
  '0000',
  'MONETIZACIONREYMONFR2@GMAIL.COM',
  'MONETIZACIONREYMONFR2'
];

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('bibi_code_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.user && parsed.role) {
          setUser(parsed.user);
          setRole(parsed.role);
        }
      }
    } catch (err) {
      console.error("Error cargando sesión local:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithCode = async (code: string): Promise<{ success: boolean; message: string; role?: UserRole }> => {
    const codeClean = code.trim().toUpperCase();
    if (!codeClean) {
      return { success: false, message: 'Ingresa un código de acceso.' };
    }

    // 1. Check if Superadmin Master Code
    if (SUPERADMIN_CODES.includes(codeClean)) {
      const superUser: UserProfile = {
        id: 'superadmin_1',
        uid: 'superadmin_1',
        email: 'monetizacionreymonfr2@gmail.com',
        displayName: 'Super Administrador'
      };
      const sessionData = { user: superUser, role: 'superadmin' as UserRole, code: codeClean };
      localStorage.setItem('bibi_code_session', JSON.stringify(sessionData));
      setUser(superUser);
      setRole('superadmin');
      return { success: true, message: '¡Bienvenido/a Superadministrador!', role: 'superadmin' };
    }

    // 2. Check in database for generated code in codigos_acceso or codigos table
    try {
      let codeDoc: any = null;

      // First query codigos_acceso table
      const { data: resAcceso } = await supabase
        .from('codigos_acceso')
        .select('*')
        .or(`id.eq.${codeClean},codigo.eq.${codeClean}`)
        .maybeSingle();

      if (resAcceso) {
        codeDoc = resAcceso;
      } else {
        // Fallback to codigos table
        const { data: resCodigos } = await supabase
          .from('codigos')
          .select('*')
          .or(`id.eq.${codeClean},codigo.eq.${codeClean}`)
          .maybeSingle();

        if (resCodigos) {
          codeDoc = resCodigos;
        }
      }

      if (!codeDoc) {
        return { success: false, message: 'El código ingresado no existe. Verifica con la administradora.' };
      }

      // Check if active / disabled
      if (codeDoc.activo === false || codeDoc.inactivo === true) {
        return { success: false, message: 'Este código de acceso ha sido desactivado o revocado.' };
      }

      // Check if single-use and already used
      if (codeDoc.usado === true) {
        return { success: false, message: 'Este código ya ha sido utilizado.' };
      }

      const assignedRole = (codeDoc.rol || 'cajero') as UserRole;

      // Update used / active status in database
      const updateData = {
        usado: true,
        ultimo_uso: Date.now(),
        usadoPor: 'usr_' + codeClean
      };

      if (resAcceso) {
        await supabase.from('codigos_acceso').update(updateData).or(`id.eq.${codeClean},codigo.eq.${codeClean}`);
      } else {
        await supabase.from('codigos').update(updateData).or(`id.eq.${codeClean},codigo.eq.${codeClean}`);
      }

      const roleLabel = assignedRole === 'superadmin' ? 'Superadministrador' : assignedRole === 'admin' ? 'Administradora' : 'Cajera';

      const profile: UserProfile = {
        id: 'usr_' + codeClean,
        uid: 'usr_' + codeClean,
        email: null,
        displayName: roleLabel
      };

      const sessionData = { user: profile, role: assignedRole, code: codeClean };
      localStorage.setItem('bibi_code_session', JSON.stringify(sessionData));
      setUser(profile);
      setRole(assignedRole);

      return {
        success: true,
        message: `¡Acceso concedido como ${roleLabel.toUpperCase()}!`,
        role: assignedRole
      };
    } catch (err: any) {
      console.error("Error verificando código:", err);
      return { success: false, message: 'Error al verificar el código con el servidor: ' + (err?.message || '') };
    }
  };

  const signOut = () => {
    localStorage.removeItem('bibi_code_session');
    setUser(null);
    setRole('none');
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, loginWithCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


