/**
 * 輕量級 Hash 路由器 (Zero-dependency Hash Router, < 120 行)
 * 遵循規格 6.2 與 9A 規範，完整支援上一頁、下一頁、新分頁與重新整理。
 */
import { useState, useEffect, useCallback, useMemo } from 'react';

export const STEP_KEY_MAP = {
  'basic-info': 'basicInfo',
  'quality-process': 'qualityProcess',
  'tooling': 'tooling',
  'preparation': 'preparation',
  'thermal-profile': 'thermalProfile',
  'smt-control': 'smtControl',
  'dip-special-process': 'dipSpecialProcess',
  'trial-report': 'trialReport',
  'documents': 'documents',
  'sign-off': 'signOff',
};

export const TAB_TO_STEP_KEY = Object.fromEntries(
  Object.entries(STEP_KEY_MAP).map(([stepSlug, tabKey]) => [tabKey, stepSlug])
);

export function parseHash(hashString = window.location.hash) {
  const raw = hashString.replace(/^#\/?/, '');
  const [pathname = '', queryString = ''] = raw.split('?');
  const path = '/' + pathname.replace(/\/+$/, '');
  const searchParams = new URLSearchParams(queryString);
  const query = Object.fromEntries(searchParams.entries());

  // 1. /login
  if (path === '/login') {
    return { route: 'login', path, query, params: {} };
  }
  // 2. /projects/new
  if (path === '/projects/new') {
    return { route: 'projects-new', path, query, params: {} };
  }
  // 3. /projects
  if (path === '' || path === '/' || path === '/projects') {
    return { route: 'projects', path: '/projects', query, params: {} };
  }
  // 4. /projects/:id/print
  const printMatch = path.match(/^\/projects\/([^/]+)\/print$/);
  if (printMatch) {
    return { route: 'project-print', path, query, params: { id: printMatch[1] } };
  }
  // 5. /projects/:id/:step
  const stepMatch = path.match(/^\/projects\/([^/]+)\/([^/]+)$/);
  if (stepMatch) {
    const [, id, stepSlug] = stepMatch;
    if (STEP_KEY_MAP[stepSlug]) {
      return {
        route: 'project-step',
        path,
        query,
        params: { id, stepSlug, tabKey: STEP_KEY_MAP[stepSlug] },
      };
    }
  }
  // 6. /projects/:id
  const projMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projMatch) {
    return { route: 'project-overview', path, query, params: { id: projMatch[1] } };
  }
  // 7. /settings, /settings/factories, /settings/users
  if (path === '/settings' || path === '/settings/factories') {
    return { route: 'settings-factories', path: '/settings/factories', query, params: {} };
  }
  if (path === '/settings/users') {
    return { route: 'settings-users', path: '/settings/users', query, params: {} };
  }
  // 8. /account
  if (path === '/account') {
    return { route: 'account', path, query, params: {} };
  }

  return { route: '404', path, query, params: {} };
}

export function navigateTo(hashPath, options = {}) {
  const isReplace = options === true || Boolean(options?.replace);
  const target = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  if (isReplace) {
    const currentUrl = window.location.href.split('#')[0];
    window.location.replace(`${currentUrl}${target}`);
  } else {
    window.location.hash = target;
  }
}

export function useHashRoute() {
  const [currentRoute, setCurrentRoute] = useState(() => parseHash());

  useEffect(() => {
    const onHashChange = () => {
      setCurrentRoute(parseHash());
      // 換頁時自動捲至頂端
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((hashPath, options) => {
    navigateTo(hashPath, options);
  }, []);

  return useMemo(() => ({
    ...currentRoute,
    navigate,
  }), [currentRoute, navigate]);
}
