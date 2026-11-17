USE fee_structure;

-- 1. Default Admin User (Password: Admin@12345)
INSERT INTO users (name, email, password_hash, role)
VALUES ('System Administrator', 'admin@feestructure.local', '$2y$12$PBHC52YLiYXAgQ.FT/rGGOa6ONpIlUzDnOivafI/rx2HSuKqXtTta', 'admin')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. Initial Sample Students
INSERT INTO students (id, student_code, name, email, phone, course) VALUES
(1, 'STU-2026-001', 'Alex Morgan', 'alex.m@example.com', '555-0101', 'Computer Science'),
(2, 'STU-2026-002', 'Sophia Chen', 'sophia.c@example.com', '555-0102', 'Business Administration'),
(3, 'STU-2026-003', 'Marcus Vance', 'marcus.v@example.com', '555-0103', 'Electrical Engineering')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3. Initial Sample Fees
INSERT INTO fees (id, student_id, title, amount, due_date) VALUES
(1, 1, 'Tuition Fee - Semester 1', 4500.00, '2026-12-15'),
(2, 1, 'Lab & Technology Fee', 600.00, '2026-12-15'),
(3, 2, 'Tuition Fee - Semester 1', 4200.00, '2026-12-15'),
(4, 2, 'Library & Activity Fee', 350.00, '2026-12-15'),
(5, 3, 'Tuition Fee - Semester 1', 4800.00, '2026-12-15')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 4. Initial Sample Payments
INSERT INTO payments (id, receipt_no, student_id, fee_id, amount, payment_method, notes) VALUES
(1, 'REC-2026-0001', 1, 1, 2000.00, 'Cash', 'Partial tuition installment'),
(2, 'REC-2026-0002', 2, 4, 350.00, 'Online', 'Full library fee settlement')
ON DUPLICATE KEY UPDATE notes=VALUES(notes);
