const ROUTE_TAIL = /\/(onboarding|history|advice|settings|record)\/?$/;

/** 今開いているページから、アプリの置いてあるディレクトリを求める */
export function detectAppBase(): string {
  if (typeof window === 'undefined') return '/';
  const fromBoot = window.__EIYO_BASE__;
  if (typeof fromBoot === 'string' && fromBoot.startsWith('/')) return fromBoot;
  let dir = window.location.pathname || '/';
  dir = dir.replace(ROUTE_TAIL, '/');
  dir = dir.replace(/\/index\.(html|php)$/, '/');
  if (!dir.endsWith('/')) dir += '/';
  return dir;
}

/** React Router 用。ルート配置は `/`、サブフォルダは末尾スラッシュなし */
export function routerBasename(): string {
  const base = detectAppBase();
  if (base === '/') return '/';
  return base.replace(/\/$/, '');
}

/** ドメイン直下でもサブフォルダでも同じ相対位置の静的ファイルを指す */
export function publicUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const clean = path.replace(/^(\.\/|\/)+/, '');
  return detectAppBase() + clean;
}
