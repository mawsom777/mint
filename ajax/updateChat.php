<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);

$userId = authenticateAndGetUserId();
$chatId = (int)($data['chat_id'] ?? 0);
$title = trim($data['title'] ?? '');
$description = trim($data['description'] ?? '');
$avatarFileId = isset($data['avatar_file_id']) ? (int)$data['avatar_file_id'] : null;

if (!$chatId) {
    http_response_code(400);
    echo json_encode(['error' => 'chat_id required']);
    exit;
}

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

$stmt = $pdoChecker->prepare("SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?");
$stmt->execute([$chatId, $userId]);
$role = $stmt->fetchColumn();
if (!$role || !in_array($role, ['owner', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$updates = [];
$params = [];
if ($title !== '') {
    $updates[] = 'title = :title';
    $params[':title'] = $title;
}
if ($description !== '') {
    $updates[] = 'description = :description';
    $params[':description'] = $description;
}
if ($avatarFileId !== null) {
    $checkFile = $pdoChecker->prepare("SELECT id FROM files WHERE id = ?");
    $checkFile->execute([$avatarFileId]);
    if ($checkFile->fetch()) {
        $updates[] = 'avatar = :avatar';
        $params[':avatar'] = $avatarFileId;
    }
}
if (empty($updates)) {
    echo json_encode(['success' => true]);
    exit;
}

$sql = "UPDATE chats SET " . implode(', ', $updates) . " WHERE id = :chat_id";
$params[':chat_id'] = $chatId;
$stmt = $pdoWriter->prepare($sql);
$stmt->execute($params);

$stmtAvatar = $pdoChecker->prepare("
    SELECT f.minio_key 
    FROM chats c 
    LEFT JOIN files f ON c.avatar = f.id 
    WHERE c.id = ?
");
$stmtAvatar->execute([$chatId]);
$minioKey = $stmtAvatar->fetchColumn();

echo json_encode([
    'success' => true,
    'avatar_url' => $minioKey ? '/ajax/file.php?key=' . $minioKey : null
]);