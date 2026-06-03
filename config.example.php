<?php
return [
    'db' => [
        'host'     => 'localhost',
        'dbname'   => 'mint',
        'charset'  => 'utf8mb4',
        'checker'  => [
            'user' => 'checker',
            'pass' => 'YOUR_CHECKER_PASSWORD',
        ],
        'writer'   => [
            'user' => 'writer',
            'pass' => 'YOUR_WRITER_PASSWORD',
        ],
        'babayka'  => [
            'user' => 'caller',
            'pass' => 'YOUR_CALLER_PASSWORD',
        ],
    ],

    // Redis
    'redis' => [
        'host'     => 'localhost',
        'port'     => 6379,
        'password' => null,
        'db'       => 0,
        'signal_ttl' => 30,
    ],

    // MinIO 
    'minio' => [
        'endpoint'              => 'http://localhost:9000',
        'use_path_style_endpoint' => true,
        'key'                   => 'minio',
        'secret'                => 'YOUR_MINIO_SECRET',
        'bucket'                => 'BUCKET',
        'region'                => 'us-east-1',
        'use_ssl'               => false,
    ],

    // Firebase Service Account
    'firebase' => [
        'service_account_path' => __DIR__ . '/notifications/service-account-file.json',
    ],

    // JWT Tokens
    'jwt' => [
        'secret' => 'YOUR_JWT_SECRET',
        'algo' => 'HS256',
        'access_token_lifetime' => 900,  // 15 минут
        'refresh_token_lifetime' => 60*60*24*30  // 30 дней
    ]
];