<?php
require __DIR__ . '/auth.php';

function ey_deny()
{
    http_response_code(401);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "ログインが必要です\n";
    exit;
}

function ey_miss()
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "見つかりません\n";
    exit;
}

function ey_content_type($path)
{
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $map = array(
        'html' => 'text/html; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'mjs' => 'application/javascript; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'txt' => 'text/plain; charset=UTF-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'webmanifest' => 'application/manifest+json; charset=UTF-8',
        'map' => 'application/json; charset=UTF-8',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'wasm' => 'application/wasm',
    );
    if (isset($map[$ext])) {
        return $map[$ext];
    }
    return 'application/octet-stream';
}

function ey_is_install_file($relative)
{
    $relative = str_replace('\\', '/', (string) $relative);
    $relative = rawurldecode($relative);
    $relative = ltrim($relative, '/');
    $allowed = array(
        'manifest.webmanifest' => true,
        'sw.js' => true,
        'icons/icon-192.png' => true,
        'icons/icon-512.png' => true,
    );
    return isset($allowed[$relative]);
}

function ey_requested_path()
{
    if (isset($_GET['mw_path'])) {
        return (string) $_GET['mw_path'];
    }
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    $path = parse_url($uri, PHP_URL_PATH);
    $path = rawurldecode(is_string($path) ? $path : '');
    $base = ey_cookie_path();
    if ($base !== '/' && strpos($path, $base) === 0) {
        $path = substr($path, strlen($base));
    }
    return ltrim($path, '/');
}

function ey_safe_relative($relative)
{
    $relative = str_replace('\\', '/', (string) $relative);
    $relative = rawurldecode($relative);
    if ($relative === '' || strpos($relative, "\0") !== false) {
        return '';
    }
    $parts = explode('/', $relative);
    $safe = array();
    foreach ($parts as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..' || $part[0] === '.') {
            return '';
        }
        $safe[] = $part;
    }
    $relative = implode('/', $safe);
    if ($relative === '' || preg_match('/\.php$/i', $relative)) {
        return '';
    }
    return $relative;
}

function ey_is_app_page($relative)
{
    if ($relative === '') {
        return false;
    }
    if (preg_match('/\.[a-z0-9]{1,8}$/i', $relative)) {
        return false;
    }
    return true;
}

function ey_resolve($relative)
{
    $relative = ey_safe_relative($relative);
    if ($relative === '') {
        return '';
    }
    $root = realpath(__DIR__);
    if ($root === false) {
        return '';
    }
    $candidate = $root . '/' . $relative;
    if (is_dir($candidate)) {
        $candidate = rtrim($candidate, '/') . '/index.html';
    } elseif (!is_file($candidate)) {
        $asDir = $root . '/' . $relative . '/index.html';
        $asHtml = $root . '/' . $relative . '.html';
        if (is_file($asDir)) {
            $candidate = $asDir;
        } elseif (is_file($asHtml)) {
            $candidate = $asHtml;
        }
    }
    $real = realpath($candidate);
    if ($real === false || !is_file($real)) {
        return '';
    }
    $prefix = rtrim($root, '/') . '/';
    if (strpos($real, $prefix) !== 0) {
        return '';
    }
    if (substr($real, -4) === '.php') {
        return '';
    }
    return $real;
}

$requested = ey_safe_relative(ey_requested_path());
$publicInstall = ey_is_install_file($requested);

if (!$publicInstall && !ey_logged_in()) {
    ey_deny();
}

if ($publicInstall) {
    $file = ey_resolve($requested);
    if ($file === '' || !ey_is_install_file($requested)) {
        ey_miss();
    }
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ey_content_type($file));
    header('X-Content-Type-Options: nosniff');
    if ($ext === 'js') {
        header('Cache-Control: no-cache');
    } else {
        header('Cache-Control: public, max-age=3600');
    }
    readfile($file);
    exit;
}

$file = ey_resolve($requested);
if ($file === '' && ey_is_app_page($requested)) {
    ey_send_app_html();
}
if ($file === '') {
    ey_miss();
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
if ($ext === 'html') {
    ey_send_app_html();
}

header('Content-Type: ' . ey_content_type($file));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-cache');
readfile($file);
