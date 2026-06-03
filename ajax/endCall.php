<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$userId = authenticateAndGetUserId();
$redis = getRedisConnection();

try {
    if ($data['caller']) {
        $redis->setex("end:{$data['caller']}", 65, $userId);
        $redis->del("audio_call_request:{$data['caller']}");
        $redis->del("video_call_request:{$data['caller']}");
    }

    $response = [
        'message' => "OK",
    ];
    http_response_code(200);
    echo json_encode($response);
    exit;

} catch (RedisException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send request']);
    exit;
}