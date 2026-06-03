<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);

$chatId = (int)($data['chat_id'] ?? 0);
$userId = authenticateAndGetUserId();

if (!$chatId) {
    http_response_code(400);
    echo json_encode(['error' => 'chat_id required']);
    exit;
}

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

$stmt = $pdoChecker->prepare("SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?");
$stmt->execute([$chatId, $userId]);
$currentRole = $stmt->fetchColumn();
if (!$currentRole) {
    http_response_code(404);
    exit;
}

if ($currentRole === 'owner') {
    $stmt2 = $pdoChecker->prepare("SELECT account_id, role FROM chat_participants WHERE chat_id = ? AND account_id != ? ORDER BY FIELD(role, 'admin', 'member') LIMIT 1");
    $stmt2->execute([$chatId, $userId]);
    $successor = $stmt2->fetch();

    $pdoWriter->beginTransaction();
    if ($successor) {
        $stmtUp = $pdoWriter->prepare("UPDATE chat_participants SET role = 'owner' WHERE chat_id = ? AND account_id = ?");
        $stmtUp->execute([$chatId, $successor['account_id']]);
        $stmtDel = $pdoWriter->prepare("DELETE FROM chat_participants WHERE chat_id = ? AND account_id = ?");
        $stmtDel->execute([$chatId, $userId]);
        $pdoWriter->commit();
        echo json_encode(['success' => true, 'transferred' => true]);
    } else {
        $stmtDelChat = $pdoWriter->prepare("DELETE FROM chats WHERE id = ?");
        $stmtDelChat->execute([$chatId]);
        $pdoWriter->commit();
        echo json_encode(['success' => true, 'chat_deleted' => true]);
    }
    exit;
} else {
    $stmt = $pdoWriter->prepare("DELETE FROM chat_participants WHERE chat_id = ? AND account_id = ?");
    $stmt->execute([$chatId, $userId]);
    echo json_encode(['success' => true]);
    exit;
}