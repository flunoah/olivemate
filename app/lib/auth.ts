// ── 버그 1 방어: 진행 중인 refresh를 공유해 중복 호출 및 무한 루프 차단 ──
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getToken(): string {
  try { return localStorage.getItem("token") || ""; } catch { return ""; }
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");
  } catch { return null; }
}

function getStayLoggedIn(): boolean {
  try { return localStorage.getItem("stayLoggedIn") === "true"; } catch { return false; }
}

export function saveTokens(accessToken: string, refreshToken: string) {
  try {
    const maxAge = getStayLoggedIn() ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    localStorage.setItem("token", accessToken);
    document.cookie = `token=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (getStayLoggedIn()) {
      localStorage.setItem("refreshToken", refreshToken);
    } else {
      sessionStorage.setItem("refreshToken", refreshToken);
    }
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("stayLoggedIn");
    sessionStorage.removeItem("refreshToken");
    document.cookie = "token=; path=/; max-age=0";
  } catch {}
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "X-Refresh-Token": refreshToken },
    });

    if (!res.ok) {
      clearAuth();
      return null;
    }

    const data = await res.json();
    const newAccess: string = data.accessToken ?? data.data?.accessToken;
    const newRefresh: string = data.refreshToken ?? data.data?.refreshToken;

    // ── 버그 2 방어: refresh 완료 시점에 이미 로그아웃됐으면 저장하지 않음 ──
    if (!getToken()) return null;

    saveTokens(newAccess, newRefresh);
    return newAccess;
  } catch {
    // 네트워크 오류는 로그아웃 처리 안 함 (일시적 장애 가능성)
    return null;
  }
}

export async function silentRefresh(): Promise<string | null> {
  // 버그 1 방어: 이미 refresh 중이면 같은 Promise 공유 (중복 호출 차단)
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = doRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

// retried 플래그로 재시도를 1회로 제한 → 무한 루프 원천 차단
export async function authFetch(
  url: string,
  options: RequestInit = {},
  retried = false
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${getToken()}` },
  });

  if (res.status === 401 && !retried) {
    const newToken = await silentRefresh();
    if (newToken) return authFetch(url, options, true);
    // refresh 실패 → 로그인으로 보내는 건 호출부에서 처리
  }

  return res;
}

export function isTokenExpired(): boolean {
  try {
    const t = getToken();
    if (!t) return true;
    const payload = JSON.parse(atob(t.split(".")[1]));
    if (!payload.exp) return false; // exp 없으면 무만료 토큰
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}
