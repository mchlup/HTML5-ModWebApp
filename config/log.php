<?php
session_start();
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$logDir = __DIR__ . '/../logs';
define('APP_LOG_DIR', $logDir);
define('APP_LOG_FILE', APP_LOG_DIR . '/app.log');
define('APP_LOG_MAX_BYTES', 5 * 1024 * 1024); // 5 MB

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = $_SESSION['username'] ?? 'anonymous';
$role = $_SESSION['role'] ?? 'guest';

ensureLoggedIn();

function rotateLogFile(): void
{
    if (!file_exists(APP_LOG_FILE)) {
        return;
    }

    clearstatcache(true, APP_LOG_FILE);
    $size = filesize(APP_LOG_FILE);
    if ($size !== false && $size > APP_LOG_MAX_BYTES) {
        $timestamp = date('Ymd-His');
        $rotated = sprintf('%s/app-%s.log', APP_LOG_DIR, $timestamp);
        @rename(APP_LOG_FILE, $rotated);
    }
}

function writeFileLog(array $entry): void
{
    if (!is_dir(APP_LOG_DIR)) {
        mkdir(APP_LOG_DIR, 0777, true);
    }

    rotateLogFile();

    $line = json_encode($entry, JSON_UNESCAPED_UNICODE);
    $handle = fopen(APP_LOG_FILE, 'a');
    if ($handle === false) {
        return;
    }

    if (flock($handle, LOCK_EX)) {
        fwrite($handle, $line . PHP_EOL);
        fflush($handle);
        flock($handle, LOCK_UN);
    }
    fclose($handle);
}

try {
    $pdo = getDbConnection();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    if ($driver === 'mysql') {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(50) NULL,
                module VARCHAR(190) NULL,
                message TEXT NULL,
                username VARCHAR(190) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'
        );
    } else {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type VARCHAR(50) NULL,
                module VARCHAR(190) NULL,
                message TEXT NULL,
                username VARCHAR(190) NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )'
        );
    }
} catch (Throwable $e) {
    $pdo = null;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $entry = [
        'type' => $input['type'] ?? 'info',
        'module' => $input['module'] ?? null,
        'message' => $input['message'] ?? '',
        'username' => $user,
        'created_at' => date('c'),
    ];

    try {
        if ($pdo instanceof PDO) {
            $stmt = $pdo->prepare('INSERT INTO app_logs (type, module, message, username) VALUES (?, ?, ?, ?)');
            $stmt->execute([$entry['type'], $entry['module'], $entry['message'], $entry['username']]);
        } else {
            writeFileLog($entry);
        }
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        writeFileLog($entry);
        jsonResponse(['success' => false, 'message' => 'Log nelze uložit.'], 500);
    }
}

if ($method === 'GET') {
    if (!in_array($role, ['super-admin', 'admin'], true)) {
        jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
    }

    if ($pdo instanceof PDO) {
        $stmt = $pdo->query('SELECT id, type, module, message, username, created_at FROM app_logs ORDER BY id DESC LIMIT 100');
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse(['success' => true, 'logs' => $logs]);
    }

    $file = APP_LOG_FILE;
    $logs = [];
    if (file_exists($file)) {
        $lines = array_slice(file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES), -100);
        foreach ($lines as $line) {
            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                $logs[] = $decoded;
            }
        }
    }
    jsonResponse(['success' => true, 'logs' => array_reverse($logs)]);
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
