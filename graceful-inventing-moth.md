# Analýza WordPress projektu JobSphere.eu

## Stručný prehľad

JobSphere.eu je **komplexná platforma pre job board a freelance marketplace** postavená na WordPress s témou WorkScout. Jedná sa o multi-tenant systém s dvojitými používateľskými rolami (Kandidáti vs. Zamestnávatelia) s pokročilými funkciami pre správu pracovných ponúk, životopisov, firemných profilov a freelance projektov.

**Typ projektu:** Enterprise-level job board + Freelance marketplace
**Hlavná téma:** WorkScout v4.1.03 (+ Child téma)
**Počet pluginov:** 47 aktívnych pluginov
**Počet vlastných šablón:** 25+ špeciálnych page templates

---

## 1. KĽÚČOVÉ FUNKCIONALITY

### 1.1 Používateľský systém a autentifikácia

**Používateľské role:**
- **Candidate** (Kandidát) - Hľadá prácu, posiela životopisy
- **Employer** (Zamestnávateľ) - Pridáva pracovné ponuky, hľadá kandidátov
- Štandardné WordPress role (Admin, Editor, atď.)

**Funkcie:**
- Vlastný registračný formulár s výberom role
- Prihlásenie cez WorkScout/WooCommerce/vlastný systém
- Role-based dashboardy (samostatné pre Candidate/Employer)
- Osobný profil s rozšírenými poľami
- Employer dashboard menu
- Candidate dashboard menu

**Relevantné súbory:**
- `wp-content/themes/workscout/template-login.php`
- `wp-content/themes/workscout/inc/extras.php` (role management)
- `wp-content/themes/workscout/template-dashboard.php` (48KB - hlavný dashboard)

---

### 1.2 Job Listing systém

**Core funkcionality:**
- Pridávanie pracovných ponúk (cez WP Job Manager)
- Pokročilé filtrovanie (lokácia, kategória, typ, mzda, tagy)
- AJAX-based real-time filtering
- Mapové zobrazenie (Google Maps s markermi)
- Split-view layout (mapa + zoznam)
- Full-page layouts
- Deadline pre aplikácie
- Platené listingy cez WooCommerce

**Custom post type:** `job_listing`

**Taxonomies:**
- `job_listing_category` - Kategórie práce
- `job_listing_region` - Regióny/lokácie
- `job_listing_tag` - Tagy
- `job_listing_type` - Typy práce (full-time, part-time, atď.)

**Pluginy:**
- WP Job Manager (core)
- WP Job Manager - Applications
- WP Job Manager - Alerts
- WP Job Manager - Bookmarks
- WP Job Manager - Tags
- WP Job Manager - Locations
- WP Job Manager - Application Deadline
- WP Job Manager - WC Paid Listings

**Šablóny:**
- `template-jobs.php` - Jobs s filtrami
- `template-jobs-fullpage.php` - Full page layout
- `template-jobs-no-map.php` - Bez mapy
- `template-splitmap.php` - Split layout s mapou
- `archive-job_listing.php` - Archív ponúk
- `single-job_listing.php` - Detail ponuky
- `taxonomy-job_listing_*.php` - Taxonomie

**JavaScript:**
- `workscout-ajax-filters.min.js` - AJAX filtrovanie
- Salary/rate range slidery
- Autocomplete search suggestions

---

### 1.3 Resume/CV Management

**Funkcionality:**
- Pridávanie životopisov kandidátov
- Portfolio/galéria prác
- Skills taxonomia
- Filtrovanie podľa kategórie, regiónu, skills
- Zaokrúhlené fotografie kandidátov (nastaviteľné)
- Private messaging s kandidátmi

**Custom post type:** `resume`

**Taxonomies:**
- `resume_category` - Kategórie
- `resume_region` - Regióny
- `resume_skill` - Zručnosti

**Pluginy:**
- WP Job Manager - Resumes

**Šablóny:**
- `template-resumes.php` - Resumes s filtrami
- `template-resumes-fullpage.php`
- `template-home-resumes.php` - Resume search homepage
- `template-splitmap-resumes.php` - Split view
- `archive-resume.php`
- `single-resume.php` (14KB)

**Meta boxes:**
- Resume Gallery - Upload portfolia
- Custom fields cez CMB2

---

### 1.4 Company Management

**Funkcionality:**
- Firemné profily
- Company reviews/ratings
- Job listings pre companies
- Rozšírené firemné údaje (headquarters, founded, employees, industry, revenue)
- Social media integrácia (Twitter, Facebook)
- Company strength (veľkosť firmy)
- Company average salary ranges

**Custom post type:** `company`

**Taxonomies:**
- `company_strength` - Veľkosť firmy
- `company_category` - Odvetvie
- `company_revenue` - Príjmy
- `company_average_salary` - Priemerná mzda

**Pluginy:**
- MAS WP Job Manager Company
- MAS WP Job Manager Company Reviews

**Šablóny:**
- `archive-company.php`
- `single-company.php` (16KB - detail firmy)
- `content-company.php`

**Meta polia:**
- Headquarters, Founded date, Tagline, Website, Email, Phone
- Twitter, Facebook URLs
- Custom header background

---

### 1.5 Freelancer & Task Management

