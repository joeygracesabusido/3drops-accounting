import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value;
  const userRole = request.cookies.get('userRole')?.value;
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/register', '/api/login', '/api/register'];
  
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Role-based restrictions for Employees
  if (isLoggedIn === 'true' && userRole === 'EMPLOYEE') {
    const restrictedPaths = [
      '/accounting',
      '/asset-inventory',
      '/users',
      '/employees',
      '/reports',
      '/settings',
    ];

    if (restrictedPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (!isLoggedIn && pathname !== '/login' && pathname !== '/register') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
