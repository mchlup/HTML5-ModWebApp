<?php
session_start();

// společné funkce a DB připojení
require_once __DIR__ . '/../../../config/common.php';
require_once __DIR__ . '/../../../config/db_connect.php';

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$role   = isset($_SESSION['role']) ? $_SESSION['role'] : 'guest';

try {
    ensureLoggedIn();
    $pdo = getDbConnection();

    switch ($method) {
        case 'GET':
            productionRecipesHandleGet($pdo);
            break;

        case 'POST':
            if (!in_array($role, array('admin', 'super-admin'), true)) {
                jsonResponse(array(
                    'success' => false,
                    'message' => 'Nedostatecna opravneni.',
                ), 403);
            }
            requireCsrfToken();
            productionRecipesHandlePost($pdo);
            break;

        case 'DELETE':
            if (!in_array($role, array('admin', 'super-admin'), true)) {
                jsonResponse(array(
                    'success' => false,
                    'message' => 'Nedostatecna opravneni.',
                ), 403);
            }
            requireCsrfToken();
            productionRecipesHandleDelete($pdo);
            break;

        default:
            jsonResponse(array(
                'success' => false,
                'message' => 'Nepodporovana HTTP metoda.',
            ), 405);
    }
} catch (Exception $e) {
    jsonResponse(array(
        'success' => false,
        'message' => 'Neocekavana chyba pri zpracovani pozadavku.',
        'debug'   => $e->getMessage(),
    ), 500);
}

/**
 * GET handler – seznam receptur nebo detail vybrane receptury.
 *
 * Parametry:
 *   GET id          – pokud je >0, vrati detail vcetne slozeni
 *   GET action=list – vrati seznam receptur
 */
function productionRecipesHandleGet(PDO $pdo)
{
    $id     = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    $action = isset($_GET['action']) ? (string) $_GET['action'] : 'list';

    if ($id > 0) {
        $sql = 'SELECT id, name, shade, gloss, batch_size, note, created_at
                FROM production_recipes
                WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(':id' => $id));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            jsonResponse(array(
                'success' => false,
                'message' => 'Receptura nebyla nalezena.',
            ), 404);
        }

        $recipe = productionRecipesMapRow($row);

        $compSql = 'SELECT component_type, component_id, amount
                    FROM production_recipe_components
                    WHERE recipe_id = :id
                    ORDER BY id ASC';
        $compStmt = $pdo->prepare($compSql);
        $compStmt->execute(array(':id' => $id));
        $components = array();
        while ($cRow = $compStmt->fetch(PDO::FETCH_ASSOC)) {
            $components[] = array(
                'componentType' => isset($cRow['component_type']) ? (string) $cRow['component_type'] : null,
                'componentId'   => isset($cRow['component_id']) ? (int) $cRow['component_id'] : null,
                'amount'        => (isset($cRow['amount']) && $cRow['amount'] !== null) ? (float) $cRow['amount'] : 0.0,
            );
        }
        $recipe['composition'] = $components;
        $recipe['componentsCount'] = count($components);

        jsonResponse(array(
            'success' => true,
            'item'    => $recipe,
        ));
    }

    // seznam receptur
    $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';

    $params     = array();
    $whereParts = array();

    if ($search !== '') {
        $whereParts[] = '(name LIKE :q OR shade LIKE :q OR gloss LIKE :q OR note LIKE :q)';
        $params[':q'] = '%' . $search . '%';
    }

    $whereSql = $whereParts ? ('WHERE ' . implode(' AND ', $whereParts)) : '';

    $sql = 'SELECT r.id,
                   r.name,
                   r.shade,
                   r.gloss,
                   r.batch_size,
                   r.note,
                   r.created_at,
                   COUNT(c.id) AS components_count
            FROM production_recipes r
            LEFT JOIN production_recipe_components c ON c.recipe_id = r.id
            ' . $whereSql . '
            GROUP BY r.id, r.name, r.shade, r.gloss, r.batch_size, r.note, r.created_at
            ORDER BY r.name ASC';
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val, PDO::PARAM_STR);
    }
    $stmt->execute();

    $items = array();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $item = productionRecipesMapRow($row);
        $item['componentsCount'] = isset($row['components_count']) ? (int) $row['components_count'] : 0;
        $items[] = $item;
    }

    jsonResponse(array(
        'success' => true,
        'items'   => $items,
        'total'   => count($items),
    ));
}

/**
 * POST handler – vytvoření / aktualizace receptury včetně složení.
 *
 * Payload (JSON):
 *   {
 *     "id": 123 | null,
 *     "name": "...",
 *     "shade": "...",
 *     "gloss": "...",
 *     "batchSize": 100.0,
 *     "note": "...",
 *     "composition": [
 *       {"componentType": "material", "componentId": 1, "amount": 50.0},
 *       ...
 *     ]
 *   }
 */
