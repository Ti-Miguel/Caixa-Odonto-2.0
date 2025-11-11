<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);

$in = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$id = (int)($in['id'] ?? 0);
if ($id <= 0) json_out(['error'=>'ID inválido'], 400);

$see_all = (int)($_SESSION['can_view_all'] ?? 0);

if ($see_all) {
  $stmt = $conn->prepare("DELETE FROM fechamentos WHERE id=?");
  $stmt->bind_param("i", $id);
} else {
  $stmt = $conn->prepare("DELETE FROM fechamentos WHERE id=? AND user_id=?");
  $stmt->bind_param("ii", $id, $_SESSION['user_id']);
}
$stmt->execute();

if ($stmt->affected_rows < 1) {
  json_out(['error'=>'not_found_or_forbidden'], 403);
}

json_out(['ok'=>true]);
