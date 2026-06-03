<?php
require_once 'config.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

define("JWT_SECRET", config('jwt.secret'));
define("JWT_ALGO", config('jwt.algo'));
define("ACCESS_TOKEN_LIFETIME", config('jwt.access_token_lifetime'));
define("REFRESH_TOKEN_LIFETIME", config('jwt.refresh_token_lifetime'));

function generateAccessToken($userId, $userName) {
    $payload = [
        'user_id' => $userId,
        'name'    => $userName,
        'iat'     => time(),
        'exp'     => time() + ACCESS_TOKEN_LIFETIME
    ];
    return JWT::encode($payload, JWT_SECRET, JWT_ALGO);
}

function verifyAccessToken($token) {
    try {
        $decoded = JWT::decode($token, new Key(JWT_SECRET, JWT_ALGO));
        return (array) $decoded;
    } catch (Exception $e) {
        return false;
    }
}

function generateRefreshToken() {
    $rawToken = bin2hex(random_bytes(32));
    $hashedToken = hash('sha256', $rawToken);
    return [$rawToken, $hashedToken];
}

function storeRefreshToken($userId, $hashedToken, $expiresAt, $pdoWriter) {
    $sql = "INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) 
            VALUES (:user_id, :token_hash, :expires_at, NOW())";
    $stmt = $pdoWriter->prepare($sql);
    $stmt->execute([
        'user_id'    => $userId,
        'token_hash' => $hashedToken,
        'expires_at' => $expiresAt
    ]);
}

function deleteRefreshToken($hashedToken, $pdoWriter) {
    $sql = "DELETE FROM refresh_tokens WHERE token_hash = :token_hash";
    $stmt = $pdoWriter->prepare($sql);
    $stmt->execute(['token_hash' => $hashedToken]);
}

function getAccessTokenFromRequest() {
    // 1. Пробуем получить из заголовка (Capacitor)
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }

    // 2. Пробуем получить из HttpOnly cookie (Web)
    if (isset($_COOKIE['access_token']) && !empty($_COOKIE['access_token'])) {
        return $_COOKIE['access_token'];
    }

    return null;
}

function authenticateAndGetUserId(): int
{
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

    return (int) $payload['user_id'];
}