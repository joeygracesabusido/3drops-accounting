'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, DollarSign, Clock, FileText, LogOut, Menu, UserCheck, CalendarDays, Timer, Wallet, Settings, Calendar, Award, ChevronDown, Printer, Package, Database, CheckCircle2, Building } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  subItems?: NavItem[];
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/hris',
    label: 'HRIS',
    icon: Users,
    subItems: [
      { href: '/users', label: 'Users', icon: UserCheck },
      { href: '/employees', label: 'Employees', icon: Users },
      { href: '/schedules', label: 'Shift Schedule', icon: CalendarDays },
      { href: '/leave-credits', label: 'Leave Credits', icon: Award },
      { href: '/leaves', label: 'Leaves', icon: CalendarDays },
      { href: '/overtime', label: 'Overtime', icon: Timer },
      { href: '/time-logs', label: 'Time Logs', icon: Clock },
      { href: '/holidays', label: 'Holidays', icon: Calendar, adminOnly: true },
    ],
  },
  {
    href: '/accounting',
    label: 'Accounting',
    icon: Wallet,
    subItems: [
      { href: '/accounting', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/accounting/coa', label: 'Chart of Accounts', icon: FileText, adminOnly: true },
      { href: '/accounting/customers', label: 'Customers', icon: Users },
      { href: '/accounting/vendors', label: 'Vendors', icon: Building },
      { href: '/accounting/subsidiary-ledgers', label: 'Subsidiary Ledgers', icon: Database },
      { href: '/accounting/reconciliation', label: 'Reconciliation', icon: CheckCircle2, adminOnly: true },
      { href: '/accounting/journal', label: 'Journal Entries', icon: Timer, adminOnly: true },
      { href: '/accounting/expenses', label: 'Expenses', icon: DollarSign },
      { href: '/accounting/sales', label: 'Sales (AR)', icon: DollarSign },
      { href: '/accounting/purchases', label: 'Purchases (AP)', icon: Package },
      { href: '/accounting/reports', label: 'Financial Reports', icon: Printer, adminOnly: true },
    ],
  },
  {
    href: '/asset-inventory',
    label: 'Asset Inventory',
    icon: Package,
    subItems: [
      { href: '/asset-inventory', label: 'Asset List', icon: Package },
      { href: '/asset-inventory/new', label: 'Add Asset', icon: FileText },
      { href: '/asset-inventory/categories', label: 'Categories', icon: Settings },
      { href: '/asset-inventory/transactions', label: 'Transactions', icon: Clock },
    ],
  },
  {
    href: '/payroll',
    label: 'Payroll',
    icon: DollarSign,
    subItems: [
      { href: '/payroll', label: 'Payroll', icon: DollarSign },
      { href: '/payroll/advances', label: 'Advances', icon: Wallet },
    ],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: FileText,
    adminOnly: true,
    subItems: [
      { href: '/reports/print-payroll', label: 'Print Payroll', icon: Printer },
    ],
  },
  { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hrisOpen, setHrisOpen] = useState(false);
  const [accountingOpen, setAccountingOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [assetInventoryOpen, setAssetInventoryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    setMounted(true);
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (cookies.isLoggedIn !== 'true') {
      window.location.href = '/login';
    }
    setUserRole(cookies.userRole || '');
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    if (item.subItems) {
      if (item.adminOnly && userRole !== 'ADMIN' && userRole !== 'HR') {
        return false;
      }
      return true;
    }
    if (userRole === 'EMPLOYEE') {
      return !['/users', '/employees', '/reports', '/settings'].includes(item.href);
    }
    if (item.adminOnly && userRole !== 'ADMIN' && userRole !== 'HR') {
      return false;
    }
    return true;
  });

  if (!mounted) return null;

  const handleLogout = () => {
    document.cookie = 'isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userEmail=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userName=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-slate-950 text-foreground">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card shadow-soft dark:shadow-soft-dark border-b px-4 py-3 flex items-center justify-between text-card-foreground">
        <span className="font-bold text-lg">HRIS Philippines</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card text-card-foreground border-r-2 border-r-amber-400/30 dark:border-r-amber-500/20 shadow-soft dark:shadow-soft-dark transition-transform lg:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <h1 className="text-xl font-bold">HRIS</h1>
          <p className="text-sm text-muted-foreground">Philippines</p>
        </div>
        
        <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;

            if (item.subItems) {
              const isHrisActive = pathname.startsWith('/users') || pathname.startsWith('/employees') || pathname.startsWith('/schedules') || pathname.startsWith('/leave-credits') || pathname.startsWith('/leaves') || pathname.startsWith('/overtime') || pathname.startsWith('/time-logs') || pathname.startsWith('/holidays');
              const isPayrollActive = pathname.startsWith('/payroll');
              const isReportsActive = pathname.startsWith('/reports');
              const isAssetInventoryActive = pathname.startsWith('/asset-inventory');
              
              let isActive = false;
              let open: boolean = false;
              let setOpen: (val: boolean) => void = () => {};
              
              if (item.href === '/hris') {
                isActive = isHrisActive;
                open = hrisOpen;
                setOpen = setHrisOpen;
              } else if (item.href === '/accounting') {
                isActive = pathname.startsWith('/accounting');
                open = accountingOpen;
                setOpen = setAccountingOpen;
              } else if (item.href === '/payroll') {
                isActive = isPayrollActive;
                open = payrollOpen;
                setOpen = setPayrollOpen;
              } else if (item.href === '/reports') {
                isActive = isReportsActive;
                open = reportsOpen;
                setOpen = setReportsOpen;
              } else if (item.href === '/asset-inventory') {
                isActive = isAssetInventoryActive;
                open = assetInventoryOpen;
                setOpen = setAssetInventoryOpen;
              }

              return (
                <div key={item.href}>
                  <button
                    onClick={() => setOpen(!open)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg mb-1 ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (item.subItems as NavItem[]).filter((subItem) => {
                    if (subItem.adminOnly && userRole !== 'ADMIN' && userRole !== 'HR') {
                      return false;
                    }
                    return true;
                  }).map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={() => {
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg mb-1 ${
                          isSubActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <SubIcon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border flex items-center justify-between gap-2 bg-card">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg flex-1">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 p-6 pt-20 lg:pt-6">
        {children}
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
