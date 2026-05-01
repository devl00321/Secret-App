# Love App Monorepo

Welcome to the Love App project. This is a monorepo containing the mobile application, server, and shared packages.

## Project Structure

- `apps/mobile`: Expo-based React Native mobile application.
- `apps/server`: Backend server.
- `packages/shared`: Shared types and logic used by both mobile and server.

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

Run the following command in the root directory to install dependencies for all packages:

```bash
npm install
```

### Running the Applications

#### Mobile App

```bash
npm run dev:mobile
```

#### Server

```bash
npm run dev:server
```

## Environment Variables

Make sure to set up the necessary `.env` files in `apps/mobile` and `apps/server`. Refer to the `.env.example` files in each directory.

## License

This project is licensed under the ISC License.
