<?php
require_once ('config.php');
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$platform = $data['platform'] ?? 'web';  // 'web', 'android', 'ios'
error_log('saveToken ' . $platform);
$platform = $platform ?? 'web';
$userId = authenticateAndGetUserId();
$pdoWriter = getDBWriterConnection();

try {
    $sql = "INSERT INTO fcm_tokens (account_id, token, platform, is_active) 
                VALUES (
                    :account_id,
                    :token,
                    :platform,
                    1
                )
                ON DUPLICATE KEY UPDATE 
                    account_id = VALUES(account_id),  
                    platform   = VALUES(platform),   
                    is_active  = VALUES(is_active);    
            ";
    $stmt = $pdoWriter->prepare($sql);
    $stmt->execute(['account_id' => $userId, 'platform' => $platform, 'token' => $data['token']]);
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




