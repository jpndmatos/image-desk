# Image Desk

A browser tool for resizing and converting images in batches. Set the size, format and quality, then download the files individually or as a ZIP.

[Open Image Desk](https://jpndmatos.github.io/image-desk/)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/dark-dashboard.jpg">
  <img src="docs/desktop-dashboard.jpg" alt="Image Desk desktop interface" width="1200">
</picture>

<details>
  <summary>Mobile view</summary>
  <br>
  <img src="docs/mobile-dashboard.jpg" alt="Image Desk mobile interface" width="320">
</details>

## Features

- Drag-and-drop uploads for JPEG, PNG, and WebP.
- Batch resizing, quarter-turn rotation, and horizontal flipping.
- Format, quality, and transparency background settings.
- Original and processed previews with file-size comparisons.
- Filename prefixes, individual downloads or a ZIP, and light and dark themes.

Images are processed on your device using Canvas. Files stay in the browser.

The desktop workbench keeps the file queue, export settings, and processing actions on one screen.

## Stack

React, TypeScript, Vite, Canvas API, and fflate.

## Run locally

Requires Node.js 22.14 or later.

```sh
npm ci
npm run dev
```

Open [localhost:5175](http://localhost:5175).

```sh
npm test
npm run build
npm run preview
```
