import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { KeyRound, ShieldCheck, ArrowRight } from "lucide-react";
import BibiStoreLogo from "../components/BibiStoreLogo";
import toast from "react-hot-toast";

export default function Login() {
  const { user, loading, role, loginWithCode } = useAuth();
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [verificando, setVerificando] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (user && role !== 'none') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeClean = codigoIngresado.trim().toUpperCase();
    if (!codeClean) {
      toast.error("Por favor ingresa un código válido.");
      return;
    }

    setVerificando(true);
    const loadingToast = toast.loading("Verificando código de acceso...");

    try {
      const result = await loginWithCode(codeClean);
      if (result.success) {
        toast.success(result.message, { id: loadingToast, duration: 4000 });
      } else {
        toast.error(result.message, { id: loadingToast, duration: 5000 });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al procesar el código: " + (err?.message || "Ocurrió un error"), { id: loadingToast });
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 border-[16px] border-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="flex justify-center text-black mb-4 w-32 relative">
          <BibiStoreLogo className="h-32 w-32" />
        </div>
        <h2 className="text-center text-4xl font-black tracking-tighter text-black uppercase mt-4">
          BIBI STORE
        </h2>
        <p className="mt-2 text-center text-xs font-mono text-gray-500 uppercase tracking-widest">
          Control de Inventario & Ventas
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 sm:px-10 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-yellow-100 p-4 border-2 border-black flex items-start gap-3">
              <ShieldCheck className="text-black shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-black">Acceso por Código</h3>
                <p className="text-[11px] text-gray-700 mt-1 leading-tight">
                  Ingresa tu código de acceso para iniciar sesión como <strong>Cajera</strong>, <strong>Administradora</strong> o <strong>Superadministrador</strong>.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-black mb-2">
                Código de Acceso
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="EJ: X7K2P9 O CLAVE MAESTRA"
                  value={codigoIngresado}
                  onChange={e => setCodigoIngresado(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 uppercase tracking-widest font-mono text-base border-2 border-black focus:outline-none focus:border-yellow-400 font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verificando || !codigoIngresado.trim()}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 font-black text-black bg-yellow-400 border-2 border-black hover:bg-black hover:text-white uppercase tracking-widest disabled:opacity-50 disabled:hover:bg-yellow-400 disabled:hover:text-black transition-all shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 cursor-pointer"
            >
              {verificando ? (
                "VERIFICANDO..."
              ) : (
                <>
                  INGRESAR AL SISTEMA <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300 text-center">
            <p className="text-[10px] text-gray-400 uppercase font-mono tracking-widest">
              Si no posees un código, solicítalo al superadministrador del sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


