# Study Deck

Flashcards on Firebase Authentication, Cloud Firestore, and Firebase Hosting.

A deck can be made without an account. It stays in the browser until an account saves it.

The Firebase project id is `flashcard-project-2ca2e`.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` if that file is not already present, then paste the web app config from Firebase Project settings.

## Before the app can save data

1. In the Firebase console, open Authentication and enable the Email/Password provider.
2. Create a Cloud Firestore database in production mode.
3. From this folder, after `npx firebase-tools login`:

```bash
npm run build
npx firebase-tools deploy --only firestore:rules,hosting
```

The public site is https://flashcard-project-2ca2e.web.app.
