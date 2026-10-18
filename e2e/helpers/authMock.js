/**
 * 全域 E2E 認證與 Supabase API 路由 Mock 工具
 * 支援離線與雲端測試雙軌模式，防範測試因遠端驗證而重導至 /#/login
 */

export const MOCK_USERS = {
  admin: {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'admin',
    role: 'admin',
    unit: '管理處',
    level: 'Administrator',
    email: 'admin@mitcorp.local',
  },
  rd: {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'rd_user',
    role: 'rd',
    unit: '研發單位',
    level: 'Standard',
    email: 'rd_user@mitcorp.local',
  },
  eng: {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'pe_user',
    role: 'eng',
    unit: '工程單位',
    level: 'Standard',
    email: 'pe_user@mitcorp.local',
  },
  qa: {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'qa_user',
    role: 'qa',
    unit: '審核單位（品保處）',
    level: 'Reviewer',
    email: 'qa_user@mitcorp.local',
  },
  e2eadmin: {
    id: '55555555-5555-5555-5555-555555555555',
    username: 'e2eadmin',
    role: 'admin',
    unit: '管理處',
    level: 'Administrator',
    email: 'e2eadmin@mitcorp.local',
  },
};

export const ALL_MOCK_ACCOUNTS = Object.values(MOCK_USERS).map((u) => ({
  username: u.username,
  password: 'password',
  role: u.role,
  unit: u.unit,
  level: u.level,
}));

export async function setupAuthMock(target) {
  // 1. 登入 Token 端點攔截
  await target.route('**/auth/v1/token?grant_type=password', async (route) => {
    let postData = {};
    try {
      postData = route.request().postDataJSON() || {};
    } catch {
      postData = {};
    }
    const email = String(postData.email || '').trim().toLowerCase();
    const password = String(postData.password || '');

    if (password === 'wrongpass' || email.includes('wronguser') || !password) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          message: 'Invalid login credentials',
        }),
      });
    }

    // 匹配對應 mock user，預設 fallback 至 admin
    const found = Object.values(MOCK_USERS).find((u) =>
      email === u.email.toLowerCase() || email === `${u.username.toLowerCase()}@mitcorp.local`
    ) || {
      id: '99999999-9999-9999-9999-999999999999',
      username: email.split('@')[0],
      role: 'admin',
      unit: '管理處',
      level: 'Administrator',
      email,
    };

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: `mock-token-${found.username}`,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `mock-refresh-${found.username}`,
        user: {
          id: found.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: found.email,
          user_metadata: {
            username: found.username,
            role: found.role,
            unit: found.unit,
            level: found.level,
          },
        },
      }),
    });
  });

  // 2. 當前使用者資訊端點攔截
  await target.route('**/auth/v1/user', async (route) => {
    const authHeader = route.request().headers()['authorization'] || '';
    let matchedUser = MOCK_USERS.admin;
    for (const u of Object.values(MOCK_USERS)) {
      if (authHeader.includes(`mock-token-${u.username}`) || authHeader.includes(u.id)) {
        matchedUser = u;
        break;
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: matchedUser.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: matchedUser.email,
        user_metadata: {
          username: matchedUser.username,
          role: matchedUser.role,
          unit: matchedUser.unit,
          level: matchedUser.level,
        },
      }),
    });
  });

  // 3. Profiles 表查詢攔截
  await target.route('**/rest/v1/profiles*', async (route) => {
    const url = route.request().url();
    let result = Object.values(MOCK_USERS);

    // 若有特定 id 篩選
    for (const u of Object.values(MOCK_USERS)) {
      if (url.includes(u.id)) {
        result = [u];
        break;
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        unit: u.unit,
        level: u.level,
        signature: null,
      }))),
    });
  });

  // 4. Projects 表查詢攔截
  await target.route('**/rest/v1/projects*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // 5. Factories 表查詢攔截
  await target.route('**/rest/v1/factories*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // 6. 登出端點攔截
  await target.route('**/auth/v1/logout*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

export async function injectAuthSession(page, user = MOCK_USERS.admin) {
  await page.evaluate(({ u, allAccounts }) => {
    localStorage.setItem('ag_accounts', JSON.stringify(allAccounts));
    localStorage.setItem('ag_current_user', JSON.stringify({
      id: u.id,
      username: u.username,
      role: u.role,
      unit: u.unit,
      level: u.level,
      email: u.email,
    }));
    localStorage.setItem('ag_sb_auth', JSON.stringify({
      access_token: `mock-token-${u.username}`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `mock-refresh-${u.username}`,
      user: {
        id: u.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: u.email,
        user_metadata: {
          username: u.username,
          role: u.role,
          unit: u.unit,
          level: u.level,
        },
      },
    }));
  }, { u: user, allAccounts: ALL_MOCK_ACCOUNTS });
}
