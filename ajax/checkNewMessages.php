<?php
require_once ('config.php');
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!$data || !isset($data['chat_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
    exit;
}

$userId = authenticateAndGetUserId();
$chatId = (int)$data['chat_id'];
$lastId = isset($data['last_message_id']) ? (int)$data['last_message_id'] : 0;

try {
    $pdo = getDBCheckerConnection();

    $sql = "
        SELECT *
        FROM messages
        WHERE chat_id = :chat_id
          AND id > :last_id
          AND NOT (is_deleted = TRUE AND deleted_by_user_id = :user_id)
        ORDER BY sent_at ASC
        LIMIT 50
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':chat_id' => $chatId,
        ':last_id' => $lastId,
        ':user_id' => $userId
    ]);

    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'messages' => $messages,
        'count' => count($messages)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}