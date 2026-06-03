<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");

$pdoChecker = getDBCheckerConnection();
$redis = getRedisConnection();

$userId = authenticateAndGetUserId();
$targetUserId = filter_var($_POST['target_user_id'] ?? '', FILTER_VALIDATE_INT);
$offer = trim($_POST['offer'] ?? '');
$callType = $_POST['call_type'] ?? 'video';

if (!$targetUserId || $targetUserId < 1) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid target_user_id is required ' . $targetUserId]);
    exit;
}

if (empty($offer)) {
    http_response_code(400);
    echo json_encode(['error' => 'Offer is required']);
    exit;
}

if ($userId === $targetUserId) {
    http_response_code(400);
    echo json_encode(['error' => 'Cannot call yourself']);
    exit;
}

if (!in_array($callType, ['video', 'audio'])) {
    http_response_code(400);
    echo json_encode(['error' => $callType]);
    exit;
}

$stmt = $pdoChecker->prepare("SELECT id, name FROM accounts WHERE id = ?");
$stmt->execute([$targetUserId]);
$targetUser = $stmt->fetch();

if (!$targetUser) {
    http_response_code(404);
    echo json_encode(['error' => 'Target user not found']);
    exit;
}

if (!$redis) {
    http_response_code(500);
    echo json_encode(['error' => 'Redis connection failed']);
    exit;
}

$signalId = bin2hex(random_bytes(16));
$signalKey = "webrtc_signal:{$targetUserId}:{$signalId}";

$signalData = [
    'id' => $signalId,
    'from_user_id' => $userId,
    'to_user_id' => $targetUserId,
    'signal_type' => 'offer',
    'call_type' => $callType,
    'signal_data' => $offer,
    'created_at' => time()
];

$signalJson = json_encode($signalData);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid offer data']);
    exit;
}

if (!$redis->setex($signalKey, config('redis.signal_ttl', 30), $signalJson)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to initiate call']);
    exit;
}

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => ucfirst($callType) . ' call initiated to ' . htmlspecialchars($targetUser['name']),
    'call_id' => $signalId,
    'call_type' => $callType
]);