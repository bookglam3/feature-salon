# Feature Salon - Testing Checklist

## Before Testing
- [ ] Set up `.env.local` with Supabase and Stripe keys
- [ ] Create all required tables in Supabase (see SETUP.md)
- [ ] Add sample services and staff to your salon
- [ ] Run `npm install` and `npm run dev`

## Authentication Flow

### Sign Up
- [ ] Navigate to `http://localhost:3000/signup`
- [ ] Enter salon name (e.g., "The Cut Studio")
- [ ] Enter email and password
- [ ] Click "Create free account"
- [ ] See success message: "Check your email to confirm your account"
- [ ] Redirected to `/dashboard` after 2 seconds
- [ ] Verify salon created in Supabase with:
  - [ ] Correct name
  - [ ] Correct slug (lowercase, hyphens)
  - [ ] Default plan: "starter"
  - [ ] Correct owner_id

### Login
- [ ] Navigate to `http://localhost:3000/login`
- [ ] Enter credentials from signup
- [ ] Click "Sign in"
- [ ] Redirected to `/dashboard`
- [ ] Can see salon name in sidebar

### Logout
- [ ] In dashboard, click "Sign out" button
- [ ] Redirected to login page

## Dashboard Features

### Navigation
- [ ] Sidebar shows 4 main nav items: Dashboard, Bookings, Clients, Staff
- [ ] Clicking each nav item navigates correctly
- [ ] Active nav item highlighted in blue (#4F6EF7)
- [ ] Logo in navbar links back to homepage

### Dashboard Page
- [ ] Display 4 stat cards: Today's bookings, Revenue today, Total bookings, Salon plan
- [ ] "Today's bookings" shows correct count
- [ ] "Revenue today" sums prices of today's appointments
- [ ] Appointments table shows: Status, Client, Service, Staff, Date & Time, Amount
- [ ] Filter tabs work: All, Today, Upcoming
- [ ] "+ New Booking" button visible and clickable

### Bookings Page
- [ ] Navigate from sidebar or dashboard link
- [ ] Display all bookings in table format
- [ ] Filter tabs work: All, Today, Upcoming
- [ ] "+ New Booking" button opens form with fields:
  - [ ] Client Name
  - [ ] Client Email
  - [ ] Client Phone
  - [ ] Service (dropdown)
  - [ ] Staff (dropdown)
  - [ ] Date/Time
  - [ ] Status (dropdown: pending, confirmed, cancelled)
- [ ] Clicking "Create" adds appointment to database
- [ ] Form clears after successful creation
- [ ] New booking appears in table immediately

### Clients Page
- [ ] Navigate from sidebar
- [ ] Shows list of all unique clients
- [ ] Display columns: Name, Email, Phone, Total Bookings, Last Booking
- [ ] Search box filters by name/email
- [ ] "Total Bookings" badge shows correct count
- [ ] Shows "—" for null values

### Staff Page
- [ ] Navigate from sidebar
- [ ] Display all staff members with: Name, Email, Role
- [ ] "+ Add Staff" button opens form
- [ ] Form has fields: Name, Email, Role (dropdown)
- [ ] Can add new staff member
- [ ] Staff appears in table after creation
- [ ] "Delete" button removes staff member with confirmation

## Public Booking Page

### Access
- [ ] Get your salon slug (e.g., "the-cut-studio")
- [ ] Visit `http://localhost:3000/book/the-cut-studio`
- [ ] Page loads with your salon name
- [ ] Shows 3-step progress: Service, Date & Time, Your details

### Step 1: Service Selection
- [ ] All services display with: Name, Duration, Price
- [ ] Can click to select a service
- [ ] Selected service highlighted with blue border
- [ ] Staff selection shows if available
- [ ] "Continue" button enabled after service selection
- [ ] "Continue" button disabled if no service selected

### Step 2: Date & Time
- [ ] Date picker shows calendar
- [ ] Can only select today or future dates
- [ ] After selecting date, time slots appear
- [ ] Time slots show in 30-min intervals (09:00, 09:30, etc.)
- [ ] Can select a time slot
- [ ] Selected time highlighted
- [ ] "Back" and "Continue" buttons work

### Step 3: Your Details
- [ ] Shows booking summary with: Service, Date, Time, Staff, Price
- [ ] Form fields: Name, Email, Phone
- [ ] If service has price > 0, shows "Charge my card now" checkbox
- [ ] Checking "Charge my card now" reveals card input field
- [ ] Stripe card element loads correctly
- [ ] "Back" button returns to step 2
- [ ] "Confirm booking" button disabled until name/email filled

### Payment Flow (if enabled)
- [ ] Check "Charge my card now"
- [ ] Card input field appears
- [ ] Enter test card: 4242 4242 4242 4242
- [ ] Enter any future exp date
- [ ] Enter any 3-digit CVC
- [ ] Click "Confirm booking"
- [ ] See "Processing..." state
- [ ] Success page shows with checkmark: "Booking confirmed!"
- [ ] Verify in Supabase:
  - [ ] Appointment created with status: "confirmed"
  - [ ] stripe_payment_id stored
- [ ] Failed payment (use 4000 0000 0000 0002):
  - [ ] Error message displays
  - [ ] Appointment not created

### Booking Confirmation
- [ ] Success page shows:
  - [ ] Checkmark icon
  - [ ] "Booking confirmed!" title
  - [ ] Service name, date, time
  - [ ] "Confirmation will be sent to [email]" message
  - [ ] "Powered by feature" footer

## Database Verification

### Salons Table
- [ ] Has columns: id, name, slug, owner_id, plan, created_at
- [ ] New salons created on signup

### Appointments Table
- [ ] Has columns: id, salon_id, staff_id, service_id, client_name, client_email, 
      client_phone, date_time, status, stripe_payment_id, created_at
- [ ] Bookings from public form: status = "pending" (or "confirmed" if paid)
- [ ] Bookings from dashboard: status as selected

### Services Table
- [ ] Has columns: id, salon_id, name, duration_minutes, price, created_at

### Staff Table
- [ ] Has columns: id, salon_id, name, email, role, created_at

## Stripe Integration

### Test Mode
- [ ] Dashboard shows Stripe test mode keys
- [ ] No real charges made
- [ ] Use Stripe test cards:
  - [ ] 4242 4242 4242 4242 (success)
  - [ ] 4000 0000 0000 0002 (decline)

### Payment Webhook (optional)
- [ ] Set up Stripe webhook to update appointment status
- [ ] Webhook endpoint: `/api/webhook/stripe` (if implemented)
- [ ] Listen for: payment_intent.succeeded, payment_intent.payment_failed

## Design Consistency

### Colors
- [ ] Primary: #4F6EF7 (blue)
- [ ] Background: #F2F4F7 (light gray)
- [ ] White cards with subtle borders
- [ ] Text: #0F172A (dark), #64748B (gray), #94A3B8 (lighter gray)

### Layout
- [ ] Sidebar: 220px width, left-aligned
- [ ] Main content: Full width minus sidebar
- [ ] Cards: 10px border radius, 0.5px subtle borders
- [ ] Consistent padding: 24px, 16px, 12px

### Typography
- [ ] Headings: Georgia serif 24-56px
- [ ] Body: system font 13-14px
- [ ] Buttons: 13-15px
- [ ] Clean, minimal design

## Edge Cases

### Error Handling
- [ ] Invalid salon slug: Shows "Salon not found"
- [ ] Failed Supabase queries: Shows error message
- [ ] Stripe error: Shows payment error
- [ ] Duplicate email signup: Shows error "User already exists"

### Permissions
- [ ] Can only see own salon in dashboard
- [ ] Cannot access other salon's data
- [ ] Can book on any public salon page

## Performance

### Load Times
- [ ] Dashboard loads < 1 second
- [ ] Booking page loads < 1 second
- [ ] Table with 100 appointments loads smoothly

### Responsiveness
- [ ] Works on mobile (375px)
- [ ] Works on tablet (768px)
- [ ] Works on desktop (1440px)

## Final Checklist

- [ ] All auth flows working
- [ ] All navigation working
- [ ] All CRUD operations working
- [ ] Payments processing correctly
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Supabase tables matching schema
- [ ] Design consistent throughout
- [ ] Ready for deployment

## Notes
- Update `.env.local` with live Stripe keys before production
- Enable Row Level Security (RLS) on all Supabase tables
- Set up email reminders (optional: Supabase Functions + SendGrid)
- Monitor Stripe payments in dashboard
