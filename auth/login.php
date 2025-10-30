<?php
require __DIR__ . '/../conexao.php';

$data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$email = trim($data['email'] ?? '');
$pass  = trim($data['password'] ?? '');

if ($email === '' || $pass === '') json_out(['error'=>'Email e senha são obrigatórios'], 400);

$stmt = $conn->prepare("SELECT id,name,email,password_hash,can_view_all FROM users WHERE email=? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();
$u = $res->fetch_assoc();

if (!$u || !password_verify($pass, $u['password_hash'])) {
  json_out(['error'=>'Credenciais inválidas'], 401);
}

$_SESSION['user_id'] = (int)$u['id'];
$_SESSION['name'] = $u['name'];
$_SESSION['email'] = $u['email'];
$_SESSION['can_view_all'] = (int)$u['can_view_all'];

json_out(['id'=>$u['id'],'name'=>$u['name'],'email'=>$u['email'],'can_view_all'=>(int)$u['can_view_all']]);
