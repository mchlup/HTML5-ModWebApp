<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Uživatel není přihlášen.']);
    exit;
}

$userId = $_SESSION['user_id'] ?? null;
$username = $_SESSION['username'];
$role = $_SESSION['role'] ?? 'user';

$appConfigPath = __DIR__ . '/app.json';

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

$definition = loadAppDefinition($appConfigPath);
$enabledModules = [];
$permissions = [];
$dbOk = false;

require_once __DIR__ . '/db_connect.php';

try {
    $pdo = getDbConnection();
    $dbOk = true;
    if ($userId !== null) {
        $stmt = $pdo->prepare('SELECT username, role FROM app_users WHERE id = ?');
        $stmt->execute([$userId]);
        if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $username = $row['username'];
            $role = $row['role'];
            $_SESSION['role'] = $role;
        }
        $res = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
        $enabledModules = $res->fetchAll(PDO::FETCH_COLUMN, 0) ?: [];
        $permStmt = $pdo->prepare('SELECT module_id, rights FROM app_permissions WHERE user_id = ?');
        $permStmt->execute([$userId]);
        while ($perm = $permStmt->fetch(PDO::FETCH_ASSOC)) {
            $permissions[$perm['module_id']] = $perm['rights'];
        }
    }
} catch (Throwable $e) {
    $dbOk = false;
}

if (!$dbOk && $role !== 'super-admin') {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'message' => 'Databáze není dostupná.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (!$dbOk && $role === 'super-admin') {
    $enabledModules = !empty($definition['defaultEnabledModules']) && is_array($definition['defaultEnabledModules'])
        ? $definition['defaultEnabledModules']
        : listAvailableModules();
    $permissions = ['*'];
}

if ($userId === null && empty($enabledModules)) {
    $enabledModules = !empty($definition['defaultEnabledModules']) && is_array($definition['defaultEnabledModules'])
        ? $definition['defaultEnabledModules']
        : listAvailableModules();
}

if (!in_array('config', $enabledModules, true)) {
    $enabledModules[] = 'config';
}

echo json_encode([
    'success' => true,
    'user' => [
        'id' => $userId,
        'username' => $username,
        'role' => $role,
        'permissions' => $permissions,
    ],
    'enabledModules' => $enabledModules,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
