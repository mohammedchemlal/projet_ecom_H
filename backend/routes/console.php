<?php

use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('orders:repair-items {--dry-run : Show changes without writing to database}', function () {
    $dryRun = (bool) $this->option('dry-run');

    $orders = Order::query()->select(['id', 'items'])->get();

    if ($orders->isEmpty()) {
        $this->info('No orders found.');

        return;
    }

    $productIds = $orders
        ->flatMap(function (Order $order): array {
            $items = is_array($order->items) ? $order->items : [];

            return collect($items)
                ->map(fn (array $item): int => (int) ($item['product_id'] ?? 0))
                ->filter(fn (int $id): bool => $id > 0)
                ->values()
                ->all();
        })
        ->unique()
        ->values();

    $productsById = Product::query()
        ->whereIn('id', $productIds)
        ->get()
        ->keyBy('id');

    $scannedOrders = 0;
    $updatedOrders = 0;
    $unchangedOrders = 0;
    $missingProducts = 0;

    foreach ($orders as $order) {
        $scannedOrders++;

        $items = is_array($order->items) ? $order->items : [];

        if ($items === []) {
            $unchangedOrders++;
            continue;
        }

        $repairedItems = array_map(function (array $item) use ($productsById, &$missingProducts): array {
            $productId = (int) ($item['product_id'] ?? 0);
            /** @var Product|null $product */
            $product = $productsById->get($productId);
            $fallback = is_array($item['product'] ?? null) ? $item['product'] : [];

            if ($product === null) {
                $missingProducts++;

                return [
                    'product_id' => $productId,
                    'quantity' => (int) ($item['quantity'] ?? 1),
                    'product' => [
                        'id' => $productId,
                        'name' => (string) ($fallback['name'] ?? ('Produit #'.$productId)),
                        'description' => $fallback['description'] ?? null,
                        'price' => (float) ($fallback['price'] ?? 0),
                        'discount_price' => array_key_exists('discount_price', $fallback) ? $fallback['discount_price'] : null,
                        'image' => $fallback['image'] ?? null,
                        'images' => $fallback['images'] ?? [],
                        'category' => (string) ($fallback['category'] ?? 'general'),
                        'rating' => (float) ($fallback['rating'] ?? 0),
                        'review_count' => (int) ($fallback['review_count'] ?? 0),
                        'stock' => (int) ($fallback['stock'] ?? 0),
                        'is_active' => (bool) ($fallback['is_active'] ?? true),
                        'is_promotion' => (bool) ($fallback['is_promotion'] ?? false),
                        'promotion_percentage' => $fallback['promotion_percentage'] ?? null,
                        'created_at' => (string) ($fallback['created_at'] ?? now()->toISOString()),
                    ],
                ];
            }

            return [
                'product_id' => $productId,
                'quantity' => (int) ($item['quantity'] ?? 1),
                'product' => [
                    'id' => $productId,
                    'name' => $product->name,
                    'description' => $product->description,
                    'price' => (float) $product->price,
                    'discount_price' => $product->discount_price,
                    'image' => $product->image,
                    'images' => $product->images ?? [],
                    'category' => $product->category,
                    'rating' => (float) $product->rating,
                    'review_count' => (int) $product->review_count,
                    'stock' => (int) $product->stock,
                    'is_active' => (bool) $product->is_active,
                    'is_promotion' => (bool) $product->is_promotion,
                    'promotion_percentage' => $product->promotion_percentage,
                    'created_at' => $product->created_at?->toISOString() ?? now()->toISOString(),
                ],
            ];
        }, $items);

        if ($repairedItems === $items) {
            $unchangedOrders++;
            continue;
        }

        $updatedOrders++;

        if (!$dryRun) {
            $order->update(['items' => $repairedItems]);
        }
    }

    $mode = $dryRun ? 'DRY RUN' : 'EXECUTED';
    $this->newLine();
    $this->info("orders:repair-items {$mode}");
    $this->line("Scanned orders: {$scannedOrders}");
    $this->line("Updated orders: {$updatedOrders}");
    $this->line("Unchanged orders: {$unchangedOrders}");
    $this->line("Items with missing product rows: {$missingProducts}");
})->purpose('Repair order items snapshots with current product data');
