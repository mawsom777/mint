<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$userId = authenticateAndGetUserId();
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['message_id']) || !isset($data['content'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing message_id or content']);
    exit;
}

$messageId = (int)$data['message_id'];
$newContent = trim($data['content']);
if ($newContent === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Content cannot be empty']);
    exit;
}

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

try {
    $stmt = $pdoChecker->prepare("
        SELECT m.chat_id, m.sender_id, m.content, c.type as chat_type
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        WHERE m.id = ? AND m.is_deleted = 0
    ");
    $stmt->execute([$messageId]);
    $message = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$message) {
        throw new Exception('Message not found or already deleted');
    }
    if ($message['sender_id'] != $userId) {
        throw new Exception('You can edit only your own messages');
    }

    $chatId = $message['chat_id'];
    $oldContent = $message['content'];

    $updateStmt = $pdoWriter->prepare("
        UPDATE messages 
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $updateStmt->execute([$newContent, $messageId]);

    $redis = getRedisConnection();
    $participantsStmt = $pdoChecker->prepare("
        SELECT account_id FROM chat_participants WHERE chat_id = ?
    ");
    $participantsStmt->execute([$chatId]);
    $participants = $participantsStmt->fetchAll(PDO::FETCH_COLUMN);

    $signal = [
        'signalType' => 'edit_message',
        'message_id' => $messageId,
        'new_content' => $newContent,
        'updated_at' => date('Y-m-d H:i:s'),
        'chat_id' => $chatId,
        'sender_id' => $userId
    ];
    $signalJson = json_encode($signal);

    foreach ($participants as $participantId) {
        if ($participantId == $userId) continue;
        $redis->rpush("message:action:{$participantId}", $signalJson);
        $redis->expire("message:action:{$participantId}", 300);
        $redis->ltrim("message:action:{$participantId}", -50, -1);
    }

    echo json_encode(['success' => true, 'message_id' => $messageId]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}