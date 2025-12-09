<?php
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/app_utils.php';

try {
    $definition = loadAppDefinition();

    // Do prohlížeče neposíláme hash hesla super administrátora
    if (isset($definition['superAdmin']['passwordHash'])) {
        unset($definition['superAdmin']['passwordHash']);
    }

    jsonResponse($definition);
} catch (Throwable $e) {
    jsonResponse(
        [
            'success' => false,
            'message' => 'Načtení konfigurace aplikace selhalo.',
        ],
        500
    );
}
