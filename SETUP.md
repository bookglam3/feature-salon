# Feature Salon Setup Guide

## Prerequisites
- Node.js 16+
- Supabase account
- Stripe account

## 1. Supabase Setup

### Create these tables in Supabase:

#### `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner', -- owner, staff
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `salons`
```sql
CREATE TABLE salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `appointments`
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  staff_id UUID REFERENCES staff(id),
  service_id UUID REFERENCES services(id),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  date_time TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
  stripe_payment_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `services`
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `staff`
```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  user_id UUID REFERENCES auth.users(id), -- for staff login
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'stylist', -- stylist, makeup-artist, esthetician, receptionist, manager
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 2. Environment Variables

Create a `.env.local` file in your project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_pk_test_your_key
STRIPE_SECRET_KEY=sk_live_or_sk_test_your_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
```

Get your Supabase keys from:
- Settings > API > Project API Keys

Get your Stripe keys from:
- Dashboard > Developers > API Keys

## 3. Installation

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## 4. Features

### For Salon Owners
- **Dashboard**: View today's bookings, revenue, and key metrics
- **Bookings**: Create, view, and manage all appointments
- **Clients**: Track all clients and their booking history
- **Staff**: Manage team members and their roles
- **Payments**: Integrated with Stripe (optional per booking)

### For Clients
- **Public Booking Page**: Visit `/book/[salon-slug]` to book appointments
- **Service Selection**: Choose from available services and stylists
- **Date & Time Selection**: Pick available slots
- **Payment**: Optional upfront payment via Stripe

## 5. Stripe Integration

### Payment Flow
1. Client selects "Charge my card now" on booking page
2. Stripe Payment Element collects card details
3. Payment is processed and appointment status set to "confirmed"
4. Without payment selection, appointment stays "pending"

### Testing
Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Exp: Any future date
- CVC: Any 3 digits

## 6. User Flows

### Sign Up
1. Navigate to `/signup`
2. Enter salon name, email, and password
3. Account created with default "starter" plan
4. Redirects to dashboard
5. Prompted to add staff and services

### Login
1. Navigate to `/login`
2. Enter credentials
3. Redirects to dashboard

### Booking (as Client)
1. Visit `/book/salon-slug`
2. Select service and staff (optional)
3. Pick date and time
4. Enter name, email, phone
5. Optionally charge card now
6. Confirmation sent to email

### Managing Bookings (as Owner)
1. Dashboard shows today's bookings and revenue
2. Bookings page lists all appointments with filters
3. "+ New Booking" button opens form to create manually
4. Can view client history and notes

## 7. Database Notes

- All IDs use UUID for security
- Timestamps in UTC
- Salon slugs are auto-generated from salon names (lowercase, hyphens)
- Appointments link to salons, services, and staff
- Status tracking: pending → confirmed → completed

## 8. Troubleshooting

### "Salon not found"
- Check that the booking link includes the correct slug
- Slugs are lowercase with hyphens replacing spaces

### Payment failures
- Ensure Stripe keys are correctly set in `.env.local`
- Check Stripe dashboard for error logs
- Use Stripe test cards in test mode

### Table structure errors
- Run the SQL migrations above in Supabase
- Ensure all foreign keys are created
- Check Row Level Security (RLS) policies if needed

## 9. Security

- Row Level Security (RLS) should be enabled on all tables
- Users can only view their own salon data
- Stripe keys never exposed on client
- Passwords hashed by Supabase Auth

## 10. Next Steps

- Add email reminders (Supabase functions + SendGrid)
- SMS notifications for clients
- Advanced reporting and analytics
- Multi-staff availability
- Custom branding per salon
