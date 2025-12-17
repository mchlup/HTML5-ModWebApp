<?php
session_start();

// nacteni spolecnych funkcí a DB připojení
require_once __DIR__ . '/../../../config/common.php';
require_once __DIR__ . '/../../../config/db_connect.php';

// VŠECHEN výstup přes jsonResponse, nic jiného neecho-vat
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    ensureLoggedIn();
    $pdo = getDbConnection();

    
    // bezpečnostní migrace (starší instalace mohou mít starší strukturu tabulky)
    ensureOrdersSchema($pdo);
// Podpora pro starší volání přes ?action=...
    $action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';

    if ($method === 'GET') {
        if ($action === 'list' || $action === '') {
            ordersList($pdo);
        } else if ($action === 'get') {
            ordersGet($pdo);
        } else {
            jsonResponse(['success' => false, 'message' => 'Neznámá akce.'], 400);
        }
    } else if ($method === 'POST') {
        // zápis chráníme CSRF tokenem
        requireCsrfToken();

        if ($action === 'create' || $action === '') {
            ordersCreate($pdo);
        } else if ($action === 'update') {
            ordersUpdate($pdo);
        } else if ($action === 'delete') {
            ordersDelete($pdo);
        } else {
            jsonResponse(['success' => false, 'message' => 'Neznámá akce.'], 400);
        }
    } else if ($method === 'PUT' || $method === 'DELETE') {
        // kompatibilní REST: PUT/DELETE také chráníme
        requireCsrfToken();
        if ($method === 'PUT') {
            ordersUpdate($pdo);
        } else {
            ordersDelete($pdo);
        }
    } else {
        jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
    }
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Neočekávaná chyba v API zakázek: ' . $e->getMessage(),
    ], 500);
}

/**
 * GET ?action=list
 * Vrací {items:[...]} pro frontend.
 */


/**
 * Pomocné funkce pro kompatibilitu DB (starší instalace mohou mít starší strukturu tabulky).
 */
function tableExists(PDO $db, string $table): bool {
    $stmt = $db->prepare("SHOW TABLES LIKE :t");
    $stmt->execute([':t' => $table]);
    return (bool)$stmt->fetchColumn();
}

function columnExists(PDO $db, string $table, string $column): bool {
    if (!tableExists($db, $table)) return false;
    // "SHOW COLUMNS ... LIKE" je v MySQL/MariaDB bezpečné a rychlé
    $stmt = $db->prepare("SHOW COLUMNS FROM `$table` LIKE :c");
    $stmt->execute([':c' => $column]);
    return (bool)$stmt->fetch(PDO::FETCH_ASSOC);
}

/**
 * Zajistí, že tabulka production_orders má všechny očekávané sloupce.
 * Pokud DB nemá práva na ALTER/CREATE, funkce se pokusí pokračovat bez pádu.
 */
