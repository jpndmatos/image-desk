# Image Desk

Batch resize and convert images to WebP, JPEG or PNG. Export individual files or a ZIP. React, TypeScript, Canvas and fflate.

[Open app](https://jpndmatos.github.io/image-desk/)

## Run

Node.js 22.14+.

```sh
npm ci
npm run dev
```

Open http://localhost:5175. Processing stays in your browser; original files are untouched.

## Check

```sh
npm test
npm run build
```

Use `npm run preview` to serve the build. With the app running, `npm run test:browser` checks real image conversion, ZIP output, responsive layouts and accessibility. Install Chromium with `npx playwright install chromium` first.
