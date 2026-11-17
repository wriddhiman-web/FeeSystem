<?php
require_once __DIR__ . '/../../src/auth.php';

api_run(function() {
    $user = require_login();
    $pdo = DB::get();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
        if ($id) {
            $sStmt = $pdo->prepare('SELECT * FROM students WHERE id = ?');
            $sStmt->execute([$id]);
            $student = $sStmt->fetch();
            if (!$student) json_out(false, null, 'Student not found', 404);

            $fStmt = $pdo->prepare('SELECT f.id, f.title, f.amount, f.due_date, f.created_at,
                COALESCE(SUM(p.amount), 0) AS paid_amount,
                ROUND(f.amount - COALESCE(SUM(p.amount), 0), 2) AS balance
                FROM fees f
                LEFT JOIN payments p ON p.fee_id = f.id
                WHERE f.student_id = ?
                GROUP BY f.id
                ORDER BY f.due_date ASC');
            $fStmt->execute([$id]);
            $student['fees'] = $fStmt->fetchAll();

            $pStmt = $pdo->prepare('SELECT p.*, f.title AS fee_title
                FROM payments p
                JOIN fees f ON f.id = p.fee_id
                WHERE p.student_id = ?
                ORDER BY p.payment_date DESC');
            $pStmt->execute([$id]);
            $student['payments'] = $pStmt->fetchAll();

            json_out(true, $student);
        }

        $q = trim((string)($_GET['q'] ?? ''));
        $sql = 'SELECT s.id, s.student_code, s.name, s.email, s.phone, s.course, s.created_at,
            COALESCE((SELECT SUM(f.amount) FROM fees f WHERE f.student_id = s.id), 0) AS total_fees,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = s.id), 0) AS total_paid
            FROM students s';

        $params = [];
        if ($q !== '') {
            $sql .= ' WHERE s.name LIKE ? OR s.student_code LIKE ? OR s.course LIKE ?';
            $term = '%' . $q . '%';
            $params = [$term, $term, $term];
        }
        $sql .= ' ORDER BY s.id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $students = $stmt->fetchAll();

        foreach ($students as &$s) {
            $s['balance'] = round($s['total_fees'] - $s['total_paid'], 2);
        }

        json_out(true, $students);
    }

    if ($method === 'POST') {
        $input = get_json_input();
        $code   = trim($input['student_code'] ?? '');
        $name   = trim($input['name'] ?? '');
        $email  = trim(filter_var($input['email'] ?? '', FILTER_SANITIZE_EMAIL));
        $phone  = trim($input['phone'] ?? '');
        $course = trim($input['course'] ?? '');

        if (!$code || !$name || !$email || !$course) {
            json_out(false, null, 'Code, name, valid email, and course are required', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_out(false, null, 'Invalid email format', 400);
        }

        // Check unique student code
        $chk = $pdo->prepare('SELECT id FROM students WHERE student_code = ?');
        $chk->execute([$code]);
        if ($chk->fetch()) {
            json_out(false, null, 'Student code already exists', 409);
        }

        $ins = $pdo->prepare('INSERT INTO students (student_code, name, email, phone, course) VALUES (?, ?, ?, ?, ?)');
        $ins->execute([$code, $name, $email, $phone, $course]);

        json_out(true, ['id' => (int)$pdo->lastInsertId(), 'message' => 'Student created successfully'], null, 201);
    }

    json_out(false, null, 'Method not allowed', 405);
});
