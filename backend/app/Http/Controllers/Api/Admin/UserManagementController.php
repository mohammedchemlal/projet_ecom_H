<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $search = trim((string) $request->query('search', ''));
        $role = $request->query('role');

        $query = User::query()->orderByDesc('created_at');

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if (in_array($role, ['visitor', 'admin'], true)) {
            $query->where('role', $role);
        }

        $perPage = min(max((int) $request->query('per_page', 10), 1), 100);
        $users = $query->paginate($perPage);

        return response()->json([
            'data' => collect($users->items())->map(fn (User $user): array => $this->sanitizeUser($user)),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'data' => $this->sanitizeUser($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'min:8', 'max:20'],
            'address' => ['nullable', 'string', 'max:255'],
            'role' => ['required', Rule::in(['visitor', 'admin'])],
        ]);

        $user = User::create($validated);

        return response()->json([
            'message' => 'Utilisateur cree avec succes',
            'data' => $this->sanitizeUser($user),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'full_name' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'required', 'string', 'min:8'],
            'phone' => ['sometimes', 'nullable', 'string', 'min:8', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => ['sometimes', 'required', Rule::in(['visitor', 'admin'])],
        ]);

        if (
            isset($validated['role'])
            && $request->user()?->id === $user->id
            && $validated['role'] !== 'admin'
        ) {
            return response()->json([
                'message' => 'Vous ne pouvez pas retirer votre propre role admin.',
            ], 422);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Utilisateur mis a jour avec succes',
            'data' => $this->sanitizeUser($user->fresh()),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdmin($request);

        if ($request->user()?->id === $user->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte admin.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'message' => 'Utilisateur supprime avec succes',
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }

    private function sanitizeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'address' => $user->address,
            'role' => $user->role,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}
