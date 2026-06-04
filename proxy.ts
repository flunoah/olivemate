import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes — use separate adminToken cookie
  if (pathname.startsWith('/admin')) {
    const adminToken = request.cookies.get('adminToken')?.value;
    if (pathname === '/admin/login') {
      if (adminToken) return NextResponse.redirect(new URL('/admin', request.url));
      return NextResponse.next();
    }
    if (!adminToken) return NextResponse.redirect(new URL('/admin/login', request.url));
    return NextResponse.next();
  }

  // Regular crew routes
  const token = request.cookies.get('token')?.value;
  const isAuthPage = pathname === '/' || pathname.startsWith('/signup');

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
