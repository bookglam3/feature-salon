# Environment Setup Quick Guide

## Step 1: Create `.env.local` file

Create a file named `.env.local` in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe Configuration (use test keys for development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
```

## Step 2: Get Supabase Keys

1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use existing
3. Go to **Settings** → **API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon/Public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Get Stripe Keys

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Click **Developers** → **API Keys** in sidebar
3. For **development**, use **Test keys**:
   - Publishable Key (pk_test_...) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret Key (sk_test_...) → `STRIPE_SECRET_KEY`

## Step 4: Set up Supabase Tables

In Supabase SQL Editor, run:

```sql
-- Salons Table
CREATE TABLE salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Services Table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff Table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'stylist',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  staff_id UUID REFERENCES staff(id),
  service_id UUID REFERENCES services(id),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  date_time TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending',
  stripe_payment_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_appointments_salon_id ON appointments(salon_id);
CREATE INDEX idx_appointments_date_time ON appointments(date_time);
CREATE INDEX idx_services_salon_id ON services(salon_id);
CREATE INDEX idx_staff_salon_id ON staff(salon_id);
CREATE INDEX idx_salons_owner_id ON salons(owner_id);
```

## Step 5: Add Sample Data (Optional)

```sql
-- Add a service
INSERT INTO services (salon_id, name, duration_minutes, price) 
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with your salon ID
  'Haircut',
  60,
  45.00
);

-- Add a staff member
INSERT INTO staff (salon_id, name, email, role)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with your salon ID
  'Emma Styles',
  'emma@salon.com',
  'stylist'
);
```

## Step 6: Run the App

```bash
npm run dev
```

Visit `http://localhost:3000`

## Step 7: Test the Flow

1. **Sign Up**: Go to `/signup`, create account
2. **Add Services & Staff**: In dashboard, add test data
3. **Test Booking**: Visit `/book/your-salon-slug`
4. **Test Payment**: Use Stripe test card `4242 4242 4242 4242`

## Stripe Test Cards

| Card | Status | Use |
|------|--------|-----|
| 4242 4242 4242 4242 | Success | Test successful payments |
| 4000 0000 0000 0002 | Decline | Test payment failures |
| 4000 0000 0000 9995 | CVC Decline | Test CVC validation |
| 4000 0000 0000 0077 | Requires Auth | Test 3D Secure |

**Exp Date**: Any future date (e.g., 12/25)
**CVC**: Any 3 digits (e.g., 123)

## Environment Variables Checklist

- [ ] `.env.local` created
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set
- [ ] `STRIPE_SECRET_KEY` set
- [ ] `.env.local` added to `.gitignore` (should be by default)

## Verification

Run this to verify setup:

```bash
# Check Node version
node --version  # Should be 16+

# Install dependencies
npm install

# Run development server
npm run dev

# Check for errors
npm run lint
```

## Deployment

### Before going live:

1. Create **Production** Stripe keys (pk_live_, sk_live_)
2. Use production Supabase project
3. Update `.env.local` with production keys
4. Enable Row Level Security (RLS) on Supabase tables
5. Set up email notifications (optional)
6. Configure CORS in Supabase

### Deploy to Vercel:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_SECRET_KEY
vercel deploy
```

## Troubleshooting

### "Cannot find module '@stripe/stripe-js'"
```bash
npm install @stripe/stripe-js
```

### "Supabase URL is not set"
Check `.env.local` exists and has `NEXT_PUBLIC_SUPABASE_URL`

### Payment fails with "Invalid Stripe key"
Verify publishable key starts with `pk_test_` or `pk_live_`

### "Unknown table: appointments"
Run the SQL migrations in Supabase SQL Editor

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Stripe Docs**: https://stripe.com/docs/payments
- **Next.js Docs**: https://nextjs.org/docs
