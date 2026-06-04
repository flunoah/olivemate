# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin_test.spec.ts >> admin dashboard full flow
- Location: admin_test.spec.ts:6:5

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]: 🫒 MATE Admin
      - button "로그아웃" [ref=e5] [cursor=pointer]
    - generic [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]:
          - button "+ 크루 등록" [ref=e9] [cursor=pointer]
          - textbox "이름 또는 사번 검색" [ref=e10]
        - paragraph [ref=e12]: 크루 없음
      - generic [ref=e14]: 왼쪽에서 크루를 선택하세요
  - navigation [ref=e15]:
    - link "홈" [ref=e16] [cursor=pointer]:
      - /url: /dashboard
      - img [ref=e17]
      - generic [ref=e20]: 홈
    - link "내역" [ref=e21] [cursor=pointer]:
      - /url: /history
      - img [ref=e22]
      - generic [ref=e26]: 내역
    - link "마이페이지" [ref=e27] [cursor=pointer]:
      - /url: /mypage
      - img [ref=e28]
      - generic [ref=e31]: 마이페이지
  - button "Open Next.js Dev Tools" [ref=e37] [cursor=pointer]:
    - img [ref=e38]
  - alert [ref=e41]
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | 
  3  | const BASE = 'http://localhost:3000';
  4  | const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  5  | 
  6  | test('admin dashboard full flow', async ({ page }) => {
  7  |   // 1. 리다이렉트: /admin → /admin/login (토큰 없음)
  8  |   await page.goto(`${BASE}/admin`);
  9  |   await expect(page).toHaveURL(/\/admin\/login/);
  10 |   console.log('✓ /admin → /admin/login 리다이렉트 정상');
  11 | 
  12 |   // 2. 로그인 페이지 렌더링
  13 |   await expect(page.locator('text=어드민')).toBeVisible();
  14 |   await page.screenshot({ path: '/tmp/ss_01_login.png' });
  15 | 
  16 |   // 3. 로그인
  17 |   await page.fill('input[type="text"]', 'admin');
  18 |   await page.fill('input[type="password"]', 'admin0826');
  19 |   await page.click('button:has-text("로그인")');
  20 |   await page.waitForURL(/\/admin$/, { timeout: 10000 });
  21 |   console.log('✓ 로그인 성공, URL:', page.url());
  22 |   await page.screenshot({ path: '/tmp/ss_02_dashboard.png' });
  23 | 
  24 |   // 4. 크루 목록 로드 확인
  25 |   await sleep(2000);
  26 |   const sidebar = page.locator('div').filter({ hasText: /사번|loginId|[가-힣]{2,4}/ }).first();
  27 |   await page.screenshot({ path: '/tmp/ss_03_crew_list.png' });
  28 | 
  29 |   // 사이드바에 크루가 있는지 확인
  30 |   const crewBtns = page.locator('div[style*="overflow-y: auto"] button');
  31 |   const crewCount = await crewBtns.count();
  32 |   console.log('✓ 크루 수:', crewCount);
> 33 |   expect(crewCount).toBeGreaterThan(0);
     |                     ^ Error: expect(received).toBeGreaterThan(expected)
  34 | 
  35 |   // 5. 첫 번째 크루 클릭
  36 |   const firstName = await crewBtns.first().locator('div').first().textContent();
  37 |   console.log('✓ 선택할 크루:', firstName);
  38 |   await crewBtns.first().click();
  39 |   await sleep(2000);
  40 |   await page.screenshot({ path: '/tmp/ss_04_workdays.png' });
  41 | 
  42 |   // 6. 근무 관리 탭 - 데이터 표시 확인
  43 |   const tabTitle = page.locator('p:has-text("년")').first();
  44 |   await expect(tabTitle).toBeVisible();
  45 |   console.log('✓ 근무 관리 탭: 월 네비게이션 표시됨');
  46 | 
  47 |   // 7. 포인트 내역 탭
  48 |   await page.click('button:has-text("포인트 내역")');
  49 |   await sleep(1500);
  50 |   await page.screenshot({ path: '/tmp/ss_05_history.png' });
  51 |   console.log('✓ 포인트 내역 탭 전환 성공');
  52 | 
  53 |   // 8. 포인트 적립 탭
  54 |   await page.click('button:has-text("포인트 적립")');
  55 |   await sleep(300);
  56 |   await page.screenshot({ path: '/tmp/ss_06_grant.png' });
  57 |   await expect(page.locator('text=수동 적립')).toBeVisible();
  58 |   console.log('✓ 포인트 적립 탭: 폼 표시됨');
  59 | 
  60 |   // 9. 회원 정보 탭
  61 |   await page.click('button:has-text("회원 정보")');
  62 |   await sleep(300);
  63 |   await page.screenshot({ path: '/tmp/ss_07_info.png' });
  64 |   await expect(page.locator('button:has-text("크루 삭제")')).toBeVisible();
  65 |   console.log('✓ 회원 정보 탭: 삭제 버튼 표시됨');
  66 | 
  67 |   // 10. 크루 등록 모달
  68 |   await page.click('button:has-text("+ 크루 등록")');
  69 |   await sleep(300);
  70 |   await page.screenshot({ path: '/tmp/ss_08_register.png' });
  71 |   await expect(page.locator('text=크루 등록')).toBeVisible();
  72 |   await page.click('button:has-text("취소")');
  73 |   console.log('✓ 크루 등록 모달: 열기/닫기 정상');
  74 | 
  75 |   // 11. 로그아웃
  76 |   await page.click('button:has-text("로그아웃")');
  77 |   await page.waitForURL(/\/admin\/login/, { timeout: 5000 });
  78 |   console.log('✓ 로그아웃 → /admin/login 리다이렉트 정상');
  79 |   await page.screenshot({ path: '/tmp/ss_09_logout.png' });
  80 | });
  81 | 
```