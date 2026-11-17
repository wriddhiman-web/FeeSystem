import { api, setCsrfToken } from './api.js';

let currentUser = null;
let studentsList = [];
let feesList = [];

// DOM References
const alertEl = document.getElementById('globalAlert');
const userBadge = document.getElementById('userBadge');

function showAlert(msg, isSuccess = false) {
  alertEl.textContent = msg;
  alertEl.className = 'alert ' + (isSuccess ? 'alert-ok' : 'alert-err');
  alertEl.classList.remove('hidden');
  setTimeout(() => alertEl.classList.add('hidden'), 4000);
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(modalOrEl) {
  const m = modalOrEl.closest('.modal-backdrop');
  if (m) m.classList.add('hidden');
}

// Format currency
function fmt(num) {
  return '$' + Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Safe cell helper
function createCell(text, className = '') {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

// 1. App Initialization
async function init() {
  const authRes = await api('api/auth.php');
  if (!authRes.ok || !authRes.data?.logged_in) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = authRes.data.user;
  if (authRes.data.csrf_token) setCsrfToken(authRes.data.csrf_token);
  userBadge.textContent = `Logged in as: ${currentUser.name} (${currentUser.role})`;

  loadDashboard();
  loadStudents();
}

// 2. Tab Navigation
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tab-btn');
  if (tabBtn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tabBtn.classList.add('active');

    const target = tabBtn.dataset.tab;
    document.getElementById(`tab-${target}`)?.classList.remove('hidden');

    if (target === 'dashboard') loadDashboard();
    else if (target === 'students') loadStudents();
    else if (target === 'fees') loadFees();
    else if (target === 'payments') loadPayments();
  }

  // Close modals
  if (e.target.closest('.closeModalBtn') || e.target.classList.contains('modal-backdrop')) {
    const modal = e.target.closest('.modal-backdrop');
    if (modal) modal.classList.add('hidden');
  }
});

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('api/auth.php?action=logout', 'POST');
  window.location.href = 'index.html';
});

// 3. Dashboard Loader
async function loadDashboard() {
  const res = await api('api/reports.php');
  if (!res.ok) return;

  const { summary, recent_payments } = res.data;
  document.getElementById('statStudents').textContent = summary.total_students;
  document.getElementById('statBilled').textContent = fmt(summary.total_billed);
  document.getElementById('statCollected').textContent = fmt(summary.total_collected);
  document.getElementById('statOutstanding').textContent = fmt(summary.total_outstanding);

  const tbody = document.getElementById('recentPaymentsBody');
  tbody.textContent = '';
  if (!recent_payments || recent_payments.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No recent payments found';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  recent_payments.forEach(p => {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(p.receipt_no));
    tr.appendChild(createCell(`${p.student_name} (${p.student_code})`));
    tr.appendChild(createCell(p.fee_title));
    tr.appendChild(createCell(fmt(p.amount)));
    tr.appendChild(createCell(p.payment_method));
    tr.appendChild(createCell(p.payment_date));
    tbody.appendChild(tr);
  });
}

// 4. Students Section
async function loadStudents(query = '') {
  const endpoint = query ? `api/students.php?q=${encodeURIComponent(query)}` : 'api/students.php';
  const res = await api(endpoint);
  if (!res.ok) return;

  studentsList = res.data || [];
  const tbody = document.getElementById('studentsTableBody');
  tbody.textContent = '';

  // Update selects in modals
  updateStudentSelects();

  if (studentsList.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = 'No students found';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  studentsList.forEach(s => {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(s.student_code));
    tr.appendChild(createCell(s.name));
    tr.appendChild(createCell(s.email));
    tr.appendChild(createCell(s.course));
    tr.appendChild(createCell(fmt(s.total_fees)));
    tr.appendChild(createCell(fmt(s.total_paid)));

    const balCell = createCell(fmt(s.balance));
    balCell.style.fontWeight = 'bold';
    balCell.style.color = s.balance > 0 ? 'var(--danger)' : 'var(--success)';
    tr.appendChild(balCell);

    // Actions
    const actTd = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-outline btn-sm';
    viewBtn.textContent = 'Ledger';
    viewBtn.style.marginRight = '0.35rem';
    viewBtn.onclick = () => viewStudentLedger(s.id);

    const feeBtn = document.createElement('button');
    feeBtn.className = 'btn btn-sm';
    feeBtn.textContent = '+ Fee';
    feeBtn.onclick = () => {
      document.getElementById('feeStudentSelect').value = s.id;
      openModal('modalAddFee');
    };

    actTd.appendChild(viewBtn);
    actTd.appendChild(feeBtn);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });
}

