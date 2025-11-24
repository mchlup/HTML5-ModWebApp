<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
$username = $input['username'] ?? '';
$password = $input['password'] ?? '';

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Chybí uživatelské jméno nebo heslo.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$appConfigPath = __DIR__ . '/app.json';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function loadAppDefinition(string $path): array
{
    if (!file_exists($path)) {
        return [
            'superAdmin' => ['username' => 'admin', 'password' => 'admin'],
            'defaultEnabledModules' => [],
        ];
    }
    $json = json_decode(file_get_contents($path), true);
    if (!is_array($json)) {
        return [
            'superAdmin' => ['username' => 'admin', 'password' => 'admin'],
            'defaultEnabledModules' => [],
        ];
    }
    if (empty($json['superAdmin'])) {
        $json['superAdmin'] = ['username' => 'admin', 'password' => 'admin'];
    }
    return $json;
}

function listAvailableModules(): array
{
    $modules = [];
    $dir = __DIR__ . '/../modules';
    if (!is_dir($dir)) {
        return $modules;
    }
    foreach (scandir($dir) as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        if (is_dir($dir . '/' . $name) && file_exists($dir . '/' . $name . '/index.js')) {
            $modules[] = $name;
        }
    }
    return $modules;
}

$appDefinition = loadAppDefinition($appConfigPath);
$userData = null;
$permissions = [];
$enabledModules = [];
$dbAvailable = false;

// Pokus 1: DB login
try {
    $pdo = getDbConnection();
    $dbAvailable = true;
    $stmt = $pdo->prepare('SELECT id, username, password, role FROM app_users WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    if ($row && password_verify($password, $row['password'])) {
        $userData = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'role' => $row['role'],
        ];
        try {
            $res = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
            $enabledModules = $res->fetchAll(PDO::FETCH_COLUMN, 0) ?: [];
        } catch (Throwable $e) {
            $enabledModules = [];
        }
        try {
            $permStmt = $pdo->prepare('SELECT module_id, rights FROM app_permissions WHERE user_id = ?');
            $permStmt->execute([$userData['id']]);
            while ($perm = $permStmt->fetch(PDO::FETCH_ASSOC)) {
                $permissions[$perm['module_id']] = $perm['rights'];
            }
        } catch (Throwable $e) {
            $permissions = [];
        }
    }
} catch (Throwable $e) {
    $dbAvailable = false;
}

if ($dbAvailable && !$userData) {
    respond(['success' => false, 'message' => 'Neplatné přihlašovací údaje.'], 401);
}

// Pokus 2: fallback na super-admina z app.json
if (!$dbAvailable && !$userData) {
    $sa = $appDefinition['superAdmin'];
    if ($username === ($sa['username'] ?? 'admin') && $password === ($sa['password'] ?? 'admin')) {
        $userData = [
            'id' => 0,
            'username' => $sa['username'] ?? 'admin',
            'role' => 'super-admin',
        ];
        $enabledModules = listAvailableModules();
        $permissions = ['*' => 'full'];
    }
}

if (!$userData) {
    respond(['success' => false, 'message' => 'Neplatné přihlašovací údaje.'], 401);
}

if (!in_array('config', $enabledModules, true)) {
    $enabledModules[] = 'config';
}

$_SESSION['user_id'] = $userData['id'];
$_SESSION['username'] = $userData['username'];
$_SESSION['role'] = $userData['role'];

respond([
    'success' => true,
    'user' => [
        'id' => $userData['id'],
        'username' => $userData['username'],
        'role' => $userData['role'],
        'permissions' => $permissions,
    ],
    'enabledModules' => array_values(array_unique($enabledModules)),
    'permissions' => $permissions,
    'dbAvailable' => $dbAvailable,
]);
