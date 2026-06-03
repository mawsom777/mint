<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$userId = authenticateAndGetUserId();
$username = trim($_GET['username'] ?? '');
if (!preg_match('/^[a-zA-Z0-9_]{3,35}$/', $username)) {
    echo json_encode(['available' => false]);
    exit;
}

try {
    $pdo = getDBCheckerConnection();
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM accounts WHERE username = ? AND id != ?");
    $stmt->execute([$username, $userId]);
    $available = $stmt->fetchColumn() == 0;
    echo json_encode(['available' => $available]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['available' => false]);
}