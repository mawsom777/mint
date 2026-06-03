<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (empty($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'No message IDs provided']);
    exit;
}

$userId = authenticateAndGetUserId();

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

try {
    $placeholders = implode(',', array_fill(0, count($data), '?'));
    $sql = "
        SELECT chat_id, MAX(sent_at) AS last_read
        FROM messages
        WHERE id IN ($placeholders)
        GROUP BY chat_id
    ";
    $stmt = $pdoChecker->prepare($sql);
    $stmt->execute($data);
    $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($updates as $row) {
        $chatId = $row['chat_id'];
        $lastRead = $row['last_read'];

        $updateSql = "
            UPDATE chat_participants
            SET last_read_at = CURRENT_TIMESTAMP
            WHERE chat_id = :chat_id AND account_id = :user_id
        ";
        $updateStmt = $pdoWriter->prepare($updateSql);
        $updateStmt->execute([
            ':chat_id' => $chatId,
            ':user_id' => $userId
        ]);
    }

    echo json_encode(['message' => 'OK', 'chat_id' => $chatId, 'account_id' => $userId]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}