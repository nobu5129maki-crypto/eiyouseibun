import { useCallback, useEffect, useState } from 'react';
import {
  CAMERA_PERMISSION_LABELS,
  openBrowserCameraSettingsHelp,
  queryCameraPermission,
  requestCameraAccess,
  type CameraPermissionState,
} from '../lib/cameraPermission';

type Props = {
  /** 許可取得に成功した直後（ストリームは呼び出し側へ渡す） */
  onGrantedStream?: (stream: MediaStream) => void;
  /** 状態だけ表示し、許可リクエストしない簡易モード */
  compact?: boolean;
  className?: string;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function CameraPermissionPanel({
  onGrantedStream,
  compact = false,
  className = '',
}: Props) {
  const [state, setState] = useState<CameraPermissionState>('unknown');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const next = await queryCameraPermission();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh();

    let status: PermissionStatus | null = null;
    let onChange: (() => void) | null = null;

    (async () => {
      try {
        if (!navigator.permissions?.query) return;
        status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        onChange = () => {
          void refresh();
        };
        status.addEventListener('change', onChange);
      } catch {
        // ignore
      }
    })();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (status && onChange) status.removeEventListener('change', onChange);
    };
  }, [refresh]);

  const askPermission = async () => {
    setBusy(true);
    setMessage('');
    setHelp('');
    try {
      const result = await requestCameraAccess();
      setState(result.state);
      if (result.state === 'granted' && result.stream) {
        setMessage('カメラの使用が許可されました。');
        if (onGrantedStream) {
          onGrantedStream(result.stream);
        } else {
          stopStream(result.stream);
        }
      } else if (result.state === 'denied') {
        setMessage('カメラの使用が拒否されました。下の手順で設定を変更できます。');
        setHelp(openBrowserCameraSettingsHelp());
      } else if (result.state === 'unsupported') {
        setMessage(
          result.errorName === 'NotFoundError'
            ? 'カメラデバイスが見つかりません。'
            : 'この環境ではカメラを利用できません。',
        );
      } else {
        setMessage('カメラ許可の確認に失敗しました。もう一度お試しください。');
      }
    } finally {
      setBusy(false);
    }
  };

  const showSettingsHelp = () => {
    setHelp(openBrowserCameraSettingsHelp());
  };

  const toneClass =
    state === 'granted'
      ? 'ok'
      : state === 'denied'
        ? 'danger'
        : state === 'prompt'
          ? 'warning'
          : '';

  return (
    <section
      className={`camera-permission ${className}`.trim()}
      aria-label="カメラ許可の設定"
      data-testid="camera-permission-panel"
      data-state={state}
    >
      <div className="camera-permission-head">
        <strong>カメラ許可</strong>
        <span className={`perm-badge ${state}`} data-testid="camera-permission-badge">
          {CAMERA_PERMISSION_LABELS[state]}
        </span>
      </div>

      {!compact && (
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          OS全体のカメラONとは別に、このサイト（ブラウザ）のカメラ許可が必要です。「許可する」を押すとブラウザの確認が表示されます。
        </p>
      )}

      {message && (
        <div className={`alert ${toneClass || 'warning'}`} data-testid="camera-permission-message">
          {message}
        </div>
      )}

      {help && (
        <div className="alert warning" data-testid="camera-permission-help">
          {help}
        </div>
      )}

      <div className="row">
        {state === 'unsupported' ? (
          <button type="button" className="btn btn-primary" disabled>
            カメラ非対応
          </button>
        ) : state === 'granted' && onGrantedStream ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void askPermission()}
            data-testid="camera-permission-start"
          >
            カメラを起動
          </button>
        ) : state === 'granted' ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void refresh()}
            data-testid="camera-permission-refresh"
          >
            状態を再確認
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void askPermission()}
            data-testid="camera-permission-ask"
          >
            {state === 'denied' ? 'もう一度許可を求める' : 'カメラを許可する'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={showSettingsHelp}
          data-testid="camera-permission-settings"
        >
          設定方法を表示
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setHelp('');
            void refresh();
          }}
          data-testid="camera-permission-reload-state"
        >
          再読み込み後に確認
        </button>
      </div>
    </section>
  );
}
