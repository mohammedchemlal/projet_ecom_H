<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PromoCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromoCodeController extends Controller
{
    public function index(): JsonResponse
    {
        $codes = PromoCode::query()->orderByDesc('created_at')->get();

        return response()->json($codes);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request);

        $code = PromoCode::create($validated);

        return response()->json($code, 201);
    }

    public function update(Request $request, PromoCode $promoCode): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $this->validatePayload($request, $promoCode);

        $promoCode->update($validated);

        return response()->json($promoCode->fresh());
    }

    public function destroy(Request $request, PromoCode $promoCode): JsonResponse
    {
        $this->authorizeAdmin($request);

        $promoCode->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    private function validatePayload(Request $request, ?PromoCode $promoCode = null): array
    {
        $isUpdate = $promoCode !== null;

        $rules = [
            'code' => [
                $isUpdate ? 'sometimes' : 'required',
                'required',
                'string',
                'min:3',
                'max:60',
                Rule::unique('promo_codes', 'code')->ignore($promoCode?->id),
            ],
            'discount' => [$isUpdate ? 'sometimes' : 'required', 'required', 'numeric', 'min:0.01', 'max:1000000'],
            'type' => [$isUpdate ? 'sometimes' : 'required', 'required', Rule::in(['percentage', 'fixed'])],
            'min_order_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'max_discount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'valid_from' => [$isUpdate ? 'sometimes' : 'required', 'required', 'date'],
            'valid_to' => [$isUpdate ? 'sometimes' : 'required', 'required', 'date', 'after_or_equal:valid_from'],
            'usage_limit' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'used_count' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        $validated = $request->validate($rules);

        if (isset($validated['code'])) {
            $validated['code'] = strtoupper(trim($validated['code']));
        }

        return $validated;
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }
}