**Funkcionality:**
- Task/Project post type
- Bidding systém pre freelancerov
- Milestone-based projekty
- Commission tracking a payout management
- Task packages cez WooCommerce
- Freelancer reviews/ratings
- Cron jobs pre expirované tasky

**Custom post type:** `task`

**Pluginy:**
- WorkScout Freelancer (v1.1.2) - vlastný plugin
- WorkScout Core (activity logging, messaging, commissions)

**Šablóny:**
- `template-tasks.php`
- `template-tasks-fullpage.php`

**Databázové tabuľky:**
- Activity logs (user actions)
- Messages/conversations (private messaging)
- Commissions (sledovanie provízie)

**Features:**
- PayPal integrácia pre payouts
- Milestone produkt typ v WooCommerce
- Sledovanie statusov projektov

---

### 1.6 Application System

**Funkcionality:**
- Aplikácie na job listingy
- Application dashboard
- Ukladanie aplikácií (nie len email)
- Application statistics
- Default application forms
- Notification system

**Plugin:**
- WP Job Manager - Applications (v3.2.0)

**Súbory:**
- Šablóny v `job_manager/` directory
- Application handling v dashboard template

---

### 1.7 E-Commerce a platobný systém

**Platforma:** WooCommerce v10.4.3

**Funkcionality:**
- Job packages (platené job listingy)
- Resume packages
- Task packages
- Milestone produkty pre freelance projekty
- Commission management
- Payout tracking
- Order management
- Invoice generation

**Pluginy:**
- WooCommerce (core)
- WooCommerce Payments
- WooCommerce Google Analytics Integration
- Facebook for WooCommerce
- Google Listings & Ads
- Print Invoices & Packing Slips

**Custom produkt typy:**
- `job_package`
- `resume_package`
- Milestone products

**Šablóny:**
- `template-jobpackages.php`
- `template-resumepackages.php`
- WooCommerce integrácia v theme

**Payment gateways:**
- PayPal (pre payouts)
- WooCommerce Payments
- Facebook Pay

---

### 1.8 Messaging a komunikácia

**Funkcionality:**
- Private messaging medzi kandidátmi a zamestnávateľmi
- Conversations systém
- Activity logging (user actions)
- Email notifikácie
- Newsletter systém

**Pluginy:**
- WorkScout Core (messaging systém)
- MailPoet (email marketing)
- Contact Form 7
- SmartSupp Live Chat

**Databázové tabuľky:**
- Messages
- Conversations
- Activity logs

**Features:**
- Real-time chat cez SmartSupp
- Email campaigny cez MailPoet
- Contact formuláre

---

### 1.9 Search a Filtering

**Typy vyhľadávania:**
1. **Job Search:**
   - Keyword search s autocomplete
   - Location filter
   - Job type (full-time, part-time, contract, atď.)
   - Categories
   - Salary range slider
   - Rate slider
   - Tags
   - Remote work filter

2. **Resume Search:**
   - Keyword search s autocomplete
   - Location filter
   - Categories
   - Skills filter
   - Region filter

3. **Company Search:**
   - Industry filter
   - Company size
   - Revenue bracket
   - Average salary

**Technológie:**
- AJAX real-time filtering
- jQuery range sliders
- Autocomplete suggestions (AJAX endpoints)
- Transient caching (24h) pre min/max values
- Google Maps marker clustering

**JavaScript:**
- `workscout-ajax-filters.min.js`
- `workscout-resumes-ajax-filters.min.js`

**AJAX Endpoints:**
- `wp_ajax_workscout_incremental_jobs_suggest`
- `wp_ajax_workscout_incremental_resumes_suggest`

---

### 1.10 Map Integration

**Funkcionality:**
- Google Maps s marker clustering
- Split-view layouts (mapa + zoznam)
- Custom map height (nastaviteľné)
- Location-based filtering
- Geolocation support

**Plugin:**
- WP Job Manager - Locations

**JavaScript:**
- jQuery GMap
- Marker clustering

**Nastavenia:**
- Google Maps API key (voliteľné)
- Default map height
- Map styles

---

## 2. DESIGN A UI/UX KOMPONENTY

### 2.1 Page Builder integrácia

**Podporované buildery:**
- **Elementor** (v3.34.0) - Hlavný page builder
- **Visual Composer / WPBakery** - Legacy podpora
- WorkScout Elementor (custom widgety)

**Custom Elementor locations:**
- Header
- Footer

### 2.2 Layouty a šablóny

**Layout možnosti:**
- Full-width
- Sidebar left
- Sidebar right
- Split-view (mapa + obsah)
- Boxed layout
- Full-page layouts

**Special layouts:**
- Jobs Search (home)
- Jobs Search (boxed)
- Resumes Search
- Split Map Jobs
- Split Map Resumes
- Dashboard
- Login page
- Contact page

### 2.3 UI Komponenty

**Forms:**
- Select2 dropdowns
- Chosen selectors
- Dropzone file upload
- jQuery UI datepickers
- Range sliders (salary/rate)

**Media:**
- Slick carousel
- Flexslider
- Magnific Popup (lightbox)
- Revolution Slider integrácia

**Navigation:**
- Superfish menus
- Mobile menu (hamburger)
- Breadcrumb navigation (Breadcrumb NavXT)
- WP PageNavi pagination