function ensureOrdersSchema(PDO $db): void {
    try {
        if (!tableExists($db, 'production_orders')) {
            // Vytvoříme tabulku v "bezpečné" variantě (bez FK), aby modul šel spustit i bez plných migrací.
            $db->exec("
                CREATE TABLE IF NOT EXISTS production_orders (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(10) NULL,
                    customer_id INT UNSIGNED NULL,
                    customer_name VARCHAR(255) NULL,
                    customer VARCHAR(255) NULL,
                    contact VARCHAR(255) NULL,
                    recipe_id INT UNSIGNED NOT NULL,
                    quantity DECIMAL(10,2) NULL,
                    due_date DATE NULL,
                    production_date DATE NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'nova',
                    note TEXT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_production_orders_recipe (recipe_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
            return;
        }

        // Postupně doplníme chybějící sloupce – nepoužíváme "IF NOT EXISTS", aby to fungovalo i na starších verzích.
        if (!columnExists($db, 'production_orders', 'code')) {
            $db->exec("ALTER TABLE production_orders ADD COLUMN code VARCHAR(10) NULL AFTER id");
        }
        if (!columnExists($db, 'production_orders', 'customer_id')) {
            $db->exec("ALTER TABLE production_orders ADD COLUMN customer_id INT UNSIGNED NULL AFTER code");
        }
        if (!columnExists($db, 'production_orders', 'customer_name')) {
            $db->exec("ALTER TABLE production_orders ADD COLUMN customer_name VARCHAR(255) NULL AFTER customer_id");
        }
        if (!columnExists($db, 'production_orders', 'production_date')) {
            // ve staré struktuře je jen due_date – přidáme production_date jako volitelné
            if (columnExists($db, 'production_orders', 'due_date')) {
                $db->exec("ALTER TABLE production_orders ADD COLUMN production_date DATE NULL AFTER due_date");
            } else {
                $db->exec("ALTER TABLE production_orders ADD COLUMN production_date DATE NULL");
            }
        }
    } catch (Throwable $e) {
        // Nechceme shodit modul – jen log do response při debugování by byl rizikový (500).
        // Pokud migrace selže (práva), API bude fungovat podle reálně dostupných sloupců.
    }
}

/**
 * GET ?action=list
 * Vrací {items:[...]} pro frontend.
 */
function ordersList(PDO $db): void {
    ensureOrdersSchema($db);

    $hasCustomers = tableExists($db, 'customers_customers') && columnExists($db, 'production_orders', 'customer_id');
    $customerJoin = $hasCustomers ? "LEFT JOIN customers_customers c ON c.id = o.customer_id" : "";
    $customerDisplayExpr = $hasCustomers
        ? "COALESCE(c.name, o.customer_name, o.customer)"
        : "COALESCE(o.customer_name, o.customer)";

    $sql = "
        SELECT 
            o.id,
            o.code,
            o.customer_id,
            o.customer_name,
            o.customer,
            o.contact,
            o.recipe_id,
            o.quantity,
            o.due_date,
            o.production_date,
            o.status,
            o.note,
            o.created_at,
            r.name AS recipe_name,
            {$customerDisplayExpr} AS customer_display
        FROM production_orders o
        LEFT JOIN production_recipes r ON r.id = o.recipe_id
        {$customerJoin}
        ORDER BY o.id DESC
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // normalizace názvů pro JS
    $items = array_map(function($row) {
        return [
            'id' => (int)$row['id'],
            'code' => $row['code'],
            'customerId' => $row['customer_id'] !== null ? (int)$row['customer_id'] : null,
            'customer' => $row['customer_display'],
            'contact' => $row['contact'],
            'recipeId' => $row['recipe_id'] !== null ? (int)$row['recipe_id'] : null,
            'recipeName' => $row['recipe_name'],
            // FE očekává i "quantity" – posíláme jako quantityKg a necháme FE sjednotit
            'quantityKg' => $row['quantity'] !== null ? (float)$row['quantity'] : null,
            'dueDate' => $row['due_date'],
            'productionDate' => $row['production_date'],
            'status' => $row['status'],
            'note' => $row['note'],
            'createdAt' => $row['created_at'],
        ];
    }, $rows);

    jsonResponse(['success' => true, 'items' => $items]);
}

/**
 * GET ?action=get&id=123
 */
/**
 * GET ?action=get&id=123
 */
function ordersGet(PDO $db): void {
    ensureOrdersSchema($db);

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$id) jsonResponse(['success' => false, 'message' => 'Chybí id.'], 400);

    $hasCustomers = tableExists($db, 'customers_customers') && columnExists($db, 'production_orders', 'customer_id');
    $customerJoin = $hasCustomers ? "LEFT JOIN customers_customers c ON c.id = o.customer_id" : "";
    $customerDisplayExpr = $hasCustomers
        ? "COALESCE(c.name, o.customer_name, o.customer)"
        : "COALESCE(o.customer_name, o.customer)";

    $sql = "
        SELECT 
            o.id,
            o.code,
            o.customer_id,
            o.customer_name,
            o.customer,
            o.contact,
            o.recipe_id,
            o.quantity,
            o.due_date,
            o.production_date,
            o.status,
            o.note,
            o.created_at,
            r.name AS recipe_name,
            {$customerDisplayExpr} AS customer_display
        FROM production_orders o
        LEFT JOIN production_recipes r ON r.id = o.recipe_id
        {$customerJoin}
        WHERE o.id = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) jsonResponse(['success' => false, 'message' => 'Zakázka nenalezena.'], 404);

    $item = [
        'id' => (int)$row['id'],
        'code' => $row['code'],
        'customerId' => $row['customer_id'] !== null ? (int)$row['customer_id'] : null,
        'customer' => $row['customer_display'],
        'contact' => $row['contact'],
        'recipeId' => $row['recipe_id'] !== null ? (int)$row['recipe_id'] : null,
        'recipeName' => $row['recipe_name'],
        'quantityKg' => $row['quantity'] !== null ? (float)$row['quantity'] : null,
        'dueDate' => $row['due_date'],
        'productionDate' => $row['production_date'],
        'status' => $row['status'],
        'note' => $row['note'],
        'createdAt' => $row['created_at'],
    ];

    jsonResponse(['success' => true, 'item' => $item]);
}

/**
 * POST ?action=create
 * Body JSON: {customerId?, customer?, contact?, recipeId, quantityKg?, dueDate?, productionDate?, status?, note?, code?}
 */
function ordersCreate(PDO $db): void {
    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (!is_array($body)) $body = [];

    $recipeId = isset($body['recipeId']) ? (int)$body['recipeId'] : 0;
    if ($recipeId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Chybí recipeId.'], 400);
    }

    $customerId = isset($body['customerId']) && $body['customerId'] !== '' ? (int)$body['customerId'] : null;
    $customer   = trim((string)($body['customer'] ?? ''));
    $contact    = trim((string)($body['contact'] ?? ''));
    $note       = (string)($body['note'] ?? '');
    $status     = trim((string)($body['status'] ?? 'nova'));

    $quantityKg = null;
    if (isset($body['quantityKg']) && $body['quantityKg'] !== '' && $body['quantityKg'] !== null) {
        $quantityKg = (float)$body['quantityKg'];
    }

    $dueDate = null;
    if (!empty($body['dueDate'])) $dueDate = (string)$body['dueDate'];
    $productionDate = null;
    if (!empty($body['productionDate'])) $productionDate = (string)$body['productionDate'];

    $code = trim((string)($body['code'] ?? ''));
    if ($code === '') {
        $code = generateOrderCode($db, $dueDate);
    }

    $stmt = $db->prepare("
        INSERT INTO production_orders
            (code, customer_id, customer_name, customer, contact, recipe_id, quantity, due_date, production_date, status, note)
        VALUES
            (:code, :customer_id, :customer_name, :customer, :contact, :recipe_id, :quantity, :due_date, :production_date, :status, :note)
    ");

    // customer_name: pokud máme ID, necháme null a řešíme JOINem; pokud nemáme ID, uložíme jméno do customer_name/customer
    $customerName = $customerId ? null : ($customer !== '' ? $customer : null);

    $stmt->execute([
        ':code' => $code,
        ':customer_id' => $customerId,
        ':customer_name' => $customerName,
        ':customer' => ($customer !== '' ? $customer : ($customerName !== null ? $customerName : '')),
        ':contact' => $contact !== '' ? $contact : null,
        ':recipe_id' => $recipeId,
        ':quantity' => $quantityKg,
        ':due_date' => $dueDate,
        ':production_date' => $productionDate,
        ':status' => $status !== '' ? $status : 'nova',
        ':note' => $note !== '' ? $note : null,
    ]);

    jsonResponse(['success' => true, 'id' => (int)$db->lastInsertId(), 'code' => $code]);
}

/**
 * POST ?action=update nebo PUT
 * Body JSON: {id, ... stejné jako create ...}
 */
function ordersUpdate(PDO $db): void {
    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (!is_array($body)) $body = [];

    $id = isset($body['id']) ? (int)$body['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Chybí id.'], 400);
    }

    $recipeId = isset($body['recipeId']) ? (int)$body['recipeId'] : null;
    $customerId = array_key_exists('customerId', $body) && $body['customerId'] !== '' && $body['customerId'] !== null
        ? (int)$body['customerId']
        : null;

    $customer = array_key_exists('customer', $body) ? trim((string)$body['customer']) : null;
    $contact  = array_key_exists('contact', $body) ? trim((string)$body['contact']) : null;
    $note     = array_key_exists('note', $body) ? (string)$body['note'] : null;
    $status   = array_key_exists('status', $body) ? trim((string)$body['status']) : null;

    $quantityKg = null;
    $quantityProvided = array_key_exists('quantityKg', $body);
    if ($quantityProvided) {
        $quantityKg = ($body['quantityKg'] === '' || $body['quantityKg'] === null) ? null : (float)$body['quantityKg'];
    }

    $dueDate = array_key_exists('dueDate', $body) ? ($body['dueDate'] ?: null) : null;
    $productionDate = array_key_exists('productionDate', $body) ? ($body['productionDate'] ?: null) : null;

    // načteme současný záznam pro merge
    $stmt0 = $db->prepare("SELECT * FROM production_orders WHERE id = :id LIMIT 1");
    $stmt0->execute([':id' => $id]);
    $cur = $stmt0->fetch(PDO::FETCH_ASSOC);
    if (!$cur) {
        jsonResponse(['success' => false, 'message' => 'Zakázka nenalezena.'], 404);
    }

    $next = [
        'code' => $cur['code'],
        'customer_id' => $cur['customer_id'],
        'customer_name' => $cur['customer_name'],
        'customer' => $cur['customer'],
        'contact' => $cur['contact'],
        'recipe_id' => $cur['recipe_id'],
        'quantity' => $cur['quantity'],
        'due_date' => $cur['due_date'],
        'production_date' => $cur['production_date'],
        'status' => $cur['status'],
        'note' => $cur['note'],
    ];

    if ($recipeId !== null && $recipeId > 0) $next['recipe_id'] = $recipeId;
    if (array_key_exists('customerId', $body)) {
        $next['customer_id'] = $customerId;
        // pokud máme ID, jméno necháme null; jinak uložíme do customer_name
        $next['customer_name'] = $customerId ? null : ($customer !== null && $customer !== '' ? $customer : null);
    }
    if ($customer !== null) $next['customer'] = ($customer !== '' ? $customer : null);
    if ($contact !== null) $next['contact'] = ($contact !== '' ? $contact : null);
    if ($note !== null) $next['note'] = ($note !== '' ? $note : null);
    if ($status !== null) $next['status'] = ($status !== '' ? $status : 'nova');
    if ($quantityProvided) $next['quantity'] = $quantityKg;
    if (array_key_exists('dueDate', $body)) $next['due_date'] = $dueDate;
    if (array_key_exists('productionDate', $body)) $next['production_date'] = $productionDate;

    $stmt = $db->prepare("
        UPDATE production_orders SET
            code = :code,
            customer_id = :customer_id,
            customer_name = :customer_name,
            customer = :customer,
            contact = :contact,
            recipe_id = :recipe_id,
            quantity = :quantity,
            due_date = :due_date,
            production_date = :production_date,
            status = :status,
            note = :note
        WHERE id = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $id,
        ':code' => $next['code'],
        ':customer_id' => $next['customer_id'],
        ':customer_name' => $next['customer_name'],
        ':customer' => $next['customer'],
        ':contact' => $next['contact'],
        ':recipe_id' => $next['recipe_id'],
        ':quantity' => $next['quantity'],
        ':due_date' => $next['due_date'],
        ':production_date' => $next['production_date'],
        ':status' => $next['status'],
        ':note' => $next['note'],
    ]);

    jsonResponse(['success' => true]);
}

