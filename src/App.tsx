/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Vender from './pages/Vender';
import Inventario from './pages/Inventario';
import Fiados from './pages/Fiados';
import Estadisticas from './pages/Estadisticas';
import Ajustes from './pages/Ajustes';
import Login from './pages/Login';
import PanelCreador from './pages/PanelCreador';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <ConfigProvider>{children}</ConfigProvider>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Vender />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="fiados" element={<Fiados />} />
            <Route path="stats" element={<Estadisticas />} />
            <Route path="ajustes" element={<Ajustes />} />
            <Route path="panel-creador" element={<PanelCreador />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

