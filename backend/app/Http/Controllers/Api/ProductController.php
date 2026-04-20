<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::query();

        // Search filter
        if ($request->has('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                                    ->orWhere('description', 'like', "%{$search}%")
                                    ->orWhere('detailed_description', 'like', "%{$search}%");
            });
        }

        // Category filter
        if ($request->has('category') && $request->query('category')) {
            $query->where('category', $request->query('category'));
        }

        // Price range filter
        if ($request->has('min_price')) {
            $minPrice = (float) $request->query('min_price');
            $query->where(function ($q) use ($minPrice): void {
                $q->whereRaw('COALESCE(discount_price, price) >= ?', [$minPrice]);
            });
        }

        if ($request->has('max_price')) {
            $maxPrice = (float) $request->query('max_price');
            $query->where(function ($q) use ($maxPrice): void {
                $q->whereRaw('COALESCE(discount_price, price) <= ?', [$maxPrice]);
            });
        }

        // Promotion filter
        if ($request->boolean('is_promotion')) {
            $query->where('is_promotion', true);
        }

        // Sorting
        $sort = $request->query('sort', 'newest');
        switch ($sort) {
            case 'price_asc':
                $query->orderByRaw('COALESCE(discount_price, price) ASC');
                break;
            case 'price_desc':
                $query->orderByRaw('COALESCE(discount_price, price) DESC');
                break;
            case 'rating':
                $query->orderByDesc('rating');
                break;
            case 'popular':
                $query->orderByDesc('review_count');
                break;
            case 'newest':
            default:
                $query->orderByDesc('created_at');
        }

        // Server-side pagination: use page & per_page query params
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, (int) $request->query('per_page', 12));

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => $paginator->items(),
            'total' => $paginator->total(),
        ]);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product);
    }

    public function reviews(Product $product): JsonResponse
    {
        $reviews = $product->reviews()->get()->map(fn (ProductReview $review): array => $this->transformReview($review));

        return response()->json($reviews->values()->all());
    }

    public function storeReview(Request $request, Product $product): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401, 'Authentification requise.');

        $validated = $request->validate(
            [
                'rating' => ['required', 'integer', 'min:1', 'max:5'],
                'title' => ['required', 'string', 'min:2', 'max:255'],
                'comment' => ['required', 'string', 'min:3', 'max:4000'],
                'images' => ['sometimes', 'array'],
                // Allow larger payloads (aligned with frontend up to ~5MB)
                'images.*' => ['string', 'max:5000000'],
            ],
            [
                'rating.required' => 'La note est obligatoire.',
                'rating.integer' => 'La note doit etre un nombre entier.',
                'rating.min' => 'La note minimale est 1.',
                'rating.max' => 'La note maximale est 5.',
                'title.required' => 'Le titre est obligatoire.',
                'title.min' => 'Le titre doit contenir au moins 2 caracteres.',
                'title.max' => 'Le titre ne peut pas depasser 255 caracteres.',
                'comment.required' => 'Le commentaire est obligatoire.',
                'comment.min' => 'Le commentaire doit contenir au moins 3 caracteres.',
                'comment.max' => 'Le commentaire ne peut pas depasser 4000 caracteres.',
                'images.array' => 'Le format des images est invalide.',
                'images.*.string' => 'Chaque image doit etre une chaine valide.',
            ]
        );

        // Use a cursor to avoid loading all orders into memory and improve performance.
        $hasPurchased = false;
        foreach (Order::query()->where('user_id', $user->id)->cursor() as $order) {
            $items = is_array($order->items) ? $order->items : [];

            foreach ($items as $item) {
                if ((int) ($item['product_id'] ?? 0) === $product->id) {
                    $hasPurchased = true;
                    break 2;
                }
            }
        }
        // Create review and update product aggregates inside a transaction to avoid race conditions.
        $review = DB::transaction(function () use ($product, $user, $validated, $hasPurchased) {
            $review = ProductReview::query()->create([
                'product_id' => $product->id,
                'user_id' => $user->id,
                'user_name' => $user->full_name,
                'user_avatar' => null,
                'rating' => $validated['rating'],
                'title' => $validated['title'],
                'comment' => $validated['comment'],
                'likes' => 0,
                'verified' => $hasPurchased,
                'images' => $validated['images'] ?? [],
            ]);

            $avgRating = ProductReview::query()->where('product_id', $product->id)->avg('rating');
            $reviewCount = ProductReview::query()->where('product_id', $product->id)->count();

            $product->update([
                'rating' => round((float) $avgRating, 2),
                'review_count' => $reviewCount,
            ]);

            return $review;
        });

        return response()->json($this->transformReview($review->fresh()), 201);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request);

        // Handle base64 / oversized images: decode and persist to `public/products`,
        // replacing the base64 payload with a safe URL. If decoding fails, fallback
        // to moving the payload into `images[]` and nulling `image` to avoid SQL errors.
        if (!empty($validated['image']) && is_string($validated['image'])) {
            $saved = $this->saveBase64ImageToDisk($validated['image']);
            if ($saved !== null) {
                $validated['image'] = $saved;
            } else {
                $validated['images'] = array_merge($validated['images'] ?? [], [$validated['image']]);
                $validated['image'] = null;
            }
        }

        if (!empty($validated['images']) && is_array($validated['images'])) {
            $validated['images'] = array_values(array_filter(array_map(function ($img) {
                if (!is_string($img)) {
                    return null;
                }
                $saved = $this->saveBase64ImageToDisk($img);
                return $saved ?? $img;
            }, $validated['images'])));
        }

        $product = Product::create($validated);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request, true);

        // Handle base64 / oversized images for updates as well.
        if (!empty($validated['image']) && is_string($validated['image'])) {
            $saved = $this->saveBase64ImageToDisk($validated['image']);
            if ($saved !== null) {
                $validated['image'] = $saved;
            } else {
                $validated['images'] = array_merge($validated['images'] ?? [], [$validated['image']]);
                $validated['image'] = null;
            }
        }

        if (!empty($validated['images']) && is_array($validated['images'])) {
            $validated['images'] = array_values(array_filter(array_map(function ($img) {
                if (!is_string($img)) {
                    return null;
                }
                $saved = $this->saveBase64ImageToDisk($img);
                return $saved ?? $img;
            }, $validated['images'])));
        }

        $product->update($validated);

        return response()->json($product->fresh());
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $product->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    private function validatePayload(Request $request, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'required', 'string', 'min:2', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'detailed_description' => ['sometimes', 'nullable', 'string', 'max:12000'],
            'specifications' => ['sometimes', 'nullable', 'array', 'max:20'],
            'specifications.*.title' => ['required_with:specifications', 'string', 'max:120'],
            'specifications.*.items' => ['required_with:specifications', 'array', 'max:20'],
            'specifications.*.items.*' => ['string', 'max:255'],
            'price' => [$required, 'required', 'numeric', 'min:0'],
            'discount_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'image' => ['sometimes', 'nullable', 'string', 'max:5000000'],
            'images' => ['sometimes', 'array'],
            'images.*' => ['string', 'max:5000000'],
            'category' => [$required, 'required', 'string', 'max:120'],
            'rating' => ['sometimes', 'numeric', 'min:0', 'max:5'],
            'review_count' => ['sometimes', 'integer', 'min:0'],
            'stock' => [$required, 'required', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'is_promotion' => ['sometimes', 'boolean'],
            'promotion_percentage' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:90'],
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }

    private function transformReview(ProductReview $review): array
    {
        return [
            'id' => $review->id,
            'user_id' => $review->user_id,
            'user_name' => $review->user_name,
            'user_avatar' => $review->user_avatar,
            'rating' => $review->rating,
            'title' => $review->title,
            'comment' => $review->comment,
            'likes' => $review->likes,
            'verified' => $review->verified,
            'images' => $review->images ?? [],
            'created_at' => $review->created_at,
        ];
    }

    /**
     * Decode a base64 data URI or raw base64 string and store it on the `public` disk.
     * Returns a publicly accessible URL (Storage::url) or null on failure.
     */
    private function saveBase64ImageToDisk(string $data): ?string
    {
        // detect data URI: data:[<mediatype>][;base64],<data>
        if (!str_contains($data, 'base64')) {
            // quick heuristic: if too short or not base64-like, skip
            if (strlen($data) < 100) {
                return null;
            }
            // assume raw base64 payload
            $payload = $data;
            $extension = 'jpg';
        } else {
            if (!preg_match('/^data:(image\/[a-zA-Z0-9+.]+);base64,(.*)$/', $data, $matches)) {
                return null;
            }

            $mime = $matches[1];
            $payload = $matches[2];
            $extension = explode('/', $mime)[1] ?? 'jpg';
            // normalize extension
            $extension = preg_replace('/[^a-z0-9]+/i', '', $extension) ?: 'jpg';
        }

        $decoded = base64_decode($payload, true);
        if ($decoded === false) {
            return null;
        }

        $filename = Str::random(12) . '_' . time() . '.' . $extension;
        $path = 'products/' . $filename;

        try {
            Storage::disk('public')->put($path, $decoded);
            return Storage::disk('public')->url($path);
        } catch (\Throwable $e) {
            // avoid throwing from here; return null and let caller fallback
            return null;
        }
    }
}
