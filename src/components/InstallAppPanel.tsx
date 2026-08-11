import { useEffect, useState } from 'react';
import { isIosSafari, isStandaloneDisplay } from '../lib/pwa';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallAppPanel() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandaloneDisplay());
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIosSafari());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <section className="card" data-testid="install-app-installed">
        <h2>ホーム画面に追加</h2>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          この端末にはアプリとしてインストール済みです。ホーム画面のアイコンから起動できます。
        </p>
      </section>
    );
  }

  return (
    <section className="card" data-testid="install-app-panel">
      <h2>スマホにインストール</h2>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        ホーム画面に追加すると、アプリアイコンから起動でき、ブラウザのタブなしで使えます。
      </p>

      {deferred ? (
        <button
          type="button"
          className="btn btn-primary"
          data-testid="install-app-button"
          onClick={async () => {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === 'accepted') setInstalled(true);
            setDeferred(null);
          }}
        >
          インストール
        </button>
      ) : ios ? (
        <ol
          className="muted"
          style={{ fontSize: '0.85rem', paddingLeft: '1.2rem', margin: '8px 0 0', lineHeight: 1.6 }}
        >
          <li>画面下（または共有）の共有ボタンをタップ</li>
          <li>「ホーム画面に追加」を選ぶ</li>
          <li>右上の「追加」で完了</li>
        </ol>
      ) : (
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
          ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください（Chrome / Edge
          推奨）。
        </p>
      )}
    </section>
  );
}
