# CMF Lens

A Progressive Web App (PWA) that uses Artificial Intelligence to analyze product images, identifying materials and matching colors to professional standards like NCS and RAL.

## Features

*   **AI Analysis**: Identifies products, materials, textures, and finishes using Google Gemini.
*   **Precision Color Matching**: Matches colors to NCS S-Series and RAL Classic standards with lighting correction.
*   **Technical Specifications**: Provides detailed color data including Light Reflectance Value (LRV), CMYK, RGB, and NCS component breakdowns (Blackness, Chromaticness, Hue).
*   **Comparison Tool**: Split-screen view to compare scanned colors against standard references or previous history.
*   **Collection Management**: Saves analysis history locally.

## Tech Stack

*   React 19
*   TypeScript
*   Tailwind CSS
*   Google GenAI SDK (Gemini 3 Flash)
*   Lucide React

## Roadmap

*   Implement user authentication system.
*   Integrate Google Login.
*   Create detailed user profile pages to manage collections.
*   Migrate community features from local storage to a backend database.