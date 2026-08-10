import { useEffect, useRef, useState } from 'react';

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
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError('');
    setReady(false);
    setStarting(true);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setError(
            'このブラウザはカメラ API に対応していません。HTTPS で開くか、画像選択をご利用ください。',
          );
          setStarting(false);
        }
        return;
      }

      try {
        // 背面カメラ優先。失敗時はデフォルトカメラへフォールバック。
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }

        if (cancelled) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          const name = err instanceof DOMException ? err.name : '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setError(
              'カメラの使用が許可されていません。ブラウザの設定でカメラを許可してください。',
            );
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setError('利用可能なカメラが見つかりませんでした。');
          } else {
            setError('カメラを起動できませんでした。画像選択をお試しください。');
          }
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
    };
  }, [open]);

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
          <strong>栄養成分表示を撮影</strong>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            閉じる
          </button>
        </div>

        <div className="camera-view">
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            muted
            autoPlay
          />
          <div className="camera-guide" aria-hidden="true" />
          {starting && <p className="camera-status">カメラを起動しています…</p>}
        </div>

        {error && <div className="alert danger">{error}</div>}

        <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          枠内に栄養成分表示が入るように合わせて、「撮影する」を押してください。
        </p>

        <div className="camera-actions row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ready || starting}
            onClick={() => void handleShutter()}
          >
            撮影する
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
