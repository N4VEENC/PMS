import { NavLink, useLocation } from 'react-router-dom';
import { BellRing, BriefcaseBusiness, Database, LayoutDashboard, Layers, LogOut, Scale, Wallet } from 'lucide-react';
import { Brand } from './AuthShell';
import { ColorModeToggle } from './ColorModeToggle';
import { cn } from '../lib/utils';

const mainNav = [
  { label: 'Portfolios', to: '/portfolios', icon: BriefcaseBusiness, end: true },
  { label: 'Themes', to: '/themes', icon: Layers },
  // { label: 'Securities', to: '/securities', icon: Database },
  { label: 'Alerts', to: '/alerts', icon: BellRing }
];

const linkClass = ({ isActive }) => cn(
  'flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition',
  isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
);

function currentUserName() {
  try {
    return JSON.parse(localStorage.getItem('portfolio_user'))?.username || 'Account';
  } catch {
    return 'Account';
  }
}

export function Layout({ children }) {
  const { pathname } = useLocation();
  const isStandalonePage = pathname === '/securities';
  const isDashboardPage = /^\/portfolios\/\d+$/.test(pathname);
  // Inside a specific portfolio, show its own shortcuts
  const portfolioId = pathname.match(/^\/portfolios\/(\d+)/)?.[1];
  const portfolioNav = portfolioId ? [
    { label: 'Dashboard', to: `/portfolios/${portfolioId}`, icon: LayoutDashboard, end: true },
    { label: 'Holdings', to: `/portfolios/${portfolioId}/holdings`, icon: Wallet },
    { label: 'Rebalance', to: `/portfolios/${portfolioId}/rebalance`, icon: Scale }
  ] : [];

  const signOut = () => {
    localStorage.removeItem('portfolio_token');
    localStorage.removeItem('portfolio_user');
    window.location.href = '/login';
  };

  return (
    <div className={isStandalonePage ? 'min-h-screen' : 'min-h-screen lg:flex'}>
      {!isStandalonePage && <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/60 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-2 py-3"><Brand /></div>
        <nav className="mt-6 space-y-1" aria-label="Main">
          {mainNav.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}><Icon className="h-4 w-4" />{label}</NavLink>
          ))}
        </nav>

        {portfolioNav.length > 0 && (
          <nav className="mt-6 space-y-1 border-t border-border pt-4" aria-label="This portfolio">
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">This portfolio</p>
            {portfolioNav.map(({ label, to, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}><Icon className="h-4 w-4" />{label}</NavLink>
            ))}
          </nav>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-2 pt-4">
          <span className="truncate text-sm font-medium">{currentUserName()}</span>
          <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>}

      <div className={cn('min-w-0 flex-1', isDashboardPage && 'bg-[#fff8e7] dark:bg-background')}>
        {isStandalonePage ? (
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur sm:px-8">
            <Brand />
            <div className="flex items-center gap-2">
              <ColorModeToggle />
              <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>
        ) : (
          <>
            {/* compact navigation for small screens */}
            <header className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card/60 px-3 py-2 lg:hidden">
              {[...mainNav, ...portfolioNav].map(({ label, to, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={linkClass}><Icon className="h-4 w-4" />{label}</NavLink>
              ))}
              <span className="ml-auto flex items-center gap-1"><ColorModeToggle /><button type="button" onClick={signOut} className="rounded-md p-2 text-muted-foreground" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></span>
            </header>
            {/* top bar, desktop: colour mode switch in the top right corner */}
            <div className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-background/85 px-8 backdrop-blur lg:flex">
              <ColorModeToggle />
            </div>
          </>
        )}
        <main className="mx-auto w-full max-w-[1500px] space-y-6 overflow-x-hidden p-4 sm:p-6 lg:px-8 lg:pb-8 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
