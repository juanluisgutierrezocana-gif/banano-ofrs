import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TrialCountdownBanner from "@/components/TrialCountdownBanner";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <TrialCountdownBanner finca={user?.finca} />
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}