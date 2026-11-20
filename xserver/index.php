<?php
require __DIR__ . '/auth.php';
ey_session_start();

if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

$error = '';
$postedId = '';
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $postedId = isset($_POST['login_id']) ? trim((string) $_POST['login_id']) : '';
    $postedPassword = isset($_POST['password']) ? (string) $_POST['password'] : '';
    $postedToken = isset($_POST['csrf']) ? (string) $_POST['csrf'] : '';
    $tokenOk = is_string($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $postedToken);
    if ($tokenOk && ey_check_login($postedId, $postedPassword)) {
        session_regenerate_id(true);
        $_SESSION['ey_user'] = $postedId;
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        header('Location: ./', true, 303);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        exit;
    }
    $error = 'IDまたはパスワードが違います';
}

if (ey_logged_in()) {
    ey_send_app_html();
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
http_response_code(200);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#1f6b4a">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Eiyo Balance">
    <meta name="description" content="過剰摂取を防ぎ、1日の栄養バランスを管理するアプリ">
    <link rel="manifest" href="./manifest.webmanifest">
    <link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">
    <link rel="apple-touch-icon" href="./icons/icon-192.png">
    <title>ログイン｜Eiyo Balance</title>
    <script>
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function () {});
        }
    </script>
    <style>
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            height: 100%;
            overflow: hidden;
            font-family: "IBM Plex Sans JP", "Hiragino Sans", "Noto Sans JP", Meiryo, system-ui, sans-serif;
            color: #14231a;
            background:
                radial-gradient(1200px 500px at 10% -10%, #d9ebe1 0%, transparent 55%),
                radial-gradient(900px 400px at 100% 0%, #e7f0ea 0%, transparent 50%),
                #eef4ef;
        }
        body {
            position: fixed;
            inset: 0;
            width: 100%;
        }
        main {
            height: 100%;
            overflow: auto;
            max-width: 430px;
            margin: 0 auto;
            padding: 36px 16px 48px;
        }
        header { text-align: center; }
        .mark { width: 72px; height: 72px; border-radius: 18px; }
        h1 { margin: 14px 0 0; font-size: 1.6rem; letter-spacing: -0.03em; }
        .lead { margin: 8px 0 0; color: #5a6b60; line-height: 1.7; }
        form {
            margin-top: 22px;
            background: #ffffff;
            border: 1px solid #d5e0d8;
            border-radius: 20px;
            padding: 20px;
        }
        label { display: block; font-size: 0.85rem; font-weight: 700; color: #1f6b4a; margin-bottom: 6px; }
        .field { margin-bottom: 14px; }
        input {
            width: 100%;
            border: 1px solid #d5e0d8;
            background: #f7fbf8;
            border-radius: 12px;
            padding: 12px 14px;
            font: inherit;
            color: inherit;
        }
        .password-row { display: flex; gap: 8px; }
        .password-row input { min-width: 0; }
        button, .toggle { font: inherit; cursor: pointer; }
        .toggle {
            flex: 0 0 auto;
            border-radius: 12px;
            border: 1px solid #1f6b4a;
            background: transparent;
            color: #1f6b4a;
            padding: 0 14px;
            font-weight: 700;
        }
        .submit {
            width: 100%;
            border: none;
            border-radius: 15px;
            background: #1f6b4a;
            color: #ffffff;
            font-weight: 800;
            padding: 14px;
        }
        .error {
            margin: 0 0 14px;
            padding: 10px 12px;
            border-radius: 12px;
            background: #fde8e6;
            color: #c23b2e;
            font-size: 0.95rem;
            font-weight: 700;
        }
        [hidden] { display: none !important; }
    </style>
</head>
<body>
    <main>
        <header>
            <img class="mark" src="./icons/icon-192.png" alt="" width="72" height="72">
            <h1>Eiyo Balance</h1>
            <p class="lead">入るには ID とパスワードが必要です</p>
        </header>
        <form method="post" action="" autocomplete="off">
            <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($_SESSION['csrf'], ENT_QUOTES, 'UTF-8'); ?>">
            <p id="loginError" class="error" role="alert"<?php echo $error === '' ? ' hidden' : ''; ?>><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
            <div class="field">
                <label for="login_id">ID</label>
                <input id="login_id" name="login_id" type="text" inputmode="text" autocomplete="username" required maxlength="64" value="<?php echo htmlspecialchars($postedId, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="field">
                <label for="password">パスワード</label>
                <div class="password-row">
                    <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128">
                    <button type="button" class="toggle" id="togglePassword" aria-controls="password" aria-pressed="false">表示</button>
                </div>
            </div>
            <button type="submit" class="submit">入る</button>
        </form>
    </main>
    <script>
        var idKey = "eiyouseibun_login_id";
        var passwordKey = "eiyouseibun_login_password";
        var form = document.querySelector("form");
        var idInput = document.getElementById("login_id");
        var passwordInput = document.getElementById("password");
        var errorBox = document.getElementById("loginError");

        document.getElementById("togglePassword").addEventListener("click", function () {
            var showing = passwordInput.type === "text";
            passwordInput.type = showing ? "password" : "text";
            this.textContent = showing ? "表示" : "隠す";
            this.setAttribute("aria-pressed", showing ? "false" : "true");
        });

        form.addEventListener("submit", function () {
            try {
                sessionStorage.setItem("eiyouseibun_pending_id", idInput.value.trim());
                sessionStorage.setItem("eiyouseibun_pending_password", passwordInput.value);
            } catch (err) {}
        });

        try {
            var failed = errorBox && !errorBox.hasAttribute("hidden") && errorBox.textContent;
            if (failed) {
                localStorage.removeItem(passwordKey);
                sessionStorage.removeItem("eiyouseibun_pending_id");
                sessionStorage.removeItem("eiyouseibun_pending_password");
            }
            var savedId = localStorage.getItem(idKey) || "";
            var savedPassword = localStorage.getItem(passwordKey) || "";
            if (!failed && savedId && savedPassword) {
                idInput.value = savedId;
                passwordInput.value = savedPassword;
                try {
                    sessionStorage.setItem("eiyouseibun_pending_id", savedId);
                    sessionStorage.setItem("eiyouseibun_pending_password", savedPassword);
                } catch (err) {}
                form.submit();
            } else if (savedId && !idInput.value) {
                idInput.value = savedId;
            }
        } catch (err) {}
    </script>
</body>
</html>
