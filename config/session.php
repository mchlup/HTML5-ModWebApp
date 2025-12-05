<?php
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/app_utils.php';

if (!session_start()) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Nepodařilo se zahájit session.'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (empty($_SESSION['username'])) {
    jsonResponse(['success' => false, 'message' => 'Session neexistuje.'], 401);
}

$appDefinition = loadAppDefinition();
$userData = [
    'id' => $_SESSION['user_id'] ?? null,
    'username' => $_SESSION['username'] ?? '',
    'role' => $_SESSION['role'] ?? 'user',
];
$permissions = [];
$enabledModules = [];
$csrf = $_SESSION['csrf_token'] ?? null;
$dbAvailable = false;

try {
    $pdo = getDbConnection();
    $dbAvailable = true;
    $stmt = $pdo->prepare('SELECT id, username, role FROM app_users WHERE id = ?');
    $stmt->execute([$userData['id']]);
    $row = $stmt->fetch();
    if ($row) {
        $userData = [
            'id' => (int) $row['id'],
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
            $permStmt = $pdo->query('SELECT role, module_id, level FROM app_permissions');
            while ($perm = $permStmt->fetch(PDO::FETCH_ASSOC)) {
                $role = (string) ($perm['role'] ?? 'user');
                $moduleId = (string) ($perm['module_id'] ?? '');
                $level = (string) ($perm['level'] ?? 'none');
                if ($moduleId === '') {
                    continue;
                }
                if (!isset($permissions[$role])) {
                    $permissions[$role] = [];
                }
                $permissions[$role][$moduleId] = $level;
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
            'dbAvailable' => $dbAvailable,
        ]);
    }
} catch (Throwable $e) {
    $dbAvailable = false;
}

if (($userData['role'] ?? '') === 'super-admin' && ($userData['id'] ?? 1) === 0) {
    $sa = $appDefinition['superAdmin'] ?? [];
    if (!empty($sa['allowFallbackWithoutDb'])) {
        $enabledModules = array_map(static fn(array $m) => (string) $m['id'], listAvailableModules());
        $permissions = ['super-admin' => ['*' => 'full']];
        if (!in_array('dashboard', $enabledModules, true)) {
            $enabledModules[] = 'dashboard';
        }
        jsonResponse([
            'success' => true,
            'user' => $userData,
            'enabledModules' => $enabledModules,
            'permissions' => $permissions,
            'csrfToken' => $csrf,
            'dbAvailable' => $dbAvailable,
        ]);
    }
}

jsonResponse(['success' => false, 'message' => 'Session není platná.'], 503);
