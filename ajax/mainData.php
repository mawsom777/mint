<?php
require_once 'config.php';
require_once 'gettingChats.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$token = null;

if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    $token = $matches[1];
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['authenticated' => false]);
    exit;
}

$payload = verifyAccessToken($token);
if (!$payload) {
    http_response_code(401);
    echo json_encode(['authenticated' => false, 'reason' => 'invalid_token']);
    exit;
}

$userId = $payload['user_id'];
$name = $payload['name'];

if (isset($data['start'])) {
    echo json_encode(['user_id' => $userId, 'name' => $name]);
    exit;
}