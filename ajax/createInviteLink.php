<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$userId = authenticateAndGetUserId();
$chatId = (int)($data['chat_id'] ?? 0);
if (!$chatId) {
    http_response_code(400);
    echo json_encode(['error' => 'chat_id обязателен']);
    exit;
}

try {
    $pdoWriter = getDBWriterConnection();
    $pdoChecker = getDBCheckerConnection();

    $stmt = $pdoChecker->prepare("SELECT type FROM chats WHERE id = ?");
    $stmt->execute([$chatId]);
    $chat = $stmt->fetch();
    if (!$chat || $chat['type'] !== 'group') {
        http_response_code(400);
        echo json_encode(['error' => 'Приглашения создаются только для групп']);
        exit;
    }
    $stmtRole = $pdoChecker->prepare(
        "SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?"
    );
    $stmtRole->execute([$chatId, $userId]);
    $participant = $stmtRole->fetch();
    if (!$participant || !in_array($participant['role'], ['owner', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Недостаточно прав для создания приглашения']);
        exit;
    }

    $token = bin2hex(random_bytes(16));
    $stmtInsert = $pdoWriter->prepare("
        INSERT INTO invite_links (chat_id, created_by, token)
        VALUES (:chat_id, :created_by, :token)
    ");
    $stmtInsert->execute([
        ':chat_id'    => $chatId,
        ':created_by' => $userId,
        ':token'      => $token
    ]);

    $inviteId = $pdoWriter->lastInsertId();
    $baseUrl = (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
    $inviteUrl = $baseUrl . '/ajax/join.php?token=' . $token;

    echo json_encode([
        'success' => true,
        'invite_id' => $inviteId,
        'token' => $token,
        'url' => $inviteUrl
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка базы данных']);
}