**Interactive:**
- Isotope masonry
- Waypoints scroll effects
- AJAX filters
- Autocomplete search

### 2.4 Ikony a fonty

**Icon sety:**
- Font Awesome (v4.x, 138KB)
- Line Awesome (113KB)
- Custom icons (45KB)
- Web Font Social Icons

**Typography:**
- Google Fonts cez Kirki
- Custom font loading
- Typography customizer

### 2.5 Responsive design

**Breakpoints:**
- Desktop (default)
- Tablet: 1290px (nastaviteľné `pp_alt_menu_width`)
- Mobile: Standard responsive

**CSS:**
- `responsive.min.css` (7.3KB)
- Mobile menu widget area
- RTL support (`rtl.css`, 10KB)

---

## 3. ADMINISTRÁCIA A CUSTOMIZER

### 3.1 Kirki Customizer Framework

**Customizer sekcie (15+ súborov):**

1. **Header** (`inc/customizer/header.php`):
   - Logo upload (standard + retina)
   - Transparent header logo
   - Header layout
   - Old/new header toggle

2. **Jobs** (`inc/customizer/jobs.php`):
   - Default job image
   - Search filter visibility (7 controls)
   - Job layout options

3. **Resumes** (`inc/customizer/resumes.php`):
   - Rounded photos toggle
   - Resume layout options
   - Private messaging enable/disable

4. **Tasks** (`inc/customizer/tasks.php`):
   - Task settings

5. **Dashboard** (`inc/customizer/dashboard.php`):
   - Dashboard appearance

6. **Maps** (`inc/customizer/maps.php`):
   - Map height
   - Google Maps API key

7. **Colors** (`inc/customizer/colors.php`):
   - Main color picker (`pp_main_color`)

8. **Layout** (`inc/customizer/layout.php`):
   - Sidebar settings

9. **Blog** (`inc/customizer/blog.php`):
   - Blog layout

10. **Shop** (`inc/customizer/shop.php`):
    - WooCommerce columns (2/3)
    - Related products toggle

11. **Footer** (`inc/customizer/footer.php`):
    - Footer widgets
    - Footer copyright

12. **Typography** (`inc/customizer/typography.php`):
    - Font selections

13. **Title/Tagline** (`inc/customizer/site-identity.php`):
    - Site branding

**Option name:** `workscout`

### 3.2 Meta Boxes (CMB2)

**Registered meta boxes:**

1. **Testimonials:**
   - Author
   - Link
   - Position

2. **Resume Gallery:**
   - File upload (portfolio)

3. **Header Background:**
   - Transparent header toggle
   - Background image upload

4. **Page Sliders:**
   - Revolution Slider selection
   - Display toggle

5. **Post/Page Layout:**
   - Sidebar position (left/right/full)
   - Sidebar selection
   - Titlebar toggle

6. **Job Search Settings:**
   - Location filter visibility
   - Types filter visibility
   - Categories filter visibility
   - Salary filter visibility
   - Rate filter visibility
   - Tags filter visibility
   - Remote work filter visibility

### 3.3 Widgets

**Registered sidebars:**
- `sidebar-1` - Main sidebar
- `sidebar-jobs` - Jobs page
- `sidebar-job-before/after` - Single job
- `sidebar-task` - Task page
- `sidebar-resume` - Single resume
- `sidebar-resumes` - Resumes archive
- `sidebar-shop` - WooCommerce
- `sidebar-companies` - Companies
- `footer1-5` - 5 footer columns
- `mobilemenu` - Mobile menu
- Dynamic sidebars (cez customizer)

---

## 4. SEO, ANALYTICS A MARKETING

### 4.1 SEO Pluginy

**All in One SEO:**
- Meta tags optimization
- XML sitemaps
- Keyword optimization
- Local SEO

**Breadcrumb NavXT:**
- SEO breadcrumbs
- Structured data

### 4.2 Analytics

**Pluginy:**
- Google Analytics for WordPress
- WooCommerce Google Analytics Integration
- Jetpack (stats)

**Tracking:**
- E-commerce events
- User behavior
- Conversion tracking

### 4.3 Marketing a Lead Generation

**Pluginy:**
- OptinMonster (lead capture)
- MailPoet (newsletters)
- Contact Form 7
- Popup Builder

**Features:**
- Email campaigns
- Pop-ups a forms
- Lead database
- Newsletter automation

### 4.4 Social Media

**Integrácie:**
- Facebook for WooCommerce (Facebook Shop)
- Social sharing (Jetpack)
- Web Font Social Icons
- Company social profiles (Twitter, Facebook)

---

## 5. SECURITY A PERFORMANCE

### 5.1 Security

**Wordfence Security (v8.1.4):**
- Malware scanning
- Firewall (WAF)
- Brute force protection
- Security monitoring

**Ďalšie pluginy:**
- Block Bad Queries
- Block Temporary Email
- Akismet (spam protection)

**Features:**
- Login URL protection
- Role-based access control
- License verification systém

### 5.2 Performance

**W3 Total Cache:**
- Page caching
- Browser caching
- Database optimization
- Minification

**Image Optimization:**
- Image Optimization plugin
- EWWW Image Optimizer

**Transient Caching:**
- Salary/rate min/max (24h cache)
- Custom data caching