document.getElementById('studentSearch').addEventListener('input', (e) => {
  loadStudents(e.target.value.trim());
});

document.getElementById('openAddStudentBtn').addEventListener('click', () => {
  openModal('modalAddStudent');
});

document.getElementById('formAddStudent').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    student_code: document.getElementById('stuCode').value.trim(),
    name: document.getElementById('stuName').value.trim(),
    email: document.getElementById('stuEmail').value.trim(),
    phone: document.getElementById('stuPhone').value.trim(),
    course: document.getElementById('stuCourse').value.trim(),
  };

  const res = await api('api/students.php', 'POST', payload);
  if (res.ok) {
    showAlert('Student added successfully!', true);
    closeModal(e.target);
    e.target.reset();
    loadStudents();
    loadDashboard();
  } else {
    showAlert(res.error || 'Failed to add student');
  }
});

// View Student Ledger Modal
async function viewStudentLedger(id) {
  const res = await api(`api/students.php?id=${id}`);
  if (!res.ok) {
    showAlert(res.error || 'Error loading student details');
    return;
  }
  const s = res.data;
  document.getElementById('ledgerStudentTitle').textContent = `${s.name} (${s.student_code})`;
  document.getElementById('ledgerStudentMeta').textContent = `Email: ${s.email} | Phone: ${s.phone} | Course: ${s.course}`;

  const fBody = document.getElementById('ledgerFeesBody');
  fBody.textContent = '';
  (s.fees || []).forEach(f => {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(f.title));
    tr.appendChild(createCell(f.due_date));
    tr.appendChild(createCell(fmt(f.amount)));
    tr.appendChild(createCell(fmt(f.paid_amount)));
    const bal = createCell(fmt(f.balance));
    bal.style.fontWeight = 'bold';
    bal.style.color = f.balance > 0 ? 'var(--danger)' : 'var(--success)';
    tr.appendChild(bal);
    fBody.appendChild(tr);
  });

  const pBody = document.getElementById('ledgerPaymentsBody');
  pBody.textContent = '';
  (s.payments || []).forEach(p => {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(p.receipt_no));
    tr.appendChild(createCell(p.fee_title));
    tr.appendChild(createCell(fmt(p.amount)));
    tr.appendChild(createCell(p.payment_method));
    tr.appendChild(createCell(p.payment_date));
    pBody.appendChild(tr);
  });

  openModal('modalLedger');
}

// 5. Fees Section
function updateStudentSelects() {
  const feeSelect = document.getElementById('feeStudentSelect');
  const paySelect = document.getElementById('payStudentSelect');
  const filterSelect = document.getElementById('feeStudentFilter');

  feeSelect.textContent = '';
  paySelect.textContent = '';
  filterSelect.textContent = '';

  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'All Students';
  filterSelect.appendChild(optAll);

  const optChoose = document.createElement('option');
  optChoose.value = '';
  optChoose.textContent = '-- Choose Student --';
  paySelect.appendChild(optChoose);

  studentsList.forEach(s => {
    const text = `${s.name} (${s.student_code})`;

    const o1 = document.createElement('option');
    o1.value = s.id;
    o1.textContent = text;
    feeSelect.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = s.id;
    o2.textContent = text;
    paySelect.appendChild(o2);

    const o3 = document.createElement('option');
    o3.value = s.id;
    o3.textContent = text;
    filterSelect.appendChild(o3);
  });
}

