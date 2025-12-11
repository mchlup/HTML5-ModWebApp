<?php
session_start();

// modulový backend – používá společné helpery z config/
require_once __DIR__ . '/../../../config/common.php';
require_once __DIR__ . '/../../../config/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$role   = $_SESSION['role'] ?? 'guest';

try {
    $pdo = getDbConnection();
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Databázové připojení není k dispozici: ' . $e->getMessage(),
    ], 500);
}

// jednoduchý helper pro načtení JSON payloadu
function readJsonPayload(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

$action = $_GET['action'] ?? 'list';

// ---------------------------------------------------------------------
// LIST – seznam dodavatelů
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === 'list') {
    ensureLoggedIn();

    $search = trim((string)($_GET['search'] ?? ''));
    $params = [];

    $sql = 'SELECT id, name, code, contact_person, email, phone, website, note, created_at, updated_at
            FROM app_suppliers';

    if ($search !== '') {
        $sql .= ' WHERE (name LIKE :q
                   OR code LIKE :q
                   OR contact_person LIKE :q
                   OR email LIKE :q
                   OR phone LIKE :q
                   OR website LIKE :q
                   OR note LIKE :q)';
        $params[':q'] = '%' . $search . '%';
    }

    $sql .= ' ORDER BY name ASC';

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        jsonResponse([
            'success' => true,
            'data'    => $rows,
        ]);
    } catch (Throwable $e) {
        jsonResponse([
            'success' => false,
            'message' => 'Načtení dodavatelů selhalo: ' . $e->getMessage(),
        ], 500);
    }
}

// ---------------------------------------------------------------------
// SAVE – vytvoření / úprava dodavatele
// ---------------------------------------------------------------------
if ($method === 'POST' && $action === 'save') {
    ensureLoggedIn();

    // super-admin může bez CSRF; ostatní role musí mít token přes apiJson/requestWithCsrf
    $allowSuperAdminWithoutCsrf = true;
    if (!($allowSuperAdminWithoutCsrf && $role === 'super-admin')) {
        requireCsrfToken();
    }

    $payload = readJsonPayload();

    $id            = isset($payload['id']) ? (int)$payload['id'] : 0;
    $name          = trim((string)($payload['name'] ?? ''));
    $code          = trim((string)($payload['code'] ?? ''));
    $contactPerson = trim((string)($payload['contact_person'] ?? ''));
    $email         = trim((string)($payload['email'] ?? ''));
    $phone         = trim((string)($payload['phone'] ?? ''));
    $website       = trim((string)($payload['website'] ?? ''));
    $note          = trim((string)($payload['note'] ?? ''));

    if ($name === '') {
        jsonResponse([
            'success' => false,
            'message' => 'Název dodavatele je povinný.',
        ], 400);
    }

    $codeDb = ($code === '') ? null : $code;

    try {
        if ($id > 0) {
            $sql = 'UPDATE app_suppliers
                    SET name = :name,
                        code = :code,
                        contact_person = :contact_person,
                        email = :email,
                        phone = :phone,
                        website = :website,
                        note = :note,
                        updated_at = NOW()
                    WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':id'             => $id,
                ':name'           => $name,
                ':code'           => $codeDb,
                ':contact_person' => $contactPerson,
                ':email'          => $email,
                ':phone'          => $phone,
                ':website'        => $website,
                ':note'           => $note,
            ]);
        } else {
            $sql = 'INSERT INTO app_suppliers
                        (name, code, contact_person, email, phone, website, note, created_at)
                    VALUES
                        (:name, :code, :contact_person, :email, :phone, :website, :note, NOW())';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':name'           => $name,
                ':code'           => $codeDb,
                ':contact_person' => $contactPerson,
                ':email'          => $email,
                ':phone'          => $phone,
                ':website'        => $website,
                ':note'           => $note,
            ]);

            $id = (int)$pdo->lastInsertId();
        }

        jsonResponse([
            'success' => true,
            'id'      => $id,
        ]);
    } catch (Throwable $e) {
        if ($e instanceof PDOException && (int)$e->getCode() === 23000) {
            jsonResponse([
                'success' => false,
                'message' => 'Uvedený kód dodavatele je již použit u jiného záznamu.',
            ], 409);
        }

        jsonResponse([
            'success' => false,
            'message' => 'Uložení dodavatele selhalo: ' . $e->getMessage(),
        ], 500);
    }
}

// ---------------------------------------------------------------------
// DELETE – smazání dodavatele
// ---------------------------------------------------------------------
if ($method === 'DELETE' && $action === 'delete') {
    ensureLoggedIn();

    $allowSuperAdminWithoutCsrf = true;
    if (!($allowSuperAdminWithoutCsrf && $role === 'super-admin')) {
        requireCsrfToken();
    }

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) {
        jsonResponse([
            'success' => false,
            'message' => 'Chybí platný identifikátor dodavatele.',
        ], 400);
    }

    try {
        $stmt = $pdo->prepare('DELETE FROM app_suppliers WHERE id = :id');
        $stmt->execute([':id' => $id]);

        jsonResponse([
            'success' => true,
            'id'      => $id,
        ]);
    } catch (Throwable $e) {
        jsonResponse([
            'success' => false,
            'message' => 'Smazání dodavatele selhalo: ' . $e->getMessage(),
        ], 500);
    }
}

// ---------------------------------------------------------------------
// Neznámá akce / metoda
// ---------------------------------------------------------------------
jsonResponse([
    'success' => false,
    'message' => 'Neznámá akce nebo nepodporovaná HTTP metoda.',
], 405);

