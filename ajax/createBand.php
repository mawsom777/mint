<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$type = $data['type'] ?? 'group';
$title = $data['title'] ?? '';
$description = $data['description'] ?? '';
$participants = $data['participants'] ?? [];
$avatarFileId = isset($data['avatar_file_id']) ? (int)$data['avatar_file_id'] : null;
$userId = authenticateAndGetUserId();

$isPrivate = 0; 
$slug = null;

if ($type === 'channel') {
    $isPrivate = !empty($data['is_private']) ? 1 : 0;
    if (!$isPrivate) {
        $slug = trim($data['slug'] ?? '');
        if ($slug === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Публичный канал должен иметь slug']);
            exit;
        }
        if (!preg_match('/^[a-zA-Z0-9\_]+$/', $slug)) {
            http_response_code(400);
            echo json_encode(['error' => 'Slug может содержать только латиницу, цифры и нижнее подчеркивание']);
            exit;
        }
    }
}

try {
    $pdoWriter = getDBWriterConnection();
    $pdoChecker = getDBCheckerConnection();
    $pdoChecker->beginTransaction();
    $pdoWriter->beginTransaction();

    $avatarId = null;
    if ($avatarFileId) {
        $stmtCheck = $pdoChecker->prepare("SELECT id FROM files WHERE id = ?");
        $stmtCheck->execute([$avatarFileId]);
        if ($stmtCheck->fetch()) {
            $avatarId = $avatarFileId;
        }
    }
    if (!$avatarId) {
        $avatarId = rand(1, 4);
    }
    $stmt = $pdoWriter->prepare("
        INSERT INTO chats (title, description, type, owner_id, is_private, slug, avatar)
        VALUES (:title, :description, :type, :owner_id, :is_private, :slug, :avatar)
    ");
    $stmt->execute([
        ':title'       => $title ?: null,
        ':description' => $description ?: null,
        ':type'        => $type,
        ':owner_id'    => $userId,
        ':is_private'  => $isPrivate,
        ':slug'        => $slug,
        ':avatar'      => $avatarId
    ]);
    $chatId = $pdoWriter->lastInsertId();

    $stmtPart = $pdoWriter->prepare("
        INSERT INTO chat_participants (chat_id, account_id, role)
        VALUES (:chat_id, :account_id, :role)
    ");
    $stmtPart->execute([':chat_id' => $chatId, ':account_id' => $userId, ':role' => 'owner']);

    if ($type === 'group') {
        $uniqueParticipants = array_unique($participants);
        foreach ($uniqueParticipants as $participantId) {
            if ($participantId === $userId) continue;
            $stmtPart->execute([
                ':chat_id' => $chatId,
                ':account_id' => $participantId,
                ':role' => 'member'
            ]);
        }
    }
    $pdoWriter->commit();

    if ($type === 'group') {
        $stmtPart = $pdoWriter->prepare("
        INSERT INTO messages (chat_id, sender_id, content, technical)
            VALUES (:chat_id, :sender_id, :content, 1)
        ");
        $stmtPart->execute([
            ':chat_id' => $chatId,
            ':sender_id' => $userId,
            ':content' => 'Группа создана',
        ]);
    } else if ($type === "channel") {
        $stmtPart = $pdoWriter->prepare("
        INSERT INTO messages (chat_id, sender_id, content, technical)
            VALUES (:chat_id, :sender_id, :content, 1)
        ");
        $stmtPart->execute([
            ':chat_id' => $chatId,
            ':sender_id' => $userId,
            ':content' => 'Канал создан',
        ]);
    } 

    $avatarUrl = null;
    if ($avatarId) {
        $stmtKey = $pdoChecker->prepare("SELECT minio_key FROM files WHERE id = ?");
        $stmtKey->execute([$avatarId]);
        $minioKey = $stmtKey->fetchColumn();
        if ($minioKey && $avatarId > 4) {
            $avatarUrl = '/ajax/file.php?key=' . $minioKey;
        } else if ($minioKey) {
            $avatarUrl = $minioKey;
        }
    }

    echo json_encode(['success' => true, 'chat_id' => $chatId, 'avatar_url' => $avatarUrl]);

} catch (PDOException $e) {
    if ($e->getCode() == 23000 && strpos($e->getMessage(), 'slug') !== false) {
        http_response_code(409);
        echo json_encode(['error' => 'Slug уже занят, выберите другой']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Ошибка базы данных: ' . $e->getMessage()]);
    }
}