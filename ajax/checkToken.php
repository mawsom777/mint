<?php
require_once 'config.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$pdo = getDBCheckerConnection();

try {
    $sql = "SELECT account_id FROM fcm_tokens WHERE token = :token AND is_active = 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['token' => $data['token']]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $response = [
        'message' => 'OK',
        'result' => $results
    ];
    http_response_code(200);
} catch (Exception $e) {
    $results = $e;
    $response = [
        'message' => 'not OK',
        'result' => $results
    ];
    http_response_code(201);
}
echo json_encode($response);
exit;




