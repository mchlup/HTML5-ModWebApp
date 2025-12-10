<?php
session_start();
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$role = $_SESSION['role'] ?? 'guest';
$configPath = __DIR__ . '/db_config.json';
$configExists = file_exists($configPath);

if ($configExists) {
    if (!in_array($role, ['super-admin', 'admin'], true)) {
        jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
    }
    if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        requireCsrfToken();
    }
}

if ($action === 'test') {
    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    $driver = $payload['driver'] ?? 'mysql';
    $database = $payload['database'] ?? ($payload['name'] ?? '');
    $host = $payload['host'] ?? 'localhost';
    $port = (int) ($payload['port'] ?? 0);
    $username = $payload['user'] ?? ($payload['username'] ?? '');
    $password = $payload['pass'] ?? ($payload['password'] ?? '');
    try {
        $conf = compact('driver', 'host', 'port', 'database', 'username', 'password');
        $dsn = '';
        if ($driver === 'mysql') {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port ?: 3306, $database);
        } elseif ($driver === 'postgres') {
            $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $host, $port ?: 5432, $database);
        } elseif ($driver === 'sqlite') {
            $dsn = 'sqlite:' . ($database ?: ':memory:');
        }
        $pdo = new PDO($dsn, $username, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        jsonResponse(['success' => true, 'message' => 'Připojení úspěšné.']);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Připojení se nezdařilo: ' . $e->getMessage()], 400);
    }
}

if ($method === 'GET') {
    if (!$configExists) {
        jsonResponse(['success' => true, 'config' => null]);
    }
    $conf = json_decode(file_get_contents($configPath), true) ?? [];
    unset($conf['password']);
    jsonResponse(['success' => true, 'config' => $conf]);
}

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    $config = [
        'driver' => $payload['driver'] ?? 'mysql',
        'host' => $payload['host'] ?? 'localhost',
        'port' => $payload['port'] ?? null,
        'database' => $payload['database'] ?? ($payload['name'] ?? ''),
        'username' => $payload['username'] ?? ($payload['user'] ?? ''),
        'password' => $payload['password'] ?? ($payload['pass'] ?? ''),
    ];
    try {
        file_put_contents($configPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        jsonResponse(['success' => true, 'message' => 'Konfigurace uložena.']);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Uložení se nezdařilo.'], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná akce.'], 400);