**Asset Management:**
- Conditional script loading
- Minified CSS/JS
- Version control pre cache busting

---

## 6. INTERNATIONALIZATION

### 6.1 Translation

**Pluginy:**
- Google Language Translator
- GTranslate
- Loco Translate

**Features:**
- Multi-language support
- Automatic translation
- String translation interface

### 6.2 RTL Support

**Súbory:**
- `rtl.css` (10KB)
- RTL language compatibility

---

## 7. COMPLIANCE

### 7.1 GDPR a Cookies

**CookieYes | GDPR Cookie Consent (v3.3.9.1):**
- Cookie consent banner
- Cookie policy management
- Consent tracking

**Features:**
- GDPR compliance
- Privacy policy integration

---

## 8. TECHNOLOGICKÝ STACK

### 8.1 Backend

**WordPress Core:**
- WordPress 5.3+ compatible
- PHP 7.x+
- MySQL database
- Table prefix: `ltlkrq_`

**Frameworks:**
- CMB2 (meta boxes)
- Kirki (customizer)

### 8.2 Frontend

**CSS:**
- Base styles (6.9KB minimized)
- Responsive CSS (7.3KB)
- WooCommerce styles (40KB)
- Font Awesome (138KB)
- Line Awesome (113KB)
- Icons (45KB)
- RTL support (10KB)
- **Total main stylesheet:** 804KB

**JavaScript Libraries (30+):**
- jQuery + jQuery UI
- Slick carousel
- Flexslider
- Magnific Popup
- Select2
- Chosen
- Dropzone
- Superfish
- Isotope
- Waypoints
- Google Maps API
- **Custom JS:** 80KB (`custom.min.js`)
- **AJAX Filters:** Job + Resume filters

### 8.3 Build Tools

**Gulp:**
- `gulpfile.js` v theme root
- `package.json` pre npm dependencies

---

## 9. KRITICKÉ SÚBORY A ŠTRUKTÚRA

### 9.1 Téma WorkScout

```
wp-content/themes/workscout/
├── functions.php (27KB)
├── style.css (804KB)
├── inc/
│   ├── customizer/ (16 súborov)
│   ├── wp-job-manager.php
│   ├── wp-job-manager-maps.php
│   ├── woocommerce.php
│   ├── template-tags.php
│   ├── extras.php
│   ├── cmb2-meta-boxes.php
│   ├── ptshortcodes.php (51KB)
│   ├── widgets.php
│   ├── vc.php (107KB - Visual Composer)
│   └── tgmpa.php
├── template-*.php (25+ šablón)
├── taxonomy-*.php (8 taxonomies)
├── archive-*.php (3 archives)
├── single-*.php (3 singles)
├── job_manager/ (17+ WPJM templates)
├── template-parts/ (komponenty)
├── company_listings/
├── wc-paid-listings/
├── css/
├── js/
├── kirki/
├── envato_setup/
└── plugins/ (8 zipped pluginov)
```

### 9.2 Pluginy (wp-content/plugins/)

**Vlastné (PureThemes/WorkScout):**
- `workscout-core/` (activity, messaging, commissions)
- `workscout-freelancer/` (tasks, bidding)
- `workscout-elementor/`
- `purethemes-cpt/`
- `purethemes-shortcodes/`

**WP Job Manager ecosystem:**
- `wp-job-manager/`
- `wp-job-manager-applications/`
- `wp-job-manager-resumes/`
- `mas-wp-job-manager-company/`
- Ďalších 8+ WPJM rozšírení

**Third-party (41 pluginov):**
- WooCommerce + 6 rozšírení
- Elementor
- Wordfence, W3 Total Cache
- MailPoet, Contact Form 7
- SEO, analytics, translation pluginy

---

## 10. ODPORÚČANIA PRE MIGRÁCIU NA NEXT.JS

### 10.1 Core Technology Stack (Next.js)

**Frontend Framework:**
- **Next.js 14+** (App Router)
- **TypeScript** (type safety)
- **React 18+**
- **Tailwind CSS** (styling)
- **shadcn/ui** (UI komponenty)

**Backend/API:**
- **Next.js API Routes** alebo **tRPC**
- **Prisma ORM** (database)
- **PostgreSQL** alebo **MySQL**
- **NextAuth.js** (autentifikácia)

**State Management:**
- **Zustand** alebo **Jotai** (lightweight)
- **React Query / TanStack Query** (server state)

**Forms:**
- **React Hook Form**
- **Zod** (validácia)

**File Uploads:**
- **UploadThing** alebo **AWS S3**
- **Cloudinary** (images)

**Maps:**
- **Google Maps API** (React wrapper)
- **Mapbox** (alternatíva)

**Payments:**
- **Stripe** (hlavný gateway)
- **PayPal SDK**

**Email:**
- **Resend** alebo **SendGrid**
- **React Email** (templates)

**Real-time:**
- **Pusher** alebo **Ably** (messaging)
- **Socket.io** (alternatíva)

**Search:**
- **Algolia** alebo **Meilisearch**
- **Typesense** (open-source alternatíva)

---

### 10.2 Prioritné funkcie na replikáciu

#### KRITICKÉ (Must-have):

