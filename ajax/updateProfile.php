<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);

$userId = authenticateAndGetUserId();

$allowedFields = ['name', 'description', 'username', 'avatar_file_id'];
$updates = [];
$params = [];

foreach ($allowedFields as $field) {
    if (array_key_exists($field, $data)) {
        if ($field === 'avatar_file_id') {
            $updates[] = "avatar = :$field";
            $params[":$field"] = (int) $data[$field];
        } else {
            $updates[] = "$field = :$field";
            $params[":$field"] = $data[$field];
        }
    }
}

if (empty($updates)) {
    http_response_code(400);
    echo json_encode(['error' => 'No fields to update']);
    exit;
}

if (isset($params[':username'])) {
    $newUsername = $params[':username'];
    if (!preg_match('/^[a-zA-Z0-9_]{3,35}$/', $newUsername)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid username format']);
        exit;
    }
    $pdoChecker = getDBCheckerConnection();
    $stmtCheck = $pdoChecker->prepare("SELECT COUNT(*) FROM accounts WHERE username = ? AND id != ?");
    $stmtCheck->execute([$newUsername, $userId]);
    if ($stmtCheck->fetchColumn() > 0) {
        http_response_code(409);
        echo json_encode(['error' => 'Username already taken']);
        exit;
    }
}

try {
    $pdoChecker = getDBCheckerConnection();
    $pdoWriter = getDBWriterConnection();

    $sql = "UPDATE accounts SET " . implode(', ', $updates) . " WHERE id = :uid";
    $params[':uid'] = $userId;
    $stmt = $pdoWriter->prepare($sql);
    $stmt->execute($params);

    $response = ['success' => true];
    if (isset($params[':avatar_file_id'])) {
        $stmtFile = $pdoChecker->prepare("SELECT minio_key FROM files WHERE id = ?");
        $stmtFile->execute([$params[':avatar_file_id']]);
        $file = $stmtFile->fetch();
        if ($file) {
            $response['avatar_url'] = '/ajax/file.php?key=' . urlencode($file['minio_key']);
        }
    }

    if (isset($data['name'])) $response['name'] = $data['name'];
    if (isset($data['username'])) $response['username'] = $data['username'];
    if (isset($data['description'])) $response['description'] = $data['description'];

    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Update failed']);
}