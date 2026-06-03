<?php
require_once 'config.php';
require_once 'gettingChats.php';
require_once 'tokensJWT.php';

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

$accessToken = getAccessTokenFromRequest();

if (!$accessToken || $accessToken === 'undefined') {
    echo "event: error\n";
    echo "data: " . json_encode(['type' => 'unauthorized', 'message' => 'No access token']) . "\n\n";
    flush();
    exit;
}

$payload = verifyAccessToken($accessToken);
if (!$payload) {
    echo "event: error\n";
    echo "data: " . json_encode(['type' => 'unauthorized', 'message' => 'Invalid token']) . "\n\n";
    flush();
    exit;
}

$userId = (int) $payload['user_id'];

/// SSE calls
$listKey = "signals:list:{$userId}";

$redis = getRedisConnection();
$existingCount = 0;
while ($signalJson = $redis->rPop($listKey)) {
    echo "data: {$signalJson}\n\n";
    flush();
    $existingCount++;
}

$lastPing = time();
$loopIterations = 0;

$lastId = isset($_GET['last_id']) ? intval($_GET['last_id']) : 0;

$pdoWriter = getDBWriterConnection();
$pdoChecker = getDBCheckerConnection();

echo "event: connected\n";
echo "data: " . json_encode([
        'status' => 'connected',
        'last_id' => $lastId
    ]) . "\n\n";
ob_flush();
flush();

if (ob_get_level()) ob_end_flush();

set_time_limit(0);

$dbMessages = time();
$lastOnlineRedis = time();
$lastOnlineDB = time();
$lastHeartbeat = time();

$chats = gettingChats(0);
$interlocutors = array_column($chats, 'accountId');
$newInterlocutors = [];