async function loadFees(studentId = '') {
  const endpoint = studentId ? `api/fees.php?student_id=${studentId}` : 'api/fees.php';
  const res = await api(endpoint);
  if (!res.ok) return;

  feesList = res.data || [];
  const tbody = document.getElementById('feesTableBody');
  tbody.textContent = '';

  if (feesList.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = 'No fees assigned';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  feesList.forEach(f => {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(`${f.student_name} (${f.student_code})`));
    tr.appendChild(createCell(f.title));
    tr.appendChild(createCell(f.due_date));
    tr.appendChild(createCell(fmt(f.amount)));
    tr.appendChild(createCell(fmt(f.paid_amount)));

    const balTd = createCell(fmt(f.balance));
    balTd.style.fontWeight = 'bold';
    tr.appendChild(balTd);

    // Status badge
    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    if (f.balance <= 0) {
      badge.className = 'badge badge-paid';
      badge.textContent = 'Paid';
    } else if (f.paid_amount > 0) {
      badge.className = 'badge badge-partial';
      badge.textContent = 'Partial';
    } else {
      badge.className = 'badge badge-unpaid';
      badge.textContent = 'Unpaid';
    }
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    // Action button
    const actTd = document.createElement('td');
    if (f.balance > 0) {
      const payBtn = document.createElement('button');
      payBtn.className = 'btn btn-sm';
      payBtn.textContent = 'Pay';
      payBtn.onclick = () => setupPayment(f.student_id, f.id);
      actTd.appendChild(payBtn);
    } else {
      actTd.textContent = '—';
    }
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });
}

document.getElementById('feeStudentFilter').addEventListener('change', (e) => {
  loadFees(e.target.value);
});

document.getElementById('openAddFeeBtn').addEventListener('click', () => {
  openModal('modalAddFee');
});

document.getElementById('formAddFee').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    student_id: parseInt(document.getElementById('feeStudentSelect').value),
    title: document.getElementById('feeTitle').value.trim(),
    amount: parseFloat(document.getElementById('feeAmount').value),
    due_date: document.getElementById('feeDueDate').value,
  };

  const res = await api('api/fees.php', 'POST', payload);
  if (res.ok) {
    showAlert('Fee assigned successfully!', true);
    closeModal(e.target);
    e.target.reset();
    loadFees();
    loadDashboard();
  } else {
    showAlert(res.error || 'Failed to assign fee');
  }
});

// 6. Payments Section
async function loadPayments() {
  const res = await api('api/payments.php');
  if (!res.ok) return;

  const tbody = document.getElementById('paymentsTableBody');
  tbody.textContent = '';
  const payments = res.data || [];

  if (payments.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'No payments recorded yet';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  payments.forEach(p => {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(p.receipt_no));
    tr.appendChild(createCell(`${p.student_name} (${p.student_code})`));
    tr.appendChild(createCell(p.fee_title));
    tr.appendChild(createCell(fmt(p.amount)));
    tr.appendChild(createCell(p.payment_method));
    tr.appendChild(createCell(p.payment_date));

    const actTd = document.createElement('td');
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-outline btn-sm';
    printBtn.textContent = 'Receipt';
    printBtn.onclick = () => showReceipt(p.id);
    actTd.appendChild(printBtn);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });
}

document.getElementById('openRecordPaymentBtn').addEventListener('click', () => {
  document.getElementById('formRecordPayment').reset();
  document.getElementById('feeBalanceNotice').classList.add('hidden');
  openModal('modalRecordPayment');
});

// Setup payment modal with student and fee pre-selected
async function setupPayment(studentId, feeId = null) {
  const payStu = document.getElementById('payStudentSelect');
  payStu.value = studentId;
  await handleStudentChangeForPayment(studentId, feeId);
  openModal('modalRecordPayment');
}

document.getElementById('payStudentSelect').addEventListener('change', async (e) => {
  await handleStudentChangeForPayment(e.target.value);
});

