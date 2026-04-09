<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Testimonial;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class TestimonialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Testimonial::query();

        if ($request->user()?->role !== 'admin') {
            $query->where('is_active', true);
        }

        $testimonials = $query
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($testimonials);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request);

        $testimonial = Testimonial::create($validated);

        return response()->json($testimonial, 201);
    }

    public function update(Request $request, Testimonial $testimonial): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request, true);

        $testimonial->update($validated);

        return response()->json($testimonial->fresh());
    }

    public function destroy(Request $request, Testimonial $testimonial): JsonResponse
    {
        $this->authorizeAdmin($request);

        $testimonial->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    private function validatePayload(Request $request, bool $isUpdate = false): array
    {
        $rules = [
            'customer_name' => [$isUpdate ? 'sometimes' : 'required', 'required', 'string', 'min:2', 'max:120'],
            'customer_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => ['sometimes', 'nullable', 'string', 'max:120'],
            'rating' => ['sometimes', 'required', 'integer', 'min:1', 'max:5'],
            'comment' => ['sometimes', 'required', 'string', 'min:3', 'max:4000'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];

        return $request->validate($rules, [
            'customer_name.required' => 'Le nom du client est obligatoire.',
            'customer_name.min' => 'Le nom du client doit contenir au moins 2 caracteres.',
            'rating.required' => 'La note est obligatoire.',
            'rating.integer' => 'La note doit etre un nombre entier.',
            'rating.min' => 'La note minimale est 1.',
            'rating.max' => 'La note maximale est 5.',
            'comment.required' => 'Le commentaire est obligatoire.',
            'comment.min' => 'Le commentaire doit contenir au moins 3 caracteres.',
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }
}
