<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // index to avoid large sorts on created_at
            try {
                $table->index('created_at', 'idx_products_created_at');
            } catch (\Throwable $e) {
                // index may already exist (created manually); ignore
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            try {
                $table->dropIndex('idx_products_created_at');
            } catch (\Throwable $e) {
                // index missing; ignore
            }
        });
    }
};