/**
 * POST ?action=delete nebo DELETE
 * Body JSON: {id} nebo ?id=
 */
function ordersDelete(PDO $db): void {
    $id = 0;
    if (isset($_GET['id'])) $id = (int)$_GET['id'];

    if ($id <= 0) {
        $body = json_decode(file_get_contents('php://input') ?: '[]', true);
        if (is_array($body) && isset($body['id'])) $id = (int)$body['id'];
    }

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Chybí id.'], 400);
    }

    $stmt = $db->prepare("DELETE FROM production_orders WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);

    jsonResponse(['success' => true]);
}

/**
 * Zyy#### – sekvence v rámci roku dle due_date (nebo aktuálního data)
 */
function generateOrderCode(PDO $db, ?string $dueDate): string {
    $year = null;
    if ($dueDate) {
        $ts = strtotime($dueDate);
        if ($ts !== false) $year = (int)date('Y', $ts);
    }
    if (!$year) $year = (int)date('Y');

    $yy = substr((string)$year, -2);
    $prefix = 'Z' . $yy;

    $stmt = $db->prepare("SELECT MAX(code) AS max_code FROM production_orders WHERE code LIKE :pfx");
    $stmt->execute([':pfx' => $prefix . '%']);
    $max = $stmt->fetch(PDO::FETCH_ASSOC);
    $maxCode = $max && !empty($max['max_code']) ? (string)$max['max_code'] : '';

    $seq = 0;
    if ($maxCode !== '') {
        // očekáváme Zyy#### => poslední 4 znaky
        $tail = substr($maxCode, -4);
        if (ctype_digit($tail)) $seq = (int)$tail;
    }
    $seq++;

    return $prefix . str_pad((string)$seq, 4, '0', STR_PAD_LEFT);
}