1. **Autentifikácia a Role (P0)**
   - NextAuth.js s custom callbacks
   - Role-based access (Candidate/Employer)
   - Registration s výberom role
   - Protected routes
   - Session management

2. **Job Listings (P0)**
   - CRUD operácie pre job ponuky
   - Advanced filtering (location, category, salary, type, tags)
   - Search s autocomplete
   - Pagination
   - Single job detail page

3. **Aplikačný systém (P0)**
   - Apply na jobs
   - Application dashboard
   - Application tracking
   - Email notifikácie

4. **User Dashboard (P0)**
   - Employer dashboard (manage jobs)
   - Candidate dashboard (applications, saved jobs)
   - Profile management

5. **Resume Management (P0)**
   - Resume creation/editing
   - Skills taxonomia
   - Resume search a filtering
   - Portfolio/gallery upload

#### VYSOKÁ PRIORITA (Should-have):

6. **Company Profiles (P1)**
   - Company CRUD
   - Company reviews/ratings
   - Company job listings
   - Meta fields (headquarters, founded, etc.)

7. **Search & Filtering (P1)**
   - Real-time AJAX filtering
   - Range sliders (salary/rate)
   - Autocomplete
   - Advanced search combinations

8. **Map Integration (P1)**
   - Google Maps embedding
   - Location-based search
   - Marker clustering
   - Split-view layout

9. **Payments & Packages (P1)**
   - Stripe integrácia
   - Job packages (paid listings)
   - Resume packages
   - Subscription management

10. **Messaging System (P1)**
    - Private messaging medzi users
    - Conversations threading
    - Real-time notifikácie

#### STREDNÁ PRIORITA (Could-have):

11. **Freelancer & Tasks (P2)**
    - Task post type
    - Bidding systém
    - Milestone tracking
    - Commission management

12. **Bookmarks & Alerts (P2)**
    - Save favorite jobs
    - Job alerts (email notifikácie)
    - Saved searches

13. **Email Marketing (P2)**
    - Newsletter system
    - Email campaigns
    - Automated emails

14. **Reviews & Ratings (P2)**
    - Company reviews
    - Freelancer ratings
    - Review moderation

#### NÍZKA PRIORITA (Nice-to-have):

15. **Page Builder (P3)**
    - Content management
    - Landing page builder
    - Custom layouts

16. **Social Integration (P3)**
    - Social login (Google, Facebook)
    - Social sharing
    - Facebook Shop

17. **Advanced SEO (P3)**
    - Meta tags management
    - XML sitemaps
    - Structured data

---

### 10.3 Databázový dizajn (Prisma Schema príklad)

**Core Models:**

