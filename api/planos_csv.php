<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) { http_response_code(401); exit; }

$see_all = (int)($_SESSION['can_view_all'] ?? 0);
$sql = "SELECT p.data, p.nome, p.cpf, p.telefone, p.plano, u.name AS quem
        FROM planos p JOIN users u ON u.id = p.user_id";
$params = []; $types='';
if (!$see_all){
  $sql .= " WHERE p.user_id = ?";
  $types .= 'i'; $params[] = $_SESSION['user_id'];
}
$sql .= " ORDER BY p.data DESC, p.id DESC";

$stmt = $conn->prepare($sql);
if ($types) $stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=planos.csv');
$out = fopen('php://output', 'w');
fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8
fputcsv($out, ['Data','Nome','CPF','Telefone','Plano','Quem'], ';');
while ($r = $res->fetch_row()){
  fputcsv($out, $r, ';');
}
fclose($out);

