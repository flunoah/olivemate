"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 0 },
];

function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().slice(0, 10);
}

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [initPoint, setInitPoint] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [crewId, setCrewId] = useState("");
  const [token, setToken] = useState("");

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSignUp = async () => {
    if (!loginId || !password || !name) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://olivemate-api.onrender.com/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, name }),
      });
      if (!res.ok) { setError("이미 사용 중인 사번입니다."); return; }

      const loginRes = await fetch("https://olivemate-api.onrender.com/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await loginRes.json();
      const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
      setCrewId(payload.sub);
      setToken(data.accessToken);
      localStorage.setItem("token", data.accessToken);
      document.cookie = `token=${data.accessToken}; path=/; max-age=86400; SameSite=Lax`;
      setStep(2);
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleInitPoint = async () => {
    setLoading(true);
    setError("");
    try {
      if (initPoint && Number(initPoint) > 0) {
        const res = await fetch(
          `https://olivemate-api.onrender.com/api/v1/points/initialize/${crewId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: Number(initPoint) }),
          }
        );
        if (!res.ok) { setError("포인트 등록에 실패했습니다."); return; }
      }
      setStep(3);
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (selectedDays.length === 0) {
      setError("근무 요일을 선택해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await fetch("https://olivemate-api.onrender.com/api/v1/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          crewId,
          daysOfWeek: selectedDays,
          startDate: getNextMonday(),
        }),
      });
      router.push("/dashboard");
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ["회원가입", "보유 자소 입력", "주소정 설정"];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">

        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-green-600">🫒 MATE</div>
          <p className="text-gray-400 text-sm mt-1">{stepTitles[step - 1]}</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${
              step >= s ? "bg-green-600" : "bg-gray-200"
            }`}/>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">이름</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"/>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">사번</label>
              <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)}
                placeholder="사번을 입력하세요"
                className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"/>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="mt-1 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"/>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleSignUp} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
              {loading ? "처리 중..." : "다음"}
            </button>
            <p className="text-center text-sm text-gray-400">
              이미 계정이 있으신가요?{" "}
              <a href="/" className="text-green-600 font-medium hover:underline">로그인</a>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700">
              <p className="font-medium mb-1">기존에 보유한 자소가 있나요?</p>
              <p className="text-xs text-green-600">중도 입사자의 경우 현재 보유한 자소 포인트를 입력해주세요.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">보유 자소 포인트</label>
              <div className="relative mt-1">
                <input type="number" value={initPoint}
                  onChange={e => setInitPoint(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">P</span>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleInitPoint} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
              {loading ? "처리 중..." : "다음"}
            </button>
            <button onClick={() => setStep(3)}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition">
              보유 자소 없음
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700">
              <p className="font-medium mb-1">주소정 근무 요일을 설정해주세요</p>
              <p className="text-xs text-green-600">다음 주부터 매주 자동으로 근무일이 등록됩니다.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">근무 요일</label>
              <div className="flex gap-1.5">
                {DAYS.map(day => (
                  <button key={day.value} onClick={() => toggleDay(day.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      selectedDays.includes(day.value)
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleSaveSchedule} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
              {loading ? "저장 중..." : "시작하기 🎉"}
            </button>
            <button onClick={() => router.push("/dashboard")}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition">
              나중에 설정하기
            </button>
          </div>
        )}

      </div>
    </div>
  );
}