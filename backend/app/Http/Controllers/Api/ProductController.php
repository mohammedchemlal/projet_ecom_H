<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
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

        $products = $query->get();

        return response()->json($products);
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
                'images.*' => ['string', 'max:2000000'],
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

        $hasPurchased = Order::query()
            ->where('user_id', $user->id)
            ->get(['items'])
            ->contains(function (Order $order) use ($product): bool {
                $items = is_array($order->items) ? $order->items : [];

                foreach ($items as $item) {
                    if ((int) ($item['product_id'] ?? 0) === $product->id) {
                        return true;
                    }
                }

                return false;
            });

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

        return response()->json($this->transformReview($review->fresh()), 201);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request);

        $product = Product::create($validated);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request, true);

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
            'image' => ['sometimes', 'nullable', 'string', 'max:2000000'],
            'images' => ['sometimes', 'array'],
            'images.*' => ['string', 'max:2000000'],
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
}
