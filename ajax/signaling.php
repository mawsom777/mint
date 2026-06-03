<?php
require_once __DIR__ . '/config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$userId = authenticateAndGetUserId();
$action = $_POST['action'] ?? '';

$redis = getRedisConnection();

switch ($action) {
    case 'send_signal':
        $toUserId = filter_var($_POST['to_user_id'] ?? '', FILTER_VALIDATE_INT);
        $signalType = $_POST['signal_type'] ?? '';
        $signalData = trim($_POST['signal_data'] ?? '');
        $callType = $_POST['call_type'] ?? null;

        if (!$toUserId || $toUserId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid to_user_id is required']);
            exit;
        }

        if (!in_array($signalType, ['offer', 'answer', 'candidate'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signal type']);
            exit;
        }

        if (empty($signalData)) {
            http_response_code(400);
            echo json_encode(['error' => 'Signal data is required']);
            exit;
        }

        if ($userId === $toUserId) {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot send signal to yourself']);
            exit;
        }

        $signalId = bin2hex(random_bytes(16));
        $signalKey = "webrtc_signal:{$toUserId}:{$signalId}";

        $signal = [
            'id' => $signalId,
            'from_user_id' => $userId,
            'to_user_id' => $toUserId,
            'signal_type' => $signalType,
            'call_type' => $callType,
            'signal_data' => $signalData,
            'created_at' => time()
        ];

        $signalJson = json_encode($signal);
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signal data']);
            exit;
        }

        if (!$redis->setex($signalKey, config('redis.signal_ttl', 30), $signalJson)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send signal']);
            exit;
        }

        echo json_encode(['success' => true]);
        break;

    case 'get_signals':
        $signalType = $_POST['signal_type'] ?? '';

        if ($signalType && !in_array($signalType, ['offer', 'answer', 'candidate'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signal type filter']);
            exit;
        }

        $pattern = "webrtc_signal:{$userId}:*";
        $signalKeys = $redis->keys($pattern);
        $signals = [];

        foreach ($signalKeys as $key) {
            $signalJson = $redis->get($key);
            if ($signalJson) {
                $signal = json_decode($signalJson, true);
                if (!$signal) {
                    $redis->del($key);
                    continue;
                }

                if (empty($signalType) || $signal['signal_type'] === $signalType) {
                    $signals[] = $signal;
                }
                $redis->del($key);
            }
        }

        usort($signals, function($a, $b) {
            return $a['created_at'] <=> $b['created_at'];
        });

        $signals = array_slice($signals, 0, 50);

        echo json_encode(['signals' => $signals]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}