<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f347d7c2-e778-4adf-a9d5-bd47f1244a70

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Aktualizacja i diagnostyka

`npm run maintenance` aktualizuje zainstalowane zależności w granicach wersji
zdefiniowanych w `package.json`, stosuje dostępne poprawki bezpieczeństwa, a
następnie uruchamia kontrolę TypeScript i build. Jeśli kontrola się nie powiedzie,
skrypt przywraca poprzednie pliki manifestu i blokady oraz próbuje odtworzyć
zależności przez `npm ci`. Aktualizacje spoza zadeklarowanych zakresów wersji
wymagają osobnej decyzji.
