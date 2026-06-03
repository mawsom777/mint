<?php
require_once 'config.php'; 
require_once 'tokensJWT.php';

$userId = authenticateAndGetUserId();
$token = $_GET['token'] ?? null;
$slug  = $_GET['channel'] ?? null;

if (!$token && !$slug) {
    http_response_code(400);
    echo 'Не указан параметр приглашения';
    exit;
}

try {
    $pdoChecker = getDBCheckerConnection();
    $pdoWriter = getDBWriterConnection();

    if ($token) {
        $stmt = $pdoChecker->prepare("
            SELECT id, chat_id, max_uses, uses, expires_at
            FROM invite_links
            WHERE token = ?
        ");
        $stmt->execute([$token]);
        $invite = $stmt->fetch();

        if (!$invite) {
            exit('Недействительная ссылка приглашения.');
        }

        if ($invite['expires_at'] && strtotime($invite['expires_at']) < time()) {
            exit('Срок действия приглашения истёк.');
        }

        if ($invite['max_uses'] !== null && $invite['uses'] >= $invite['max_uses']) {
            exit('Лимит использований приглашения исчерпан.');
        }

        $chatId = $invite['chat_id'];

    } elseif ($slug) {
        $stmtChat = $pdoChecker->prepare(
            "SELECT id, is_private FROM chats WHERE slug = ? AND type = 'channel'"
        );
        $stmtChat->execute([$slug]);
        $chat = $stmtChat->fetch();

        if (!$chat || $chat['is_private'] == 1) {
            exit('Канал не найден или является приватным.');
        }

        $chatId = $chat['id'];
    }

    $stmtMember = $pdoChecker->prepare(
        "SELECT 1 FROM chat_participants WHERE chat_id = ? AND account_id = ?"
    );
    $stmtMember->execute([$chatId, $userId]);
    if ($stmtMember->fetch()) {
        header('Location: /index.html?chat_id=' . $chatId);
        exit;
    }

    $stmtJoin = $pdoWriter->prepare(
        "INSERT INTO chat_participants (chat_id, account_id, role) VALUES (:chat_id, :account_id, 'member')"
    );
    $stmtJoin->execute([':chat_id' => $chatId, ':account_id' => $userId]);

    if ($token) {
        $stmtUpdate = $pdoWriter->prepare("UPDATE invite_links SET uses = uses + 1 WHERE id = ?");
        $stmtUpdate->execute([$invite['id']]);
    }

    header('Location: /index.html?chat_id=' . $chatId);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo 'Произошла ошибка сервера.';
}