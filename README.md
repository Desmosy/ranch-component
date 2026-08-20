# Ranch Components

A collection of beautiful, high-quality, and interactive UI components built with React, Tailwind CSS, and Framer Motion. This repository serves as the open-source home for the components featured in my portfolio's "Ranch" playground.

🔗 **Live Demo / Full Project:** [Check out the main portfolio repository](https://github.com/Desmosy/koshish-portfolio)

---

## Components

### 1. Prism Atom
A beautiful, glassmorphic 3D atom component perfect for showcasing complex structures, futuristic UI themes, or simply adding a stunning visual element to your React applications.

**Features:**
- Highly customizable (rings, speed, glow, lens flare, chromatic aberration)
- Responsive and beautifully animated
- Modern glassmorphic control panel included in the preview

**Usage:**
Simply copy the files from `components/prism-atom/` into your React project.

### 2. Temple Chime
A hanging curtain of Nepali/Tibetan mantra letters that sways and rings beneath a gilded temple roof-ridge. Each strand is a Verlet-physics chain of characters pinned to the roof's actual silhouette (traced from the image's alpha channel), but only within the inner horizontal roofline so it doesn't spill over the sloping dragon-eave corners. The cursor parts the strands like a real doorway curtain — a wind chime you can brush your hand through, inspired by the beaded curtains hanging in doorways at home.

**Features:**
- Physics-based letter curtain (Verlet chain, contour-pinned to the roof image)
- Synthesized Web Audio bead-knock + temple-bell chime, no audio files
- Customizable glyph size, strand length, raggedness, mouse reach, glow, and inner-roof-only clipping

**Usage:**
Simply copy the files from `components/temple-chime/` into your React project.

*(More components coming soon!)*

---

## General Dependencies
Ensure you have the following installed in your project to use these components:
- Tailwind CSS
- `lucide-react` (for UI icons)
- A standard `cn` utility function (typically found in `lib/utils.ts` in shadcn/ui setups)

## License
[MIT License](LICENSE) © 2026 Koshish
