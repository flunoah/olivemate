# Frontend Architecture

CrewCheck 프론트엔드(`mate-front`) 구조와 컨벤션.

> 서비스명은 CrewCheck이나 저장소명·메타데이터는 이전 명칭(MATE)을 유지한다.

---

## 1. Tech Stack

| 항목 | 내용 |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| React | 19.2.4 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 **+ inline style 혼재** (아래 참고) |
| Test | Playwright (E2E) |
| Backend | 별도 저장소(`mate`). `next.config.ts`의 `rewrites()`로 프록시 |

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run start    # 빌드 결과 실행
```

> `lint` 스크립트가 정의되어 있지 않다. ESLint 도입 시 `package.json`에 추가할 것.

---

## 2. 디렉토리 구조

```
app/
├── layout.tsx              루트 레이아웃 + 하단 탭 네비게이션
├── globals.css             Tailwind v4 import, CSS 변수, 애니메이션
├── page.tsx                로그인 (진입점)
├── signup/page.tsx         회원가입
├── dashboard/page.tsx      홈 — 잔액, 이번 주 근무, 포인트 사용
├── history/page.tsx        내역 — 캘린더, 원장 목록, 사용 취소
├── mypage/page.tsx         마이페이지 — 소정 근무일, 알림 설정
├── admin/
│   ├── layout.tsx
│   ├── login/page.tsx      어드민 전용 로그인 (adminToken 쿠키)
│   └── page.tsx            어드민 대시보드
├── api/bugs/route.ts       Next.js Route Handler (버그 제보 저장)
├── components/
│   └── TopProgressBar.tsx  상단 로딩 인디케이터
└── lib/
    ├── auth.ts             토큰 관리 + authFetch
    └── push.ts             Web Push 구독

public/
└── service-worker.js       푸시 수신 및 알림 클릭 처리

