const fs = require('fs')
const Stripe = require('stripe');
const STRIPE_TEST_SECRET_KEY = 'sk_test_51MEuPXA69JWLHl3Jxw3gKWTtXJCOkzmvjDs5oJ45DZEHFzo5HLz5JfWkNvzU03eCyo0ojkiW2ot6WXA8udWEkh0300nAnoJmcj'
const stripe = Stripe(STRIPE_TEST_SECRET_KEY);

// fetch polyfill for Node < 18 
let _fetch = global.fetch;
if (typeof _fetch !== 'function') {
  try { _fetch = require('node-fetch'); }
  catch {
    throw new Error('Global fetch not available. Install node-fetch: npm i node-fetch');
  }
}

const handler = async (country) => {
  
  try {
    let finalCustomers = []

    // load customers from public API
    const norm = (s) => (s || '').toString().trim();
    const DATA_URL = 'https://ops-challenge-f4e887b4ef3a.herokuapp.com/data';
    const DATA_API_KEY = process.env.DATA_API_KEY || 'pk_7f8a9b2c4d6e1f3a5b8c9d0e2f4a6b7c';

  
    // normalize input into a valid ISO alpha-2 country code
    const alpha2ToName = JSON.parse(fs.readFileSync('countries-ISO3166.json', 'utf-8'));

    const toAlpha2 = (input) => {
      const q = norm(input);
      if (!q) return null;
      const maybe = q.toUpperCase();
      if (alpha2ToName[maybe]) return maybe; 
      const target = q.toLowerCase();
      for (const [code, name] of Object.entries(alpha2ToName)) {
        if ((name || '').toLowerCase() === target) return code.toUpperCase();
      }
      return null;
    };

    // fetch all customers from the challenge Data API.
    const fetchAllCustomers = async () => {
      const url = `${DATA_URL}?api_key=${DATA_API_KEY}`;
      const res = await _fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Data API failed: ${res.status} ${res.statusText} — ${txt}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.customers)) return data.customers;
      if (Array.isArray(data.data)) return data.data;
      throw new Error('Unexpected API response format.');
    };

    // filter the customers by country 
    const filterByCountry = (rows, alpha2) => {
      const wantedName = (alpha2ToName[alpha2] || '').toLowerCase();
      return rows.filter((c) => {
        const raw = norm(c.countryCode || c.country);
        if (!raw) return false;
        if (raw.toUpperCase() === alpha2) return true;      
        return raw.toLowerCase() === wantedName;            
      });
    };

    // transform customers to save into Stripe
    const toStripePayload = (c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      const email = norm(c.email).toLowerCase();
      if (!email) return null;
      return {
        name: name || undefined,
        email,
        metadata: {
          source_id: c.id ? String(c.id) : '',
          source_country: norm(c.countryCode || c.country),
        },
      };
    };

    // validate/resolve country
    if (!norm(country)) throw new Error('Please provide a country name, e.g., handler("Spain").');
    const alpha2 = toAlpha2(country);
    if (!alpha2) throw new Error(`Invalid or unknown country "${country}". Try "Spain" or "ES".`);

    // Step 1: fetch all customers
    const all = await fetchAllCustomers();

    // Step 2: filter by selected country
    const filtered = filterByCountry(all, alpha2);

    // Step 3: for each customer create a Stripe customer
    for (const c of filtered) {
      const payload = toStripePayload({ ...c, countryCode: alpha2 }); 
      if (!payload) continue;
      try {
        const created = await stripe.customers.create(payload);
        // push into finalCustomers with email, Stripe id and country
        finalCustomers.push({
          email: payload.email,
          customerId: created.id,
          country: alpha2,
        });
      } catch (err) {
        console.error(`Stripe create failed for ${payload.email}:`, err?.message || err);
      }
    }

    // Step 4: write final-customers array into final-customers.json using fs
    try {
      fs.writeFileSync('final-customers.json', JSON.stringify(finalCustomers, null, 2), 'utf-8');
      console.log('final-customers.json written successfully.');
    } catch (err) {
      console.log('Failed to write final-customers.json:', err?.message || err);
    }


    console.log(finalCustomers)

  } catch (e) {
    throw e
  }
}

module.exports = { handler }

// minimal CLI so `node index.js Spain` runs the handler 
if (require.main === module) {
  const argCountry = process.argv.slice(2).join(' ');
  if (!argCountry) {
    console.error('Please provide a country, e.g. `node index.js Spain`');
    process.exit(1);
  }
  handler(argCountry).catch((e) => {
    console.error('Handler error:', e?.message || e);
    process.exit(1);
  });
}
