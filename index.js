const fs = require('fs')
const Stripe = require('stripe');
const STRIPE_TEST_SECRET_KEY = 'sk_test_51MEuPXA69JWLHl3Jxw3gKWTtXJCOkzmvjDs5oJ45DZEHFzo5HLz5JfWkNvzU03eCyo0ojkiW2ot6WXA8udWEkh0300nAnoJmcj'
const stripe = Stripe(STRIPE_TEST_SECRET_KEY);

const handler = async (country) => {

  try{
    let finalCustomers = []

    // load customers.json 
    const customers = JSON.parse(fs.readFileSync('customers.json', 'utf-8'));

    const targetCountry = (country || '').trim().toUpperCase();
    if (!targetCountry) throw new Error('Please provide a country alpha-2 code (e.g., "BE").');

    // filter by country
     const filtered = customers.filter(c =>
      (c.country || c.countryCode || '').toString().trim().toUpperCase() === targetCountry
    );


     // transform customers to save into Stripe
    for (const c of filtered) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || undefined;
      const email = (c.email || '').trim().toLowerCase();
      if (!email) continue;

      
      // for each customer create a Stripe customer
      const created = await stripe.customers.create({
        name,
        email,
        metadata: {
          source_id: c.id ? String(c.id) : '',
          source_country: targetCountry,
        },
      });

      // push into finalCustomers the stripe customers with email, country and id as properties.
      finalCustomers.push({
        email,
        customerId: created.id,
        country: targetCountry,
      });
    }

    // write finalCustomers array into final-customers.json using fs
    fs.writeFileSync('final-customers.json', JSON.stringify(finalCustomers, null, 2), 'utf-8');

    

    console.log(finalCustomers)

}catch(e){
  throw e
}
};
module.exports = { handler };


