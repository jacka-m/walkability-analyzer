# 15-Minute City · Walkability Analyzer

Interactive isochrone-based walkability and access analyzer. Drop a pin on any location in Pasadena, choose a travel mode (walk, bike, drive) and time range (5, 10, or 15 minutes), and see what's reachable — with points of interest overlaid and a weighted access score.

## Live Demo

🔗 **[View Live](https://YOUR_USERNAME.github.io/walkability-analyzer/)**

## Features

- **Isochrone visualization** — network-shaped reachability polygons, not simple radius circles
- **Real POI data** — grocery stores, parks, schools, clinics, cafés, and transit stops
- **Access scoring** — weighted composite score (0–100) based on category coverage
- **Multi-modal** — walk, bike, and drive travel profiles with different speed models
- **Dark cartographic basemap** — CartoDB Dark tiles

## Tech Stack

- React 18 + Vite
- SVG-based map rendering (no Leaflet/Mapbox dependency)
- CartoDB raster tiles
- GitHub Pages deployment via Actions

## Development

```bash
npm install
npm run dev
```

## License

MIT
