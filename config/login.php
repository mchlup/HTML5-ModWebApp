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

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    $pdo = null;
}

$userData = null;
if ($pdo) {
    $stmt = $pdo->prepare('SELECT id, username, password, role FROM app_users WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    if ($row && password_verify($password, $row['password'])) {
        $userData = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'role' => $row['role'],
        ];
    }
}

if (!$userData) {
    $appConfigPath = __DIR__ . '/app.json';
    $superAdmin = ['username' => 'admin', 'password' => 'admin'];
    if (file_exists($appConfigPath)) {
        $json = json_decode(file_get_contents($appConfigPath), true);
        if (isset($json['superAdmin'])) {
            $sa = $json['superAdmin'];
            if (isset($sa['username'])) {
                $superAdmin['username'] = $sa['username'];
            }
            if (isset($sa['password'])) {
                $superAdmin['password'] = $sa['password'];
            }
        }
    }
    if ($username === $superAdmin['username'] && $password === $superAdmin['password']) {
        $userData = [
            'id' => null,
            'username' => $superAdmin['username'],
            'role' => 'super-admin',
        ];
    }
}

if (!$userData) {
    echo json_encode(['success' => false, 'message' => 'Neplatné přihlašovací údaje.']);
    exit;
}

$_SESSION['user_id'] = $userData['id'];
$_SESSION['username'] = $userData['username'];
$_SESSION['role'] = $userData['role'];

$enabledModules = [];
if ($pdo) {
    try {
        $res = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
        $enabledModules = $res->fetchAll(PDO::FETCH_COLUMN, 0);
    } catch (Exception $e) {
        $enabledModules = [];
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

$permissions = [];
if ($pdo && $userData['id'] !== null) {
    $stmt = $pdo->prepare('SELECT module_id, rights FROM app_permissions WHERE user_id = ?');
    $stmt->execute([$userData['id']]);
    while ($perm = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $permissions[$perm['module_id']] = $perm['rights'];
    }
}

$response = [
    'success' => true,
    'user' => [
        'id' => $userData['id'],
        'username' => $userData['username'],
        'role' => $userData['role'],
        'permissions' => $permissions,
    ],
    'enabledModules' => $enabledModules,
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
