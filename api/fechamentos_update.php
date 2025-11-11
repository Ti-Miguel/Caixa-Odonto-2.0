<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);

$in = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$id = (int)($in['id'] ?? 0);
if ($id <= 0) json_out(['error'=>'ID inválido'], 400);

$data     = $in['data'] ?? date('Y-m-d');
$dinheiro = (float)($in['dinheiro'] ?? 0);
$pix      = (float)($in['pix'] ?? 0);
$debito   = (float)($in['debito'] ?? 0);
$credito  = (float)($in['credito'] ?? 0);
$boletos  = (float)($in['boletos'] ?? 0);
$total    = (float)($in['total'] ?? 0);
$plano    = max(0, (int)($in['plano'] ?? 0));
$orto     = max(0, (int)($in['orto'] ?? 0));
$orto_puro= max(0, (int)($in['orto_puro'] ?? 0));
$obs      = $in['obs'] ?? null;

$see_all = (int)($_SESSION['can_view_all'] ?? 0);

// Garante que o registro existe e é do usuário (se não for admin)
if ($see_all) {
  $stmt = $conn->prepare("SELECT id FROM fechamentos WHERE id=? LIMIT 1");
  $stmt->bind_param("i", $id);
} else {
  $stmt = $conn->prepare("SELECT id FROM fechamentos WHERE id=? AND user_id=? LIMIT 1");
  $stmt->bind_param("ii", $id, $_SESSION['user_id']);
}
$stmt->execute();
if (!$stmt->get_result()->fetch_assoc()) {
  json_out(['error'=>'not_found_or_forbidden'], 403);
}

$stmt2 = $conn->prepare("
  UPDATE fechamentos SET
    data=?, dinheiro=?, pix=?, debito=?, credito=?, boletos=?, total=?,
    plano=?, orto=?, orto_puro=?, obs=?
  WHERE id=?
");
$stmt2->bind_param(
  "sddddddiiisi",
  $data, $dinheiro, $pix, $debito, $credito, $boletos, $total,
  $plano, $orto, $orto_puro, $obs, $id
);
$stmt2->execute();

json_out(['ok'=>true]);
