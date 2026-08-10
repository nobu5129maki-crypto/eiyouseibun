import { useEffect, useRef, useState } from 'react';
import {
  CAMERA_PERMISSION_LABELS,
  queryCameraPermission,
  type CameraPermissionState,
} from '../lib/cameraPermission';
import { CameraPermissionPanel } from './CameraPermissionPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'permission' | 'live'>('permission');
  const [permState, setPermState] = useState<CameraPermissionState>('unknown');

  useEffect(() => {
    if (!open) return;
    setError('');
    setReady(false);
    setPhase('permission');
    void queryCameraPermission().then(setPermState);

    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
      setPhase('permission');
    };
  }, [open]);

  // live フェーズに入ったら video にストリームを接続
  useEffect(() => {
    if (!open || phase !== 'live') return;
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;

    let cancelled = false;
    video.srcObject = stream;
    void video
      .play()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError('カメラ映像の再生に失敗しました。もう一度お試しください。');
          setPhase('permission');
          stopStream(stream);
          streamRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, phase]);

  const handleGrantedStream = (stream: MediaStream) => {
    stopStream(streamRef.current);
    streamRef.current = stream;
    setPermState('granted');
    setError('');
    setReady(false);
    setPhase('live');
  };

  const handleClose = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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

        {phase === 'permission' && (
          <CameraPermissionPanel onGrantedStream={handleGrantedStream} />
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
              {!ready && <p className="camera-status">カメラ映像を準備しています…</p>}
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
              >
                撮影する
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  stopStream(streamRef.current);
                  streamRef.current = null;
                  if (videoRef.current) videoRef.current.srcObject = null;
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
