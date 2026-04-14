<?php
// Render a fake OrderPlaced mailable and send via the configured mailer (log driver)
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

putenv('QUEUE_CONNECTION=sync');
putenv('ADMIN_EMAIL=storevalerya@gmail.com,simo167chenlal@gmail.com');

use Illuminate\Support\Facades\Mail;

$order = new \App\Models\Order();
$order->id = 999999;
$order->created_at = now();
$order->total = 199.99;
$order->discount_amount = 0.00;
$order->promo_code = null;
$order->status = 'pending';
$order->address = '1 Rue Exemple, Rabat';
$order->phone = '0600000000';
$order->items = [
    [
        'product_id' => 1,
        'quantity' => 2,
        'product' => [
            'id' => 1,
            'name' => 'Bague Test',
            'price' => 99.995,
            'discount_price' => null,
            'image' => 'https://images.unsplash.com/photo-1?w=600',
            'images' => ['https://images.unsplash.com/photo-1?w=600'],
        ],
    ],
];

$customer = new \App\Models\User();
$customer->full_name = 'Client Test';
$customer->email = 'client@example.test';
$customer->address = 'Adresse facturation';

$recipients = array_filter(array_map('trim', explode(',', env('ADMIN_EMAIL'))));
Mail::to($recipients)->send(new \App\Mail\OrderPlaced($order, $customer));

echo "EMAIL_RENDERED\n";
