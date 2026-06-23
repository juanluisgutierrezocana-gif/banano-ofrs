import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import RegisterComplete from "@/pages/RegisterComplete";
import AppLayout from "@/components/layout/AppLayout";
import PanelDiario from "@/pages/PanelDiario";
import RecepcionFruta from "@/pages/RecepcionFruta";
import Reporteria from "@/pages/Reporteria";
import Configuraciones from "@/pages/Configuraciones";
import Inventario from "@/pages/Inventario";
import Perdidas from "@/pages/Perdidas";
import EditarTrenadas from "@/pages/EditarTrenadas";
import Saldos from "@/pages/Saldos";
import OrdenCalibre from "@/pages/OrdenCalibre";
import Landing from "@/pages/Landing";
import AvancesLayout from "@/components/layout/AvancesLayout";
import AvancesHome from "@/pages/avances/AvancesHome";
import AvancesConfiguraciones from "@/pages/avances/AvancesConfiguraciones";
import LaborDetalle from "@/pages/avances/LaborDetalle";
import ReporteLaborAgricola from "@/pages/avances/ReporteLaborAgricola";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground mt-4 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    } else if (authError.type === "auth_required") {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/welcome" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/registro-completado" element={<RegisterComplete />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/welcome" replace />} />}>
        <Route path="/landing" element={<Landing />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<PanelDiario />} />
          <Route path="/recepcion" element={<RecepcionFruta />} />
          <Route path="/reporteria" element={<Reporteria />} />
          <Route path="/configuraciones" element={<Configuraciones />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/perdidas" element={<Perdidas />} />
          <Route path="/editar-trenadas" element={<EditarTrenadas />} />
          <Route path="/orden-calibre" element={<OrdenCalibre />} />
          <Route path="/saldos" element={<Saldos />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/welcome" replace />} />}>
        <Route element={<AvancesLayout />}>
          <Route path="/avances-agricolas" element={<AvancesHome />} />
          <Route path="/avances-agricolas/configuraciones" element={<AvancesConfiguraciones />} />
          <Route path="/avances-agricolas/reporteria" element={<ReporteLaborAgricola />} />
          <Route path="/avances-agricolas/labor/:laborId" element={<LaborDetalle />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;