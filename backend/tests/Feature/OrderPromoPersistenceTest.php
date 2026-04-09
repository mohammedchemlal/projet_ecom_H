<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderPromoPersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_stores_order_without_promo(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/orders', [
            'total' => 149.99,
            'address' => 'Rabat, Agdal',
            'phone' => '0600000000',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('promo_code', null)
            ->assertJsonPath('discount_amount', 0);

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('id'),
            'user_id' => $user->id,
            'promo_code' => null,
            'discount_amount' => 0,
            'total' => 149.99,
        ]);
    }

    public function test_it_stores_order_with_promo(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/orders', [
            'total' => 119.99,
            'discount_amount' => 30.00,
            'promo_code' => 'SAVE20',
            'address' => 'Rabat, Agdal',
            'phone' => '0600000000',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('promo_code', 'SAVE20')
            ->assertJsonPath('discount_amount', 30);

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('id'),
            'user_id' => $user->id,
            'promo_code' => 'SAVE20',
            'discount_amount' => 30.00,
            'total' => 119.99,
        ]);
    }
}
