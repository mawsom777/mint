<?php
require_once 'config.php';
header('Content-Type: application/json');

$slug = trim($_GET['slug'] ?? '');
if (!preg_match('/^[a-zA-Z0-9\-]+$/', $slug)) {
    echo json_encode(['available' => false]);
    exit;
}
$pdo = getDBCheckerConnection();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM chats WHERE slug = ?");
$stmt->execute([$slug]);
$available = $stmt->fetchColumn() == 0;
echo json_encode(['available' => $available]);