import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";

const COPILOT_NAV = [
  { to: "/", label: "Interview", icon: MicIcon },
  { to: "/meeting", label: "Professional Meeting", icon: UsersIcon },
  { to: "/assessment", label: "Online Assessment", icon: CodeIcon },
  { to: "/resources", label: "Resource Hub", icon: BookIcon },
];

const BOTTOM_NAV = [
  { to: "/history", label: "History", icon: ClockIcon },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? "w-[68px]" : "w-[260px]"
      } shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-solid)] transition-all duration-300 select-none`}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight truncate">Interview Copilot</h1>
              <p className="text-[10px] text-[var(--color-text-muted)] -mt-0.5">AI-Powered Assistant</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[var(--color-text-muted)] hover:text-white"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* New Session button */}
      <div className="px-3 mb-2">
        <NavLink
          to="/"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-brand-600/10 border border-brand-500/20 text-brand-300 text-sm font-medium hover:bg-brand-600/15 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {!collapsed && "New Session"}
        </NavLink>
      </div>

      {/* AI Copilot section */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
            AI Copilot
          </p>
        </div>
      )}
      <nav className="px-3 space-y-0.5">
        {COPILOT_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                isActive
                  ? "bg-brand-600/10 text-brand-300 font-medium"
                  : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                {!collapsed && <span className="truncate">{label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* New Features section */}
      {!collapsed && (
        <div className="px-4 pt-6 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
            New Features
          </p>
        </div>
      )}
      <nav className="px-3 space-y-0.5">
        <NavLink
          to="/prep"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
              isActive
                ? "bg-brand-600/10 text-brand-300 font-medium"
                : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <BrainIcon active={isActive} />
              {!collapsed && (
                <>
                  <span className="truncate">Mock Interview</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold leading-none">
                    NEW
                  </span>
                </>
              )}
            </>
          )}
        </NavLink>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <nav className="px-3 space-y-0.5 mb-2">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? "bg-brand-600/10 text-brand-300 font-medium"
                  : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile / status */}
      <div className="border-t border-[var(--color-border)] p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
            U
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">User</p>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Online</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CodeIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function BrainIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-1 2.65V12a3 3 0 0 1-6 0V9.65A4 4 0 0 1 8 7V6a4 4 0 0 1 4-4z" />
      <path d="M8 14v2a4 4 0 0 0 8 0v-2" />
      <path d="M6 10a2 2 0 1 0 0-4" />
      <path d="M18 10a2 2 0 1 1 0-4" />
      <path d="M12 18v4" />
    </svg>
  );
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
