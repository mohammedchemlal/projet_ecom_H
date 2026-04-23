<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Nouvelle commande #{{ $order->id }}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #222; background:#f7f7f8; margin:0; padding:24px 0; }
      .wrapper { max-width:720px; margin:0 auto; }
      .card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 6px 22px rgba(10,10,10,0.06); }
      header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
      .brand { font-weight:700; color:#7a0e18; font-size:18px; }
      .meta { color:#666; font-size:13px; }
      .order-items td, .order-items th { padding:8px 10px; border-bottom:1px solid #f1f1f1; }
      .order-items th { text-align:left; font-weight:600; color:#333; }
      .total { font-weight:700; font-size:16px; text-align:right; }
      .btn { display:inline-block; background:#7a0e18; color:#fff; padding:10px 14px; border-radius:8px; text-decoration:none; }
      .footer { margin-top:14px; color:#777; font-size:13px; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <header>
          @php
            $logoUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/favicon.ico';
            $adminLink = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/admin/orders/' . $order->id;
          @endphp
          <img src="{{ $logoUrl }}" alt="logo" width="48" height="48" style="border-radius:8px;object-fit:contain" />
          <div>
            <div class="brand">Valerya — Nouvelle commande</div>
            <div class="meta">Commande #{{ $order->id }} • {{ $order->created_at }}</div>
          </div>
        </header>

        <section>
          <p><strong>Montant total :</strong> {{ number_format($order->total, 2) }} MAD</p>
          <p><strong>Remise :</strong> {{ number_format($order->discount_amount ?? 0, 2) }} MAD</p>
          <p><strong>Code promo :</strong> {{ $order->promo_code ?? '—' }}</p>
          <p><strong>Statut :</strong> {{ $order->status }}</p>
          <p><strong>Adresse de livraison :</strong> {{ $order->address }}</p>
          <p><strong>Téléphone :</strong> {{ $order->phone }}</p>
          @if(! empty($customer))
            <p><strong>Client :</strong> {{ $customer->full_name ?? '—' }} ({{ $customer->email ?? '—' }})</p>
            @if(! empty($customer->address))
              <p><strong>Adresse de facturation :</strong> {{ $customer->address }}</p>
            @endif
          @else
            <p><strong>Client :</strong> Visiteur</p>
          @endif
        </section>

        <h4 style="margin-top:18px">Articles</h4>
        <table class="order-items" width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th>Produit</th>
              <th style="width:90px;text-align:center">Quantité</th>
              <th style="width:120px;text-align:right">Prix</th>
            </tr>
          </thead>
          <tbody>
            @foreach($order->items as $item)
              <tr>
                <td>
                  <div style="display:flex;gap:8px;align-items:center">
                    @if(! empty(data_get($item, 'product.image')))
                      <img src="{{ data_get($item, 'product.image') }}" alt="" width="48" height="48" style="object-fit:cover;border-radius:6px;" />
                    @elseif(! empty(data_get($item, 'product.images.0')))
                      <img src="{{ data_get($item, 'product.images.0') }}" alt="" width="48" height="48" style="object-fit:cover;border-radius:6px;" />
                    @endif
                    <div>{{ data_get($item, 'product.name', 'Produit') }}</div>
                  </div>
                </td>
                <td style="text-align:center">{{ data_get($item, 'quantity', 1) }}</td>
                @php
                  $unitPrice = data_get($item, 'product.discount_price');
                  if ($unitPrice === null || $unitPrice === '') {
                    $unitPrice = data_get($item, 'product.price', 0);
                  }
                  $unitPrice = (float) $unitPrice;
                  $quantity = (int) data_get($item, 'quantity', 1);
                  $lineTotal = $unitPrice * $quantity;
                @endphp
                <td style="text-align:right">{{ number_format($unitPrice, 2) }} MAD<br/><small style="color:#666">Ligne: {{ number_format($lineTotal, 2) }} MAD</small></td>
              </tr>
            @endforeach
          </tbody>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">
          <div class="footer">Consultez le tableau d'administration pour traiter la commande.</div>
          <div>
            <a class="btn" href="{{ $adminLink }}">Voir la commande</a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
