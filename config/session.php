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

require_once __DIR__ . '/db_connect.php';
$enabledModules = [];
$permissions = [];

if ($userId !== null) {
    try {
        $pdo = getDbConnection();
        $stmt = $pdo->prepare('SELECT username, role FROM app_users WHERE id = ?');
        $stmt->execute([$userId]);
        if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $username = $row['username'];
            $role = $row['role'];
            $_SESSION['role'] = $role;
        }
        $res = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
        $enabledModules = $res->fetchAll(PDO::FETCH_COLUMN, 0);
        $permStmt = $pdo->prepare('SELECT module_id, rights FROM app_permissions WHERE user_id = ?');
        $permStmt->execute([$userId]);
        while ($perm = $permStmt->fetch(PDO::FETCH_ASSOC)) {
            $permissions[$perm['module_id']] = $perm['rights'];
        }
    } catch (Exception $e) {
        $enabledModules = [];
        $permissions = [];
    }
} else {
    $appConfigPath = __DIR__ . '/app.json';
    if (file_exists($appConfigPath)) {
        $json = json_decode(file_get_contents($appConfigPath), true);
        if (!empty($json['defaultEnabledModules']) && is_array($json['defaultEnabledModules'])) {
            $enabledModules = $json['defaultEnabledModules'];
        }
    }
    if (empty($enabledModules) && is_dir(__DIR__ . '/../modules')) {
        foreach (scandir(__DIR__ . '/../modules') as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            if (is_dir(__DIR__ . '/../modules/' . $name)) {
                $enabledModules[] = $name;
            }
        }
    }
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
