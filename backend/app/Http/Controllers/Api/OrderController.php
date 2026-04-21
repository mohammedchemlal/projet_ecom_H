<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\PromoCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401, 'Authentification requise.');

        $query = Order::with('user')->orderByDesc('created_at');

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

        $items = $this->normalizeItems($validated['items'] ?? []);

        // compute subtotal from normalized items (use discount_price if present)
        $subtotal = array_reduce($items, function ($carry, $item) {
            $price = $item['product']['discount_price'] ?? $item['product']['price'] ?? 0;
            return $carry + ($price * ($item['quantity'] ?? 1));
        }, 0.0);

        $discountAmount = $validated['discount_amount'] ?? 0;
        $promo = null;
        $promoCode = isset($validated['promo_code']) ? strtoupper(trim((string) $validated['promo_code'])) : null;

        if ($promoCode !== null) {
            $promo = PromoCode::query()->where('code', $promoCode)->first();

            if ($promo === null) {
                return response()->json(['message' => 'Code promo invalide.'], 422);
            }

            $now = now();
            if (! $promo->is_active || $promo->valid_from > $now || $promo->valid_to < $now) {
                return response()->json(['message' => 'Code promo expiré ou inactif.'], 422);
            }

            if ($promo->usage_limit !== null && $promo->used_count >= $promo->usage_limit) {
                return response()->json(['message' => 'Ce code promo a atteint sa limite d\'utilisation.'], 422);
            }

            if ($promo->min_order_amount !== null && $subtotal < $promo->min_order_amount) {
                return response()->json(['message' => 'Montant minimum non atteint pour ce code promo.'], 422);
            }

            // calculate discount server-side
            if ($promo->type === 'fixed') {
                $calculated = min($subtotal, (float) $promo->discount);
            } else {
                $calculated = ($subtotal * (float) $promo->discount) / 100.0;
                if ($promo->max_discount !== null) {
                    $calculated = min($calculated, (float) $promo->max_discount);
                }
            }

            // round to 3 decimals to match frontend precision
            $discountAmount = round($calculated, 3);
        }

        // Create order and decrement product stock within a DB transaction to avoid races
        DB::beginTransaction();

        try {
            // Lock relevant product rows for update
            $productIds = collect($items)->map(fn($it) => (int) $it['product_id'])->unique()->values()->all();
            $productsForUpdate = Product::query()->whereIn('id', $productIds)->lockForUpdate()->get()->keyBy('id');

            // Verify stock availability
            foreach ($items as $it) {
                $pid = (int) $it['product_id'];
                $qty = (int) ($it['quantity'] ?? 1);
                $prod = $productsForUpdate->get($pid);

                if ($prod === null) {
                    DB::rollBack();
                    return response()->json(['message' => "Produit introuvable: {$pid}"], 422);
                }

                // Check if product is active/available
                if (property_exists($prod, 'is_active') && ! $prod->is_active) {
                    DB::rollBack();
                    return response()->json(['message' => "Le produit {$prod->name} n'est plus disponible."], 422);
                }

                if ($prod->stock < $qty) {
                    DB::rollBack();
                    return response()->json(['message' => "Stock insuffisant pour le produit {$prod->name}."], 422);
                }
            }

            // Decrement stock
            foreach ($items as $it) {
                $pid = (int) $it['product_id'];
                $qty = (int) ($it['quantity'] ?? 1);
                $prod = $productsForUpdate->get($pid);
                $prod->stock = max(0, $prod->stock - $qty);
                $prod->save();
            }

            $order = Order::create([
                'user_id' => $targetUserId,
                'items' => $items,
                'total' => $validated['total'],
                'discount_amount' => $discountAmount,
                'promo_code' => $promoCode,
                'status' => $validated['status'] ?? 'pending',
                'address' => $validated['address'],
                'phone' => $validated['phone'],
            ]);

            // increment used_count safely
            if (! empty($promo) && $promo instanceof PromoCode) {
                if ($promo->usage_limit === null || $promo->used_count < $promo->usage_limit) {
                    $promo->increment('used_count');
                }
            }

            DB::commit();

            // Prepare customer info (if any) and queue notification email to site owner / admin
            try {
                $adminEmails = env('ADMIN_EMAIL', config('mail.from.address'));
                $customer = null;
                if (! empty($order->user_id)) {
                    $customer = User::query()->find($order->user_id);
                }

                if (! empty($adminEmails)) {
                    // allow comma-separated list in ADMIN_EMAIL
                    $recipients = array_filter(array_map('trim', explode(',', (string) $adminEmails)));
                    if (! empty($recipients)) {
                        // queue the mailable so the API is not blocked; Mailable uses Queueable
                        Mail::to($recipients)->queue(new \App\Mail\OrderPlaced($order, $customer));
                    }
                }
            } catch (\Throwable $mailEx) {
                // don't break the API response if queue fails — log for diagnostics
                logger()->error('Failed to queue order notification email: '.$mailEx->getMessage());
            }

            return response()->json($this->transformOrder($order), 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la creation de la commande.'], 500);
        }
    }

    public function update(Request $request, Order $order): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['pending', 'confirmed', 'delivered'])],
        ]);

        // If changing status to confirmed, verify products are still available
        if (($validated['status'] ?? '') === 'confirmed') {
            $items = $this->normalizeItems($order->items ?? []);
            $productIds = collect($items)->map(fn($it) => (int) $it['product_id'])->unique()->values()->all();
            $products = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');

            $errors = [];
            foreach ($items as $it) {
                $pid = (int) $it['product_id'];
                $qty = (int) ($it['quantity'] ?? 1);
                $prod = $products->get($pid);

                if ($prod === null) {
                    $errors[] = "Produit introuvable: {$pid}";
                    continue;
                }

                if (property_exists($prod, 'is_active') && ! $prod->is_active) {
                    $errors[] = "Le produit {$prod->name} n'est plus disponible.";
                    continue;
                }

                if ($prod->stock < $qty) {
                    $errors[] = "Stock insuffisant pour le produit {$prod->name}.";
                    continue;
                }
            }

            if (! empty($errors)) {
                return response()->json(['message' => implode(' ', $errors)], 422);
            }
        }

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
            // include basic customer info when available
            'customer_name' => $order->user?->full_name ?? null,
            'customer_email' => $order->user?->email ?? null,
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }
}
