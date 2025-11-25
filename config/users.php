<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
$method = $_SERVER['REQUEST_METHOD'];

if (empty($_SESSION['role']) || !in_array($_SESSION['role'], ['super-admin', 'admin'], true)) {
    jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
}
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    requireCsrfToken();
}

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Databázové připojení se nezdařilo.']);
    exit;
}

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, username, role FROM app_users');
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $permStmt = $pdo->query('SELECT user_id, module_id, rights FROM app_permissions');
    $perms = [];
    while ($row = $permStmt->fetch(PDO::FETCH_ASSOC)) {
        $uid = (int)$row['user_id'];
        if (!isset($perms[$uid])) {
            $perms[$uid] = [];
        }
        $perms[$uid][$row['module_id']] = $row['rights'];
    }
    foreach ($users as &$user) {
        $uid = (int)$user['id'];
        $user['id'] = $uid;
        $user['permissions'] = $perms[$uid] ?? [];
    }
    echo json_encode(['success' => true, 'users' => $users], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? null;
    $password = $data['password'] ?? null;
    $role = $data['role'] ?? 'user';
    $permissions = $data['permissions'] ?? [];
    if (!$username || !$password) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Uživatelské jméno a heslo jsou povinné.']);
        exit;
    }
    try {
        $hash = password_hash($password, PASSWORD_DEFAULT);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Chyba při zpracování hesla.']);
        exit;
    }
    $stmt = $pdo->prepare('INSERT INTO app_users (username, password, role) VALUES (?, ?, ?)');
    try {
        $stmt->execute([$username, $hash, $role]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Nepodařilo se vytvořit uživatele. Uživatelské jméno již existuje?']);
        exit;
    }
    $userId = (int)$pdo->lastInsertId();
    if (is_array($permissions)) {
        foreach ($permissions as $moduleId => $perm) {
            if ($perm === 'none') {
                continue;
            }
            $permStmt = $pdo->prepare('INSERT INTO app_permissions (user_id, module_id, rights) VALUES (?, ?, ?)');
            $permStmt->execute([$userId, $moduleId, $perm]);
        }
    }
    echo json_encode([
        'success' => true,
        'message' => 'Uživatel vytvořen.',
        'user' => [
            'id' => $userId,
            'username' => $username,
            'role' => $role,
            'permissions' => $permissions,
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} elseif ($method === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = $params['id'] ?? null;
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nebyl specifikován uživatel ke smazání.']);
        exit;
    }
    if (!empty($_SESSION['user_id']) && (int)$id === (int)$_SESSION['user_id']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nelze smazat sám sebe.']);
        exit;
    }
    $stmt = $pdo->prepare('DELETE FROM app_users WHERE id = ?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Uživatel smazán.']);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Nepodporovaná HTTP metoda.']);
}
