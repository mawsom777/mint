<?php
require_once ('config.php');
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$userId = authenticateAndGetUserId();
$redis = getRedisConnection();

if ($userId) {
    $redis->setex("user_online:{$userId}", 3, 1);
}

echo json_encode(['status' => 'ok']);