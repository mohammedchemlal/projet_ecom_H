<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\PromoCode;
use App\Models\Testimonial;
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
        User::query()->updateOrCreate([
            'email' => 'admin@valeriahouse.com',
        ], [
            'full_name' => 'Admin ValeriaHouse',
            'phone' => '+33123456789',
            'address' => 'Paris, France',
            'role' => 'admin',
            'password' => bcrypt('Admin@123'),
        ]);

        $defaultCategories = [
            [
                'label' => 'Colliers',
                'value' => 'necklaces',
                'icon' => 'pi pi-gem',
                'description' => 'Colliers elegants',
            ],
            [
                'label' => 'Bagues',
                'value' => 'rings',
                'icon' => 'pi pi-circle',
                'description' => 'Bagues raffinees',
            ],
            [
                'label' => 'Bracelets',
                'value' => 'bracelets',
                'icon' => 'pi pi-link',
                'description' => 'Bracelets tendance',
            ],
            [
                'label' => "Boucles d'oreilles",
                'value' => 'earrings',
                'icon' => 'pi pi-star',
                'description' => "Boucles d'oreilles",
            ],
        ];

        foreach ($defaultCategories as $category) {
            Category::query()->updateOrCreate([
                'value' => $category['value'],
            ], $category);
        }

        $defaultPromos = [
            [
                'code' => 'WELCOME10',
                'discount' => 10,
                'type' => 'percentage',
                'min_order_amount' => 0,
                'max_discount' => null,
                'valid_from' => now()->subMonth(),
                'valid_to' => now()->addMonths(12),
                'usage_limit' => 100,
                'used_count' => 0,
                'is_active' => true,
            ],
            [
                'code' => 'SAVE20',
                'discount' => 20,
                'type' => 'percentage',
                'min_order_amount' => 300,
                'max_discount' => 250,
                'valid_from' => now()->subMonth(),
                'valid_to' => now()->addMonths(6),
                'usage_limit' => 50,
                'used_count' => 0,
                'is_active' => true,
            ],
        ];

        foreach ($defaultPromos as $promo) {
            PromoCode::query()->updateOrCreate([
                'code' => $promo['code'],
            ], $promo);
        }

        $defaultProducts = [
            [
                'name' => 'Collier Elegance Doree',
                'description' => 'Collier en or avec finition premium.',
                'detailed_description' => "Collier elegant pense pour les grandes occasions.\n\nFinition polie miroir et fermoir securise pour un port confortable toute la journee.",
                'specifications' => [
                    [
                        'title' => 'Caracteristiques',
                        'items' => ['Matiere: Argent 925 plaque or 18k', 'Poids moyen: 5 g', 'Longueur: 45 cm + extension 5 cm'],
                    ],
                    [
                        'title' => 'Entretien',
                        'items' => ['Eviter le contact avec parfums et eau de mer', 'Nettoyer avec un chiffon doux'],
                    ],
                ],
                'price' => 299.99,
                'discount_price' => 199.99,
                'image' => 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
                'images' => [
                    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
                    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600',
                ],
                'category' => 'necklaces',
                'rating' => 4.8,
                'review_count' => 124,
                'stock' => 15,
                'is_active' => true,
                'is_promotion' => true,
                'promotion_percentage' => 33,
            ],
            [
                'name' => 'Bague Solitaire Argent',
                'description' => 'Bague en argent sterling avec pierre centrale.',
                'detailed_description' => "Bague solitaire au style intemporel, ideale pour un cadeau raffine.\n\nMonture stable et confortable pour un usage quotidien.",
                'specifications' => [
                    [
                        'title' => 'Caracteristiques',
                        'items' => ['Matiere: Argent sterling 925', 'Pierre centrale taille brillant', 'Finition anti-ternissement'],
                    ],
                    [
                        'title' => 'Conseils',
                        'items' => ['Retirer avant activites sportives', 'Conserver dans un ecrin sec'],
                    ],
                ],
                'price' => 149.99,
                'discount_price' => null,
                'image' => 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
                'images' => [
                    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
                    'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600',
                ],
                'category' => 'rings',
                'rating' => 4.9,
                'review_count' => 89,
                'stock' => 23,
                'is_active' => true,
                'is_promotion' => false,
                'promotion_percentage' => null,
            ],
            [
                'name' => 'Bracelet Chaine Or Rose',
                'description' => 'Bracelet fin en or rose, design moderne.',
                'detailed_description' => "Bracelet minimaliste en or rose avec une ligne fine et contemporaine.\n\nFermeture securisee et ajustement simple pour un port quotidien.",
                'specifications' => [
                    [
                        'title' => 'Caracteristiques',
                        'items' => ['Matiere: Alliage plaque or rose', 'Longueur ajustable: 16 a 20 cm', 'Fermoir mousqueton'],
                    ],
                    [
                        'title' => 'Entretien',
                        'items' => ['Essuyer apres usage', 'Eviter les produits chimiques agressifs'],
                    ],
                ],
                'price' => 89.99,
                'discount_price' => 71.99,
                'image' => 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
                'images' => [
                    'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
                    'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600',
                ],
                'category' => 'bracelets',
                'rating' => 4.7,
                'review_count' => 56,
                'stock' => 30,
                'is_active' => true,
                'is_promotion' => true,
                'promotion_percentage' => 20,
            ],
        ];

        foreach ($defaultProducts as $product) {
            Product::query()->updateOrCreate([
                'name' => $product['name'],
                'category' => $product['category'],
            ], $product);
        }

        $defaultTestimonials = [
            [
                'customer_name' => 'Sophie Martin',
                'customer_image' => '/avatars/avatar-rose.svg',
                'role' => 'Cliente fidele',
                'rating' => 5,
                'comment' => 'Des bijoux d une qualite exceptionnelle. Le service client est remarquable et les livraisons sont rapides.',
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'customer_name' => 'Julie Bernard',
                'customer_image' => '/avatars/avatar-gold.svg',
                'role' => 'Collectionneuse',
                'rating' => 5,
                'comment' => 'J adore la finesse des creations. Chaque piece est unique et parfaitement finie.',
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'customer_name' => 'Marie Lambert',
                'customer_image' => '/avatars/avatar-emerald.svg',
                'role' => 'Influenceuse mode',
                'rating' => 5,
                'comment' => 'Mes clientes adorent ces bijoux. Le rapport qualite-prix est excellent.',
                'is_active' => true,
                'sort_order' => 3,
            ],
        ];

        foreach ($defaultTestimonials as $testimonial) {
            Testimonial::query()->updateOrCreate([
                'customer_name' => $testimonial['customer_name'],
            ], $testimonial);
        }
    }
}
