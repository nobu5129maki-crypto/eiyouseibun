import { useRef, useState, type ChangeEvent } from 'react';
import {
  backupFileName,
  backupSummary,
  makeBackup,
  parseBackup,
  stringifyBackup,
} from '../lib/backup';
import type { AppState } from '../types';

export function BackupPanel({
  state,
  restoreAll,
  showExport = true,
  onRestored,
}: {
  state: AppState;
  restoreAll: (next: AppState) => void;
  showExport?: boolean;
  onRestored?: (next: AppState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const backup = makeBackup(state);
      const file = new File([stringifyBackup(backup)], backupFileName(backup.exportedAt), {
        type: 'application/json',
      });
      const shared = await shareBackup(file);
      if (!shared) downloadBackup(file);
      setMessage(
        `${backupSummary(backup)}を書き出しました。メールやファイルアプリに残すと、履歴を消しても戻せます。`,
      );
    } catch (err) {
      if (isAbort(err)) return;
      setError('書き出せませんでした。もう一度試してください。');
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      const ok = window.confirm(
        `今の記録は、ファイルの内容に置き換わります。\n${backupSummary(parsed.backup)}を読み込みますか？`,
      );
      if (!ok) return;
      restoreAll(parsed.backup.state);
      setMessage(`${backupSummary(parsed.backup)}を読み込みました。`);
      onRestored?.(parsed.backup.state);
    } catch {
      setError('読み込めませんでした。栄養バランスのバックアップファイルか確認してください。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" data-testid="backup-panel">
      <h2>データのバックアップ</h2>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        {showExport
          ? '食事記録とプロフィールをファイルに残します。スマホの閲覧データを消す前に書き出してください。'
          : '閲覧データを消したあとは、保存したバックアップを読み込むと記録を戻せます。'}
      </p>
      {showExport ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          data-testid="backup-export"
          onClick={() => void exportBackup()}
        >
          バックアップを書き出す
        </button>
      ) : null}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        data-testid="backup-import"
        onClick={() => fileRef.current?.click()}
      >
        バックアップを読み込む
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="file-hidden"
        data-testid="backup-file"
        onChange={(e) => void onPickFile(e)}
      />
      {message ? <p className="alert ok">{message}</p> : null}
      {error ? <p className="alert danger">{error}</p> : null}
    </section>
  );
}

async function shareBackup(file: File): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  await nav.share({ files: [file], title: '栄養バランス バックアップ' });
  return true;
}

function downloadBackup(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError';
}
