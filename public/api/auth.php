<?php
require_once __DIR__ . '/../../src/auth.php';

api_run(function() {
    $pdo = DB::get();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';

    if ($method === 'GET') {
        start_secure_session();
        $isLoggedIn = !empty($_SESSION['user_id']);
        json_out(true, [
            'logged_in'  => $isLoggedIn,
            'user'       => $isLoggedIn ? ($_SESSION['user'] ?? null) : null,
            'csrf_token' => get_csrf_token()
        ]);
    }

    if ($method === 'POST' && $action === 'login') {
        $data = get_json_input();
        $email = trim(filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL));
        $password = (string)($data['password'] ?? '');

        if (!$email || !$password) {
            json_out(false, null, 'Email and password are required', 400);
        }

        if ($lockMsg = rate_limit_check($pdo, $email)) {
            json_out(false, null, $lockMsg, 429);
        }

        $stmt = $pdo->prepare('SELECT id, name, email, password_hash, role, failed_attempts, locked_until FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            record_login_failure($pdo, $email);
            json_out(false, null, 'Invalid email or password', 401);
        }

        record_login_success($pdo, $user);
        json_out(true, [
            'user'       => $_SESSION['user'],
            'csrf_token' => get_csrf_token()
        ]);
    }

    if ($method === 'POST' && $action === 'logout') {
        require_login();
        start_secure_session();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        json_out(true, ['message' => 'Logged out successfully']);
    }

    json_out(false, null, 'Action not found', 404);
});
