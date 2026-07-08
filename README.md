# Portfolio Website - Production-Ready Enterprise Structure

Interactive portfolio website with 3D elements, cinematic UI, and Star Wars/Star Trek themed design.

## 🏗️ Project Structure

```
/
├── public/                    # Static assets (served as-is)
│   └── assets/               # All assets
│       ├── audio/
│       ├── docs/
│       ├── fonts/
│       ├── images/
│       ├── planets/
│       └── videos/
│
├── src/                       # Source code (development)
│   ├── js/
│   │   ├── core/             # Core application logic
│   │   │   ├── app.js        # Main application entry point
│   │   │   ├── config.js     # Configuration constants
│   │   │   └── state.js      # Application state management
│   │   │
│   │   ├── modules/          # Feature modules
│   │   │   ├── audio.js      # Audio management
│   │   │   └── [more modules]
│   │   │
│   │   ├── utils/            # Utility functions
│   │   │   ├── canvas.js     # Canvas utilities
│   │   │   ├── image.js      # Image loading/warming
│   │   │   ├── math.js       # Math utilities
│   │   │   └── throttle.js   # Throttling utilities
│   │   │
│   │   └── components/       # Reusable components
│   │
│   └── styles/
│       ├── base/             # Base styles
│       │   ├── reset.css     # CSS reset
│       │   ├── variables.css # CSS custom properties
│       │   └── typography.css # Fonts & text
│       │
│       ├── components/       # Component styles
│       │
│       ├── themes/           # Theme variations
│       │
│       └── main.css          # Main stylesheet (imports all)
│
├── js/                        # Legacy JS files (to be migrated)
├── css/                       # Legacy CSS (to be migrated)
├── index.html                # Main HTML file
├── vite.config.js            # Vite build configuration
├── package.json              # Dependencies & scripts
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (outputs to `dist/`)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🎯 Features

- **3D Interactive Ship**: Three.js powered 3D spacecraft
- **Cinematic Starfield**: Animated starfield with warp effects
- **Planetary Navigation**: Click planets to view portfolio sections
- **LCARS Interface**: Star Trek themed UI elements
- **Holographic Effects**: Star Wars inspired visual effects
- **Responsive Design**: Works on all devices
- **Performance Optimized**: Adaptive quality, lazy loading, code splitting

## 🏢 Enterprise Structure Benefits

### Modularity
- Each feature in its own module
- Easy to locate and update code
- Clear separation of concerns

### Maintainability
- Self-documenting structure
- Consistent naming conventions
- Centralized configuration

### Scalability
- Easy to add new features
- Supports team collaboration
- Professional code organization

### Performance
- Code splitting for faster loads
- Lazy loading of modules
- Optimized build output

## 📝 Migration Status

The project is being migrated from a monolithic structure to a modular enterprise structure:

### ✅ Completed
- Core configuration module
- State management module
- Utility functions (canvas, image, math, throttle)
- Audio management module
- Build configuration with path aliases
- CSS structure with component organization

### ⏳ In Progress
- Module migration (starfield, planets, camera, ship, warp, ui)
- Component HTML templates
- Full CSS migration to component files

### 📋 Planned
- Complete module migration
- TypeScript migration (optional)
- Unit tests
- Documentation

## 🔧 Development

### Adding New Features

1. Create module in `src/js/modules/`
2. Add styles in `src/styles/components/`
3. Import in main app file
4. Update documentation

### Path Aliases

Use these aliases in your code:

- `@core` → `src/js/core`
- `@modules` → `src/js/modules`
- `@utils` → `src/js/utils`
- `@components` → `src/js/components`
- `@styles` → `src/styles`

Example:
```javascript
import { CONFIG } from '@core/config';
import { playShootSfx } from '@modules/audio';
```

## 📚 Documentation

- `PROJECT_STRUCTURE.md` - Detailed folder structure
- `STAR_WARS_TREK_IDEAS.md` - Feature ideas
- `FEATURES_TO_ADD.md` - Feature roadmap

## 🎨 Technologies

- **Three.js** - 3D graphics
- **Vite** - Build tool & dev server
- **Canvas API** - 2D rendering
- **CSS Custom Properties** - Theming
- **ES Modules** - Modern JavaScript

## 📄 License

This project is part of a personal portfolio website.

---

**Built with ❤️ by Raymond van der Walt**