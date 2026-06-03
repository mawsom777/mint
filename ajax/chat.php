<?php
require_once 'formatDate.php';
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$userId = authenticateAndGetUserId();
$chatId = isset($data['chatId']) ? (int)$data['chatId'] : null;

function messagesFormat($result, $files_per_message, $filesInfo, $userId, $lastReadAt = null, $chatType = 'personal'): array
{
    $messages = [];
    for ($i = 0; $i < count($result); $i++) {
        $file_list = [];
        if (!empty($files_per_message[$i])) {
            foreach ($files_per_message[$i] as $file_id) {
                if (isset($filesInfo[$file_id])) {
                    $is_media = (strpos($filesInfo[$file_id]['mime_type'], 'image/') === 0 || strpos($filesInfo[$file_id]['mime_type'], 'video/') === 0);
                    $file_list[] = [
                        'id' => $file_id,
                        'name' => $filesInfo[$file_id]['original_name'],
                        'type' => $filesInfo[$file_id]['mime_type'],
                        'key'  => $filesInfo[$file_id]['minio_key'],
                        'thumb_key' => $is_media ? ('thumb_' . $filesInfo[$file_id]['minio_key']) : null
                    ];
                }
            }
        }

        $isSender = ($result[$i]['sender_id'] === $userId);
        $isRead = false;
        if (!$isSender && $lastReadAt !== null) {
            $isRead = (strtotime($result[$i]['sent_at']) <= strtotime($lastReadAt));
        } elseif ($isSender) {
            $isRead = $result[$i]['receiver_read'] ?? false;
        }

        $messages[$i]['id']       = $result[$i]['id'];
        $messages[$i]['sender']   = $isSender ? -1 : $result[$i]['sender_id'];
        $messages[$i]['content']  = $result[$i]['content'];
        $messages[$i]['type']     = $result[$i]['message_type'];
        $messages[$i]['files']    = $file_list;
        $messages[$i]['sentAt']   = formatDate($result[$i]['sent_at']);
        $messages[$i]['updatedAt']= $result[$i]['updated_at'];
        $messages[$i]['isRead']   = $isRead;
        $messages[$i]['readAt']   = $isRead ? $result[$i]['sent_at'] : null;
        $messages[$i]['technical']= $result[$i]['technical'] ?? false;

        if ($chatType !== 'personal' && !$isSender) {
            $messages[$i]['sender_name']   = $result[$i]['sender_name'] ?? '';
            $messages[$i]['sender_avatar'] = $result[$i]['sender_avatar_url'] ?? '';
        }
    }
    return $messages;
}

