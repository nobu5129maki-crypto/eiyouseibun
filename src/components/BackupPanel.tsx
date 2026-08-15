import { useRef, useState, type ChangeEvent } from 'react';
import {
  backupFileName,
  backupSummary,
  makeBackup,
  parseBackup,
  stringifyBackup,
} from '../lib/backup';
import { createBackupFile, exportBackupFile, isAbortError } from '../lib/backupExport';
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
      const file = createBackupFile(stringifyBackup(backup), backupFileName(backup.exportedAt));
      await exportBackupFile(file);
      setMessage(
        `${backupSummary(backup)}を書き出しました。メールやファイルアプリに残すと、履歴を消しても戻せます。`,
      );
    } catch (err) {
      if (isAbortError(err)) return;
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
