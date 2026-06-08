import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: “MATE 포인트”,
  description: “올리브영 자소 포인트”,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="color-scheme" content="light" />
        <meta name="google-site-verification" content="kp9Ob3ybE7kCCFy4rXK1WEaV2tbkZXBa_FIUV4kfY6I" />
        <meta name="naver-site-verification" content="14ee60ca9e01be066bb41f203598f051" />
      </head>
      <body className="bg-gray-50 max-w-md mx-auto min-h-screen relative pb-20">
        {children}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex z-50">
          <a href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-gray-400 hover:text-green-600 transition">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>
            <span className="text-xs mt-0.5">홈</span>
          </a>
          <a href="/history" className="flex-1 flex flex-col items-center py-3 text-gray-400 hover:text-green-600 transition">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
            <span className="text-xs mt-0.5">내역</span>
          </a>
          <a href="/mypage" className="flex-1 flex flex-col items-center py-3 text-gray-400 hover:text-green-600 transition">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span className="text-xs mt-0.5">마이페이지</span>
          </a>
        </nav>
      </body>
    </html>
  );
}