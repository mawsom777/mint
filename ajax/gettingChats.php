<?php
require_once 'formatDate.php';
require_once 'config.php';
require_once 'tokensJWT.php';

function gettingChats($echo = true) {
    $userId = authenticateAndGetUserId();

    try {
        $pdoChecker = getDBCheckerConnection();
        $sql = "
            WITH LastMessages AS (
                SELECT
                    m.chat_id,
                    m.id AS message_id,
                    m.content,
                    m.sender_id,
                    m.sent_at,
                    m.message_type,
                    m.files,
                    ROW_NUMBER() OVER (PARTITION BY m.chat_id ORDER BY m.sent_at DESC) AS rn
                FROM messages m
                WHERE m.chat_id IN (
                    SELECT chat_id FROM chat_participants WHERE account_id = :user_id
                )
                AND NOT m.is_deleted
            ),
            ChatInfo AS (
                SELECT
                    c.id AS chat_id,
                    c.type,
                    c.title,
                    c.avatar AS avatar_file_id,
                    CASE
                        WHEN c.type = 'personal' THEN (
                            SELECT a.id
                            FROM chat_participants cp
                            JOIN accounts a ON a.id = cp.account_id
                            WHERE cp.chat_id = c.id AND cp.account_id != :user_id
                            LIMIT 1
                        )
                        ELSE NULL
                    END AS account_id,
                    CASE
                        WHEN c.type = 'personal' THEN (
                            SELECT a.name
                            FROM chat_participants cp
                            JOIN accounts a ON a.id = cp.account_id
                            WHERE cp.chat_id = c.id AND cp.account_id != :user_id
                            LIMIT 1
                        )
                        ELSE c.title
                    END AS display_name,
                    CASE
                        WHEN c.type = 'personal' THEN (
                            SELECT CASE
                                WHEN a.avatar BETWEEN 1 AND 4
                                    THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                                ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                            END
                            FROM chat_participants cp
                            JOIN accounts a ON a.id = cp.account_id
                            LEFT JOIN files f ON a.avatar = f.id
                            WHERE cp.chat_id = c.id AND cp.account_id != :user_id
                            LIMIT 1
                        )
                        ELSE (
                            SELECT CASE
                                WHEN c.avatar BETWEEN 1 AND 4
                                    THEN ELT(c.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                                ELSE CONCAT('/ajax/file.php?key=', fc.minio_key)
                            END
                            FROM files fc
                            WHERE fc.id = c.avatar
                        )
                    END AS avatar_url,
                    cp.last_read_at AS my_last_read_at,
                    CASE
                        WHEN c.type = 'personal' THEN (
                            SELECT cp2.last_read_at
                            FROM chat_participants cp2
                            WHERE cp2.chat_id = c.id AND cp2.account_id != :user_id
                            LIMIT 1
                        )
                        ELSE NULL
                    END AS other_last_read_at
                FROM chats c
                JOIN chat_participants cp ON cp.chat_id = c.id AND cp.account_id = :user_id
            )
            SELECT
                ci.chat_id,
                lm.message_id,
                lm.content,
                lm.sender_id,
                lm.sent_at,
                lm.message_type,
                lm.files,
                ci.type AS chat_type,
                ci.display_name AS name,
                ci.account_id,
                ci.avatar_url,
                ci.my_last_read_at,
                ci.other_last_read_at,
                CASE 
                    WHEN ci.type = 'group' AND lm.sent_at IS NOT NULL THEN
                        EXISTS (
                            SELECT 1
                            FROM chat_participants cp
                            WHERE cp.chat_id = ci.chat_id
                              AND cp.account_id != :user_id
                              AND cp.last_read_at >= lm.sent_at
                        )
                    ELSE FALSE
                END AS is_read_by_other
            FROM ChatInfo ci
            LEFT JOIN LastMessages lm ON lm.chat_id = ci.chat_id AND lm.rn = 1
            ORDER BY COALESCE(lm.sent_at, '1970-01-01') DESC;
        ";

        $stmt = $pdoChecker->prepare($sql);
        $stmt->execute([':user_id' => $userId]);
        $chatsData = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $unreadCounts = [];
        foreach ($chatsData as $chat) {
            $chatId = $chat['chat_id'];
            $lastRead = $chat['my_last_read_at'] ?? '1970-01-01 00:00:00';
            $stmtUnread = $pdoChecker->prepare("
                SELECT COUNT(*)
                FROM messages m
                WHERE m.chat_id = :chat_id
                  AND m.sender_id != :user_id
                  AND m.sent_at > :last_read
                  AND NOT m.is_deleted
            ");
            $stmtUnread->execute([
                ':chat_id' => $chatId,
                ':user_id' => $userId,
                ':last_read' => $lastRead
            ]);
            $unreadCounts[$chatId] = (int)$stmtUnread->fetchColumn();
        }

        $chats = [];
        foreach ($chatsData as $row) {
            $hasMessage = !is_null($row['message_id']);
            $isSender = $hasMessage && ($row['sender_id'] === $userId);

            if (!$hasMessage) {
                $isRead = false;
            } elseif ($isSender) {
                if ($row['chat_type'] === 'personal') {
                    $isRead = ($row['sent_at'] <= ($row['other_last_read_at'] ?? '1970-01-01'));
                } else {
                    $isRead = (bool)($row['is_read_by_other'] ?? false);
                }
            } else {
                $isRead = ($row['sent_at'] <= ($row['my_last_read_at'] ?? '1970-01-01'));
            }

            $chats[] = [
                'messageId'      => $row['message_id'] ?? -1,
                'chatId'         => $row['chat_id'],
                'id'             => $row['chat_id'],
                'type'           => $row['chat_type'],
                'name'           => $row['name'],
                'lastMessage'    => $hasMessage ? $row['content'] : '',
                'sender'         => $isSender ? -1 : ($row['sender_id'] ?? 0),
                'sentAt'         => $hasMessage ? formatDate($row['sent_at']) : ['', ''],
                'messageType'    => $row['message_type'] ?? 'text',
                'isRead'         => $isRead,
                'unreadCount'    => $unreadCounts[$row['chat_id']] ?? 0,
                'accountId'      => $row['account_id'] ?? -1,
                'url'            => $row['avatar_url'] ?? '',
                'online'         => ($row['chat_type'] === 'personal') ? 0 : null,
                'isReadByOther'  => (bool)($row['is_read_by_other'] ?? false)
            ];
        }

        if ($echo) {
            echo json_encode($chats, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        } else {
            return $chats;
        }

    } catch (PDOException $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        return $e->getMessage();
    }
}