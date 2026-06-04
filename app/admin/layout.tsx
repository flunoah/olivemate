export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // 크루용 하단 nav와 body padding을 덮는 전체화면 오버레이
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto" }}>
      {children}
    </div>
  );
}
