<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);

$ini  = $_GET['ini'] ?? null;
$fim  = $_GET['fim'] ?? null;
$quem = $_GET['quem'] ?? null;
$plano = $_GET['plano'] ?? ''; // '', 'life', 'life-orto', 'orto-puro'

$where = [];
$params = [];
$types = '';

if ($ini){ $where[] = "f.data >= ?"; $types .= 's'; $params[] = $ini; }
if ($fim){ $where[] = "f.data <= ?"; $types .= 's'; $params[] = $fim; }

if (!empty($quem)) {
  // filtra por quem (nome do user)
  $where[] = "u.name = ?";
  $types .= 's'; $params[] = $quem;
}

if ($plano === 'life')       $where[] = "f.plano > 0";
if ($plano === 'life-orto')  $where[] = "f.orto > 0";
if ($plano === 'orto-puro')  $where[] = "f.orto_puro > 0";

$see_all = (int)($_SESSION['can_view_all'] ?? 0);
if (!$see_all) {
  $where[] = "f.user_id = ?";
  $types .= 'i'; $params[] = $_SESSION['user_id'];
}

$sql = "SELECT f.*, u.name AS quem FROM fechamentos f
        JOIN users u ON u.id = f.user_id";

if ($where) $sql .= " WHERE " . implode(" AND ", $where);
$sql .= " ORDER BY f.data DESC, f.id DESC";

$stmt = $conn->prepare($sql);
if ($types) $stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) $out[] = $r;

json_out($out);
