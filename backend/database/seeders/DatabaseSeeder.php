<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'full_name' => 'Admin ValeriaHouse',
            'email' => 'admin@valeriahouse.com',
            'phone' => '+33123456789',
            'address' => 'Paris, France',
            'role' => 'admin',
            'password' => bcrypt('Admin@123'),
        ]);
    }
}
