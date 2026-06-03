<?php
require_once ('config.php');
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$chatId = (int)($data['chat_id'] ?? 0);
$userId = authenticateAndGetUserId();
$targetId = (int)($data['target_id'] ?? 0);

if (!$chatId || !$targetId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing parameters']);
    exit;
}

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

$stmt = $pdoChecker->prepare("SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?");
$stmt->execute([$chatId, $userId]);
$currentRole = $stmt->fetchColumn();
if (!$currentRole) {
    http_response_code(403);
    exit;
}

$stmt->execute([$chatId, $targetId]);
$targetRole = $stmt->fetchColumn();
if (!$targetRole) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

if ($targetRole === 'owner' && $currentRole !== 'owner') {
    http_response_code(403);
    echo json_encode(['error' => 'Cannot remove owner']);
    exit;
}
if ($targetId === $userId) {
    http_response_code(400);
    echo json_encode(['error' => 'Cannot remove yourself, use leave instead']);
    exit;
}
if ($currentRole === 'admin' && $targetRole !== 'member') {
    http_response_code(403);
    echo json_encode(['error' => 'Admins can only remove members']);
    exit;
}

$stmt = $pdoWriter->prepare("DELETE FROM chat_participants WHERE chat_id = ? AND account_id = ?");
$stmt->execute([$chatId, $targetId]);

echo json_encode(['success' => true]);