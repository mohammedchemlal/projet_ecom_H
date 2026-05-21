<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Confirmation de commande #{{ $order->id }}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #222; background:#f7f7f8; margin:0; padding:24px 0; }
      .wrapper { max-width:600px; margin:0 auto; }
      .card { background:#fff; border-radius:12px; padding:24px; box-shadow:0 6px 22px rgba(10,10,10,0.06); }
      .brand { font-weight:700; color:#7a0e18; font-size:20px; text-align:center; margin-bottom:8px; }
      .check { text-align:center; font-size:48px; margin:12px 0; }
      .title { text-align:center; font-size:18px; font-weight:600; margin:0 0 4px; }
      .subtitle { text-align:center; color:#666; font-size:14px; margin:0 0 20px; }
      .details { background:#f9f9fb; border-radius:8px; padding:16px; margin:16px 0; }
      .details p { margin:6px 0; font-size:14px; }
      table.items { width:100%; border-collapse:collapse; margin:16px 0; }
      table.items th { text-align:left; font-weight:600; color:#333; padding:8px 10px; border-bottom:2px solid #eee; font-size:13px; }
      table.items td { padding:10px; border-bottom:1px solid #f1f1f1; font-size:14px; }
      .total-row td { font-weight:700; border-top:2px solid #ddd; padding-top:10px; }
      .footer { text-align:center; margin-top:20px; color:#888; font-size:13px; }
      .frontend-link { display:inline-block; background:#7a0e18; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin:16px 0; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="brand">Valerya — Bijoux d'exception</div>
        <div class="check">&#10003;</div>
        <div class="title">Merci pour votre commande !</div>
        <div class="subtitle">Votre commande #{{ $order->id }} a bien été enregistrée.</div>

        <div class="details">
          <p><strong>Date :</strong> {{ $order->created_at }}</p>
          <p><strong>Statut :</strong> En attente</p>
          <p><strong>Adresse de livraison :</strong> {{ $order->address }}</p>
          <p><strong>Téléphone :</strong> {{ $order->phone }}</p>
          @if(! empty($customer) && ! empty($customer->full_name))
            <p><strong>Client :</strong> {{ $customer->full_name }}</p>
          @endif
        </div>

        <h4 style="margin:0 0 4px;font-size:15px;">Récapitulatif de votre commande</h4>
        <table class="items">
          <thead>
            <tr>
              <th>Produit</th>
              <th style="text-align:center">Qté</th>
              <th style="text-align:right">Prix</th>
            </tr>
          </thead>
          <tbody>
            @foreach($order->items as $item)
              <tr>
                <td>
                  <div style="display:flex;gap:8px;align-items:center">
                    @if(! empty(data_get($item, 'product.image')))
                      <img src="{{ data_get($item, 'product.image') }}" alt="" width="40" height="40" style="object-fit:cover;border-radius:6px;" />
                    @elseif(! empty(data_get($item, 'product.images.0')))
                      <img src="{{ data_get($item, 'product.images.0') }}" alt="" width="40" height="40" style="object-fit:cover;border-radius:6px;" />
                    @endif
                    <div>{{ data_get($item, 'product.name', 'Produit') }}</div>
                  </div>
                </td>
                <td style="text-align:center">{{ data_get($item, 'quantity', 1) }}</td>
                @php
                  $unitPrice = data_get($item, 'product.discount_price') ?: data_get($item, 'product.price', 0);
                  $unitPrice = (float) $unitPrice;
                  $lineTotal = $unitPrice * (int) data_get($item, 'quantity', 1);
                @endphp
                <td style="text-align:right">{{ number_format($lineTotal, 2) }} MAD</td>
              </tr>
            @endforeach
            <tr class="total-row">
              <td colspan="2" style="text-align:right">Total</td>
              <td style="text-align:right">{{ number_format($order->total, 2) }} MAD</td>
            </tr>
          </tbody>
        </table>

        @if($order->discount_amount > 0)
          <p style="font-size:14px;color:#666;text-align:right;">Réduction appliquée : -{{ number_format($order->discount_amount, 2) }} MAD</p>
        @endif

        <div style="text-align:center;margin-top:8px;">
          @php
            $profileLink = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/profile?tab=orders';
          @endphp
          <a class="frontend-link" href="{{ $profileLink }}">Suivre ma commande</a>
        </div>

        <div class="footer">
          <p>Valerya — Bijoux d'exception<br>
          Une question ? Contactez-nous par email.</p>
        </div>
      </div>
    </div>
  </body>
</html>
