<?php
require_once __DIR__ . '/../../src/auth.php';

api_run(function() {
    $user = require_login();
    $pdo = DB::get();

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        json_out(false, null, 'Method not allowed', 405);
    }

    $stuCount = (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn();
    $totalFees = (float)$pdo->query('SELECT COALESCE(SUM(amount), 0) FROM fees')->fetchColumn();
    $totalPaid = (float)$pdo->query('SELECT COALESCE(SUM(amount), 0) FROM payments')->fetchColumn();
    $totalOutstanding = round($totalFees - $totalPaid, 2);

    $recentStmt = $pdo->query('SELECT p.id, p.receipt_no, p.amount, p.payment_method, p.payment_date,
        s.name AS student_name, s.student_code, f.title AS fee_title
        FROM payments p
        JOIN students s ON s.id = p.student_id
        JOIN fees f ON f.id = p.fee_id
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT 5');
    $recentPayments = $recentStmt->fetchAll();

    json_out(true, [
        'summary' => [
            'total_students'    => $stuCount,
            'total_billed'      => round($totalFees, 2),
            'total_collected'   => round($totalPaid, 2),
            'total_outstanding' => $totalOutstanding,
        ],
        'recent_payments' => $recentPayments,
    ]);
});
