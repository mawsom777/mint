<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$files = array_column($data['files'] ?? [], 0);
$files_data = array_column($data['files'] ?? [], 1);
$userId = authenticateAndGetUserId();

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

try {
    $pdoChecker->beginTransaction();

    if (isset($data['chatId'])) {
        $chatId = (int)$data['chatId'];
        $isNewChat = false;

        $stmtCheck = $pdoChecker->prepare("SELECT 1 FROM chat_participants WHERE chat_id = ? AND account_id = ?");
        $stmtCheck->execute([$chatId, $userId]);
        if (!$stmtCheck->fetch()) {
            throw new Exception('You are not a member of this chat');
        }
    } else {
        $receiverId = $data['receiverId'];
        $type = $receiverId === $userId ? 'saved' : 'personal';
        $stmtChat = $pdoChecker->prepare("
            SELECT c.id
            FROM chats c
            JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.account_id = :uid1
            JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.account_id = :uid2
            WHERE c.type = :type
            LIMIT 1
        ");
        $stmtChat->execute([':uid1' => $userId, ':uid2' => $receiverId, ':type' => $type]);
        $chat = $stmtChat->fetch(PDO::FETCH_ASSOC);


        if (!$chat) {
            $stmtCreateChat = $pdoWriter->prepare("
                INSERT INTO chats (title, type, owner_id)
                VALUES (NULL, :type, :owner_id)
            ");
            $stmtCreateChat->execute([':type' => $type, ':owner_id' => $userId]);
            $chatId = $pdoWriter->lastInsertId();

            if ($type === 'personal') {
                $stmtAddParticipants = $pdoWriter->prepare("
                    INSERT INTO chat_participants (chat_id, account_id, role)
                    VALUES (:chat_id, :uid1, 'member'),
                           (:chat_id, :uid2, 'member')
                ");
                $stmtAddParticipants->execute([':chat_id' => $chatId, ':uid1' => $userId, ':uid2' => $receiverId]);
            } else {
                $stmtAddParticipants = $pdoWriter->prepare("
                    INSERT INTO chat_participants (chat_id, account_id, role)
                    VALUES (:chat_id, :uid1, 'member')
                ");
                $stmtAddParticipants->execute([':chat_id' => $chatId, ':uid1' => $userId]);
            }
            $isNewChat = true;
        } else {
            $chatId = $chat['id'];
            $isNewChat = $data['newChat'] ?? false;
        }
    }

    $stmtChatType = $pdoChecker->prepare("SELECT type FROM chats WHERE id = ?");
    $stmtChatType->execute([$chatId]);
    $chatType = $stmtChatType->fetchColumn();

    if ($chatType === 'channel') {
        $stmtRole = $pdoChecker->prepare("SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?");
        $stmtRole->execute([$chatId, $userId]);
        $role = $stmtRole->fetchColumn();
        if (!in_array($role, ['owner', 'admin'])) {
            throw new Exception('Only channel administrators can send messages');
        }
    }

    $sql = "INSERT INTO messages (chat_id, sender_id, content, message_type, files)
            VALUES (:chat_id, :sender_id, :content, 'text', :files)";
    $stmt = $pdoWriter->prepare($sql);
    $stmt->execute([
        ':chat_id' => $chatId,
        ':sender_id' => $userId,
        ':content' => $data['content'],
        ':files' => !empty($files) ? json_encode($files) : null
    ]);
    $messageId = $pdoWriter->lastInsertId();
    $pdoChecker->commit();

    $senderName = $senderAvatar = null;
    if ($chatType !== 'personal') {
        $stmtAcc = $pdoChecker->prepare("SELECT 
                                            a.name,
                                            CASE
                                                WHEN a.avatar BETWEEN 1 AND 4 THEN
                                                    ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', 
                                                                 '--avatar-gradient-green', '--avatar-gradient-purple')
                                                ELSE
                                                    CONCAT('/ajax/file.php?key=', f.minio_key)
                                            END AS avatar_url
                                        FROM accounts a
                                        LEFT JOIN files f ON a.avatar = f.id
                                        WHERE a.id = ?");
        $stmtAcc->execute([$userId]);
        $acc = $stmtAcc->fetch();
        $senderName = $acc['name'];
        $senderAvatar = $acc['avatar_url'];
    }

    $redis = getRedisConnection();
    $stmtParticipants = $pdoChecker->prepare("SELECT account_id FROM chat_participants WHERE chat_id = ? AND account_id != ?");
    $stmtParticipants->execute([$chatId, $userId]);
    $participants = $stmtParticipants->fetchAll(PDO::FETCH_COLUMN);

    $signal = [
        'signalType' => 'message',
        'id' => $messageId,
        'isRead' => false,
        'content' => $data['content'],
        'sender' => $userId,
        'sentAt' => ['Сегодня', date('H:i')],
        'type' => 'text',
        'files' => $files_data ?? null,
        'chatId' => $chatId,
        'newChat' => $isNewChat ?? false,
        'chatType' => $chatType
    ];

    if ($chatType !== 'personal') {
        $signal['sender_name'] = $senderName;
        $signal['sender_avatar'] = $senderAvatar;
    }

    $signalJson = json_encode($signal);
    foreach ($participants as $participantId) {
        $redis->rpush("user:{$participantId}", $signalJson);
        $redis->expire("user:{$participantId}", 300);
        $redis->ltrim("user:{$participantId}", -50, -1);
    }

    echo json_encode(['message' => 'OK', 'messageId' => $messageId]);

} catch (Exception $e) {
    $pdoChecker->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}