function productionRecipesHandlePost(PDO $pdo)
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = array();
    }

    $id        = isset($data['id']) ? (int) $data['id'] : 0;
    $name      = isset($data['name']) ? trim((string) $data['name']) : '';
    $shade     = isset($data['shade']) ? trim((string) $data['shade']) : null;
    $gloss     = isset($data['gloss']) ? trim((string) $data['gloss']) : null;
    $batchSize = (isset($data['batchSize']) && $data['batchSize'] !== '') ? (float) $data['batchSize'] : null;
    $note      = isset($data['note']) ? trim((string) $data['note']) : null;

    $composition = isset($data['composition']) && is_array($data['composition'])
        ? $data['composition']
        : array();

    if ($name === '') {
        jsonResponse(array(
            'success' => false,
            'message' => 'Název receptury je povinný.',
        ), 400);
    }

    $validComponents = array();
    foreach ($composition as $idx => $c) {
        if (!is_array($c)) {
            continue;
        }
        $componentType = isset($c['componentType']) ? (string) $c['componentType'] : '';
        $componentId   = isset($c['componentId']) ? (int) $c['componentId'] : 0;
        $amount        = (isset($c['amount']) && $c['amount'] !== '') ? (float) $c['amount'] : 0.0;

        if (!in_array($componentType, array('material', 'intermediate'), true)) {
            continue;
        }
        if ($componentId <= 0 || $amount <= 0) {
            continue;
        }

        $validComponents[] = array(
            'component_type' => $componentType,
            'component_id'   => $componentId,
            'amount'         => $amount,
        );
    }

    if (!$validComponents) {
        jsonResponse(array(
            'success' => false,
            'message' => 'Je potřeba zadat alespoň jednu surovinu / komponentu.',
        ), 400);
    }

    $pdo->beginTransaction();
    try {
        if ($id > 0) {
            // update
            $sql = 'UPDATE production_recipes
                    SET name = :name,
                        shade = :shade,
                        gloss = :gloss,
                        batch_size = :batch_size,
                        note = :note
                    WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array(
                ':name'       => $name,
                ':shade'      => $shade,
                ':gloss'      => $gloss,
                ':batch_size' => $batchSize,
                ':note'       => $note,
                ':id'         => $id,
            ));

            $recipeId = $id;

            $delSql = 'DELETE FROM production_recipe_components WHERE recipe_id = :id';
            $delStmt = $pdo->prepare($delSql);
            $delStmt->execute(array(':id' => $recipeId));
        } else {
            // insert
            $sql = 'INSERT INTO production_recipes
                        (name, shade, gloss, batch_size, note, created_at)
                    VALUES
                        (:name, :shade, :gloss, :batch_size, :note, NOW())';
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array(
                ':name'       => $name,
                ':shade'      => $shade,
                ':gloss'      => $gloss,
                ':batch_size' => $batchSize,
                ':note'       => $note,
            ));

            $recipeId = (int) $pdo->lastInsertId();
        }

        // vložit složení
        $compSql = 'INSERT INTO production_recipe_components
                        (recipe_id, component_type, component_id, amount)
                    VALUES
                        (:recipe_id, :component_type, :component_id, :amount)';
        $compStmt = $pdo->prepare($compSql);
        foreach ($validComponents as $c) {
            $compStmt->execute(array(
                ':recipe_id'      => $recipeId,
                ':component_type' => $c['component_type'],
                ':component_id'   => $c['component_id'],
                ':amount'         => $c['amount'],
            ));
        }

        $pdo->commit();

        $sql = 'SELECT id, name, shade, gloss, batch_size, note, created_at
                FROM production_recipes
                WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array(':id' => $recipeId));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $item = productionRecipesMapRow($row);
        $item['componentsCount'] = count($validComponents);

        jsonResponse(array(
            'success' => true,
            'item'    => $item,
        ));
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(array(
            'success' => false,
            'message' => 'Uložení receptury se nezdařilo.',
            'debug'   => $e->getMessage(),
        ), 500);
    }
}

/**
 * DELETE handler – odstranění receptury
 */
function productionRecipesHandleDelete(PDO $pdo)
{
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        jsonResponse(array(
            'success' => false,
            'message' => 'Neplatné ID receptury.',
        ), 400);
    }

    // zkontrolovat, zda není receptura použita v zakázkách
    $sql = 'SELECT COUNT(*) FROM production_orders WHERE recipe_id = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array(':id' => $id));
    $usedCount = (int) $stmt->fetchColumn();
    if ($usedCount > 0) {
        jsonResponse(array(
            'success' => false,
            'message' => 'Recepturu nelze smazat, protože je použita v zakázkách.',
        ), 409);
    }

    $delSql = 'DELETE FROM production_recipes WHERE id = :id';
    $delStmt = $pdo->prepare($delSql);
    $delStmt->execute(array(':id' => $id));

    jsonResponse(array(
        'success' => true,
        'message' => 'Receptura byla odstraněna.',
    ));
}

/**
 * Mapovani DB radku na objekt pro API
 */
function productionRecipesMapRow(array $row)
{
    return array(
        'id'        => isset($row['id']) ? (int) $row['id'] : 0,
        'name'      => isset($row['name']) ? (string) $row['name'] : '',
        'shade'     => isset($row['shade']) ? (string) $row['shade'] : '',
        'gloss'     => isset($row['gloss']) ? (string) $row['gloss'] : '',
        'batchSize' => (isset($row['batch_size']) && $row['batch_size'] !== null) ? (float) $row['batch_size'] : null,
        'note'      => isset($row['note']) ? (string) $row['note'] : '',
        'createdAt' => isset($row['created_at']) ? (string) $row['created_at'] : '',
    );
}

