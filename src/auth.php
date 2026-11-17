<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/helpers.php';

function start_secure_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

    $sessName = $_ENV['SESSION_NAME'] ?? 'FEE_SESSID';
    session_name($sessName);

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    session_start();
}

function get_csrf_token(): string {
    start_secure_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$token || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        json_out(false, null, 'Invalid or missing CSRF token', 403);
    }
}

function require_login(): array {
    start_secure_session();
    if (empty($_SESSION['user_id'])) {
        json_out(false, null, 'Unauthorized. Please log in.', 401);
    }

    if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
        verify_csrf();
    }

    return $_SESSION['user'] ?? ['id' => $_SESSION['user_id']];
}

function rate_limit_check(PDO $pdo, string $email): ?string {
    start_secure_session();
    // 1. Session lock check
    if (!empty($_SESSION['lock_until']) && $_SESSION['lock_until'] > time()) {
        $wait = ceil(($_SESSION['lock_until'] - time()) / 60);
        return "Too many failed attempts. Locked for {$wait} minute(s).";
    }

    // 2. DB lock check
    $stmt = $pdo->prepare('SELECT locked_until FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user && !empty($user['locked_until']) && strtotime($user['locked_until']) > time()) {
        $wait = ceil((strtotime($user['locked_until']) - time()) / 60);
        return "Account is locked due to repeated failures. Try again in {$wait} minute(s).";
    }

    return null;
}

function record_login_failure(PDO $pdo, string $email): void {
    start_secure_session();
    $_SESSION['failed_attempts'] = ($_SESSION['failed_attempts'] ?? 0) + 1;
    if ($_SESSION['failed_attempts'] >= 5) {
        $_SESSION['lock_until'] = time() + 300; // 5 minutes lock
    }

    $stmt = $pdo->prepare('SELECT id, failed_attempts FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user) {
        $attempts = $user['failed_attempts'] + 1;
        if ($attempts >= 5) {
            $lock = $pdo->prepare('UPDATE users SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ?');
            $lock->execute([$attempts, $user['id']]);
        } else {
            $up = $pdo->prepare('UPDATE users SET failed_attempts = ? WHERE id = ?');
            $up->execute([$attempts, $user['id']]);
        }
    }
}

function record_login_success(PDO $pdo, array $user): void {
    start_secure_session();
    unset($_SESSION['failed_attempts'], $_SESSION['lock_until']);

    $stmt = $pdo->prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?');
    $stmt->execute([$user['id']]);

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user'] = [
        'id'    => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ];
}
