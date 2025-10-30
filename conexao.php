<?php
// conexao.php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = "localhost";
$user = "u380360322_caixaodo";
$pass = "Miguel847829";
$db   = "u380360322_caixaodo";

$conn = new mysqli($host, $user, $pass, $db);
$conn->set_charset("utf8mb4");

session_set_cookie_params([
  'lifetime' => 0,
  'path' => '/',
  'httponly' => true,
  'secure' => isset($_SERVER['HTTPS']),
  'samesite' => 'Lax'
]);
session_start();

function json_out($data, $code=200){
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

set_exception_handler(function(Throwable $e){
  // Se já mandamos cabeçalho, não dá pra trocar o formato
  if (!headers_sent()) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
  }
  echo json_encode([
    'error' => 'internal_error',
    'message' => $e->getMessage(),
    'file' => basename($e->getFile()),
    'line' => $e->getLine()
  ], JSON_UNESCAPED_UNICODE);
  exit;
});
