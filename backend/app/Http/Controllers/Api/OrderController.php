<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401, 'Authentification requise.');

        $query = Order::query()->orderByDesc('created_at');

        $search = trim((string) $request->query('search', ''));
        $status = $request->query('status');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        if ($user->role !== 'admin') {
            $query->where('user_id', $user->id);
        }

        if ($search !== '') {
            $query->where(function ($subQuery) use ($search): void {
                $subQuery->where('id', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if (in_array($status, ['pending', 'confirmed', 'delivered'], true)) {
            $query->where('status', $status);
        }

        if (is_string($dateFrom) && $dateFrom !== '') {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if (is_string($dateTo) && $dateTo !== '') {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        if ($request->has('per_page') || $request->has('page')) {
            $perPage = min(max((int) $request->query('per_page', 10), 1), 100);
            $orders = $query->paginate($perPage);

            return response()->json([
                'data' => collect($orders->items())->map(fn (Order $order): array => $this->transformOrder($order)),
                'meta' => [
                    'current_page' => $orders->currentPage(),
                    'last_page' => $orders->lastPage(),
                    'per_page' => $orders->perPage(),
                    'total' => $orders->total(),
                ],
            ]);
        }

        return response()->json(
            $query->get()->map(fn (Order $order): array => $this->transformOrder($order))->all()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401, 'Authentification requise.');

        $validated = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'total' => ['required', 'numeric', 'min:0'],
            'discount_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'promo_code' => ['sometimes', 'nullable', 'string', 'max:60'],
            'status' => ['sometimes', Rule::in(['pending', 'confirmed', 'delivered'])],
            'address' => ['required', 'string', 'max:2000'],
            'phone' => ['required', 'string', 'max:30'],
        ]);

        $targetUserId = $validated['user_id'] ?? $user->id;

        if ($user->role !== 'admin') {
            $targetUserId = $user->id;
        }

        $order = Order::create([
            'user_id' => $targetUserId,
            'items' => $this->normalizeItems($validated['items'] ?? []),
            'total' => $validated['total'],
            'discount_amount' => $validated['discount_amount'] ?? 0,
            'promo_code' => $validated['promo_code'] ?? null,
            'status' => $validated['status'] ?? 'pending',
            'address' => $validated['address'],
            'phone' => $validated['phone'],
        ]);

        return response()->json($this->transformOrder($order), 201);
    }

    public function update(Request $request, Order $order): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['pending', 'confirmed', 'delivered'])],
        ]);

        $order->update([
            'status' => $validated['status'],
        ]);

        return response()->json($this->transformOrder($order->fresh()));
    }

    public function destroy(Request $request, Order $order): JsonResponse
    {
        $this->authorizeAdmin($request);

        $order->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * @param array<int, array{product_id:int, quantity:int, product?:array<string,mixed>}> $items
     * @return array<int, array<string, mixed>>
     */
    private function normalizeItems(array $items): array
    {
        $productIds = collect($items)
            ->map(fn (array $item): int => (int) ($item['product_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values();

        $productsById = Product::query()
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        return array_map(function (array $item) use ($productsById): array {
            $productId = (int) ($item['product_id'] ?? 0);
            /** @var Product|null $product */
            $product = $productsById->get($productId);

            $fallbackProduct = is_array($item['product'] ?? null) ? $item['product'] : [];

            $price = $product?->price ?? (float) ($fallbackProduct['price'] ?? 0);
            $discountPrice = $product?->discount_price;

            return [
                'product_id' => $productId,
                'quantity' => (int) ($item['quantity'] ?? 1),
                'product' => [
                    'id' => $productId,
                    'name' => $product?->name ?? (string) ($fallbackProduct['name'] ?? ('Produit #'.$productId)),
                    'description' => $product?->description ?? ($fallbackProduct['description'] ?? null),
                    'price' => $price,
                    'discount_price' => $discountPrice,
                    'image' => $product?->image ?? ($fallbackProduct['image'] ?? null),
                    'images' => $product?->images ?? ($fallbackProduct['images'] ?? []),
                    'category' => $product?->category ?? (string) ($fallbackProduct['category'] ?? 'general'),
                    'rating' => $product?->rating ?? (float) ($fallbackProduct['rating'] ?? 0),
                    'review_count' => $product?->review_count ?? (int) ($fallbackProduct['review_count'] ?? 0),
                    'stock' => $product?->stock ?? (int) ($fallbackProduct['stock'] ?? 0),
                    'is_active' => $product?->is_active ?? (bool) ($fallbackProduct['is_active'] ?? true),
                    'is_promotion' => $product?->is_promotion ?? (bool) ($fallbackProduct['is_promotion'] ?? false),
                    'promotion_percentage' => $product?->promotion_percentage ?? ($fallbackProduct['promotion_percentage'] ?? null),
                    'created_at' => $product?->created_at?->toISOString() ?? (string) ($fallbackProduct['created_at'] ?? now()->toISOString()),
                ],
            ];
        }, $items);
    }

    private function transformOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'user_id' => $order->user_id ?? 0,
            'items' => $this->normalizeItems($order->items ?? []),
            'total' => $order->total,
            'discount_amount' => $order->discount_amount ?? 0,
            'promo_code' => $order->promo_code,
            'status' => $order->status,
            'address' => $order->address,
            'phone' => $order->phone,
            'created_at' => $order->created_at,
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }
}
