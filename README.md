# Lab Inventory System — Frontend

Next.js 14 frontend for the Lab Inventory Management System.

## Requirements
- Node.js 18+
- Backend API running

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and set API URL
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:5000/api

# 3. Build for production
npm run build

# 4. Start production server
npm start
```

## Development

```bash
npm run dev
# Open http://localhost:3000
```

## Running with PM2 (recommended for server)

```bash
npm run build
npm install -g pm2
pm2 start npm --name lab-inventory-ui -- start
pm2 save
pm2 startup
```

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Full URL to the backend API (e.g. `http://192.168.1.100:5000/api`) |

## Features
- Dashboard with stock statistics and charts
- Item inventory management with pagination
- Stock movements (IN / OUT / ADJUSTMENT / RETURN / DISPOSAL)
- Category management with color coding
- Supplier management
- Transaction history with filters
- User management with role-based access (Admin / Staff / Viewer)
- Low stock alerts
