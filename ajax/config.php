<?php
require_once __DIR__ . '/../vendor/autoload.php';
use Aws\S3\S3Client;
use Aws\Exception\AwsException;

date_default_timezone_set('Europe/Moscow');

function loadConfig(): array {
    $localFile = __DIR__ . '/../config.local.php';
    if (file_exists($localFile)) {
        return require $localFile;
    }
    return [];
}

$appConfig = loadConfig();

function config(string $key, $default = null) {
    global $appConfig;
    $keys = explode('.', $key);
    $value = $appConfig;
    foreach ($keys as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }
        $value = $value[$segment];
    }
    return $value;
}

function getDBCheckerConnection(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf("mysql:host=%s;dbname=%s;charset=%s",
            config('db.host', 'localhost'),
            config('db.dbname', 'mint'),
            config('db.charset', 'utf8mb4')
        );
        $pdo = new PDO($dsn,
            config('db.checker.user'),
            config('db.checker.pass'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
    }
    return $pdo;
}

function getDBWriterConnection(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf("mysql:host=%s;dbname=%s;charset=%s",
            config('db.host', 'localhost'),
            config('db.dbname', 'mint'),
            config('db.charset', 'utf8mb4')
        );
        $pdo = new PDO($dsn,
            config('db.writer.user'),
            config('db.writer.pass'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
    }
    return $pdo;
}

// Redis
function getRedisConnection() {
    static $redis = null;
    if ($redis === null) {
        try {
            $redis = new Redis();
            $redis->connect(
                config('redis.host', 'localhost'),
                config('redis.port', 6379),
                2, null, 100
            );
            if ($pass = config('redis.password')) {
                $redis->auth($pass);
            }
            $redis->select(config('redis.db', 0));
        } catch (Exception $e) {
            error_log('Redis connection failed: ' . $e->getMessage());
            return false;
        }
    }
    return $redis;
}

// MinIO
function getMinIOConnection() {
    try {
        return new S3Client([
            'version' => 'latest',
            'region'  => config('minio.region', 'us-east-1'),
            'endpoint' => config('minio.endpoint'),
            'use_path_style_endpoint' => config('minio.use_path_style_endpoint', true),
            'credentials' => [
                'key'    => config('minio.key'),
                'secret' => config('minio.secret'),
            ],
            'http' => [
                'verify' => false,
            ],
        ]);
    } catch (Exception $e) {
        error_log('MinIO connection failed: ' . $e->getMessage());
        return false;
    }
}