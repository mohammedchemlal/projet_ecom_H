<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'description',
        'detailed_description',
        'specifications',
        'price',
        'discount_price',
        'image',
        'images',
        'category',
        'rating',
        'review_count',
        'stock',
        'is_active',
        'is_promotion',
        'promotion_percentage',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'float',
            'discount_price' => 'float',
            'images' => 'array',
            'specifications' => 'array',
            'rating' => 'float',
            'review_count' => 'integer',
            'stock' => 'integer',
            'is_active' => 'boolean',
            'is_promotion' => 'boolean',
            'promotion_percentage' => 'integer',
        ];
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class)->orderByDesc('created_at');
    }
}
