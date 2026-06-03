<?php
require_once __DIR__ . '/../ajax/config.php';
require_once __DIR__ . '/../ajax/tokensJWT.php';

function showChannel($slug): void
{
    $userId = authenticateAndGetUserId();
    $slug = preg_replace('/[^a-zA-Zа-яА-ЯёЁ0-9_]/u', '', $slug);
    if (empty($slug)) {
        http_response_code(400);
        echo 'Некорректное название канала.';
        return;
    }

    try {
        $pdoChecker = getDBCheckerConnection();
        $pdoWriter = getDBWriterConnection();

        $stmtChat = $pdoChecker->prepare(
            "SELECT id, is_private FROM chats WHERE slug = ? AND type = 'channel'"
        );
        $stmtChat->execute([$slug]);
        $chat = $stmtChat->fetch();

        if (!$chat || $chat['is_private'] == 1) {
            exit('Канал не найден или является приватным.');
        }

        $chatId = $chat['id'];

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

        header('Location: /index.html?chat_id=' . $chatId);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo 'Произошла ошибка сервера.';
    }
}