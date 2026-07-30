import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isSession = location.pathname.startsWith("/session/");

  if (isSession) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="relative min-h-full">
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl" />
            <div className="absolute top-1/3 -left-40 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