while (true) {
    if (connection_aborted()) {
        exit;
    } else {
        echo "heartbeat\n";
        flush();
    }

    $actions = "message:action:{$userId}";
    $signalJson = $redis->rPop($actions);
    if ($signalJson) {
        $signalData = json_decode($signalJson, true);
        if ($signalData && isset($signalData['signalType'])) {
            if ($signalData['signalType'] === 'delete_message') {
                error_log('SSE: delit');
                echo "data: " . json_encode(['delete_message' => $signalData['message_id']]) . "\n\n";
                flush();
            } elseif ($signalData['signalType'] === 'edit_message') {
                echo "data: " . json_encode(['edit_message' => $signalData]) . "\n\n";
                flush();
            } else {
                echo "data: {$signalJson}\n\n";
                flush();
            }
        } else {
            echo "data: {$signalJson}\n\n";
            flush();
        }
    }

    /// Звонки
    $call = null;
    try {
        $audioCaller = $redis->get("audio_call_request:{$userId}");
        $videoCaller = $redis->get("video_call_request:{$userId}");
        $callAccept = $redis->get("accept:{$userId}");
        $callReject = $redis->get("reject:{$userId}");
        $callEnd = $redis->get("end:{$userId}");
    } catch (RedisException $e) {
        error_log("SSE Error: " . $e->getMessage());
        echo "event: error\n";
        echo "data: " . json_encode([
                'error' => 'Redis error. Calls',
                'code' => $e->getCode()
            ]) . "\n\n";

        ob_flush();
        flush();
    }
    if ($audioCaller) {
        $call = ['callerId' => $audioCaller, 'type' => 'audio'];
    } else if ($videoCaller) {
        $call = ['callerId' => $videoCaller, 'type' => 'video'];
    }
    if ($callAccept) {
        $call = ['answer' => 'accept'];
        $redis->del("accept:{$userId}");
    } else if ($callReject) {
        $call = ['answer' => 'reject'];
        $redis->del("reject:{$userId}");
    }
    if ($callEnd) {
        $call = ['end' => true];
        $redis->del("end:{$userId}");
    }
    if ($call) {
        echo "data: " . json_encode([
                'call' => $call
            ]) . "\n\n";
        flush();
    }

    /// Сообщения
    if (time() - $dbMessages >= 3000) {
        try {
            $stmt = $pdoChecker->prepare("
            SELECT m.id
            FROM messages m
            JOIN chat_participants cp ON cp.chat_id = m.chat_id
            WHERE cp.account_id = :user_id
                AND m.id > :last_id
                AND NOT (m.is_deleted = TRUE AND m.deleted_by_user_id = :user_id)
            ORDER BY m.id DESC
            LIMIT 1
        ");
            $stmt->execute([
                ':user_id' => $userId,
                ':last_id' => $lastId
            ]);
            $newMessage = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("SSE Error: " . $e->getMessage());
            echo "event: error\n";
            echo "data: " . json_encode([
                    'error' => 'Database error',
                    'code' => $e->getCode()
                ]) . "\n\n";

            ob_flush();
            flush();

            sleep(5);
            continue;
        }

        if ($newMessage) {
            $lastId = $newMessage[0]['id'];
            $chats = gettingChats(0);
            $interlocutors = array_column($chats, 'accountId');
            echo "data: " . json_encode([
                    'chats' => json_encode($chats),
                    'lastId' => $lastId,
                    'call' => $call
                ]) . "\n\n";
            flush();
        }
        $dbMessages = time();
    } else {
        try {
            $messages = [];
            $seen = [];
            while ($msg = $redis->lpop("user:{$userId}")) {
                $msg = json_decode($msg, true);
                if ($msg['signalType'] === 'message') {
                    if ($msg['newChat']) {
                        try {
                            $stmt = $pdoChecker->prepare("
                            SELECT a.id AS user_id,
                                    a.name AS name,
                                    a.last_seen,
                                    COALESCE(f.minio_key, NULL) AS avatar_url
                            FROM accounts a
                            LEFT JOIN files f ON a.avatar = f.id
                            WHERE a.id = :sender_id
                        ");
                            $stmt->execute([
                                ':sender_id' => $msg['sender']
                            ]);
                            $newChat = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        } catch (Exception $e) {
                            error_log("SSE Error: " . $e->getMessage());
                            echo "event: error\n";
                            echo "data: " . json_encode([
                                    'error' => 'Database error',
                                    'code' => $e->getCode()
                                ]) . "\n\n";

                            ob_flush();
                            flush();

                            sleep(5);
                            continue;
                        }
                        $messages[] = array_merge($msg, $newChat);
                        $newInterlocutors[] = $msg['sender'];
                    } else {
                        $messages[] = $msg;
                    }
                } else if ($msg['signalType'] === 'seen') {
                    $seen[] = $msg;
                }
            }
        } catch (RedisException $e) {
            error_log("SSE Error: " . $e->getMessage());
            echo "event: error\n";
            echo "data: " . json_encode([
                    'error' => 'Redis error. Messages',
                    'code' => $e->getCode()
                ]) . "\n\n";

            ob_flush();
            flush();
        }

        if ($messages || $seen) {
            $data = [];
            if ($messages)
                $data['new_messages'] = json_encode($messages);
            if ($seen)
                $data['seen'] = json_encode($seen);
            echo "data: " . json_encode($data) . "\n\n";
            flush();
            $messages = [];
            $seen = [];
        }
    }

    /// last_seen
    static $previousOnline = [];

    if (time() - $lastOnlineRedis >= 2) {
        $updated = false;
        while ($new = $redis->lpop("new_user_online:{$userId}")) {
            if (!in_array($new, $interlocutors)) {
                $interlocutors[] = $new;
                $updated = true;
            }
        }
        if (!empty($newInterlocutors)) {
            foreach ($newInterlocutors as $newId) {
                if (!in_array($newId, $interlocutors)) {
                    $interlocutors[] = $newId;
                    $updated = true;
                }
            }
            $newInterlocutors = [];
        }

        $online = [];
        if (!empty($interlocutors)) {
            $keys = array_map(fn($id) => "user_online:{$id}", $interlocutors);
            $statuses = $redis->mget($keys);

            foreach ($statuses as $i => $val) {
                if ($val == 1) {
                    $online[] = $interlocutors[$i];
                }
            }
        }

        $gained = array_diff($online, $previousOnline);
        $lost   = array_diff($previousOnline, $online);

        if (!empty($gained) || !empty($lost)) {
            echo "data: " . json_encode([
                    'online_gained' => array_values($gained),
                    'online_lost'   => array_values($lost)
                ]) . "\n\n";
            flush();
        }

        $previousOnline = $online;

        $lastOnlineRedis = time();
    }

    if ((time() - $lastOnlineDB) >= 30) {
        $sql = 'UPDATE accounts SET last_seen = NOW() WHERE id = :id';
        $stmt = $pdoWriter->prepare($sql);
        $stmt->execute(['id' => $userId]);

        $lastOnlineDB = time();
    }

    usleep(500000);
}
