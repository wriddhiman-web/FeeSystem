<?php
// Global Security Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

function json_out(bool $ok, mixed $data = null, ?string $error = null, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $res = ['ok' => $ok];
    if ($ok) {
        $res['data'] = $data;
    } else {
        $res['error'] = $error ?? 'Request failed';
    }
    echo json_encode($res, JSON_UNESCAPED_SLASHES);
    exit;
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function api_run(callable $fn): void {
    try {
        $fn();
    } catch (Throwable $e) {
        error_log('[API_ERROR] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
        json_out(false, null, 'An internal server error occurred', 500);
    }
}
