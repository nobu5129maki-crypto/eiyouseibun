import { useEffect, useRef, useState } from 'react';
import {
  CAMERA_PERMISSION_LABELS,
  bindStreamToVideo,
  openBrowserCameraSettingsHelp,
  queryCameraPermission,
  requestCameraAccess,
  type CameraPermissionState,
} from '../lib/cameraPermission';
import { CameraPermissionPanel } from './CameraPermissionPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** 「カメラで撮影」クリック直後に取得したストリーム（ユーザー操作の連続性を保つ） */
  initialStream?: MediaStream | null;
  initialError?: string;
};

function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function CameraCapture({
  open,
  onClose,
  onCapture,
  initialStream = null,
  initialError = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** 親から渡されたストリームは親が停止する（StrictMode 対策） */
  const parentOwnedRef = useRef(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState('');
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState<'permission' | 'live'>('permission');
  const [permState, setPermState] = useState<CameraPermissionState>('unknown');
  const [liveEpoch, setLiveEpoch] = useState(0);

  useEffect(() => {
    if (!open) return;

    setError(initialError);
    setHelp(initialError ? openBrowserCameraSettingsHelp() : '');
    setReady(false);
    setStarting(false);
    void queryCameraPermission().then(setPermState);

    if (initialStream) {
      parentOwnedRef.current = true;
      streamRef.current = initialStream;
      setPermState('granted');
      setPhase('live');
      setLiveEpoch((n) => n + 1);
    } else {
      parentOwnedRef.current = false;
      streamRef.current = null;
      setPhase('permission');
    }
  }, [open, initialStream, initialError]);

  useEffect(() => {
    if (!open || phase !== 'live') return;
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;

    // 親所有ストリームが既に停止済みなら許可画面へ戻す
    if (stream.getTracks().every((t) => t.readyState === 'ended')) {
      setError('カメラ接続が切れました。「カメラを今すぐ起動」を押してください。');
      setHelp(openBrowserCameraSettingsHelp());
      setPhase('permission');
      return;
    }

    let cancelled = false;
    setStarting(true);
    void bindStreamToVideo(video, stream)
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setStarting(false);
          if (!initialError) setError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStarting(false);
          setReady(false);
          setError('カメラ映像の表示に失敗しました。下のボタンでもう一度起動してください。');
          setHelp(openBrowserCameraSettingsHelp());
          setPhase('permission');
          if (!parentOwnedRef.current) {
            stopStream(stream);
            streamRef.current = null;
          }
        }
      });

    return () => {
      cancelled = true;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, phase, liveEpoch, initialError]);

  const handleGrantedStream = (stream: MediaStream) => {
    if (!parentOwnedRef.current) stopStream(streamRef.current);
    parentOwnedRef.current = false;
    streamRef.current = stream;
    setPermState('granted');
    setError('');
    setHelp('');
    setReady(false);
    setPhase('live');
    setLiveEpoch((n) => n + 1);
  };

  const retryStart = async () => {
    setStarting(true);
    setError('');
    setHelp('');
    const result = await requestCameraAccess();
    setStarting(false);
    setPermState(result.state);
    if (result.state === 'granted' && result.stream) {
      handleGrantedStream(result.stream);
      return;
    }
    setError(result.detail || 'カメラを起動できませんでした。');
    setHelp(openBrowserCameraSettingsHelp());
    setPhase('permission');
  };

  const releaseLocalStream = () => {
    if (!parentOwnedRef.current) stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleClose = () => {
    releaseLocalStream();
    onClose();
  };

  const handleShutter = async () => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0) {
      setError('カメラ映像の準備ができていません。少し待ってから再度お試しください。');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('画像の取り込みに失敗しました。');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) {
      setError('撮影データの作成に失敗しました。');
      return;
    }

    const file = new File([blob], `nutrition-label-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    releaseLocalStream();
    onCapture(file);
  };

  if (!open) return null;

  return (
    <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="カメラ撮影">
      <div className="camera-panel">
        <div className="camera-header">
          <div>
            <strong>栄養成分表示を撮影</strong>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              許可状態: {CAMERA_PERMISSION_LABELS[permState]}
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            閉じる
          </button>
        </div>

        <div className="alert warning" data-testid="camera-os-vs-site-note">
          OSの「カメラへのアクセス」がONでも、Chrome
          でこのサイトのカメラ許可が別に必要です。LINE等のアプリ内ブラウザは非対応のことがあります。
        </div>

        {phase === 'permission' && (
          <>
            {error && (
              <div className="alert danger" data-testid="camera-start-error">
                {error}
              </div>
            )}
            {help && (
              <div className="alert warning" data-testid="camera-start-help">
                {help}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={starting}
              onClick={() => void retryStart()}
              data-testid="camera-retry-start"
            >
              {starting ? '起動中…' : 'カメラを今すぐ起動'}
            </button>
            <CameraPermissionPanel onGrantedStream={handleGrantedStream} />
          </>
        )}

        {phase === 'live' && (
          <>
            <div className="camera-view">
              <video
                ref={videoRef}
                className="camera-video"
                playsInline
                muted
                autoPlay
              />
              <div className="camera-guide" aria-hidden="true" />
              {(starting || !ready) && (
                <p className="camera-status">カメラ映像を準備しています…</p>
              )}
            </div>

            {error && <div className="alert danger">{error}</div>}

            <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
              枠内に栄養成分表示が入るように合わせて、「撮影する」を押してください。
            </p>

            <div className="camera-actions row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready}
                onClick={() => void handleShutter()}
                data-testid="camera-shutter"
              >
                撮影する
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  releaseLocalStream();
                  parentOwnedRef.current = false;
                  setReady(false);
                  setPhase('permission');
                  void queryCameraPermission().then(setPermState);
                }}
              >
                許可設定に戻る
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                キャンセル
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
