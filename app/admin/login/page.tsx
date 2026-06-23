"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopProgressBar } from "../../components/TopProgressBar";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      if (!res.ok) {
        setError("아이디 또는 비밀번호를 확인해주세요");
        return;
      }
      const data = await res.json();
      const token = data.data?.accessToken ?? data.accessToken;
      const maxAge = data.data?.expiresIn ?? data.expiresIn ?? 86400;
      localStorage.setItem("adminToken", token);
      document.cookie = `adminToken=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      router.push("/admin");
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <TopProgressBar loading={loading} />
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-green-600">🫒 MATE</div>
          <p className="text-gray-400 text-sm mt-1">어드민</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">아이디</label>
            <input
              type="text"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder="아이디를 입력하세요"
              className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
