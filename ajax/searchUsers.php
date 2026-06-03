<?php
require_once 'config.php';
require_once 'tokensJWT.php';

$query = isset($_GET['query']) ? trim($_GET['query']) : '';
$mode = $_GET['mode'] ?? 'username';
$userId = authenticateAndGetUserId();
if (!in_array($mode, ['username', 'name', 'phone'])) {
    $mode = 'username';
}
try {
    $pdoChecker = getDBCheckerConnection();

    $queryLength = strlen($query);
    $searchQuery = '%' . $query . '%';
    if ($queryLength === 0) {
        $sql = "SELECT 
                    a.id,
                    a.name,
                    a.phone,
                    IF(a.last_seen >= DATE_SUB(NOW(), INTERVAL 5 SECOND), 1, 0) AS is_online,
                    CASE
                        WHEN a.avatar BETWEEN 1 AND 4
                            THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                        ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                    END AS avatar_url,
                    'personal' AS type,
                    pc.chat_id
                FROM accounts a
                LEFT JOIN files f ON a.avatar = f.id
                LEFT JOIN (
                    SELECT 
                        cp2.account_id AS other_account_id,
                        c.id AS chat_id
                    FROM chats c
                    JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.account_id = :uid1
                    JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.account_id != :uid1
                    WHERE c.type = 'personal' 
                ) pc ON pc.other_account_id = a.id
                WHERE a.id != :uid1
                LIMIT 10";
        $stmt = $pdoChecker->prepare($sql);
        $stmt->bindParam(':uid1', $userId, PDO::PARAM_INT);
    } else if ($mode === 'name') {
        // Поиск по имени: пользователи + каналы
        $sql = "SELECT id, name, phone, is_online, avatar_url, type, chat_id FROM (
                    SELECT 
                        a.id,
                        a.name,
                        a.phone,
                        IF(a.last_seen >= DATE_SUB(NOW(), INTERVAL 5 SECOND), 1, 0) AS is_online,
                        CASE
                            WHEN a.avatar BETWEEN 1 AND 4
                                THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                            ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                        END AS avatar_url,
                        'personal' AS type,
                        IFNULL(pc.chat_id, -1) AS chat_id,
                        ABS(LENGTH(a.name) - :query_length) AS len_diff
                    FROM accounts a
                    LEFT JOIN files f ON a.avatar = f.id
                    LEFT JOIN (
                        SELECT 
                            cp2.account_id AS other_account_id,
                            c.id AS chat_id
                        FROM chats c
                        JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.account_id = :uid1
                        JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.account_id != :uid1
                        WHERE c.type = 'personal' 
                    ) pc ON pc.other_account_id = a.id
                    WHERE a.id != :uid1
                        AND a.name LIKE :query
                    UNION ALL
                    SELECT 
                        c.id,
                        c.title AS name,
                        NULL AS phone,
                        0 AS is_online,
                        CASE
                            WHEN c.avatar BETWEEN 1 AND 4
                                THEN ELT(c.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                            ELSE CONCAT('/ajax/file.php?key=', f_ch.minio_key)
                        END AS avatar_url,
                        'channel' AS type,
                        c.id AS chat_id,
                        ABS(LENGTH(c.title) - :query_length) AS len_diff
                    FROM chats c
                    LEFT JOIN files f_ch ON c.avatar = f_ch.id
                    WHERE c.type = 'channel' AND c.is_private = 0
                        AND c.title LIKE :query
                ) AS combined
                ORDER BY len_diff ASC, name ASC
                LIMIT 10";
        $stmt = $pdoChecker->prepare($sql);
        $stmt->bindParam(':uid1', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':query', $searchQuery, PDO::PARAM_STR);
        $stmt->bindParam(':query_length', $queryLength, PDO::PARAM_STR);
    } else if ($mode === 'username') {
        // Поиск по username / slug: пользователи + каналы
        $sql = "SELECT id, name, phone, is_online, avatar_url, type, chat_id FROM (
                    SELECT 
                        a.id,
                        a.name,
                        a.phone,
                        IF(a.last_seen >= DATE_SUB(NOW(), INTERVAL 5 SECOND), 1, 0) AS is_online,
                        CASE
                            WHEN a.avatar BETWEEN 1 AND 4
                                THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                            ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                        END AS avatar_url,
                        'personal' AS type,
                        IFNULL(pc.chat_id, -1) AS chat_id,
                        ABS(LENGTH(a.username) - :query_length) AS len_diff
                    FROM accounts a
                    LEFT JOIN files f ON a.avatar = f.id
                    LEFT JOIN (
                        SELECT 
                            cp2.account_id AS other_account_id,
                            c.id AS chat_id
                        FROM chats c
                        JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.account_id = :uid1
                        JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.account_id != :uid1
                        WHERE c.type = 'personal'
                    ) pc ON pc.other_account_id = a.id
                    WHERE a.id != :uid1
                        AND a.username LIKE :query
                    UNION ALL
                    SELECT 
                        c.id,
                        c.title AS name,
                        NULL AS phone,
                        0 AS is_online,
                        CASE
                            WHEN c.avatar BETWEEN 1 AND 4
                                THEN ELT(c.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                            ELSE CONCAT('/ajax/file.php?key=', f_ch.minio_key)
                        END AS avatar_url,
                        'channel' AS type,
                        c.id AS chat_id,
                        ABS(LENGTH(c.slug) - :query_length) AS len_diff
                    FROM chats c
                    LEFT JOIN files f_ch ON c.avatar = f_ch.id
                    WHERE c.type = 'channel' AND c.is_private = 0
                        AND c.slug LIKE :query
                ) AS combined
                ORDER BY len_diff ASC, name ASC
                LIMIT 10";
        $stmt = $pdoChecker->prepare($sql);
        $stmt->bindParam(':uid1', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':query', $searchQuery, PDO::PARAM_STR);
        $stmt->bindParam(':query_length', $queryLength, PDO::PARAM_STR);
    } else {
        // phone – только пользователи (без каналов)
        $sql = "SELECT 
                    a.id,
                    a.name,
                    a.phone,
                    IF(a.last_seen >= DATE_SUB(NOW(), INTERVAL 5 SECOND), 1, 0) AS is_online,
                    CASE
                        WHEN a.avatar BETWEEN 1 AND 4
                            THEN ELT(a.avatar, '--avatar-gradient-gray', '--avatar-gradient-blue', '--avatar-gradient-green', '--avatar-gradient-purple')
                        ELSE CONCAT('/ajax/file.php?key=', f.minio_key)
                    END AS avatar_url,
                    'personal' AS type,
                    pc.chat_id
                FROM accounts a
                LEFT JOIN files f ON a.avatar = f.id
                LEFT JOIN (
                    SELECT 
                        cp2.account_id AS other_account_id,
                        c.id AS chat_id
                    FROM chats c
                    JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.account_id = :uid1
                    JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.account_id != :uid1
                    WHERE c.type = 'personal'
                ) pc ON pc.other_account_id = a.id
                WHERE a.id != :uid1
                    AND a.phone LIKE :query
                ORDER BY ABS(LENGTH(a.phone) - :query_length), a.phone
                LIMIT 10";
        
        $stmt = $pdoChecker->prepare($sql);
        $stmt->bindParam(':uid1', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':query', $searchQuery, PDO::PARAM_STR);
        $stmt->bindParam(':query_length', $queryLength, PDO::PARAM_STR);
    }
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    header('Content-Type: application/json');
    echo json_encode($results);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка базы данных: ' . $e->getMessage()]);
}