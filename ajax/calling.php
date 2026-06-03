<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$userId = authenticateAndGetUserId();
$action = $_POST['action'] ?? '';
$redis = getRedisConnection();

switch ($action) {
    case 'send_signal':
        handleSendSignal($userId, $redis);
        break;

    case 'get_incoming':
        handleGetIncoming($userId, $redis);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
        break;
}

function handleSendSignal($userId, $redis) {
    $targetUserId = (int)($_POST['target_id'] ?? 0);
    $signalType = $_POST['signal_type'] ?? '';
    $signalData = $_POST['signal_data'] ?? '';
    $callType = $_POST['call_type'] ?? 'video';

    $allowedSignalTypes = ['offer', 'answer', 'candidate', 'reject', 'end_call'];
    if (!in_array($signalType, $allowedSignalTypes)) {
        echo json_encode(['success' => false, 'error' => 'Invalid signal type']);
        exit;
    }

    if ($targetUserId <= 0 || empty($signalType) || empty($signalData)) {
        echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
        exit;
    }

    $signalKey = "call_signal:{$targetUserId}";
    $signal = [
        'from_user_id' => $userId,
        'signal_type' => $signalType,
        'signal_data' => $signalData,
        'call_type' => $callType,
        'timestamp' => time()
    ];

    $redis->setex($signalKey, 30, json_encode($signal));
    echo json_encode(['success' => true]);
}

function handleGetIncoming($userId, $redis) {
    $signalKey = "call_signal:{$userId}";
    $signalData = $redis->get($signalKey);

    if ($signalData) {
        $signal = json_decode($signalData, true);

        if (time() - $signal['timestamp'] > 30) {
            $redis->del($signalKey);
            echo json_encode(['success' => false, 'error' => 'Signal expired']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'from_user_id' => $signal['from_user_id'],
            'signal_type' => $signal['signal_type'],
            'signal_data' => $signal['signal_data'],
            'call_type' => $signal['call_type'],
            'timestamp' => $signal['timestamp']
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No signals']);
    }
}