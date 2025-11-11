<?php
// create_users.php
require __DIR__ . '/conexao.php';

// 1) Garante a tabela (roda apenas se ainda não existir)
$conn->query("
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  can_view_all TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

// 2) Lista de usuários (edite/adicione se quiser)
$senhaPadrao = 'amor@100';
$usuarios = [
  // ADMINs: visualizam todos os lançamentos
  ['name' => 'José Miguel',   'email' => 'jm1243miguel@gmail.com',  'can_view_all' => 1],
  ['name' => 'Geovana Lays',  'email' => 'geovanalays@outlook.com', 'can_view_all' => 1],

  // Recepcionistas: visualizam apenas os próprios lançamentos
  ['name' => 'Adriany',    'email' => 'adriannyrocha21@gmail.com', 'can_view_all' => 0],
  ['name' => 'Yasmin',    'email' => 'yasminmessias792@gmail.com', 'can_view_all' => 0],
  ['name' => 'Rita',    'email' => 'rcml.cassia@gmail.com', 'can_view_all' => 0],
  ['name' => 'Evelyn',    'email' => 'evv.13kay@gmail.com', 'can_view_all' => 0],
  ['name' => 'Dhully',    'email' => 'dhully.7d@gmail.com', 'can_view_all' => 0],
  // ['name' => 'Joyce',       'email' => 'joyce@amorsaude.com',     'can_view_all' => 0],
];

// 3) Upsert: cria ou atualiza (inclusive redefinindo a senha para amor@100)
$sql = "
INSERT INTO users (name, email, password_hash, can_view_all)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  can_view_all = VALUES(can_view_all),
  password_hash = VALUES(password_hash)  -- reseta a senha para amor@100
";
$stmt = $conn->prepare($sql);

$ok = 0; $fail = 0; $msgs = [];
foreach ($usuarios as $u) {
  try {
    $hash = password_hash($senhaPadrao, PASSWORD_DEFAULT);
    $stmt->bind_param('sssi', $u['name'], $u['email'], $hash, $u['can_view_all']);
    $stmt->execute();
    $ok++;
  } catch (Throwable $e) {
    $fail++;
    $msgs[] = $u['email'] . ': ' . $e->getMessage();
  }
}

// 4) Saída
header('Content-Type: text/plain; charset=utf-8');
echo "Users processados com sucesso: {$ok}\n";
if ($fail) {
  echo "Falhas: {$fail}\n";
  echo implode("\n", $msgs) . "\n";
}
echo "\nIMPORTANTE: Delete este arquivo (create_users.php) após usar.\n";

