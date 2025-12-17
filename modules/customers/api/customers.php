<?php
session_start();

require_once __DIR__ . '/../../../config/common.php';
require_once __DIR__ . '/../../../config/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = strtolower(trim((string)($_GET['action'] ?? '')));

// CSRF ochrana pro všechny zápisy
if ($method !== 'GET') {
    requireCsrfToken();
}

try {
    ensureLoggedIn();
    $pdo = getDbConnection();
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Databázové připojení není k dispozici: ' . $e->getMessage(),
    ], 500);
}

function customersJsonList(array $rows): void {
    jsonResponse([
        'success' => true,
        // kompatibilita: některé části UI mohou čekat "data", jiné "items"
        'data' => $rows,
        'items' => $rows,
        'count' => count($rows),
    ]);
}

function customersGetAll(PDO $pdo): void {
    try {
        $stmt = $pdo->query('SELECT id, code, name, ico, dic, email, phone, address, note, active, created_at, updated_at
                             FROM customers_customers
                             ORDER BY name ASC, id ASC');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        customersJsonList($rows);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Načtení zákazníků selhalo: ' . $e->getMessage()], 500);
    }
}

function customersGetOne(PDO $pdo, int $id): void {
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Chybí ID.'], 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT id, code, name, ico, dic, email, phone, address, note, active, created_at, updated_at
                               FROM customers_customers
                               WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            jsonResponse(['success' => false, 'message' => 'Zákazník nenalezen.'], 404);
        }
        jsonResponse(['success' => true, 'data' => $row, 'item' => $row]);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Načtení zákazníka selhalo: ' . $e->getMessage()], 500);
    }
}

function customersCreate(PDO $pdo): void {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) $input = [];

    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        jsonResponse(['success' => false, 'message' => 'Pole „Název“ je povinné.'], 400);
    }

    $code = trim((string)($input['code'] ?? ''));
    if ($code === '') {
        // jednoduchý generátor kódu: C + YY + 4 čísla (pořadí podle max(id) v tabulce)
        $yy = date('y');
        $stmt = $pdo->query('SELECT MAX(id) AS max_id FROM customers_customers');
        $maxId = (int)($stmt->fetch(PDO::FETCH_ASSOC)['max_id'] ?? 0);
        $seq = $maxId + 1;
        $code = 'C' . $yy . str_pad((string)$seq, 4, '0', STR_PAD_LEFT);
    }

    $stmt = $pdo->prepare('INSERT INTO customers_customers
        (code, name, ico, dic, email, phone, address, note, active)
        VALUES (:code, :name, :ico, :dic, :email, :phone, :address, :note, :active)');

    try {
        $stmt->execute([
            ':code' => $code,
            ':name' => $name,
            ':ico' => trim((string)($input['ico'] ?? '')) ?: null,
            ':dic' => trim((string)($input['dic'] ?? '')) ?: null,
            ':email' => trim((string)($input['email'] ?? '')) ?: null,
            ':phone' => trim((string)($input['phone'] ?? '')) ?: null,
            ':address' => trim((string)($input['address'] ?? '')) ?: null,
            ':note' => trim((string)($input['note'] ?? '')) ?: null,
            ':active' => !empty($input['active']) ? 1 : 0,
        ]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'message' => 'Uložení zákazníka se nezdařilo: ' . $e->getMessage()], 400);
    }

    jsonResponse(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'code' => $code]);
}

function customersUpdate(PDO $pdo): void {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) $input = [];

    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Chybí ID.'], 400);
    }

    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        jsonResponse(['success' => false, 'message' => 'Pole „Název“ je povinné.'], 400);
    }

    $stmt = $pdo->prepare('UPDATE customers_customers
        SET code = :code,
            name = :name,
            ico = :ico,
            dic = :dic,
            email = :email,
            phone = :phone,
            address = :address,
            note = :note,
            active = :active
        WHERE id = :id');

    try {
        $stmt->execute([
            ':id' => $id,
            ':code' => trim((string)($input['code'] ?? '')),
            ':name' => $name,
            ':ico' => trim((string)($input['ico'] ?? '')) ?: null,
            ':dic' => trim((string)($input['dic'] ?? '')) ?: null,
            ':email' => trim((string)($input['email'] ?? '')) ?: null,
            ':phone' => trim((string)($input['phone'] ?? '')) ?: null,
            ':address' => trim((string)($input['address'] ?? '')) ?: null,
            ':note' => trim((string)($input['note'] ?? '')) ?: null,
            ':active' => !empty($input['active']) ? 1 : 0,
        ]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'message' => 'Uložení zákazníka se nezdařilo: ' . $e->getMessage()], 400);
    }

    jsonResponse(['success' => true]);
}

function customersDelete(PDO $pdo): void {
    $id = 0;

    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
        if (is_array($input)) $id = (int)($input['id'] ?? 0);
    }

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Chybí ID.'], 400);
    }

    try {
        $stmt = $pdo->prepare('DELETE FROM customers_customers WHERE id = :id');
        $stmt->execute([':id' => $id]);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Smazání zákazníka selhalo: ' . $e->getMessage()], 500);
    }

    jsonResponse(['success' => true]);
}

try {
    // --- kompatibilní router přes ?action=...
    if ($action !== '') {
        if ($action === 'list' || $action === 'getall') {
            customersGetAll($pdo);
        }

        if ($action === 'get') {
            customersGetOne($pdo, (int)($_GET['id'] ?? 0));
        }

        if ($action === 'create') {
            if ($method !== 'POST') jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
            customersCreate($pdo);
        }

        if ($action === 'update') {
            if ($method !== 'POST' && $method !== 'PUT') jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
            customersUpdate($pdo);
        }

        if ($action === 'delete') {
            if ($method !== 'POST' && $method !== 'DELETE') jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
            customersDelete($pdo);
        }

        jsonResponse(['success' => false, 'message' => 'Neznámá akce.'], 400);
    }

    // --- REST router
    switch ($method) {
        case 'GET':
            customersGetAll($pdo);
            break;

        case 'POST':
            customersCreate($pdo);
            break;

        case 'PUT':
            customersUpdate($pdo);
            break;

        case 'DELETE':
            customersDelete($pdo);
            break;

        default:
            jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
    }
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
}
