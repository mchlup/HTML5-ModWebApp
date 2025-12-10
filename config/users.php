<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$role = $_SESSION['role'] ?? 'guest';

if (!in_array($role, ['super-admin', 'admin'], true)) {
    jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
}
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    requireCsrfToken();
}

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Databázové připojení se nezdařilo.'], 500);
}

$driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
if ($driver === 'mysql') {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(190) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT "user"
        )'
    );
} else {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(190) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT "user"
        )'
    );
}

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, username, role FROM app_users ORDER BY username');
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(['success' => true, 'users' => $users]);
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim((string) ($data['username'] ?? ''));
    $password = $data['password'] ?? null;
    $userRole = $data['role'] ?? 'user';
    if ($username === '' || !$password) {
        jsonResponse(['success' => false, 'message' => 'Uživatelské jméno a heslo jsou povinné.'], 400);
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO app_users (username, password, role) VALUES (?, ?, ?)');
    try {
        $stmt->execute([$username, $hash, $userRole]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => 'Nepodařilo se vytvořit uživatele.'], 500);
    }
    $userId = (int) $pdo->lastInsertId();
    jsonResponse([
        'success' => true,
        'message' => 'Uživatel vytvořen.',
        'user' => [
            'id' => $userId,
            'username' => $username,
            'role' => $userRole,
        ],
    ]);
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = (int) ($data['id'] ?? 0);
    $newRole = $data['role'] ?? null;
    $newPassword = $data['password'] ?? null;
    if ($userId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Neplatný uživatel.'], 400);
    }
    $updates = [];
    $params = [];
    if ($newRole) {
        $updates[] = 'role = ?';
        $params[] = $newRole;
    }
    if ($newPassword) {
        $updates[] = 'password = ?';
        $params[] = password_hash($newPassword, PASSWORD_DEFAULT);
    }
    if (!$updates) {
        jsonResponse(['success' => false, 'message' => 'Nic k uložení.'], 400);
    }
    $params[] = $userId;
    $stmt = $pdo->prepare('UPDATE app_users SET ' . implode(', ', $updates) . ' WHERE id = ?');
    $stmt->execute($params);
    jsonResponse(['success' => true, 'message' => 'Uživatel upraven.']);
}

if ($method === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = (int) ($params['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Nebyl specifikován uživatel ke smazání.'], 400);
    }
    if (!empty($_SESSION['user_id']) && $id === (int) $_SESSION['user_id']) {
        jsonResponse(['success' => false, 'message' => 'Nelze smazat sám sebe.'], 400);
    }
    $stmt = $pdo->prepare('DELETE FROM app_users WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['success' => true, 'message' => 'Uživatel smazán.']);
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná HTTP metoda.'], 405);
