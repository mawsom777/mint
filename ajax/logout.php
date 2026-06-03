<?php
require_once 'config.php';
require_once 'tokensJWT.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$pdoWriter = getDBWriterConnection();

$refreshToken = null;
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (isset($_COOKIE['refresh_token'])) {
    $refreshToken = $_COOKIE['refresh_token'];
} elseif (isset($data['refresh_token'])) {
    $refreshToken = $data['refresh_token'];
}

if (!empty($refreshToken)) {
    $hashedToken = hash('sha256', $refreshToken);
    $stmtDel = $pdoWriter->prepare("DELETE FROM refresh_tokens WHERE token_hash = :hash");
    $stmtDel->execute(['hash' => $hashedToken]);
}

if (isset($_COOKIE['refresh_token']) || isset($_COOKIE['access_token'])) {
    $cookieParams = [
        'expires'  => time() - 3600,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ];
    setcookie('access_token', '', $cookieParams);
    setcookie('refresh_token', '', $cookieParams);
}

if (isset($data['logout_all']) && $data['logout_all'] === true) {
    $accessToken = getAccessTokenFromRequest();
    if ($accessToken) {
        $payload = verifyAccessToken($accessToken);
        if ($payload) {
            $userId = (int)$payload['user_id'];
            $stmtDelAll = $pdoWriter->prepare("DELETE FROM refresh_tokens WHERE user_id = :uid");
            $stmtDelAll->execute(['uid' => $userId]);
        }
    }
}

echo json_encode(['success' => true]);