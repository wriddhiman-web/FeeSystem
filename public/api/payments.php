<?php
require_once __DIR__ . '/../../src/auth.php';

api_run(function() {
    $user = require_login();
    $pdo = DB::get();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
        if ($id) {
            $stmt = $pdo->prepare('SELECT p.*, s.name AS student_name, s.student_code, s.email AS student_email, s.course,
                f.title AS fee_title, f.amount AS total_fee_amount,
                ROUND(f.amount - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE fee_id = f.id AND id <= p.id), 2) AS remaining_balance
                FROM payments p
                JOIN students s ON s.id = p.student_id
                JOIN fees f ON f.id = p.fee_id
                WHERE p.id = ?');
            $stmt->execute([$id]);
            $receipt = $stmt->fetch();
            if (!$receipt) json_out(false, null, 'Receipt not found', 404);
            json_out(true, $receipt);
        }

        $studentId = filter_input(INPUT_GET, 'student_id', FILTER_VALIDATE_INT);
        $sql = 'SELECT p.*, s.name AS student_name, s.student_code, f.title AS fee_title
            FROM payments p
            JOIN students s ON s.id = p.student_id
            JOIN fees f ON f.id = p.fee_id';

        $params = [];
        if ($studentId) {
            $sql .= ' WHERE p.student_id = ?';
            $params[] = $studentId;
        }

        $sql .= ' ORDER BY p.payment_date DESC, p.id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $payments = $stmt->fetchAll();

        json_out(true, $payments);
    }

    if ($method === 'POST') {
        $input = get_json_input();
        $studentId = filter_var($input['student_id'] ?? null, FILTER_VALIDATE_INT);
        $feeId     = filter_var($input['fee_id'] ?? null, FILTER_VALIDATE_INT);
        $amount    = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
        $method    = trim($input['payment_method'] ?? 'Cash');
        $notes     = trim($input['notes'] ?? '');

        if (!$studentId || !$feeId || $amount === false || $amount <= 0) {
            json_out(false, null, 'Valid student, fee, and positive payment amount are required', 400);
        }

        $amount = round($amount, 2);

        // Fetch fee and verify ownership and outstanding balance
        $fStmt = $pdo->prepare('SELECT f.id, f.student_id, f.amount,
            COALESCE(SUM(p.amount), 0) AS total_paid
            FROM fees f
            LEFT JOIN payments p ON p.fee_id = f.id
            WHERE f.id = ?
            GROUP BY f.id');
        $fStmt->execute([$feeId]);
        $fee = $fStmt->fetch();

        if (!$fee) {
            json_out(false, null, 'Fee record not found', 404);
        }

        if ((int)$fee['student_id'] !== $studentId) {
            json_out(false, null, 'Fee record does not belong to the selected student', 400);
        }

        $outstanding = round($fee['amount'] - $fee['total_paid'], 2);

        if ($outstanding <= 0) {
            json_out(false, null, 'This fee is already fully paid', 422);
        }

        // Strict business rule: Payment greater than outstanding balance is rejected
        if ($amount > $outstanding) {
            json_out(false, null, "Payment amount (\${$amount}) exceeds the outstanding balance (\${$outstanding})", 422);
        }

        // Generate receipt number
        $receiptNo = 'REC-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));

        $ins = $pdo->prepare('INSERT INTO payments (receipt_no, student_id, fee_id, amount, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?)');
        $ins->execute([$receiptNo, $studentId, $feeId, $amount, $method, $notes]);
        $paymentId = (int)$pdo->lastInsertId();

        $remaining = round($outstanding - $amount, 2);

        json_out(true, [
            'payment_id'        => $paymentId,
            'receipt_no'        => $receiptNo,
            'amount_paid'       => $amount,
            'remaining_balance' => $remaining,
            'message'           => 'Payment recorded successfully'
        ], null, 201);
    }

    json_out(false, null, 'Method not allowed', 405);
});
