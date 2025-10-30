<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);

$in = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$nome = trim($in['nome'] ?? '');
$cpf  = trim($in['cpf'] ?? '');
$tel  = trim($in['telefone'] ?? '');
$plano = $in['plano'] ?? 'Plano Life';
$data  = date('Y-m-d');

if ($nome === '') json_out(['error'=>'Nome é obrigatório'], 400);

$stmt = $conn->prepare("INSERT INTO planos (data,nome,cpf,telefone,plano,user_id) VALUES (?,?,?,?,?,?)");
$stmt->bind_param("sssssi", $data, $nome, $cpf, $tel, $plano, $_SESSION['user_id']);
$stmt->execute();

json_out(['ok'=>true,'id'=>$conn->insert_id]);
