<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::query()->orderBy('label')->get();

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'label' => ['required', 'string', 'min:2', 'max:100'],
            'value' => ['required', 'string', 'min:2', 'max:80', 'alpha_dash', 'unique:categories,value'],
            'icon' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $category = Category::create([
            'label' => $validated['label'],
            'value' => strtolower($validated['value']),
            'icon' => $validated['icon'] ?: 'pi pi-tag',
            'description' => $validated['description'] ?? '',
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
            'value' => [
                'sometimes',
                'required',
                'string',
                'min:2',
                'max:80',
                'alpha_dash',
                Rule::unique('categories', 'value')->ignore($category->id),
            ],
            'icon' => ['sometimes', 'nullable', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if (array_key_exists('value', $validated)) {
            $validated['value'] = strtolower($validated['value']);
        }

        if (array_key_exists('icon', $validated) && $validated['icon'] === '') {
            $validated['icon'] = 'pi pi-tag';
        }

        $category->update($validated);

        return response()->json($category->fresh());
    }

    public function destroy(Request $request, Category $category): JsonResponse
    {
        $this->authorizeAdmin($request);

        $category->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }
}
