<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$userId = authenticateAndGetUserId();
$chatId = isset($_GET['chat_id']) ? (int)$_GET['chat_id'] : 0;

if (!$chatId) {
    http_response_code(400);
    echo json_encode(['error' => 'chat_id required']);
    exit;
}
try {
    $pdo = getDBCheckerConnection();

    // Проверяем, состоит ли пользователь в чате
    $stmt = $pdo->prepare("
        SELECT 
            c.title,
            c.description,
            c.type,
            c.is_private,
            c.slug,
            CASE
                WHEN c.avatar BETWEEN 1 AND 4
                    THEN ELT(c.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                ELSE CONCAT('/ajax/file.php?key=', fc.minio_key)
            END AS avatar,
            cp.role
        FROM chats c
        JOIN chat_participants cp ON cp.chat_id = c.id AND cp.account_id = :uid
        LEFT JOIN files fc ON c.avatar = fc.id
        WHERE c.id = :cid
    ");
    $stmt->execute([':uid' => $userId, ':cid' => $chatId]);
    $chat = $stmt->fetch();

    if (!$chat) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit;
    }

    $currentRole = $chat['role'];

    $showParticipants = false;
    if ($chat['type'] === 'group') {
        $showParticipants = true;
    } elseif ($chat['type'] === 'channel' && in_array($currentRole, ['owner', 'admin'])) {
        $showParticipants = true;
    }

    $participants = [];
    if ($showParticipants) {
        $stmtP = $pdo->prepare("
            SELECT 
                a.id,
                a.name,
                CASE
                    WHEN a.avatar BETWEEN 1 AND 4
                        THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                    ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                END AS avatar_url,
                cp.role
            FROM chat_participants cp
            JOIN accounts a ON a.id = cp.account_id
            LEFT JOIN files f ON a.avatar = f.id
            WHERE cp.chat_id = :cid
            ORDER BY FIELD(cp.role, 'owner', 'admin', 'member'), a.name
        ");
        $stmtP->execute([':cid' => $chatId]);
        $participants = $stmtP->fetchAll();
    }

    foreach ($participants as &$p) {
        if ($userId == $p['id']) {
            $p['can_remove'] = false;
        } elseif ($currentRole === 'owner') {
            $p['can_remove'] = true;
        } elseif ($currentRole === 'admin' && $p['role'] === 'member') {
            $p['can_remove'] = true;
        } else {
            $p['can_remove'] = false;
        }
    }
    unset($p);

    $response = [
        'success' => true,
        'chat' => [
            'id' => $chatId,
            'title' => $chat['title'],
            'description' => $chat['description'],
            'type' => $chat['type'],
            'is_private' => (bool)$chat['is_private'],
            'slug' => $chat['slug'],
            'avatar' => $chat['avatar'],
        ],
        'current_role' => $currentRole,
        'can_edit' => in_array($currentRole, ['owner', 'admin']),
        'participants' => $participants
    ];

    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}