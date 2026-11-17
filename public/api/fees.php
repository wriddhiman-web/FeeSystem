<?php
require_once __DIR__ . '/../../src/auth.php';

api_run(function() {
    $user = require_login();
    $pdo = DB::get();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $studentId = filter_input(INPUT_GET, 'student_id', FILTER_VALIDATE_INT);
        $sql = 'SELECT f.id, f.student_id, f.title, f.amount, f.due_date, f.created_at,
            s.name AS student_name, s.student_code,
            COALESCE(SUM(p.amount), 0) AS paid_amount,
            ROUND(f.amount - COALESCE(SUM(p.amount), 0), 2) AS balance
            FROM fees f
            JOIN students s ON s.id = f.student_id
            LEFT JOIN payments p ON p.fee_id = f.id';

        $params = [];
        if ($studentId) {
            $sql .= ' WHERE f.student_id = ?';
            $params[] = $studentId;
        }

        $sql .= ' GROUP BY f.id ORDER BY f.due_date ASC, f.id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $fees = $stmt->fetchAll();

        json_out(true, $fees);
    }

    if ($method === 'POST') {
        $input = get_json_input();
        $studentId = filter_var($input['student_id'] ?? null, FILTER_VALIDATE_INT);
        $title     = trim($input['title'] ?? '');
        $amount    = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
        $dueDate   = trim($input['due_date'] ?? '');

        if (!$studentId || !$title || $amount === false || $amount <= 0 || !$dueDate) {
            json_out(false, null, 'Valid student, title, positive amount, and due date are required', 400);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
            json_out(false, null, 'Due date must be in YYYY-MM-DD format', 400);
        }

        // Verify student exists
        $sCheck = $pdo->prepare('SELECT id FROM students WHERE id = ?');
        $sCheck->execute([$studentId]);
        if (!$sCheck->fetch()) {
            json_out(false, null, 'Student not found', 404);
        }

        $stmt = $pdo->prepare('INSERT INTO fees (student_id, title, amount, due_date) VALUES (?, ?, ?, ?)');
        $stmt->execute([$studentId, $title, round($amount, 2), $dueDate]);

        json_out(true, ['id' => (int)$pdo->lastInsertId(), 'message' => 'Fee created successfully'], null, 201);
    }

    json_out(false, null, 'Method not allowed', 405);
});
