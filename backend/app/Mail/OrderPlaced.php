<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderPlaced extends Mailable
{
    use Queueable, SerializesModels;

    public Order $order;
    public ?User $customer = null;

    /**
     * Create a new message instance.
     */
    public function __construct(Order $order, ?User $customer = null)
    {
        $this->order = $order;
        $this->customer = $customer;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        $subject = sprintf('Nouvelle commande #%d', $this->order->id);

        return $this->subject($subject)
            ->view('emails.order_placed')
            ->with([
                'order' => $this->order,
                'customer' => $this->customer,
            ]);
    }
}
