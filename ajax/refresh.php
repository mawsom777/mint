<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");

$rawRefreshToken = null;
$input = file_get_contents("php://input");
$data = json_decode($input, true);
if (isset($data['refresh_token'])) {
    $rawRefreshToken = $data['refresh_token'];          // Capacitor
} elseif (isset($_COOKIE['refresh_token'])) {
    $rawRefreshToken = $_COOKIE['refresh_token'];       // Web
}

if (!$rawRefreshToken) {
    http_response_code(200);
    echo json_encode(['error' => 'Refresh token missing', 'reason' => 'invalid_refresh_token']);
    exit;
}

$hashedToken = hash('sha256', $rawRefreshToken);
$pdoReader = getDBCheckerConnection();
$pdoWriter = getDBWriterConnection();

$stmt = $pdoReader->prepare("SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = :hash");
$stmt->execute(['hash' => $hashedToken]);
$tokenData = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$tokenData || strtotime($tokenData['expires_at']) < time()) {
    http_response_code(200);
    error_log('refreshPHP: invalid token hash ' . $hashedToken);
    echo json_encode(['error' => 'Invalid or expired refresh token', 'reason' => 'invalid_refresh_token']);
    exit;
}

$stmt = $pdoReader->prepare("SELECT id, name FROM accounts WHERE id = :id");
$stmt->execute(['id' => $tokenData['user_id']]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user) {
    http_response_code(200);
    echo json_encode(['error' => 'User not found']);
    exit;
}

$newAccessToken = generateAccessToken($user['id'], $user['name']);
list($newRawRefreshToken, $newHashedRefreshToken) = generateRefreshToken();
$newExpiresAt = date('Y-m-d H:i:s', time() + REFRESH_TOKEN_LIFETIME);

$pdoWriter->beginTransaction();
try {
    $stmtDel = $pdoWriter->prepare("DELETE FROM refresh_tokens WHERE token_hash = :hash");
    $stmtDel->execute(['hash' => $hashedToken]);
    storeRefreshToken($user['id'], $newHashedRefreshToken, $newExpiresAt, $pdoWriter);
    $pdoWriter->commit();
} catch (Exception $e) {
    $pdoWriter->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update refresh token']);
    exit;
}

if (isset($_COOKIE['refresh_token'])) {
    // Web: обновляем HttpOnly cookies
    setcookie('access_token', $newAccessToken, [
        'expires'  => time() + ACCESS_TOKEN_LIFETIME,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    setcookie('refresh_token', $newRawRefreshToken, [
        'expires'  => time() + REFRESH_TOKEN_LIFETIME,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    echo json_encode(['success' => true]);
} else {
    // Capacitor: отдаём токены в теле
    echo json_encode([
        'access_token'  => $newAccessToken,
        'refresh_token' => $newRawRefreshToken,
        'expires_in'    => ACCESS_TOKEN_LIFETIME
    ]);
}