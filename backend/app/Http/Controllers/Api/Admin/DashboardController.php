<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $usersCount = User::query()->count();
        $ordersQuery = Order::query();
        $productsCount = Product::query()->count();
        $totalOrders = $ordersQuery->count();
        $totalRevenue = (float) $ordersQuery->sum('total');
        $pendingOrders = (clone $ordersQuery)->where('status', 'pending')->count();
        $deliveredOrders = (clone $ordersQuery)->where('status', 'delivered')->count();
        $lowStockProducts = Product::query()->where('stock', '<=', 10)->count();

        $recentOrders = Order::query()
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(function (Order $order): array {
                return [
                    'id' => $order->id,
                    'user_id' => $order->user_id ?? 0,
                    'user_name' => $this->resolveUserName($order->user_id),
                    'total' => (float) $order->total,
                    'status' => $order->status,
                    'created_at' => $order->created_at?->toISOString(),
                ];
            })
            ->values();

        $months = [
            1 => 'Jan',
            2 => 'Fév',
            3 => 'Mar',
            4 => 'Avr',
            5 => 'Mai',
            6 => 'Juin',
            7 => 'Juil',
            8 => 'Aoû',
            9 => 'Sep',
            10 => 'Oct',
            11 => 'Nov',
            12 => 'Déc',
        ];

        $monthlyOrders = array_fill(1, 12, 0);
        $monthlyRevenue = array_fill(1, 12, 0.0);

        Order::query()
            ->whereYear('created_at', now()->year)
            ->select(['created_at', 'total'])
            ->get()
            ->each(function (Order $order) use (&$monthlyOrders, &$monthlyRevenue): void {
                $month = (int) $order->created_at?->format('n');

                if ($month < 1 || $month > 12) {
                    return;
                }

                $monthlyOrders[$month]++;
                $monthlyRevenue[$month] += (float) $order->total;
            });

        $categoryDistribution = Product::query()
            ->select('category', DB::raw('count(*) as total'))
            ->groupBy('category')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'category' => $row->category,
                'label' => $this->resolveCategoryLabel($row->category),
                'total' => (int) $row->total,
            ])
            ->values();

        $lowStockProductsList = Product::query()
            ->where('stock', '<=', 10)
            ->orderBy('stock')
            ->orderByDesc('updated_at')
            ->limit(6)
            ->get(['id', 'name', 'stock', 'category', 'image', 'is_active'])
            ->map(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'stock' => $product->stock,
                'category' => $product->category,
                'image' => $product->image,
                'is_active' => $product->is_active,
            ])
            ->values();

        return response()->json([
            'stats' => [
                'total_users' => $usersCount,
                'total_orders' => $totalOrders,
                'total_revenue' => $totalRevenue,
                'total_products' => $productsCount,
                'pending_orders' => $pendingOrders,
                'delivered_orders' => $deliveredOrders,
                'low_stock_products' => $lowStockProducts,
            ],
            'recent_orders' => $recentOrders,
            'monthly_sales' => collect($months)->map(function (string $label, int $month) use ($monthlyOrders, $monthlyRevenue): array {
                return [
                    'label' => $label,
                    'orders' => $monthlyOrders[$month],
                    'revenue' => round($monthlyRevenue[$month], 2),
                ];
            })->values(),
            'category_distribution' => $categoryDistribution,
            'low_stock_products_list' => $lowStockProductsList,
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Acces reserve aux administrateurs.');
    }

    private function resolveUserName(?int $userId): string
    {
        if ($userId === null) {
            return 'Client invité';
        }

        return User::query()->whereKey($userId)->value('full_name') ?? "Client #{$userId}";
    }

    private function resolveCategoryLabel(string $category): string
    {
        return match ($category) {
            'necklaces' => 'Colliers',
            'rings' => 'Bagues',
            'bracelets' => 'Bracelets',
            'earrings' => "Boucles d'oreilles",
            default => $category,
        };
    }
}