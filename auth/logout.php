<?php
require __DIR__ . '/../conexao.php';
session_destroy();
json_out(['ok'=>true]);