```prisma
// User Management
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String
  role          UserRole  @default(CANDIDATE)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile       Profile?
  jobs          Job[]
  applications  Application[]
  resumes       Resume[]
  messages      Message[]
  reviews       Review[]
  bookmarks     Bookmark[]
}

enum UserRole {
  CANDIDATE
  EMPLOYER
  ADMIN
}

// Job Listings
model Job {
  id              String    @id @default(cuid())
  title           String
  description     String    @db.Text
  location        String
  salaryMin       Int?
  salaryMax       Int?
  type            JobType
  remote          Boolean   @default(false)
  deadline        DateTime?
  status          JobStatus @default(ACTIVE)
  createdAt       DateTime  @default(now())

  employerId      String
  employer        User      @relation(fields: [employerId], references: [id])

  companyId       String?
  company         Company?  @relation(fields: [companyId], references: [id])

  categories      Category[]
  tags            Tag[]
  applications    Application[]
  bookmarks       Bookmark[]
}

enum JobType {
  FULL_TIME
  PART_TIME
  CONTRACT
  FREELANCE
  INTERNSHIP
}

enum JobStatus {
  DRAFT
  ACTIVE
  EXPIRED
  FILLED
}

// Applications
model Application {
  id          String    @id @default(cuid())
  coverLetter String?   @db.Text
  status      AppStatus @default(PENDING)
  createdAt   DateTime  @default(now())

  jobId       String
  job         Job       @relation(fields: [jobId], references: [id])

  candidateId String
  candidate   User      @relation(fields: [candidateId], references: [id])

  resumeId    String?
  resume      Resume?   @relation(fields: [resumeId], references: [id])
}

enum AppStatus {
  PENDING
  REVIEWED
  SHORTLISTED
  REJECTED
  ACCEPTED
}

// Resumes/CVs
model Resume {
  id            String    @id @default(cuid())
  title         String
  bio           String?   @db.Text
  experience    Json?     // Structured work experience
  education     Json?     // Education history
  portfolio     String[]  // Image URLs
  createdAt     DateTime  @default(now())

  candidateId   String
  candidate     User      @relation(fields: [candidateId], references: [id])

  skills        Skill[]
  categories    Category[]
  applications  Application[]
}

// Companies
model Company {
  id              String    @id @default(cuid())
  name            String
  description     String?   @db.Text
  headquarters    String?
  founded         DateTime?
  employees       String?   // "1-10", "11-50", etc.
  website         String?
  email           String?
  phone           String?
  twitter         String?
  facebook        String?
  logo            String?
  createdAt       DateTime  @default(now())

  ownerId         String
  owner           User      @relation(fields: [ownerId], references: [id])

  jobs            Job[]
  reviews         Review[]
  categories      Category[]
}

// Messaging
model Conversation {
  id          String    @id @default(cuid())
  createdAt   DateTime  @default(now())

  participants User[]
  messages    Message[]
}

model Message {
  id              String       @id @default(cuid())
  content         String       @db.Text
  read            Boolean      @default(false)
  createdAt       DateTime     @default(now())

  senderId        String
  sender          User         @relation(fields: [senderId], references: [id])

  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id])
}

// Taxonomies
model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique
  type      TaxType   // JOB, RESUME, COMPANY

  jobs      Job[]
  resumes   Resume[]
  companies Company[]
}

model Skill {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique

  resumes   Resume[]
}

model Tag {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique

  jobs      Job[]
}

enum TaxType {
  JOB
  RESUME
  COMPANY
}

// Reviews
model Review {
  id          String    @id @default(cuid())
  rating      Int       // 1-5
  comment     String?   @db.Text
  createdAt   DateTime  @default(now())

  authorId    String
  author      User      @relation(fields: [authorId], references: [id])

  companyId   String?
  company     Company?  @relation(fields: [companyId], references: [id])
}

// Bookmarks/Saved
model Bookmark {
  id          String    @id @default(cuid())
  createdAt   DateTime  @default(now())

  userId      String
  user        User      @relation(fields: [userId], references: [id])

  jobId       String
  job         Job       @relation(fields: [jobId], references: [id])
}

// Freelancer Features (P2)
model Task {
  id            String     @id @default(cuid())
  title         String
  description   String     @db.Text
  budget        Int?
  deadline      DateTime?
  status        TaskStatus @default(OPEN)
  createdAt     DateTime   @default(now())

  employerId    String
  employer      User       @relation(fields: [employerId], references: [id])

  bids          Bid[]
  milestones    Milestone[]
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model Bid {
  id          String    @id @default(cuid())
  amount      Int
  proposal    String    @db.Text
  status      BidStatus @default(PENDING)
  createdAt   DateTime  @default(now())

  taskId      String
  task        Task      @relation(fields: [taskId], references: [id])

  freelancerId String
  freelancer   User     @relation(fields: [freelancerId], references: [id])
}

enum BidStatus {
  PENDING
  ACCEPTED
  REJECTED
}

model Milestone {
  id          String    @id @default(cuid())
  title       String
  amount      Int
  completed   Boolean   @default(false)
  paidOut     Boolean   @default(false)
  createdAt   DateTime  @default(now())

  taskId      String
  task        Task      @relation(fields: [taskId], references: [id])
}

// Payments & Packages
model Package {
  id          String      @id @default(cuid())
  name        String
  description String?     @db.Text
  price       Int
  type        PackageType
  duration    Int         // days
  features    Json        // Structured features list
  active      Boolean     @default(true)
  createdAt   DateTime    @default(now())

  purchases   Purchase[]
}

enum PackageType {
  JOB_LISTING
  RESUME_LISTING
  FEATURED_JOB
  TASK
}

model Purchase {
  id          String    @id @default(cuid())
  status      PayStatus @default(PENDING)
  createdAt   DateTime  @default(now())
  expiresAt   DateTime?

  userId      String
  user        User      @relation(fields: [userId], references: [id])

  packageId   String
  package     Package   @relation(fields: [packageId], references: [id])
}

enum PayStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

---

### 10.4 API Routes štruktúra

**Next.js App Router API:**

```
app/
├── api/
│   ├── auth/
│   │   ├── [...nextauth]/route.ts    # NextAuth
│   │   ├── register/route.ts         # Registration
│   │   └── logout/route.ts
│   ├── jobs/
│   │   ├── route.ts                  # GET (list), POST (create)
│   │   ├── [id]/route.ts             # GET, PUT, DELETE
│   │   ├── [id]/apply/route.ts       # POST application
│   │   ├── search/route.ts           # Advanced search
│   │   └── filters/route.ts          # Get filter options
│   ├── resumes/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   └── search/route.ts
│   ├── companies/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   └── [id]/reviews/route.ts
│   ├── applications/
│   │   ├── route.ts                  # List user's applications
│   │   └── [id]/route.ts             # Update status
│   ├── messages/
│   │   ├── conversations/route.ts
│   │   ├── [id]/route.ts
│   │   └── send/route.ts
│   ├── payments/
│   │   ├── checkout/route.ts         # Stripe checkout
│   │   ├── webhook/route.ts          # Stripe webhook
│   │   └── packages/route.ts
│   ├── tasks/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   └── [id]/bids/route.ts
│   ├── bookmarks/
│   │   ├── route.ts                  # Toggle bookmark
│   │   └── [userId]/route.ts         # List bookmarks
│   ├── upload/
│   │   └── route.ts                  # File upload handler
│   └── search/
│       ├── autocomplete/route.ts     # Autocomplete API
│       └── suggest/route.ts          # Search suggestions
```

---

### 10.5 Frontend Routes (App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
├── (dashboard)/
│   ├── dashboard/
│   │   ├── page.tsx                  # Role-based redirect
│   │   ├── employer/
│   │   │   ├── page.tsx              # Employer dashboard
│   │   │   ├── jobs/page.tsx         # Manage jobs
│   │   │   ├── jobs/new/page.tsx     # Create job
│   │   │   ├── jobs/[id]/edit/page.tsx
│   │   │   ├── applications/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   └── messages/page.tsx
│   │   └── candidate/
│   │       ├── page.tsx              # Candidate dashboard
│   │       ├── resume/page.tsx       # Manage resume
│   │       ├── applications/page.tsx
│   │       ├── saved-jobs/page.tsx
│   │       ├── alerts/page.tsx
│   │       └── messages/page.tsx
│   └── profile/page.tsx              # User profile
├── jobs/
│   ├── page.tsx                      # Job listings with filters
│   ├── [slug]/page.tsx               # Single job detail
│   └── search/page.tsx               # Advanced search
├── resumes/
│   ├── page.tsx                      # Resume listings
│   ├── [slug]/page.tsx               # Single resume
│   └── search/page.tsx
├── companies/
│   ├── page.tsx                      # Company listings
│   └── [slug]/
│       ├── page.tsx                  # Company profile
│       ├── jobs/page.tsx             # Company jobs
│       └── reviews/page.tsx          # Company reviews
├── tasks/
│   ├── page.tsx                      # Task/project listings
│   ├── [slug]/page.tsx               # Single task
│   └── [slug]/bid/page.tsx           # Submit bid
├── packages/
│   ├── page.tsx                      # View all packages
│   └── checkout/page.tsx             # Package checkout
├── messages/
│   ├── page.tsx                      # Conversations list
│   └── [id]/page.tsx                 # Conversation thread
├── contact/page.tsx
├── about/page.tsx
└── page.tsx                          # Homepage
```

