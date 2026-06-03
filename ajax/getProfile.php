<?php
require_once ('config.php');
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$userId = authenticateAndGetUserId();
$targetId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : $userId;

try {
    $pdo = getDBCheckerConnection();

    $stmt = $pdo->prepare(
        "SELECT a.username, a.name, a.description, a.avatar, f.minio_key, f.mime_type 
         FROM accounts a 
         LEFT JOIN files f ON a.avatar = f.id 
         WHERE a.id = ?"
    );
    $stmt->execute([$targetId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    $avatarUrl = null;
    $avatarGradient = null;

    if ($user['avatar'] && $user['minio_key'] && $user['avatar'] > 4) {
        $avatarUrl = '/ajax/file.php?key=' . urlencode($user['minio_key']);
    } else {
        $avatarUrl = $user['minio_key'];
    }

    echo json_encode([
        'success' => true,
        'username'   => $user['username'],
        'name'       => $user['name'],
        'description'=> $user['description'] ?? '',
        'avatar_url' => $avatarUrl
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error' . $e]);
}