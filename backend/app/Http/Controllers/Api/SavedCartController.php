<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedCart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SavedCartController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $carts = SavedCart::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $carts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.productId' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'promo' => ['sometimes', 'nullable', 'array'],
        ]);

        $cart = SavedCart::query()->create([
            'user_id' => $user->id,
            'name' => $validated['name'] ?? 'Mon panier',
            'items' => $validated['items'],
            'promo' => $validated['promo'] ?? null,
        ]);

        return response()->json([
            'data' => $cart,
            'message' => 'Panier sauvegarde.',
        ], 201);
    }

    public function show(Request $request, SavedCart $savedCart): JsonResponse
    {
        $user = $request->user();

        if ($savedCart->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Acces refuse.'], 403);
        }

        return response()->json([
            'data' => $savedCart,
        ]);
    }

    public function destroy(Request $request, SavedCart $savedCart): JsonResponse
    {
        $user = $request->user();

        if ($savedCart->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Acces refuse.'], 403);
        }

        $savedCart->delete();

        return response()->json([
            'message' => 'Panier sauvegarde supprime.',
        ]);
    }
}
