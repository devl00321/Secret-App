❤️ LUVV – Private Couple App
LUVV is a modern, privacy-focused couple application designed to strengthen emotional connection through secure communication, real-time features, and intelligent interaction systems.
This project is being developed as a full-stack mobile application with a strong focus on user experience, security, and reliability.

🚀 Features
- 🔐 Secure partner pairing system (code-based + Firebase)
- 💬 Real-time chat and interaction
- 📱 Cross-platform mobile app (Expo / React Native)
- 🔑 Google Authentication (env-controlled)
- ⚡ Optimized backend with validation & rate limiting
- 🧠 Clean state management and scalable architecture


🛠️ Tech Stack
Frontend (Mobile)
- Expo Router
- React Native
- TypeScript

Backend
- Node.js + Express
- TypeScript

Services
- Firebase (Auth, Firestore)
- REST APIs

🔒 Security & Improvements
- Input sanitization for auth flows
- Rate limiting implemented
- Secure pairing using transactional logic

Environment-based configuration (no hardcoded secrets)
📂 App Structure
- `app/`: Expo Router routes
- `src/screens/`: routed screen implementations
- `src/services/`: Firebase, auth, and pairing logic
- `src/store/`: Zustand state
- `src/theme/`: shared design tokens

⚙️ Setup
```bash
npm install
npm run start --workspace mobile
npm run lint --workspace mobile
npm run typecheck --workspace mobile
```
# fill env values
Copy `apps/mobile/.env.example` to `.env` and set the values you need.

- `EXPO_PUBLIC_FIREBASE_*`: Firebase project configuration
- `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`: platform-specific Google auth client IDs

Google sign-in stays disabled on native builds until the relevant client ID is configured.

📌 Status
🚧 Currently in active development
Focus: Stability, UX improvements, and feature expansion

💡 Vision
To create a safe, intimate, and intelligent digital space for couples, combining emotional warmth with strong technical reliability.