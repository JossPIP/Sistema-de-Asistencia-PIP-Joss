import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 w-full glass-panel z-50 rounded-t-2xl shadow-[0_-4px_24px_rgba(25,28,29,0.04)] border-t border-outline-variant/20 flex justify-around items-center px-4 pb-4 pt-2 md:hidden">
      <NavItem to="/" icon="dashboard" label="Panel" />
      <NavItem to="/scanner" icon="qr_code_scanner" label="Escáner" />
      <NavItem to="/students" icon="group" label="Estudiantes" />
      <NavItem to="/settings" icon="settings" label="Ajustes" />
    </nav>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center px-3 py-1.5 transition-transform duration-150 active:scale-95 rounded-xl",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-on-surface-variant hover:text-primary"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
          >
            {icon}
          </span>
          <span className="text-[11px] font-medium tracking-wide uppercase mt-1">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function TopBar() {
  return (
    <header className="w-full top-0 sticky z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center px-6 py-4 border-b border-outline-variant/10">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
        <h1 className="text-xl font-bold text-on-surface tracking-tight">El Registrador Digital</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center space-x-6 mr-6">
          <DesktopNavLink to="/" label="Panel" />
          <DesktopNavLink to="/scanner" label="Escáner" />
          <DesktopNavLink to="/students" label="Estudiantes" />
          <DesktopNavLink to="/settings" label="Ajustes" />
        </div>
        <div className="h-10 w-10 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline-variant/20">
          <img
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAI0oxuCqDsSRsdaPBV2gAkLNVWbtK0I_gBAEhCNLeNaaBdiwwiWph3R0UCsGqvDIgq3OHJzy9RpWKqukD2RZ_dlR_Ay5lg376NcumzZR1xPsZ5uhiZTU4indH4U0FCnb6cMsI-ZP6-5EEPK8qLky-nSGYKBKkZVVl7LbqZdBZkVwruijvjiOBkdh3lZyV8mXNyA_saCUQ_wsRzX2IoDhckiWMWq1gKR9PHlCYFncPsKHA8XN6Vpcx_eYkhPNCQZq2Yb1uJvO0OWBk"
            alt="Admin Profile"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
}

function DesktopNavLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200",
          isActive
            ? "text-primary font-semibold"
            : "text-on-surface-variant hover:bg-surface-container-high"
        )
      }
    >
      {label}
    </NavLink>
  );
}
