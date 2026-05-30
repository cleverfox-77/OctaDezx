<?php
/* supabase_proxy.php - Bypassing cPanel Restrictions */

// 1. CONFIGURATION
$SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

// 2. GET THE PATH & METHOD
// We get the 'path' from the .htaccess rewrite (see Step 2 below)
$path = isset($_GET['__path']) ? $_GET['__path'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// 3. PREPARE THE DESTINATION URL
// We must manually reconstruct the query string (e.g. ?id=eq.123)
$queryString = $_SERVER['QUERY_STRING'];
// Remove the internal '__path' parameter we added in .htaccess
$queryString = preg_replace('/__path=[^&]*&?/', '', $queryString);

$destination = $SUPABASE_URL . '/' . $path . ($queryString ? '?' . $queryString : '');

// 4. INITIALIZE CURL
$ch = curl_init($destination);

// 5. FORWARD HEADERS (Crucial for Auth & API Keys)
$requestHeaders = [];
foreach (getallheaders() as $key => $value) {
    // Only forward necessary headers to avoid conflicts
    if (preg_match('/^(apikey|authorization|content-type|accept|prefer|range)$/i', $key)) {
        $requestHeaders[] = "$key: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $requestHeaders);

// 6. CONFIGURE CURL OPTIONS
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HEADER, true); // We need to read response headers

// Handle Body for POST/UPDATE/etc
if ($method !== 'GET') {
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $input = file_get_contents('php://input');
    if ($input) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
    }
}

// 7. EXECUTE REQUEST
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

// 8. SEPARATE HEADERS & BODY
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

curl_close($ch);

// 9. RETURN RESPONSE TO FRONTEND
http_response_code($httpCode);

// Forward Supabase response headers (like Content-Type, Content-Range)
foreach (explode("\r\n", $responseHeaders) as $headerLine) {
    if (strpos($headerLine, ':') !== false) {
        header($headerLine);
    }
}

echo $responseBody;
?>