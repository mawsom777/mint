<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$userId = authenticateAndGetUserId();
$redis = getRedisConnection();
try {
    if ($data['type'] === 'audio') {
        $redis->setex("audio_call_request:{$data['target']}", 65, $userId);
    } else if ($data['type'] === 'video') {
        $redis->setex("video_call_request:{$data['target']}", 65, $userId);
    }

    $response = [
        'message' => "OK",
        'result' => $data['target']
    ];
    http_response_code(200);
    echo json_encode($response);
    exit;

} catch (RedisException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send request']);
    exit;
}