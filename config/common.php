<?php
function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function requireCsrfToken(): void {
    $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    if (!$sessionToken || !$headerToken || !hash_equals($sessionToken, $headerToken)) {
        jsonResponse(['success' => false, 'message' => 'Neplatný CSRF token.'], 403);
    }
}

function ensureLoggedIn(): void {
    if (empty($_SESSION['username'])) {
        jsonResponse(['success' => false, 'message' => 'Vyžadováno přihlášení.'], 401);
    }
}
