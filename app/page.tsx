"use client";
// v2
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopProgressBar } from "./components/TopProgressBar";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  useEffect(() => {
    const stay = localStorage.getItem("stayLoggedIn") === "true";
    setStayLoggedIn(stay);
    const t = localStorage.getItem("token");
    if (!t) return;
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      if (payload.exp * 1000 > Date.now()) {
        router.replace("/dashboard");
      } else {
        localStorage.clear();
        document.cookie = "token=; path=/; max-age=0";
      }
    } catch {
      localStorage.clear();
      document.cookie = "token=; path=/; max-age=0";
    }
  }, []);

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
        if (res.status === 401) setError("아이디 또는 비밀번호를 확인해주세요");
        else if (res.status === 403) setError("접근 권한이 없습니다");
        else if (res.status >= 500) setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요");
        else setError("사번 또는 비밀번호가 틀렸습니다.");
        return;
      }

      const data = await res.json();
      const token = data.data?.accessToken ?? data.accessToken;
      const refreshToken = data.data?.refreshToken ?? data.refreshToken;
      const maxAge = stayLoggedIn ? 30 * 24 * 60 * 60 : 86400;
      localStorage.setItem("token", token);
      localStorage.setItem("stayLoggedIn", stayLoggedIn ? "true" : "false");
      document.cookie = `token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      if (refreshToken) {
        if (stayLoggedIn) localStorage.setItem("refreshToken", refreshToken);
        else sessionStorage.setItem("refreshToken", refreshToken);
      }
      router.push("/dashboard");
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

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-green-600">🫒 MATE</div>
          <p className="text-gray-400 text-sm mt-1">올리브영 자소 포인트</p>
        </div>

        {/* 입력 폼 */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">사번</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="사번을 입력하세요"
              className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setStayLoggedIn(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${stayLoggedIn ? "bg-green-600" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${stayLoggedIn ? "translate-x-4" : "translate-x-0"}`}
              />
            </div>
            <span className="text-sm text-gray-600">로그인 유지</span>
          </label>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>

        {/* 회원가입 링크 */}
        <p className="text-center text-sm text-gray-400 mt-6">
          계정이 없으신가요?{" "}
          <a href="/signup" className="text-green-600 font-medium hover:underline">
            회원가입
          </a>
        </p>
      </div>
    </div>
    </>
  );
}