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

export async function queryCameraPermission(): Promise<CameraPermissionState> {
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
    // Chromium 以外では camera が PermissionName に無いことがある
  }

  return 'prompt';
}

/**
 * ブラウザのカメラ許可ダイアログを出す。
 * 成功時はストリームを返し、呼び出し側で停止する。
 */
export async function requestCameraAccess(): Promise<{
  state: CameraPermissionState;
  stream: MediaStream | null;
  errorName?: string;
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { state: 'unsupported', stream: null };
  }

  try {
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
    return { state: 'granted', stream };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { state: 'denied', stream: null, errorName: name };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { state: 'unsupported', stream: null, errorName: name };
    }
    return { state: 'unknown', stream: null, errorName: name || 'Error' };
  }
}

export function openBrowserCameraSettingsHelp(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS: 設定 → Safari（または使用中のブラウザ）→ カメラ を「許可」にしてください。その後このページを再読み込みします。';
  }
  if (/Android/i.test(ua)) {
    return 'Android: ブラウザのアドレスバー左の鍵アイコン → 権限 → カメラ を「許可」にしてください。';
  }
  return 'ブラウザのアドレスバー左（鍵/サイト情報）→ カメラ を「許可」に変更し、ページを再読み込みしてください。';
}