---

### 10.6 UI Komponenty (shadcn/ui + custom)

**shadcn/ui komponenty:**
- Button, Input, Textarea, Select
- Dialog, Sheet, Popover
- Dropdown Menu, Command
- Form components (+ React Hook Form)
- Card, Badge, Avatar
- Tabs, Accordion
- Toast notifications

**Custom komponenty:**

```
components/
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Sidebar.tsx
│   └── MobileNav.tsx
├── auth/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── ProtectedRoute.tsx
├── jobs/
│   ├── JobCard.tsx
│   ├── JobList.tsx
│   ├── JobFilters.tsx
│   ├── JobSearchBar.tsx
│   ├── JobDetail.tsx
│   ├── ApplyButton.tsx
│   └── JobForm.tsx
├── resumes/
│   ├── ResumeCard.tsx
│   ├── ResumeList.tsx
│   ├── ResumeFilters.tsx
│   └── ResumeForm.tsx
├── companies/
│   ├── CompanyCard.tsx
│   ├── CompanyProfile.tsx
│   ├── CompanyReviews.tsx
│   └── ReviewForm.tsx
├── dashboard/
│   ├── DashboardLayout.tsx
│   ├── DashboardStats.tsx
│   ├── ApplicationsList.tsx
│   └── JobsManager.tsx
├── messaging/
│   ├── ConversationList.tsx
│   ├── MessageThread.tsx
│   └── MessageComposer.tsx
├── filters/
│   ├── SearchFilter.tsx
│   ├── RangeSlider.tsx
│   ├── CategoryFilter.tsx
│   └── LocationFilter.tsx
├── maps/
│   ├── GoogleMap.tsx
│   ├── MapMarker.tsx
│   └── SplitViewMap.tsx
├── payments/
│   ├── PackageCard.tsx
│   ├── CheckoutForm.tsx
│   └── PaymentStatus.tsx
├── tasks/
│   ├── TaskCard.tsx
│   ├── TaskDetail.tsx
│   ├── BidForm.tsx
│   └── MilestoneTracker.tsx
└── ui/
    ├── [shadcn components]
    ├── FileUpload.tsx
    ├── ImageGallery.tsx
    ├── Autocomplete.tsx
    ├── Pagination.tsx
    └── LoadingSpinner.tsx
```

---

### 10.7 State Management príklad

**Zustand stores:**

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  role: UserRole | null
  login: (user: User) => void
  logout: () => void
}

// stores/jobsStore.ts
interface JobsState {
  jobs: Job[]
  filters: JobFilters
  setFilters: (filters: Partial<JobFilters>) => void
  fetchJobs: () => Promise<void>
}

// stores/messagesStore.ts
interface MessagesState {
  conversations: Conversation[]
  unreadCount: number
  fetchConversations: () => Promise<void>
}
```

**React Query queries:**

```typescript
// hooks/useJobs.ts
export const useJobs = (filters: JobFilters) => {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => fetchJobs(filters),
  })
}

