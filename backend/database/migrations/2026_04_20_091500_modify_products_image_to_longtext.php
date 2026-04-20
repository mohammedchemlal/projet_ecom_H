<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     * Uses raw SQL to avoid requiring the doctrine DBAL package for `change()`.
     */
    public function up()
    {
        DB::statement('ALTER TABLE `products` MODIFY `image` LONGTEXT NULL;');
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        // Revert to varchar(255) as previous schema; adjust length if your schema differs.
        DB::statement('ALTER TABLE `products` MODIFY `image` VARCHAR(255) NULL;');
    }
};
