/** バックアップファイルの共有・ダウンロード。共有が失敗しても保存に落とす。 */

export type BackupShareNav = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

export type BackupDownloadDom = {
  createElement: (tag: string) => {
    href: string;
    download: string;
    rel: string;
    style: { display: string };
    click: () => void;
    remove: () => void;
  };
  body: { appendChild: (node: unknown) => void };
};

export type BackupExportHost = {
  navigator?: BackupShareNav;
  document?: BackupDownloadDom;
  createObjectURL?: (obj: Blob) => string;
  revokeObjectURL?: (url: string) => void;
};

export function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError';
}

export function createBackupFile(json: string, filename: string): File {
  try {
    return new File([json], filename, { type: 'application/json' });
  } catch {
    return new File([json], asciiBackupName(filename), { type: 'application/json' });
  }
}

export function shouldTryFileShare(nav: BackupShareNav = navigator): boolean {
  if (typeof nav.share !== 'function') return false;
  const ua = nav.userAgent || '';
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  return iOS || /Android/i.test(ua);
}

export async function tryShareBackup(file: File, nav: BackupShareNav = navigator): Promise<boolean> {
  if (!shouldTryFileShare(nav)) return false;
  try {
    if (typeof nav.canShare === 'function' && !nav.canShare({ files: [file] })) return false;
  } catch {
    return false;
  }
  try {
    await nav.share?.({ files: [file], title: '栄養バランス バックアップ' });
    return true;
  } catch (err) {
    if (isAbortError(err)) throw err;
    return false;
  }
}

export function downloadBackup(file: File, host: BackupExportHost = {}): void {
  const createObjectURL = host.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectURL = host.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
  const blob = new Blob([file], { type: 'application/json' });
  const url = createObjectURL(blob);
  const filename = file.name || 'eiyou-backup.json';

  if (host.document) {
    const a = host.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    host.document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  globalThis.setTimeout(() => revokeObjectURL(url), 2000);
}

export async function exportBackupFile(
  file: File,
  host: BackupExportHost = {},
): Promise<'shared' | 'downloaded'> {
  const nav = host.navigator ?? navigator;
  const shared = await tryShareBackup(file, nav);
  if (shared) return 'shared';
  downloadBackup(file, host);
  return 'downloaded';
}

function asciiBackupName(filename: string): string {
  const day = filename.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return day ? `eiyou-backup-${day}.json` : 'eiyou-backup.json';
}
