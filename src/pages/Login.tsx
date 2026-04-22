import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useConfig } from "../contexts/ConfigContext";
import { signInWithGoogle, signOut, db } from "../lib/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { Store, ShieldAlert, KeyRound, LogOut } from "lucide-react";

export default function Login() {
  const { user, loading, role } = useAuth();
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [verificando, setVerificando] = useState(false);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div></div>;
  }

  if (user && role !== 'none') {
    return <Navigate to="/" replace />;
  }

  const canjearCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setVerificando(true);

    try {
      // 1. Check if the code doc exists and is not used
      const docRef = doc(db, 'codigos', codigoIngresado.trim());
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists() || docSnap.data().usado) {
        alert("El código ingresado es inválido o ya fue utilizado.");
        setVerificando(false);
        return;
      }

      const rolAsignado = docSnap.data().rol; // 'admin' | 'cajero'

      // 2. Batch write: mark code as used, setup user profile
      const batch = writeBatch(db);
      
      // Update code
      batch.update(docRef, {
        usado: true,
        usadoPor: user.uid
      });

      // Create user role document
      batch.set(doc(db, 'usuarios', user.uid), {
        rol: rolAsignado,
        codigo_usado: codigoIngresado.trim()
      });

      await batch.commit();
      
      // La recarga de auth context detectará el cambio gracias a onSnapshot en usuarios
      alert(`¡Código verificado! Bienvenido/a al sistema como: ${rolAsignado.toUpperCase()}`);

    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al canjear el código (verifique la consola).");
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 border-[16px] border-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="flex justify-center text-black mb-4 h-32 w-32 relative">
          <img 
            src="/logo.jpg" 
            alt="Bibi Store Logo" 
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://files.fm/u/nx6fjyav4y';
              (e.target as HTMLImageElement).onerror = () => {
                (e.target as HTMLImageElement).style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
              };
            }}
          />
          <Store className="fallback-icon hidden text-black" size={80} />
        </div>
        <h2 className="text-center text-4xl font-black tracking-tighter text-black uppercase">
          BIBI STORE
        </h2>
        <p className="mt-2 text-center text-xs font-mono text-gray-500 uppercase tracking-widest">
          Sistema de Inventario & Ventas
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 sm:px-10 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]">
          {user && role === 'none' ? (
            <div className="flex flex-col gap-6">
              <div className="bg-gray-100 p-4 border border-black flex items-start gap-3">
                <ShieldAlert className="text-black shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-black">Cuenta sin permisos</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Tu correo ({user.email}) ha iniciado sesión con éxito, pero aún no tiene un rol asignado.
                  </p>
                </div>
              </div>

              <form onSubmit={canjearCodigo} className="space-y-4 border-t-2 border-dashed border-gray-300 pt-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">Código de Acceso</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      required
                      placeholder="INGRESE TOKEN..."
                      value={codigoIngresado}
                      onChange={e => setCodigoIngresado(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 uppercase tracking-widest font-mono border-2 border-black focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={verificando || !codigoIngresado.trim()}
                  className="w-full flex justify-center items-center gap-2 py-4 px-4 font-black text-black bg-yellow-400 border-2 border-black hover:bg-black hover:text-white uppercase tracking-widest disabled:opacity-50 disabled:hover:bg-yellow-400 disabled:hover:text-black transition-all"
                >
                  {verificando ? "VERIFICANDO..." : "CANJEAR"}
                </button>
              </form>

              <div className="pt-4 border-t-2 border-black">
                <button onClick={signOut} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-red-600 uppercase tracking-widest">
                  <LogOut size={16} /> Salir (Log Out)
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center font-mono text-xs text-gray-500 uppercase tracking-widest border-b-2 border-black pb-4">
                Por favor, identifícate.
              </div>

              <button
                onClick={signInWithGoogle}
                className="w-full flex justify-center py-4 px-4 border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] text-sm font-black uppercase tracking-widest text-black bg-white hover:bg-yellow-400 hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                Acceder con Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
