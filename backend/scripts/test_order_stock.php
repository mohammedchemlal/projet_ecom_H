<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\OrderController;

echo "Starting stock-decrement test\n";

try {
    // Find or create a user
    $user = User::first();
    if (! $user) {
        $user = User::create([
            'name' => 'Test User',
            'email' => 'test+local@example.com',
            'password' => bcrypt('password'),
        ]);
        echo "Created user id {$user->id}\n";
    } else {
        echo "Using user id {$user->id}\n";
    }

    // Create a test product
    $product = Product::create([
        'name' => 'Test Product',
        'description' => 'Auto-generated test product',
        'price' => 9.99,
        'stock' => 5,
        'category' => 'tests',
        'is_active' => true,
    ]);

    echo "Created product id {$product->id} with stock {$product->stock}\n";

    $items = [ ['product_id' => $product->id, 'quantity' => 2] ];
    $requestData = [
        'user_id' => $user->id,
        'items' => $items,
        'total' => 2 * 9.99,
        'address' => 'Test Address',
        'phone' => '0000000000',
    ];

    $request = Request::create('/api/orders', 'POST', $requestData);
    $request->setUserResolver(function() use ($user) { return $user; });

    $controller = new OrderController();

    $response = $controller->store($request);

    $status = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : 'unknown';
    echo "OrderController response status: {$status}\n";

    $product->refresh();
    echo "Product stock after order: {$product->stock}\n";

    echo "TEST_COMPLETE\n";
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
