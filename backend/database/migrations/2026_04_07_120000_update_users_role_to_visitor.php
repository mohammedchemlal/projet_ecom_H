<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::disableForeignKeyConstraints();

            Schema::create('users_new', function (Blueprint $table) {
                $table->id();
                $table->string('full_name');
                $table->string('email')->unique();
                $table->string('password');
                $table->string('phone')->nullable();
                $table->text('address')->nullable();
                $table->enum('role', ['visitor', 'admin'])->default('visitor');
                $table->timestamp('email_verified_at')->nullable();
                $table->rememberToken();
                $table->timestamps();
            });

            DB::statement("INSERT INTO users_new (id, full_name, email, password, phone, address, role, email_verified_at, remember_token, created_at, updated_at)
                SELECT id,
                       full_name,
                       email,
                       password,
                       phone,
                       address,
                       CASE WHEN role = 'user' THEN 'visitor' ELSE role END,
                       email_verified_at,
                       remember_token,
                       created_at,
                       updated_at
                FROM users");

            Schema::drop('users');
            Schema::rename('users_new', 'users');

            Schema::enableForeignKeyConstraints();

            return;
        }

        DB::statement("UPDATE users SET role = 'visitor' WHERE role = 'user'");
        DB::statement("ALTER TABLE users MODIFY role ENUM('visitor', 'admin') NOT NULL DEFAULT 'visitor'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::disableForeignKeyConstraints();

            Schema::create('users_old', function (Blueprint $table) {
                $table->id();
                $table->string('full_name');
                $table->string('email')->unique();
                $table->string('password');
                $table->string('phone')->nullable();
                $table->text('address')->nullable();
                $table->enum('role', ['user', 'admin'])->default('user');
                $table->timestamp('email_verified_at')->nullable();
                $table->rememberToken();
                $table->timestamps();
            });

            DB::statement("INSERT INTO users_old (id, full_name, email, password, phone, address, role, email_verified_at, remember_token, created_at, updated_at)
                SELECT id,
                       full_name,
                       email,
                       password,
                       phone,
                       address,
                       CASE WHEN role = 'visitor' THEN 'user' ELSE role END,
                       email_verified_at,
                       remember_token,
                       created_at,
                       updated_at
                FROM users");

            Schema::drop('users');
            Schema::rename('users_old', 'users');

            Schema::enableForeignKeyConstraints();

            return;
        }

        DB::statement("UPDATE users SET role = 'user' WHERE role = 'visitor'");
        DB::statement("ALTER TABLE users MODIFY role ENUM('user', 'admin') NOT NULL DEFAULT 'user'");
    }
};
