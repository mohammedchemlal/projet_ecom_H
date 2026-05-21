<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedCart extends Model
{
    protected $table = 'saved_carts';

    protected $fillable = [
        'user_id',
        'name',
        'items',
        'promo',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'promo' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
