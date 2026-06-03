<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$chatId = $data['chat_id'];
$messageId = $data['message_id'];
$userId = authenticateAndGetUserId();

$pdo = getDBCheckerConnection();
$stmt = $pdo->prepare("SELECT account_id FROM chat_participants WHERE chat_id = ? AND account_id != ?");
$stmt->execute([$chatId, $userId]);
$participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

$redis = getRedisConnection();
$signal = ['signalType' => 'seen', 'id' => $messageId, 'chatId' => $chatId];
foreach ($participants as $uid) {
    $redis->rpush("user:{$uid}", json_encode($signal));
    $redis->expire("user:{$uid}", 300);
}
$response = [
    'message' => "OK",
];
http_response_code(200);
echo json_encode($response);
exit;



