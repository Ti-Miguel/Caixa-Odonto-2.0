<?php
require __DIR__ . '/../conexao.php';
if (!isset($_SESSION['user_id'])) { http_response_code(401); exit; }

$ini  = $_GET['ini'] ?? null;
$fim  = $_GET['fim'] ?? null;
$quem = $_GET['quem'] ?? null;
$plano = $_GET['plano'] ?? '';

$see_all = (int)($_SESSION['can_view_all'] ?? 0);

$sql = "SELECT f.data, u.name AS quem, f.dinheiro, f.pix, f.debito, f.credito, f.boletos, f.total, f.plano, f.orto, f.orto_puro, f.obs
        FROM fechamentos f
        JOIN users u ON u.id = f.user_id";
$where = []; $params = []; $types = '';

if ($ini){ $where[]="f.data>=?"; $types.='s'; $params[]=$ini; }
if ($fim){ $where[]="f.data<=?"; $types.='s'; $params[]=$fim; }
if ($quem){ $where[]="u.name=?"; $types.='s'; $params[]=$quem; }
if ($plano==='life') $where[]="f.plano>0";
if ($plano==='life-orto') $where[]="f.orto>0";
if ($plano==='orto-puro') $where[]="f.orto_puro>0";
if (!$see_all){ $where[]="f.user_id=?"; $types.='i'; $params[]=$_SESSION['user_id']; }

if ($where) $sql .= " WHERE ".implode(" AND ", $where);
$sql .= " ORDER BY f.data DESC, f.id DESC";

$stmt = $conn->prepare($sql);
if ($types) $stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=fechamentos.csv');
$out = fopen('php://output', 'w');
fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
fputcsv($out, ['Data','Quem','Dinheiro','PIX','Débito','Crédito','Boletos','Total','Plano Life','Plano Life Orto','Orto','Obs.'], ';');
while ($r = $res->fetch_row()) { fputcsv($out, $r, ';'); }
fclose($out);