try {
    $pdoChecker = getDBCheckerConnection();
    $pdoWriter = getDBWriterConnection();

    if ($chatId === null) {
        $requestedId = (int)$data['receiverId'];

        $stmtCheckUser = $pdoChecker->prepare("SELECT COUNT(*) FROM accounts WHERE id = ?");
        $stmtCheckUser->execute([$requestedId]);
        $isUser = $stmtCheckUser->fetchColumn() > 0;

        if ($isUser) {
            $stmtChat = $pdoChecker->prepare("
                SELECT c.id
                FROM chats c
                JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.account_id = :uid1
                JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.account_id = :uid2
                WHERE c.type = :type
                LIMIT 1
            ");
            $stmtChat->execute([':uid1' => $userId, ':uid2' => $requestedId, ':type' => $data['type']]);
            $chat = $stmtChat->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                $pdoWriter->beginTransaction();
                if ($userId === $requestedId) {
                    $stmtCreateChat = $pdoWriter->prepare("
                        INSERT INTO chats (title, type, owner_id)
                        VALUES (NULL, 'saved', :owner_id)
                    ");
                } else {
                    $stmtCreateChat = $pdoWriter->prepare("
                        INSERT INTO chats (title, type, owner_id)
                        VALUES (NULL, 'personal', :owner_id)
                    ");
                }
                $stmtCreateChat->execute([':owner_id' => $userId]);
                $chatId = $pdoWriter->lastInsertId();

                if ($userId === $requestedId) {
                    $stmtAddParticipants = $pdoWriter->prepare("
                        INSERT INTO chat_participants (chat_id, account_id, role)
                        VALUES (:chat_id, :uid1, 'member')
                    ");
                    $stmtAddParticipants->execute([
                        ':chat_id' => $chatId,
                        ':uid1' => $userId
                    ]);
                } else {
                    $stmtAddParticipants = $pdoWriter->prepare("
                        INSERT INTO chat_participants (chat_id, account_id, role)
                        VALUES (:chat_id, :uid1, 'member'),
                               (:chat_id, :uid2, 'member')
                    ");
                    $stmtAddParticipants->execute([
                        ':chat_id' => $chatId,
                        ':uid1' => $userId,
                        ':uid2' => $requestedId
                    ]);
                }
                $pdoWriter->commit();
            } else {
                $chatId = $chat['id'];
            }
        } else {
            $stmtCheckChat = $pdoChecker->prepare("SELECT id FROM chats WHERE id = ?");
            $stmtCheckChat->execute([$requestedId]);
            $chatRow = $stmtCheckChat->fetch();
            if ($chatRow) {
                $chatId = $chatRow['id'];
            } else {
                http_response_code(404);
                echo json_encode(['result' => 'Chat or user not found']);
                exit;
            }
        }
    }

    if ($chatId === null) {
        http_response_code(400);
        echo json_encode(["result" => "Missing chat_id"]);
        exit;
    }

    $chatType = 'personal';
    $chatIsPrivate = 0;
    $stmtChatType = $pdoChecker->prepare("SELECT type, is_private FROM chats WHERE id = ?");
    $stmtChatType->execute([$chatId]);
    $chatTypeRow = $stmtChatType->fetch();
    if ($chatTypeRow) {
        $chatType = $chatTypeRow['type'];
        $chatIsPrivate = $chatTypeRow['is_private'];
    }

    $stmtCheckParticipant = $pdoChecker->prepare("SELECT 1 FROM chat_participants WHERE chat_id = ? AND account_id = ?");
    $stmtCheckParticipant->execute([$chatId, $userId]);
    if (!$stmtCheckParticipant->fetch()) {
        if ($chatType === 'channel' && $chatIsPrivate === 0) {
            # pass
        } else {
            http_response_code(403);
            echo json_encode(['result' => 'Access denied']);
            exit;
        }
    }

    $role = 'member';
    $stmtRole = $pdoChecker->prepare("SELECT role FROM chat_participants WHERE chat_id = ? AND account_id = ?");
    $stmtRole->execute([$chatId, $userId]);
    $roleRow = $stmtRole->fetch();
    if ($roleRow) {
        $role = $roleRow['role'];
    }

    $canSend = true;
    if ($chatType === 'channel' && !in_array($role, ['owner', 'admin'])) {
        $canSend = false;
    }

    $stmtCount = $pdoChecker->prepare("SELECT COUNT(*) FROM chat_participants WHERE chat_id = ?");
    $stmtCount->execute([$chatId]);
    $participantCount = (int)$stmtCount->fetchColumn();

        $stmtLastRead = $pdoChecker->prepare("
        SELECT last_read_at FROM chat_participants
        WHERE chat_id = :chat_id AND account_id = :uid
    ");
        $stmtLastRead->execute([':chat_id' => $chatId, ':uid' => $userId]);
        $myLastRead = $stmtLastRead->fetchColumn();

    $theirLastRead = null;
    $chatType = $pdoChecker->query("SELECT type FROM chats WHERE id = $chatId")->fetchColumn();
    if ($chatType === 'personal') {
        $stmtTheirLastRead = $pdoChecker->prepare("
        SELECT last_read_at FROM chat_participants
        WHERE chat_id = :chat_id AND account_id != :uid
    ");
        $stmtTheirLastRead->execute([':chat_id' => $chatId, ':uid' => $userId]);
        $theirLastRead = $stmtTheirLastRead->fetchColumn();
    }

    if ($chatType !== 'personal') {
        $sql = "SELECT m.*,
                   a.name AS sender_name,
                   CASE
                       WHEN a.avatar BETWEEN 1 AND 4
                           THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                       ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                   END AS sender_avatar_url,
                   (m.sent_at <= :their_last_read) AS receiver_read
            FROM messages m
            JOIN accounts a ON m.sender_id = a.id
            LEFT JOIN files f ON a.avatar = f.id
            WHERE m.chat_id = :chat_id
            AND NOT m.is_deleted
            ORDER BY m.sent_at DESC
            LIMIT 100
        ";
    } else {
        $sql = "
            SELECT m.*,
                   (m.sent_at <= :their_last_read) AS receiver_read
            FROM messages m
            WHERE m.chat_id = :chat_id
              AND NOT m.is_deleted
            ORDER BY m.sent_at DESC
            LIMIT 100
        ";
    }
    $stmt = $pdoChecker->prepare($sql);
        $stmt->execute([
            ':chat_id' => $chatId,
            ':their_last_read' => $theirLastRead ?: '1970-01-01 00:00:00'
        ]);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $files_per_message = [];
    $all_file_ids = [];
    foreach ($result as $row) {
        $file_ids = [];
        if (!empty($row['files'])) {
            $decoded = json_decode($row['files'], true);
            if (is_array($decoded)) {
                $file_ids = array_map('intval', $decoded);
                $all_file_ids = array_merge($all_file_ids, $file_ids);
            }
        }
        $files_per_message[] = $file_ids;
    }

    $all_file_ids = array_unique($all_file_ids);
    $filesInfo = [];
    if (!empty($all_file_ids)) {
        $placeholders = implode(',', array_fill(0, count($all_file_ids), '?'));
        $sql_files = "SELECT id, original_name, mime_type, minio_key FROM files WHERE id IN ($placeholders)";
        $stmt_files = $pdoChecker->prepare($sql_files);
        $stmt_files->execute($all_file_ids);
        $rows = $stmt_files->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $filesInfo[$row['id']] = [
                'original_name' => $row['original_name'],
                'mime_type'     => $row['mime_type'],
                'minio_key'     => $row['minio_key'],
            ];
        }
    }

    $messages = messagesFormat($result, $files_per_message, $filesInfo, $userId, $myLastRead, $chatType);

    $response = [
        'result' => $messages,
        'chatType' => $chatType,
        'canSend' => $canSend,
        'participantCount' => $participantCount
    ];
    http_response_code(200);
    echo json_encode($response);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}