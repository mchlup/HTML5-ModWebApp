<?php
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/app_utils.php';

if (!session_start()) {
    // Nepodařilo se založit session – vrátíme JSON chybu a ukončíme skript
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Nepodařilo se zahájit session.'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if ($rawInput !== '' && $input === null) {
    jsonResponse(['success' => false, 'message' => 'Neplatný formát JSON.'], 400);
}
$username = $input['username'] ?? '';
$password = $input['password'] ?? '';

if ($username === '' || $password === '') {
    jsonResponse(['success' => false, 'message' => 'Chybí uživatelské jméno nebo heslo.'], 400);
}

$appDefinition = loadAppDefinition();
$userData = null;
$permissions = [];
$enabledModules = [];
$dbAvailable = false;

$rateKey = 'login_failures_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!isset($_SESSION[$rateKey])) {
    $_SESSION[$rateKey] = ['count' => 0, 'time' => time()];
}
if ($_SESSION[$rateKey]['count'] >= 5 && (time() - $_SESSION[$rateKey]['time']) < 900) {
    jsonResponse(['success' => false, 'message' => 'Příliš mnoho pokusů, zkuste to později.'], 429);
}

try {
    $pdo = getDbConnection();
    $dbAvailable = true;
    $stmt = $pdo->prepare('SELECT id, username, password, role FROM app_users WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    if ($row && password_verify($password, $row['password'])) {
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
    }
} catch (Throwable $e) {
    $dbAvailable = false;
}

if ($dbAvailable && !$userData) {
    $_SESSION[$rateKey]['count'] += 1;
    $_SESSION[$rateKey]['time'] = time();
    jsonResponse(['success' => false, 'message' => 'Neplatné přihlašovací údaje.'], 401);
}

if (!$dbAvailable && !$userData) {
    $sa = $appDefinition['superAdmin'];
    if (!empty($sa['enabledOfflineLogin']) && !empty($sa['allowFallbackWithoutDb'])) {
        if ($username === ($sa['username'] ?? 'admin') && password_verify($password, $sa['passwordHash'] ?? '')) {
            $userData = [
                'id' => 0,
                'username' => $sa['username'] ?? 'admin',
                'role' => 'super-admin',
            ];
            $enabledModules = array_map(static fn(array $m) => (string) $m['id'], listAvailableModules());
            $permissions = ['super-admin' => ['*' => 'full']];
        }
    }
}

if (!$userData) {
    $_SESSION[$rateKey]['count'] += 1;
    $_SESSION[$rateKey]['time'] = time();
    jsonResponse(['success' => false, 'message' => 'Neplatné přihlašovací údaje.'], 401);
}

if (!in_array('config', $enabledModules, true)) {
    $enabledModules[] = 'config';
}
if (!in_array('dashboard', $enabledModules, true)) {
    $enabledModules[] = 'dashboard';
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
}

$_SESSION['user_id'] = $userData['id'];
$_SESSION['username'] = $userData['username'];
$_SESSION['role'] = $userData['role'];

jsonResponse([
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
    'csrfToken' => $_SESSION['csrf_token'],
]);
