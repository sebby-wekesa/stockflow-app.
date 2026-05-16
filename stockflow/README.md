# StockFlow - Manufacturing Management System

A comprehensive manufacturing management system built with modern web technologies for managing production workflows, inventory, sales, and user operations.

## 🚀 Features

- **Production Management**: Track manufacturing orders from creation to completion
- **Inventory Control**: Real-time stock tracking across multiple branches
- **Sales Management**: Customer order processing and fulfillment
- **User Management**: Role-based access control with multiple user types
- **Import/Export**: Bulk data operations with Excel integration
- **Reporting**: Comprehensive analytics and reporting tools

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth
- **UI Components**: Radix UI, Custom Design System
- **Validation**: Zod schemas

## 📋 Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database
- Supabase account (for authentication)

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stockflow
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your database and Supabase credentials
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   pnpm prisma generate

   # Run database migrations
   pnpm prisma db push

   # Seed the database with test data
   pnpm prisma db seed
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

6. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with test credentials (see seed data)

## 📁 Project Structure

```
stockflow/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (dashboard)/       # Protected dashboard routes
│   └── auth/              # Authentication pages
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── [feature]/        # Feature-specific components
├── lib/                  # Shared utilities
│   ├── prisma.ts         # Database client
│   ├── auth.ts          # Authentication helpers
│   ├── validations.ts   # Zod schemas
│   └── [feature]/       # Feature utilities
├── prisma/               # Database schema and migrations
└── types/               # TypeScript type definitions
```

## 🔐 User Roles

- **ADMIN**: Full system access, user management
- **MANAGER**: Production oversight, approvals
- **OPERATOR**: Manufacturing operations
- **SALES**: Customer order management
- **WAREHOUSE**: Inventory management
- **PACKAGING**: Order fulfillment

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm test

# Run linting
pnpm lint

# Type checking
pnpm build
```

## 📊 Database Schema

The application uses a comprehensive database schema with the following key models:

- **Users**: Role-based user accounts
- **ProductionOrder**: Manufacturing workflow tracking
- **SaleOrder**: Customer order management
- **Design**: Product specifications
- **RawMaterial**: Material inventory
- **FinishedGoods**: Product inventory
- **Branch**: Multi-location support

## 🚀 Deployment

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Application
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="..."
```

### Build for Production

```bash
pnpm build
pnpm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 📞 Support

For support or questions, please open an issue in the repository.

---

**Built with ❤️ using Next.js, Prisma, and modern web technologies.**