proxy.ts                    ⚠️ 미들웨어 (파일명 오류 — 3-3 참고)
next.config.ts              API 프록시 설정
```

---

## 3. 알려진 이슈 (우선 수정 대상)

### 3-1. `/api/bugs`가 백엔드로 프록시되어 동작하지 않는다

`next.config.ts`의 rewrites가 **모든** `/api/*`를 백엔드로 넘긴다.

```typescript
source: "/api/:path*",
destination: "https://olivemate-api.onrender.com/api/:path*",
```

그래서 `app/api/bugs/route.ts`가 존재해도 `fetch("/api/bugs")`는 자체 Route Handler에 도달하지 못하고 Render 백엔드로 가서 404가 난다. 호출부가 `.catch(() => {})`로 실패를 삼키고 있어 지금까지 드러나지 않았다.

**수정**: 백엔드 엔드포인트가 전부 `/api/v1/`로 시작하므로 프록시 범위를 좁힌다.

```typescript
source: "/api/v1/:path*",
destination: `${process.env.API_BASE_URL ?? "https://olivemate-api.onrender.com"}/api/v1/:path*`,
```

### 3-2. 백엔드 주소가 하드코딩되어 있다

로컬 백엔드로 개발하려면 `next.config.ts`를 직접 고쳐야 하고, 실수로 커밋하면 프로덕션이 로컬을 가리킨다. 위 예시처럼 `API_BASE_URL` 환경변수로 분리하고 `.env.local`에 다음을 둔다.

```
API_BASE_URL=http://localhost:8080
```

`NEXT_PUBLIC_` 접두사 없이 서버 사이드에서만 쓰이므로 클라이언트에 노출되지 않는다.

### 3-3. `proxy.ts`가 미들웨어로 인식되지 않는다

Next.js 미들웨어는 **파일명 `middleware.ts`, 함수명 `middleware`**여야 한다. 현재는 `proxy.ts` / `export function proxy(...)`이므로 **라우트 가드가 전혀 실행되지 않는다.**

```bash
mv proxy.ts middleware.ts
# 함수명도 proxy → middleware 로 변경
```

현재는 각 페이지의 `useEffect` 클라이언트 가드만으로 버티는 상태다. 이 방식은 페이지가 일단 렌더된 뒤 리다이렉트하므로, 비로그인 상태에서 보호된 화면이 잠깐 노출될 수 있다.

미들웨어가 살아나면 다음 규칙이 적용된다.

| 경로 | 쿠키 | 동작 |
|---|---|---|
| `/admin/login` | `adminToken` 있음 | `/admin`으로 리다이렉트 |
| `/admin/*` | `adminToken` 없음 | `/admin/login`으로 리다이렉트 |
| `/`, `/signup` | `token` 있음 | `/dashboard`로 리다이렉트 |
| 그 외 | `token` 없음 | `/`로 리다이렉트 |

### 3-4. 하단 네비게이션이 `<a>` 태그다

`layout.tsx`의 탭 3개가 `<a href="/dashboard">` 형태라 **탭 전환 시 전체 페이지가 리로드**된다. `next/link`로 교체하면 클라이언트 사이드 라우팅이 적용되어 전환이 즉각적이 된다.

```tsx
import Link from "next/link";
<Link href="/dashboard" className="...">
```

### 3-5. 되돌리기(Undo) 기능이 동작하지 않는다

`dashboard/page.tsx`가 사용 응답에서 취소용 ID를 찾는다.

```typescript
const ledgerId = data.ledgerId ?? data.id ?? "";
if (ledgerId) setPendingUndo({...});   // 10초 카운트다운 토스트
else showToast(`${usedAmt}P 사용 완료!`);
```

그러나 백엔드 `UsePointResult`는 `(usedAmount, balance)` 두 필드뿐이라 **항상 else로 빠진다.** 되돌리기 UI는 구현되어 있으나 한 번도 노출된 적이 없다.

**수정**: 백엔드 `UsePointResult`에 `txId` 추가 필요. 프론트만으로는 해결 불가.

### 3-6. 사용 취소가 중복 호출된다

`history/page.tsx`가 `mergedIds`를 순회하며 `/points/cancel`을 여러 번 호출한다.

```typescript
for (const ledgerId of cancelTarget.ledgerIds) {
  const res = await authFetch("/api/v1/points/cancel", {...});
  if (!res.ok) { setCancelError("취소 가능 시간이 지났습니다."); return; }
}
```

백엔드는 첫 호출에서 `txId` 단위로 전부 취소하므로, 두 번째 호출부터는 "사용 내역을 찾을 수 없습니다"(400)가 나고 프론트는 이를 **"취소 가능 시간이 지났습니다"로 잘못 표시**한다.

**수정**: 첫 `ledgerId` 하나만 호출하도록 변경.

---

## 4. 인증

### 토큰 저장 위치

| 토큰 | 위치 | 비고 |
|---|---|---|
| accessToken | `localStorage` + 쿠키 | 쿠키는 미들웨어 라우트 가드용 |
| refreshToken | `stayLoggedIn` ? `localStorage` : `sessionStorage` | 로그인 유지 여부에 따라 분기 |
| adminToken | 쿠키 | 어드민 전용, 크루 토큰과 분리 |

쿠키 `max-age`는 `stayLoggedIn` 여부에 따라 30일 / 24시간.

### authFetch — 모든 API 호출의 단일 진입점

```typescript
export async function authFetch(url, options = {}, retried = false): Promise<Response>
```

- `Authorization: Bearer {token}` 자동 첨부
- 401 응답 시 `silentRefresh()` → 성공하면 원 요청 1회 재시도
- `retried` 플래그로 무한 루프 차단
- refresh 실패 시 리다이렉트는 **호출부 책임** (`router.push("/")`)

**직접 `fetch`를 쓰지 말 것.** 토큰 첨부와 갱신이 누락된다.

### silentRefresh — 동시 호출 방어

```typescript
if (isRefreshing && refreshPromise) return refreshPromise;   // 진행 중이면 Promise 공유
```

여러 API가 동시에 401을 받아도 refresh 요청은 한 번만 나간다.
또한 refresh 완료 시점에 이미 로그아웃됐다면 새 토큰을 저장하지 않는다.

### 페이지 진입 패턴

모든 보호 페이지가 동일한 구조를 따른다.

```typescript
useEffect(() => {
  const t = localStorage.getItem("token");
  if (!t) { router.push("/"); return; }

  const proceed = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setCrewId(payload.sub);
      fetchData(payload.sub);
    } catch { clearAuth(); router.push("/"); }
  };

  if (isTokenExpired()) {
    silentRefresh().then(newToken => {
      if (newToken) proceed(newToken);
      else { clearAuth(); router.push("/"); }
    });
  } else {
    proceed(t);
  }
}, []);
```

`crewId`는 JWT payload의 `sub`에서 추출한다. 별도 API 호출 없음.

---

## 5. API 연동 규칙

### 응답 언래핑

백엔드 응답 포맷이 두 가지로 혼재되어 있어 방어 패턴이 필요하다.

```typescript
const res2 = await res.json();
const data = res2?.data ?? res2;
```

| 패턴 | 컨트롤러 |
|---|---|
| 직접 반환 | Point, Attendance, Schedule, Auth, Admin |
| `ApiResponse<T>` 래핑 | Notification, PushSubscription |

일부 엔드포인트는 **평문 문자열**(`"근무일 등록 완료..."`)을 반환하므로 `res.json()` 호출 시 주의.

### 관리자 키 헤더

크루용 API 호출에도 `X-Admin-Key`를 관례적으로 붙이고 있다.

```typescript
const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key';
headers: { 'X-Admin-Key': adminKey }
```

> **주의**: `NEXT_PUBLIC_` 접두사는 이 값이 **브라우저 번들에 그대로 포함**된다는 뜻이다. 실제 관리자 배치 엔드포인트(`/admin/grant-points-all` 등)가 같은 키를 쓴다면 보안 문제가 된다. 크루 API에는 이 헤더가 불필요하므로 제거를 검토할 것.

### 요일 번호 변환 (필수)

서버는 **1=월 ~ 7=일**, JS `Date.getDay()`는 **0=일 ~ 6=토**로 다르다.

```typescript
const serverDayToJsDay = (d: number): number => (d === 7 ? 0 : d);
```

`/schedule/me/{crewId}` 응답을 화면에 쓰기 전 반드시 변환한다.

### 날짜 처리

KST 기준으로 오늘 날짜를 구할 때 오프셋을 수동 적용한다.

```typescript
const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const today = koreaTime.toISOString().slice(0, 10);
```

---

## 6. 스타일링

### ⚠️ 두 가지 방식이 혼재한다

| 영역 | 방식 |
|---|---|
| `layout.tsx` (body, 하단 네비) | **Tailwind 유틸리티 클래스** |
| 페이지 내부 (dashboard, history, mypage) | **inline style 객체** |

`globals.css`는 Tailwind v4 방식(`@import "tailwindcss"` + `@theme inline`)으로 설정되어 있다.

**신규 작업 시**: 기존 페이지를 수정할 때는 그 파일의 방식을 따르고, 새 컴포넌트는 Tailwind를 우선한다. 한 파일 안에서 두 방식을 섞지 말 것.

> `@theme`이 `--font-geist-sans`를 참조하지만 `layout.tsx`에 Geist 폰트 로딩이 없다. 실제로는 `body`의 `Arial, Helvetica, sans-serif`가 적용된다. Next.js 기본 템플릿의 잔재이므로 정리 대상.

### 컬러 토큰

inline style에서 반복 사용되는 값들. 상수 파일로 추출하면 유지보수가 쉬워진다.

| 용도 | 값 |
|---|---|
| primary (적립, 성공) | `#1B9E5B` |
| primary 배경 | `#F0FAF4` / `#E8F5E9` |
| danger (사용, 삭제) | `#E53935` |
| danger 배경 | `#FFF0F0` / `#FFEBEE` |
| warning (소멸 예정) | `#E65100` |
| warning 배경 | `#FFF3E0` / `#FFF8E1` |
| info (연장 근무) | `#1565C0` |
| info 배경 | `#EFF6FF` / `#E3F2FD` |
| 페이지 배경 | `#f5f5f5` |
| 카드 배경 | `#fff` |
| 본문 텍스트 | `#1a1a1a` |
| 보조 텍스트 | `#888` |
| 테두리 | `#e0e0e0` |

### 카드 컨테이너 기본형

```typescript
{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }
```

### 레이아웃

- 모바일 퍼스트. 콘텐츠 최대 너비 `448px` (`max-w-md`), 가운데 정렬
- 하단 탭 네비 고정. `body`에 `pb-20`으로 겹침 방지

---

## 7. UI 패턴

| 패턴 | 컴포넌트 | 용도 |
|---|---|---|
| 상단 로딩 바 | `TopProgressBar` | 페이지·액션 로딩 (`loading` prop) |
| 토스트 | `Toast` (dashboard 내부) | 성공/실패 알림, 탭하여 닫기 |
| 되돌리기 바 | `UndoToastBar` | 10초 카운트다운 취소 (현재 미작동, 3-5 참고) |
| 확인 모달 | `CancelModal` (history 내부) | 파괴적 액션 확인 |
| 바텀시트 | 연장 근무 추가 모달 | 하단에서 올라오는 선택 UI |
| 배너 | 홈 화면 추가 안내 | `localStorage`로 dismiss 상태 유지 |

> `Toast`, `CancelModal` 등이 각 페이지 파일 안에 정의되어 재사용되지 않는다. `components/`로 추출 권장.

### 되돌릴 수 있는 액션 원칙

파괴적이지만 되돌릴 수 있는 액션(포인트 사용)은 **확인 모달 대신 실행 후 되돌리기**를 제공한다.
되돌릴 수 없는 액션(사용 취소 확정)은 **확인 모달**을 띄운다.

---

## 8. Web Push

### 흐름

```
마이페이지 "알림 켜기"
  → Notification.requestPermission()
  → service-worker.js 등록
  → GET /api/v1/push/vapid-public-key
  → pushManager.subscribe()
  → POST /api/v1/push/subscribe (endpoint, p256dh, auth)
```

### 파일

| 파일 | 역할 |
|---|---|
| `app/lib/push.ts` | 구독/해제, 지원 여부 확인, VAPID 키 변환 |
| `public/service-worker.js` | `push` 이벤트 → 알림 표시, `notificationclick` → 딥링크 이동 |

### iOS 제약

iOS Safari는 **홈 화면에 추가(PWA 설치)된 상태에서만** 푸시를 지원한다. 브라우저 탭에서는 `Notification.requestPermission()`이 동작하지 않는다.

`dashboard/page.tsx`의 "홈 화면에 추가하기" 배너가 이 선행 단계를 안내한다. UX 순서상 배너 → 알림 켜기로 이어지는 것이 자연스럽다.

`isPushSupported()`가 false면 마이페이지의 알림 카드 자체를 렌더하지 않는다.

### 딥링크 미처리

백엔드가 보내는 알림의 `deepLink`는 `/points/history?date=2026-08-11` 형태지만, `history/page.tsx`가 **URL의 `date` 쿼리 파라미터를 읽지 않는다.** 알림을 클릭해 들어와도 해당 날짜가 자동 선택되지 않는다.

**수정 방향**: `useSearchParams()`로 `date`를 읽어 `selectedDate` 초기값에 반영.

---

## 9. 코딩 컨벤션

- 모든 페이지는 `"use client"`. SSR·서버 컴포넌트를 사용하지 않는다 (사실상 SPA).
- API 호출은 반드시 `authFetch` 경유.
- 응답은 `res.data ?? res`로 언래핑.
- 상태 변수는 `useState`, 폼은 제어 컴포넌트로 관리.
- 에러 메시지는 `apiErrorMessage(status)`로 매핑하되, 가능하면 `ErrorResponse.code`로 분기하는 것이 정확하다 (409가 여러 상황에 쓰임).
- 파일 상단에 `interface`로 API 응답 타입을 선언한다. 백엔드 DTO 변경 시 함께 갱신할 것.

---

## 10. 개선 백로그

| 우선순위 | 항목 | 근거 |
|---|---|---|
| 높음 | `proxy.ts` → `middleware.ts` 수정 | 라우트 가드 미작동 (3-3) |
| 높음 | rewrites 범위 축소 + 환경변수화 | `/api/bugs` 미작동, 로컬 개발 마찰 (3-1, 3-2) |
| 높음 | 사용 취소 중복 호출 제거 | 잘못된 에러 메시지 노출 (3-6) |
| 중간 | 하단 네비 `<a>` → `<Link>` | 탭 전환마다 전체 리로드 (3-4) |
| 중간 | 공통 컴포넌트 추출 (`Toast`, `Card`, `Button`) | 페이지마다 복붙 상태 |
| 중간 | 컬러 토큰 상수화 | 색상 변경 시 수십 곳 수정 필요 |
| 중간 | 딥링크 `date` 파라미터 처리 | 알림 클릭 시 동작 없음 (8) |
| 낮음 | `NEXT_PUBLIC_ADMIN_KEY` 사용 재검토 | 브라우저 번들에 노출 (5) |
| 낮음 | Geist 폰트 잔재 정리 | 무의미한 CSS 변수 |
| 낮음 | ESLint 도입 | `lint` 스크립트 부재 |