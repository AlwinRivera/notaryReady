export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, successUrl, cancelUrl } = req.body;

  const PLANS = {
    onetime: { name: 'NotaryReady — Single Document',  amount: 9900,  uses: 1   },
    bundle:  { name: 'NotaryReady — 5 Document Bundle', amount: 39900, uses: 5   },
    monthly: { name: 'NotaryReady — Monthly Unlimited', amount: 29900, uses: 999 }
  };

  const selected = PLANS[plan];
  if (!selected) return res.status(400).json({ error: 'Invalid plan' });

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Payment not configured' });

  try {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: { name: 'NotaryReady Customer' },
            line_items: [{
              currency: 'PHP',
              amount: selected.amount,
              name: selected.name,
              quantity: 1,
              description: selected.name
            }],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            success_url: successUrl,
            cancel_url: cancelUrl,
            description: selected.name,
            metadata: { plan, uses: selected.uses }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.errors?.[0]?.detail || 'PayMongo error' });
    }

    return res.status(200).json({
      checkoutUrl: data.data.attributes.checkout_url,
      sessionId: data.data.id
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
