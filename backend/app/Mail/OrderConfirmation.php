<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public Order $order;
    public ?User $customer = null;

    public function __construct(Order $order, ?User $customer = null)
    {
        $this->order = $order;
        $this->customer = $customer;
    }

    public function build()
    {
        $subject = sprintf('Confirmation de votre commande #%d - Valerya', $this->order->id);

        return $this->subject($subject)
            ->view('emails.order_confirmation')
            ->with([
                'order' => $this->order,
                'customer' => $this->customer,
            ]);
    }
}
