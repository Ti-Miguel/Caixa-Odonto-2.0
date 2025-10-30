<?php
require __DIR__ . '/../conexao.php';

$me = null;
if (isset($_SESSION['user_id'])) {
  $me = [
    'id' => $_SESSION['user_id'],
    'name' => $_SESSION['name'] ?? null,
    'email' => $_SESSION['email'] ?? null,
    'can_view_all' => (int)($_SESSION['can_view_all'] ?? 0)
  ];
}

$okDb = false;
try {
  $r = $conn->query("SELECT 1 AS ok");
  $okDb = (bool)$r->fetch_assoc()['ok'];
} catch(Throwable $e){}

json_out([
  'ok' => true,
  'session' => $me ?: 'anonymous',
  'db' => $okDb ? 'up' : 'down',
  'time' => date('c')
]);
