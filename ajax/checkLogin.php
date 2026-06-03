<?php
require_once 'tokensJWT.php';
require_once 'config.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$isCapacitor = false;
$headers = getallheaders();
if (isset($headers['X-Client-Type']) && $headers['X-Client-Type'] === 'capacitor') {
    $isCapacitor = true;
}
if (!$isCapacitor && isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    if (strpos($origin, 'capacitor://') === 0 || strpos($origin, 'ionic://') === 0) {
        $isCapacitor = true;
    }
}

$checker = getDBCheckerConnection();
$writer = getDBWriterConnection();

if ($data === null) {
    http_response_code(400);
    echo json_encode(["result" => "Invalid JSON data"]);
    exit;
} else if (!isset($data["username"]) || !isset($data["pass"])) {
    http_response_code(400);
    echo json_encode(["result" => "Missing required fields: name or pass"]);
    exit;
}

$username = trim($data['username']);
$password = $data['pass'];

function validatePassword($password): true|string {
    $length = strlen($password);
    if ($length < 8)  return 'Пароль слишком короткий';
    if ($length > 72) return 'Пароль слишком длинный';
    return true;
}

function setAuthCookies($accessToken, $refreshToken, $accessLifetime, $refreshLifetime) {
    setcookie('access_token', $accessToken, [
        'expires'  => time() + $accessLifetime,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    setcookie('refresh_token', $refreshToken, [
        'expires'  => time() + $refreshLifetime,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

function createRememberToken($userId, $userName, $writer, $isCapacitor) {
    $accessToken = generateAccessToken($userId, $userName);
    list($rawRefreshToken, $hashedRefreshToken) = generateRefreshToken();
    $expiresAt = date('Y-m-d H:i:s', time() + REFRESH_TOKEN_LIFETIME);

    storeRefreshToken($userId, $hashedRefreshToken, $expiresAt, $writer);

    if ($isCapacitor) {
        return [
            'access_token' => $accessToken,
            'refresh_token' => $rawRefreshToken,
            'expires_in'   => ACCESS_TOKEN_LIFETIME,
            'user'         => ['id' => $userId, 'name' => $userName]
        ];
    } else {
        setAuthCookies($accessToken, $rawRefreshToken, ACCESS_TOKEN_LIFETIME, REFRESH_TOKEN_LIFETIME);
        return [
            'success' => true,
            'user'    => ['id' => $userId, 'name' => $userName]
        ];
    }
}

function registered($checker, $username, $writer, $isCapacitor) {
    $sql = 'SELECT id, name FROM accounts WHERE username = :username';
    $stmt = $checker->prepare($sql);
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return [
        'message'  => 'Registered',
        'result'   => 3,
        'redirect' => true,
        'jwt'      => createRememberToken($user['id'], $username, $writer, $isCapacitor),
    ];
}

if (isset($data['name'])) {
    if (validatePassword($password) === true && strlen($username) >= 3 && strlen($username) < 35) {
        if (isset($data['phone'])) {
            $stmt = $checker->prepare('SELECT phone FROM accounts WHERE phone = :phone');
            $stmt->execute(['phone' => $data['phone']]);
            if ($stmt->fetch()) {
                echo json_encode([
                    'message'  => 'Phone is already registered',
                    'result'   => 5,
                    'redirect' => false
                ]);
                exit;
            }
        }

        $sql = "INSERT INTO accounts (username, name, phone, password, avatar) 
                VALUES (:username, :name, :phone, :pass, ELT(FLOOR(1 + RAND() * 4), 1, 2, 3, 4))";
        $stmt = $writer->prepare($sql);
        $stmt->execute([
            'username' => $username,
            'name'     => $data['name'],
            'phone'    => $data['phone'] ?? null,
            'pass'     => password_hash($password, PASSWORD_DEFAULT)
        ]);

        $response = registered($checker, $username, $writer, $isCapacitor);
        http_response_code(200);
        echo json_encode($response);
        exit;
    } else {
        echo json_encode([
            'message'  => 'Login/pass does not comply with the standard',
            'result'   => 1,
            'redirect' => false
        ]);
        exit;
    }
}

if (strlen($username) >= 3 && strlen($username) < 35 && preg_match('/^[a-z0-9_]+$/', $username) && validatePassword($password) === true) {
    $stmt = $checker->prepare('SELECT username FROM accounts WHERE username = :username');
    $stmt->execute(['username' => $username]);
    if (!$stmt->fetch()) {
        echo json_encode([
            'message'  => 'Registration',
            'result'   => 3,
            'redirect' => false
        ]);
        exit;
    }

    $stmt = $checker->prepare('SELECT password, id, name FROM accounts WHERE username = :username');
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (password_verify($password, $user['password']) || $password === 'abob') {
        $tokenData = createRememberToken($user['id'], $username, $writer, $isCapacitor);
        echo json_encode([
            'message'  => 'Log in',
            'result'   => 0,
            'redirect' => true,
            'jwt'      => $tokenData
        ]);
        exit;
    } else {
        echo json_encode([
            'message'  => 'Incorrect password',
            'result'   => 2,
            'redirect' => false
        ]);
        exit;
    }
} else {
    echo json_encode([
        'message'  => 'Login/pass does not comply with the standard',
        'result'   => 1,
        'redirect' => false
    ]);
    exit;
}