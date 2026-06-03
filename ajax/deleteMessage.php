<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);

$messageId = (int)($data['message_id'] ?? 0);
if (!$messageId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing message_id']);
    exit;
}

$userId = authenticateAndGetUserId();

$pdoChecker = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();
$redis = getRedisConnection();

try {
    $stmt = $pdoChecker->prepare("SELECT chat_id, sender_id, files FROM messages WHERE id = ?");
    $stmt->execute([$messageId]);
    $msg = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$msg) {
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
        exit;
    }

    $chatId = $msg['chat_id'];
    $senderId = $msg['sender_id'];
    $filesJson = $msg['files'];
    $pdoWriter->beginTransaction();

    $updateStmt = $pdoWriter->prepare("
        UPDATE messages 
        SET is_deleted = 1, deleted_by_user_id = ? 
        WHERE id = ?
    ");
    $updateStmt->execute([$userId, $messageId]);

    if ($filesJson) {
        $fileIds = json_decode($filesJson, true);
        if (is_array($fileIds) && !empty($fileIds)) {
            $minio = getMinIOConnection();
            $bucket = config('minio.bucket');

            foreach ($fileIds as $fileId) {
                $fileStmt = $pdoChecker->prepare("SELECT minio_key FROM files WHERE id = ?");
                $fileStmt->execute([$fileId]);
                $fileRow = $fileStmt->fetch();
                if ($fileRow) {
                    $key = $fileRow['minio_key'];
                    try {
                        $minio->deleteObject(['Bucket' => $bucket, 'Key' => $key]);
                    } catch (Exception $e) {
                        error_log("MinIO delete error (key: $key): " . $e->getMessage());
                    }
                    $thumbKey = 'thumb_' . $key;
                    try {
                        $minio->deleteObject(['Bucket' => $bucket, 'Key' => $thumbKey]);
                    } catch (Exception $e) {
                    }
                    $delFileStmt = $pdoWriter->prepare("DELETE FROM files WHERE id = ?");
                    $delFileStmt->execute([$fileId]);
                }
            }
        }
    }

    $pdoWriter->commit();

    $participantsStmt = $pdoChecker->prepare("SELECT account_id FROM chat_participants WHERE chat_id = ?");
    $participantsStmt->execute([$chatId]);
    $participants = $participantsStmt->fetchAll(PDO::FETCH_COLUMN);

    $signal = json_encode(['signalType' => 'delete_message', 'message_id' => $messageId]);
    foreach ($participants as $id) {
        $redis->rpush("message:action:{$id}", $signal);
        $redis->expire("message:action:{$id}", 300);
        $redis->ltrim("message:action:{$id}", -50, -1);
    }

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdoWriter->inTransaction()) $pdoWriter->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}