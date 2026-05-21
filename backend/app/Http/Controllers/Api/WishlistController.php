<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Wishlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $products = $user->wishlistProducts()->get();

        return response()->json([
            'data' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        $exists = Wishlist::query()
            ->where('user_id', $user->id)
            ->where('product_id', $validated['product_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Ce produit est deja dans vos favoris.',
            ], 409);
        }

        $wishlist = Wishlist::query()->create([
            'user_id' => $user->id,
            'product_id' => $validated['product_id'],
        ]);

        $product = $wishlist->product;

        return response()->json([
            'data' => $product,
            'message' => 'Produit ajoute aux favoris.',
        ], 201);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $user = $request->user();

        $deleted = Wishlist::query()
            ->where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->delete();

        if ($deleted === 0) {
            return response()->json([
                'message' => 'Ce produit n\'est pas dans vos favoris.',
            ], 404);
        }

        return response()->json([
            'message' => 'Produit retire des favoris.',
        ]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        $existing = Wishlist::query()
            ->where('user_id', $user->id)
            ->where('product_id', $validated['product_id'])
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json([
                'added' => false,
                'message' => 'Produit retire des favoris.',
            ]);
        }

        Wishlist::query()->create([
            'user_id' => $user->id,
            'product_id' => $validated['product_id'],
        ]);

        $product = Product::query()->find($validated['product_id']);

        return response()->json([
            'added' => true,
            'data' => $product,
            'message' => 'Produit ajoute aux favoris.',
        ], 201);
    }
}
