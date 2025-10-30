<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);

$see_all = (int)($_SESSION['can_view_all'] ?? 0);

$sql = "SELECT p.*, u.name AS quem FROM planos p
        JOIN users u ON u.id = p.user_id";
$params = []; $types = '';
if (!$see_all){
  $sql .= " WHERE p.user_id = ?";
  $types .= 'i'; $params[] = $_SESSION['user_id'];
}
$sql .= " ORDER BY p.data DESC, p.id DESC";

$stmt = $conn->prepare($sql);
if ($types) $stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) $out[] = $r;

json_out($out);