// hooks/useApplications.ts
export const useApplications = (userId: string) => {
  return useQuery({
    queryKey: ['applications', userId],
    queryFn: () => fetchApplications(userId),
  })
}
```

---

### 10.8 Third-party Services

**Musíš integrovať:**

1. **Stripe** - Payments
   - Checkout sessions
   - Webhooks
   - Subscription management

2. **Google Maps API**
   - Maps embedding
   - Geocoding
   - Places autocomplete

3. **Cloudinary** / **AWS S3**
   - Image/file storage
   - Image optimization

4. **Resend** / **SendGrid**
   - Transactional emails
   - Email templates

5. **Pusher** / **Ably**
   - Real-time messaging
   - Notifications

6. **Algolia** / **Meilisearch** (voliteľné)
   - Advanced search
   - Autocomplete

7. **Vercel Analytics** (ak deploy na Vercel)
   - Performance tracking

---

### 10.9 Deployment a Infrastructure

**Recommended Stack:**

- **Hosting:** Vercel (Next.js optimized)
- **Database:** PlanetScale (MySQL) alebo Supabase (PostgreSQL)
- **File Storage:** AWS S3 alebo Cloudinary
- **CDN:** Vercel Edge Network
- **Email:** Resend
- **Monitoring:** Sentry (error tracking)
- **Analytics:** Vercel Analytics + Google Analytics

**Environment Variables (.env):**
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GOOGLE_MAPS_API_KEY=
CLOUDINARY_URL=
RESEND_API_KEY=
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
```

---

### 10.10 Migration Roadmap

**Fáza 1: Foundation (2-3 týždne)**
- Next.js setup + TypeScript
- Database schema (Prisma)
- Authentication (NextAuth)
- Basic layouts a routing
- User roles

**Fáza 2: Core Features (4-6 týždňov)**
- Job listings CRUD
- Resume management
- Application system
- Search & filtering
- Dashboard (employer + candidate)

**Fáza 3: Advanced Features (3-4 týždne)**
- Company profiles
- Messaging system
- Map integration
- Bookmarks & alerts
- Reviews/ratings

**Fáza 4: Payments & E-commerce (2-3 týždne)**
- Stripe integration
- Package system
- Payment webhooks
- Subscription management

**Fáza 5: Freelancer Features (2-3 týždne)**
- Tasks/projects
- Bidding system
- Milestones
- Commission tracking

**Fáza 6: Polish & Optimization (2 týždne)**
- SEO optimization
- Performance tuning
- Email templates
- Testing
- Bug fixes

**Celkový odhad:** 15-21 týždňov (3-5 mesiacov)

---

## 11. ZHRNUTIE FUNKCIÍ PODĽA KOMPLEXITY

### Jednoduché (Easy) ✅
- Základné CRUD operácie
- Static pages (About, Contact)
- Basic authentication
- Simple forms

### Stredné (Medium) 🟡
- Advanced filtering
- Search s autocomplete
- File uploads
- Email notifications
- Role-based access

### Komplexné (Hard) 🔴
- Real-time messaging
- Map integrácia s clustering
- Payment system (Stripe)
- Commission tracking
- Bidding systém
- Multi-tenant dashboards

---

## 12. ODHADOVANÉ NÁKLADY (Monthly SaaS)

**Development:**
- Vercel Pro: $20/mo
- PlanetScale: $29-39/mo (Scaler plan)
- Cloudinary: $0-89/mo (depends on usage)
- Resend: $0-20/mo
- Pusher: $0-49/mo
- Stripe: 2.9% + $0.30 per transaction
- Google Maps: $200 free credit/mo, then pay-as-you-go
- Domain: $10-15/year

**Celkové náklady:** ~$100-250/mesiac (závisí od traffic a usage)

---

## 13. MOŽNÉ VÝZVY PRI MIGRÁCII

1. **Data Migration:**
   - Export z WordPress databázy
   - Transformácia na nový schema
   - Image/file migration

2. **SEO:**
   - URL štruktúra (redirects)
   - Meta tags
   - Sitemap generation

3. **Complex Features:**
   - Real-time messaging (WordPress nemal)
   - Advanced search (treba lepšiu implementáciu)
   - Commission tracking (custom logika)

4. **Third-party Dependencies:**
   - Replace WordPress pluginov s SaaS službami
   - Náklady na services

5. **Performance:**
   - Optimalizácia pre veľký počet listings
   - Image optimization
   - Database indexing

---

## 14. ODPORÚČANÉ RESOURCES

**Tutorials & Docs:**
- Next.js Documentation
- Prisma Documentation
- NextAuth.js Documentation
- Stripe Documentation
- shadcn/ui components

**Example Projects:**
- Next.js Job Board templates
- SaaS boilerplates (Shipfast, Supastarter)
- Marketplace templates

**Libraries:**
- `next-themes` (dark mode)
- `react-hook-form` + `zod`
- `@tanstack/react-query`
- `zustand` / `jotai`
- `date-fns` (date manipulation)
- `lucide-react` (icons)

---

## 15. ZÁVER

JobSphere.eu je **vysoko komplexná platforma** s rozsiahlou funkčnosťou, ktorá kombinuje:
- Job board
- Freelance marketplace
- E-commerce (WooCommerce)
- Messaging systém
- Company management
- Review systém

**Odhadovaný rozsah migrácie:**
- **Backend:** ~15,000-20,000 LOC
- **Frontend:** ~10,000-15,000 LOC
- **Database:** 20+ models
- **API Routes:** 50+ endpoints
- **UI Components:** 100+ komponenty

**Odporúčanie:**
Migruj postupne podľa priority (P0 → P1 → P2 → P3), testuj každú fázu, a launch MVP s core features (P0) čo najskôr. Potom iteratívne pridávaj advanced features.

---

**Ďalšie kroky:**
1. Setup Next.js projekt
2. Design database schema (Prisma)
3. Implement authentication
4. Build core features (jobs, resumes, applications)
5. Iterate and expand