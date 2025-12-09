<?php
session_start();

// nacteni spolecnych funkcí a DB připojení
require_once __DIR__ . '/../../../config/common.php';
require_once __DIR__ . '/../../../config/db_connect.php';

// VŠECHEN výstup přes jsonResponse, nic jiného neecho-vat
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$role   = isset($_SESSION['role']) ? $_SESSION['role'] : 'guest';

try {
    ensureLoggedIn();

    $pdo = getDbConnection();

    switch ($method) {
        case 'GET':
            crmMaterialsHandleGet($pdo);
            break;

        case 'POST':
            if (!in_array($role, array('admin', 'super-admin'), true)) {
                jsonResponse(array(
                    'success' => false,
                    'message' => 'Nedostatecna opravneni.',
                ), 403);
            }
            requireCsrfToken();
            crmMaterialsHandlePost($pdo);
            break;

        case 'DELETE':
            if (!in_array($role, array('admin', 'super-admin'), true)) {
                jsonResponse(array(
                    'success' => false,
                    'message' => 'Nedostatecna opravneni.',
                ), 403);
            }
            requireCsrfToken();
            crmMaterialsHandleDelete($pdo);
            break;

        default:
            jsonResponse(array(
                'success' => false,
                'message' => 'Nepodporovana HTTP metoda.',
            ), 405);
    }
} catch (Exception $e) {
    // fallback – kdyby se cokoli pokazilo nad úrovní handlerů
    jsonResponse(array(
        'success' => false,
        'message' => 'Neocekavana chyba v API surovin: ' . $e->getMessage(),
    ), 500);
}

/**
 * GET /modules/crm/api/materials.php
 * GET /modules/crm/api/materials.php?id=123
 */
function crmMaterialsHandleGet($pdo)
{
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

    if ($id > 0) {
        $sql = 'SELECT id, code, name, supplier, price, density, solids, okp, oil, voc, safety, note, created_at
                FROM crm_materials
                WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(':id' => $id));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            jsonResponse(array(
                'success' => false,
                'message' => 'Surovina nebyla nalezena.',
            ), 404);
        }

        jsonResponse(array(
            'success'  => true,
            'material' => crmMaterialsMapRow($row),
        ));
    }

    $sql = 'SELECT id, code, name, supplier, price, density, solids, okp, oil, voc, safety, note, created_at
            FROM crm_materials
            ORDER BY name';
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $materials = array();
    foreach ($rows as $row) {
        $materials[] = crmMaterialsMapRow($row);
    }

    jsonResponse(array(
        'success'   => true,
        'materials' => $materials,
    ));
}

/**
 * POST /modules/crm/api/materials.php
 * JSON body – insert/update podle existence "id"
 */
function crmMaterialsHandlePost($pdo)
{
    $dataRaw = file_get_contents('php://input');
    $data    = json_decode($dataRaw, true);
    if (!is_array($data)) {
        $data = array();
    }

    $id       = isset($data['id']) ? (int) $data['id'] : 0;
    $code     = isset($data['code']) ? trim((string) $data['code']) : '';
    $name     = isset($data['name']) ? trim((string) $data['name']) : '';
    $supplier = isset($data['supplier']) ? trim((string) $data['supplier']) : '';

    $price   = (isset($data['price']) && $data['price'] !== '') ? (float) $data['price'] : null;
    $density = (isset($data['density']) && $data['density'] !== '') ? (float) $data['density'] : null;
    $solids  = (isset($data['solids']) && $data['solids'] !== '') ? (float) $data['solids'] : null;
    $okp     = isset($data['okp']) ? trim((string) $data['okp']) : '';
    $oil     = isset($data['oil']) ? trim((string) $data['oil']) : '';
    $voc     = (isset($data['voc']) && $data['voc'] !== '') ? (float) $data['voc'] : null;
    $safety  = isset($data['safety']) ? trim((string) $data['safety']) : '';
    $note    = isset($data['note']) ? trim((string) $data['note']) : '';

    if ($code === '' || $name === '') {
        jsonResponse(array(
            'success' => false,
            'message' => 'Kod i nazev suroviny jsou povinne.',
        ), 400);
    }

    if ($id > 0) {
        $sql = 'UPDATE crm_materials
                SET code = :code,
                    name = :name,
                    supplier = :supplier,
                    price = :price,
                    density = :density,
                    solids = :solids,
                    okp = :okp,
                    oil = :oil,
                    voc = :voc,
                    safety = :safety,
                    note = :note
                WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(
            ':code'     => $code,
            ':name'     => $name,
            ':supplier' => $supplier,
            ':price'    => $price,
            ':density'  => $density,
            ':solids'   => $solids,
            ':okp'      => $okp,
            ':oil'      => $oil,
            ':voc'      => $voc,
            ':safety'   => $safety,
            ':note'     => $note,
            ':id'       => $id,
        ));
    } else {
        $sql = 'INSERT INTO crm_materials
                    (code, name, supplier, price, density, solids, okp, oil, voc, safety, note, created_at)
                VALUES
                    (:code, :name, :supplier, :price, :density, :solids, :okp, :oil, :voc, :safety, :note, NOW())';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(
            ':code'     => $code,
            ':name'     => $name,
            ':supplier' => $supplier,
            ':price'    => $price,
            ':density'  => $density,
            ':solids'   => $solids,
            ':okp'      => $okp,
            ':oil'      => $oil,
            ':voc'      => $voc,
            ':safety'   => $safety,
            ':note'     => $note,
        ));
        $id = (int) $pdo->lastInsertId();
    }

    jsonResponse(array(
        'success' => true,
        'id'      => $id,
    ));
}

/**
 * DELETE /modules/crm/api/materials.php?id=123
 */
function crmMaterialsHandleDelete($pdo)
{
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        jsonResponse(array(
            'success' => false,
            'message' => 'Neplatne ID suroviny.',
        ), 400);
    }

    $stmt = $pdo->prepare('DELETE FROM crm_materials WHERE id = :id');
    $stmt->execute(array(':id' => $id));

    jsonResponse(array(
        'success' => true,
    ));
}

/**
 * Mapovani radku z DB na JSON strukturu
 */
function crmMaterialsMapRow($row)
{
    return array(
        'id'        => isset($row['id']) ? (int) $row['id'] : 0,
        'code'      => isset($row['code']) ? (string) $row['code'] : '',
        'name'      => isset($row['name']) ? (string) $row['name'] : '',
        'supplier'  => isset($row['supplier']) ? (string) $row['supplier'] : '',
        'price'     => (isset($row['price']) && $row['price'] !== null) ? (float) $row['price'] : null,
        'density'   => (isset($row['density']) && $row['density'] !== null) ? (float) $row['density'] : null,
        'solids'    => (isset($row['solids']) && $row['solids'] !== null) ? (float) $row['solids'] : null,
        'okp'       => isset($row['okp']) ? (string) $row['okp'] : '',
        'oil'       => isset($row['oil']) ? (string) $row['oil'] : '',
        'voc'       => (isset($row['voc']) && $row['voc'] !== null) ? (float) $row['voc'] : null,
        'safety'    => isset($row['safety']) ? (string) $row['safety'] : '',
        'note'      => isset($row['note']) ? (string) $row['note'] : '',
        'createdAt' => isset($row['created_at']) ? (string) $row['created_at'] : '',
    );
}

