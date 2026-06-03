<?php
require_once ('config.php');
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

try {
    $pdoWriter = getDBWriterConnection();
    $pdoChecker = getDBCheckerConnection();

    $stmt = $pdoChecker->prepare("
        SELECT c.id, c.type, c.is_private, c.slug
        FROM chats c
        JOIN chat_participants cp ON cp.chat_id = c.id AND cp.account_id = :uid
        WHERE c.id = :cid
    ");
    $stmt->execute([':uid' => $userId, ':cid' => $chatId]);
    $chat = $stmt->fetch();

    if (!$chat) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit;
    }

    if ($chat['type'] === 'channel' && !$chat['is_private']) {
        if (empty($chat['slug'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Channel has no slug']);
            exit;
        }
        $baseUrl = (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
        echo json_encode([
            'success' => true,
            'url' => $baseUrl . '/channel/' . urlencode($chat['slug'])
        ]);
        exit;
    }

    $stmtRole = $pdoChecker->prepare(
        "SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?"
    );
    $stmtRole->execute([$chatId, $userId]);
    $participant = $stmtRole->fetch();

    if (!$participant || !in_array($participant['role'], ['owner', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Only owner/admin can get invite link']);
        exit;
    }

    $stmtLink = $pdoChecker->prepare("
        SELECT id, token, uses, max_uses, expires_at
        FROM invite_links
        WHERE chat_id = ?
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (max_uses IS NULL OR uses < max_uses)
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmtLink->execute([$chatId]);
    $existing = $stmtLink->fetch();

    $token = null;
    if ($existing) {
        $token = $existing['token'];
    } else {
        $token = bin2hex(random_bytes(16));
        $stmtInsert = $pdoWriter->prepare("
            INSERT INTO invite_links (chat_id, created_by, token)
            VALUES (:chat_id, :created_by, :token)
        ");
        $stmtInsert->execute([
            ':chat_id' => $chatId,
            ':created_by' => $userId,
            ':token' => $token
        ]);
    }

    $baseUrl = (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
    echo json_encode([
        'success' => true,
        'url' => $baseUrl . '/ajax/join.php?token=' . $token
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}