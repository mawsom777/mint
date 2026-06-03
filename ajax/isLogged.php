<?php
require_once 'tokensJWT.php';
header('Content-Type: application/json');

$accessToken = getAccessTokenFromRequest();

if (!$accessToken || $accessToken === 'undefined') {
    http_response_code(200);
    echo json_encode(['authenticated' => false]);
    exit;
}

$payload = verifyAccessToken($accessToken);
if (!$payload) {
    http_response_code(200);
    echo json_encode(['authenticated' => false, 'reason' => 'invalid_token']);
    exit;
}

echo json_encode([
    'redirect'      => false,
    'authenticated' => true,
    'user_id'       => $payload['user_id'],
    'name'          => $payload['name']
]);