async function handleStudentChangeForPayment(studentId, selectFeeId = null) {
  const feeSelect = document.getElementById('payFeeSelect');
  feeSelect.textContent = '';
  const notice = document.getElementById('feeBalanceNotice');
  notice.classList.add('hidden');

  if (!studentId) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Select Student First --';
    feeSelect.appendChild(opt);
    return;
  }

  const res = await api(`api/fees.php?student_id=${studentId}`);
  if (!res.ok) return;

  const fees = (res.data || []).filter(f => f.balance > 0);
  if (fees.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No outstanding fees for this student';
    feeSelect.appendChild(opt);
    return;
  }

  fees.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.dataset.balance = f.balance;
    opt.textContent = `${f.title} (Outstanding: ${fmt(f.balance)})`;
    feeSelect.appendChild(opt);
  });

  if (selectFeeId) {
    feeSelect.value = selectFeeId;
  }

  updatePaymentBalanceNotice();
}

document.getElementById('payFeeSelect').addEventListener('change', updatePaymentBalanceNotice);

function updatePaymentBalanceNotice() {
  const feeSelect = document.getElementById('payFeeSelect');
  const sel = feeSelect.options[feeSelect.selectedIndex];
  const notice = document.getElementById('feeBalanceNotice');
  const amountInput = document.getElementById('payAmount');

  if (sel && sel.dataset.balance) {
    const bal = parseFloat(sel.dataset.balance);
    notice.textContent = `Outstanding Balance: ${fmt(bal)}. Maximum payment allowed: ${fmt(bal)}.`;
    notice.classList.remove('hidden');
    amountInput.max = bal;
    amountInput.value = bal; // default to full outstanding
  } else {
    notice.classList.add('hidden');
    amountInput.removeAttribute('max');
  }
}

// Payment form submission with client-side balance validation
document.getElementById('formRecordPayment').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentId = parseInt(document.getElementById('payStudentSelect').value);
  const feeId = parseInt(document.getElementById('payFeeSelect').value);
  const amount = parseFloat(document.getElementById('payAmount').value);
  const method = document.getElementById('payMethod').value;
  const notes = document.getElementById('payNotes').value.trim();

  const feeSelect = document.getElementById('payFeeSelect');
  const sel = feeSelect.options[feeSelect.selectedIndex];
  const bal = sel?.dataset.balance ? parseFloat(sel.dataset.balance) : null;

  if (bal !== null && amount > bal) {
    showAlert(`Payment cannot exceed outstanding balance of ${fmt(bal)}`);
    return;
  }

  const payload = {
    student_id: studentId,
    fee_id: feeId,
    amount,
    payment_method: method,
    notes
  };

  const res = await api('api/payments.php', 'POST', payload);
  if (res.ok) {
    showAlert('Payment recorded successfully!', true);
    closeModal(e.target);
    e.target.reset();
    loadDashboard();
    loadStudents();
    loadFees();
    loadPayments();
    if (res.data?.payment_id) {
      showReceipt(res.data.payment_id);
    }
  } else {
    showAlert(res.error || 'Failed to record payment');
  }
});

// 7. Receipt Modal & Clean Printing
async function showReceipt(paymentId) {
  const res = await api(`api/payments.php?id=${paymentId}`);
  if (!res.ok) {
    showAlert(res.error || 'Error fetching receipt');
    return;
  }

  const p = res.data;
  document.getElementById('recReceiptNo').textContent = p.receipt_no;
  document.getElementById('recDate').textContent = p.payment_date;
  document.getElementById('recStudent').textContent = p.student_name;
  document.getElementById('recCode').textContent = p.student_code;
  document.getElementById('recCourse').textContent = p.course;
  document.getElementById('recFeeTitle').textContent = p.fee_title;
  document.getElementById('recMethod').textContent = p.payment_method;
  document.getElementById('recAmount').textContent = fmt(p.amount);
  document.getElementById('recRemaining').textContent = fmt(p.remaining_balance);

  const notesRow = document.getElementById('recNotesRow');
  if (p.notes) {
    document.getElementById('recNotes').textContent = p.notes;
    notesRow.classList.remove('hidden');
  } else {
    notesRow.classList.add('hidden');
  }

  openModal('modalReceipt');
}

document.getElementById('printReceiptBtn').addEventListener('click', () => {
  window.print();
});

// Run initialization
init();
