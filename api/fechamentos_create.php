<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) json_out(['error'=>'unauthorized'], 401);

$in = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$campos = ['data','dinheiro','pix','debito','credito','boletos','total','plano','orto','orto_puro','obs'];
foreach (['dinheiro','pix','debito','credito','boletos','total'] as $k) { $in[$k] = (float)($in[$k] ?? 0); }
foreach (['plano','orto','orto_puro'] as $k) { $in[$k] = max(0, (int)($in[$k] ?? 0)); }
$in['data'] = $in['data'] ?: date('Y-m-d');
$in['obs']  = $in['obs']  ?? null;

$stmt = $conn->prepare("
  INSERT INTO fechamentos (data,dinheiro,pix,debito,credito,boletos,total,plano,orto,orto_puro,obs,user_id)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
");

/* TIPOS: s d d d d d d i i i s i  (12 no total) */
$stmt->bind_param(
  "sddddddiiisi",
  $in['data'],
  $in['dinheiro'],
  $in['pix'],
  $in['debito'],
  $in['credito'],
  $in['boletos'],
  $in['total'],
  $in['plano'],
  $in['orto'],
  $in['orto_puro'],
  $in['obs'],
  $_SESSION['user_id']
);

$stmt->execute();
json_out(['ok'=>true,'id'=>$conn->insert_id]);
