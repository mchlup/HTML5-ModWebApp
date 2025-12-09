<?php
session_start();

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$role   = $_SESSION['role'] ?? 'guest';

if ($method !== 'POST') {
    jsonResponse([
        'success' => false,
        'message' => 'Metoda neni podporovana. Pouzijte POST.',
    ], 405);
}

ensureLoggedIn();

// Super-admin muze volat bez CSRF, ostatni musi mit platny token
$allowSuperAdminWithoutCsrf = true;
if (!($allowSuperAdminWithoutCsrf && $role === 'super-admin')) {
    requireCsrfToken();
}

$action   = $_GET['action'] ?? ($_POST['action'] ?? 'install');
$payload  = json_decode(file_get_contents('php://input'), true) ?? [];
$moduleId = isset($payload['moduleId']) ? (string) $payload['moduleId'] : '';

if ($moduleId === '') {
    jsonResponse([
        'success' => false,
        'message' => 'Chybi identifikator modulu.',
    ], 400);
}

if ($action !== 'install') {
    jsonResponse([
        'success' => false,
        'message' => 'Neznama akce.',
    ], 400);
}

try {
    $pdo = getDbConnection();
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Databazove pripojeni neni k dispozici: ' . $e->getMessage(),
    ], 500);
}

// root aplikace (nad /config)
$baseDir    = dirname(__DIR__);
$moduleSafe = basename($moduleId);
$schemaPath = $baseDir . '/modules/' . $moduleSafe . '/schema.sql';

if (!is_file($schemaPath)) {
    jsonResponse([
        'success' => false,
        'message' => 'Soubor se schematem pro modul nebyl nalezen.',
    ], 404);
}

$sql = file_get_contents($schemaPath);
if ($sql === false || trim($sql) === '') {
    jsonResponse([
        'success' => false,
        'message' => 'Soubor se schematem je prazdny nebo se jej nepodarilo nacist.',
    ], 500);
}

try {
    $pdo->beginTransaction();
    executeSqlBatch($pdo, $sql);
    $pdo->commit();

    jsonResponse([
        'success'  => true,
        'message'  => 'Databazove schema modulu bylo uspesne vytvoreno.',
        'moduleId' => $moduleId,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse([
        'success' => false,
        'message' => 'Vytvareni databazoveho schematu selhalo: ' . $e->getMessage(),
    ], 500);
}

/**
 * Rozdeli a spusti jednotlive SQL prikazy ze schema.sql.
 *
 * @param PDO    $pdo
 * @param string $sql
 * @return void
 */
function executeSqlBatch(PDO $pdo, string $sql): void
{
    // Odstraneni radkovych komentaru typu --
    $sql = preg_replace('/^\\s*--.*$/m', '', $sql);
    if ($sql === null) {
        $sql = '';
    }

    // Odstraneni blokovych komentaru /* ... */
    $sql = preg_replace('!/\\*.*?\\*/!s', '', $sql);
    if ($sql === null) {
        $sql = '';
    }

    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        static function ($stmt) {
            return $stmt !== '';
        }
    );

    foreach ($statements as $statement) {
        $pdo->exec($statement);
    }
}

