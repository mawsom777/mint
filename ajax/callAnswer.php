<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$userId = authenticateAndGetUserId();
$redis = getRedisConnection();

try {
    if ($data['accepted'] === true) {
        $redis->setex("accept:{$data['caller']}", 65, $userId);
    } else if ($data['accepted'] === false) {
        $redis->setex("reject:{$data['caller']}", 65, $userId);
    }
    $redis->del("audio_call_request:{$userId}");
    $redis->del("video_call_request:{$userId}");

    $response = [
        'message' => "OK",
        'result' => $data['caller']
    ];
    http_response_code(200);
    echo json_encode($response);
    die();

} catch (RedisException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send request']);
    die();
}