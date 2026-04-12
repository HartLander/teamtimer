import { useEffect, useMemo, useState } from 'react';
import { NavLink } from '@/components/NavLink';
import { useApp } from '@/contexts/AppContext';
import { Calendar, Users, BarChart3, Settings, LogOut, Clock, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'teamtimer-app-sidebar-collapsed';

function getInitialCollapsedState() {
  if (typeof window === 'undefined') return false;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved === 'true';
  return window.innerWidth <= 1180;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { logout, currentUser } = useApp();
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const navItems = useMemo(() => {
    const base = [
      { to: '/', icon: Calendar, label: 'Planung' },
      { to: '/mitarbeiter', icon: Users, label: 'Mitarbeiter' },
      { to: '/auswertung', icon: BarChart3, label: 'Auswertung' },
      { to: '/einstellungen', icon: Settings, label: 'Einstellungen' },
    ];

    if (currentUser?.isAdmin) {
      base.push({ to: '/konten', icon: ShieldCheck, label: 'Konten' });
    }

    return base;
  }, [currentUser?.isAdmin]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <aside
        className={cn(
          'flex h-full min-h-0 flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-200',
          collapsed ? 'w-[78px]' : 'w-56'
        )}
      >
        <div
          className={cn(
            'border-b border-border',
            collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'flex items-center justify-between px-3 py-4'
          )}
        >
          <div className={cn('flex min-w-0 items-center overflow-hidden', collapsed ? 'justify-center' : 'gap-2')}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            {!collapsed && <span className="truncate text-lg font-bold text-foreground">TeamTimer</span>}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(prev => !prev)}
            className="h-8 w-8 flex-shrink-0 text-muted-foreground"
            title={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto p-3">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={cn(
                'flex rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                collapsed ? 'justify-center' : 'items-center gap-3'
              )}
              activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
              title={item.label}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {!collapsed && currentUser && (
            <div className="mb-3 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
              <div className="font-medium text-foreground">{currentUser.displayName}</div>
              <div className="text-muted-foreground">{currentUser.isAdmin ? 'Admin' : currentUser.username}</div>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={logout}
            className={cn(
              'text-muted-foreground hover:text-destructive',
              collapsed ? 'h-10 w-full justify-center px-0' : 'w-full justify-start gap-3'
            )}
            title="Abmelden"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && 'Abmelden'}
          </Button>
        </div>
      </aside>

      <main className="flex h-full min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
