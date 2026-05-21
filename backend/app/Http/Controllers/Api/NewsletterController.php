<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NewsletterController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        $normalized = strtolower(trim($validated['email']));

        $exists = NewsletterSubscriber::query()->where('email', $normalized)->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Vous êtes déjà inscrit à la newsletter.',
            ], 409);
        }

        NewsletterSubscriber::query()->create([
            'email' => $normalized,
        ]);

        return response()->json([
            'message' => 'Merci ! Votre inscription est enregistrée.',
        ], 201);
    }
}
