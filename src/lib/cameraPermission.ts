export type CameraPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'unknown';

export const CAMERA_PERMISSION_LABELS: Record<CameraPermissionState, string> = {
  granted: '許可済み',
  denied: '拒否',
  prompt: '未設定（確認待ち）',
  unsupported: '非対応',
  unknown: '確認中',
};

export type CameraAccessResult = {
  state: CameraPermissionState;
  stream: MediaStream | null;
  errorName?: string;
  detail?: string;
};

/** Android / iOS / PC で通りやすい制約を順に試す */
const VIDEO_CONSTRAINTS: MediaStreamConstraints[] = [
  { audio: false, video: { facingMode: 'environment' } },
  { audio: false, video: { facingMode: 'user' } },
  { audio: false, video: true },
  { audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
];

export function isSecureCameraContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export async function queryCameraPermission(): Promise<CameraPermissionState> {
  if (!isSecureCameraContext()) return 'unsupported';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';

  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied') return 'denied';
      if (status.state === 'prompt') return 'prompt';
    }
  } catch {
    // Android など一部環境では camera が PermissionName に無い
  }

  return 'prompt';
}

/**
 * ブラウザのカメラを開く。必ずユーザー操作（click）の直後に呼ぶこと。
 */
export async function requestCameraAccess(): Promise<CameraAccessResult> {
  if (!isSecureCameraContext()) {
    return {
      state: 'unsupported',
      stream: null,
      errorName: 'InsecureContext',
      detail: 'カメラは HTTPS（または localhost）でのみ利用できます。',
    };
  }

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    return {
      state: 'unsupported',
      stream: null,
      errorName: 'NoMediaDevices',
      detail: 'このブラウザはカメラ API に対応していません。Chrome 最新版で開いてください。',
    };
  }

  let lastError: unknown;
  for (const constraints of VIDEO_CONSTRAINTS) {
    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      return { state: 'granted', stream };
    } catch (err) {
      lastError = err;
      const name = err instanceof DOMException ? err.name : '';
      // 許可拒否はリトライしても同じなので即返す
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return {
          state: 'denied',
          stream: null,
          errorName: name,
          detail:
            'サイトのカメラ権限が拒否されています。OS全体のカメラONとは別に、ブラウザでこのサイトを許可してください。',
        };
      }
    }
  }

  const name = lastError instanceof DOMException ? lastError.name : '';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      state: 'unsupported',
      stream: null,
      errorName: name,
      detail: 'カメラデバイスが見つかりませんでした。',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      state: 'unknown',
      stream: null,
      errorName: name,
      detail: 'カメラが他のアプリで使用中の可能性があります。他アプリを閉じて再試行してください。',
    };
  }

  return {
    state: 'unknown',
    stream: null,
    errorName: name || 'Error',
    detail: 'カメラを起動できませんでした。Chrome でこのサイトを開き直してください。',
  };
}

export function openBrowserCameraSettingsHelp(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS: 設定アプリのカメラONに加え、Safari（または Chrome）でこのサイトのカメラも「許可」にしてください。アドレスバー左の「ぁあ」や鍵アイコンから確認できます。';
  }
  if (/Android/i.test(ua)) {
    return [
      'Android の「プライバシー → カメラへのアクセス」は全体のスイッチです。',
      '加えて Chrome でこのサイト（eiyouseibun.vercel.app）のカメラ権限も必要です。',
      '手順: Chrome でこのページを開く → アドレスバー左の鍵（またはサイト情報）→ 権限 → カメラ → 許可 → ページを再読み込み。',
      '※ LINE や Instagram 内ブラウザではカメラが動かないことがあります。Chrome アプリで開いてください。',
    ].join(' ');
  }
  return 'アドレスバー左の鍵アイコン → サイトの設定 → カメラ を「許可」にし、ページを再読み込みしてください。';
}

export async function bindStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  // メタデータが付くまで待ってから play（Android Chrome 向け）
  if (video.readyState < 1) {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('video load failed'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  }

  await video.play();
}
