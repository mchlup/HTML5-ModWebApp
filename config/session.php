<?php
session_start();
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

function loadAppDefinition(string $path): array
{
    if (!file_exists($path)) {
        return [];
    }
    $json = json_decode(file_get_contents($path), true);
    return is_array($json) ? $json : [];
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

if (empty($_SESSION['username'])) {
    jsonResponse(['success' => false, 'message' => 'Session neexistuje.'], 401);
}

$appDefinition = loadAppDefinition(__DIR__ . '/app.json');
$userData = [
    'id' => $_SESSION['user_id'] ?? null,
    'username' => $_SESSION['username'] ?? '',
    'role' => $_SESSION['role'] ?? 'user',
];
$permissions = [];
$enabledModules = [];
$csrf = $_SESSION['csrf_token'] ?? null;

// Pokus 1: DB session
try {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare('SELECT id, username, role FROM app_users WHERE id = ?');
    $stmt->execute([$userData['id']]);
    $row = $stmt->fetch();
    if ($row) {
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
        jsonResponse([
            'success' => true,
            'user' => $userData,
            'enabledModules' => $enabledModules,
            'permissions' => $permissions,
            'csrfToken' => $csrf,
        ]);
    }
} catch (Throwable $e) {
    // ignore
}

// Pokus 2: fallback super admin bez DB
if (($userData['role'] ?? '') === 'super-admin' && ($userData['id'] ?? 1) === 0) {
    $sa = $appDefinition['superAdmin'] ?? [];
    if (!empty($sa['allowFallbackWithoutDb'])) {
        $enabledModules = listAvailableModules();
        $permissions = ['*' => 'full'];
        if (!in_array('dashboard', $enabledModules, true)) {
            $enabledModules[] = 'dashboard';
        }
        jsonResponse([
            'success' => true,
            'user' => $userData,
            'enabledModules' => $enabledModules,
            'permissions' => $permissions,
            'csrfToken' => $csrf,
        ]);
    }
}

jsonResponse(['success' => false, 'message' => 'Session není platná.'], 503);
