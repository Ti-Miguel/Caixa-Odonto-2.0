<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);
json_out([
  'id' => $_SESSION['user_id'],
  'name' => $_SESSION['name'],
  'email' => $_SESSION['email'],
  'can_view_all' => (int)$_SESSION['can_view_all']
]);
