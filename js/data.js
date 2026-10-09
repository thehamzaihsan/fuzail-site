// ─────────────────────────────────────────────────────────────
//  Portfolio content. Edit text, colours and file names here.
// ─────────────────────────────────────────────────────────────

export const ARTIST = {
  name: 'Fuzail Ahmed',
  first: 'FUZAIL',
  role: '3D Artist',
  email: 'fuzailahmed546@gmail.com',
  intro:
    'I am a digital creator focused on high-fidelity 3D execution. Whether I’m crafting hyper-realistic product animations or building entirely fictional, unimagined worlds, I bridge the gap between technical precision and cinematic atmosphere.',
  intro2:
    'Driven by the aesthetics of modern games and film, I deconstruct complex objects to rebuild them with digital perfection — from grounded reality to the boundless reaches of imagination.',
};

// Models shown in the hero "showroom" and in the 3D inspector.
// bg / ink / glow drive the Nike-style colour matching of the whole page.
export const MODELS = {
  oud: {
    file: 'assets/models/oud_b.glb', title: 'J. Janan Oud', word: 'JANAN', kind: 'Product Visual',
    bg: '#120a06', bg2: '#3a1a07', ink: '#f1b46a', glow: '#ff8a2a', dark: true,
    rot: [0, -0.35, 0], fit: 1.55, y: 0.0,
    blurb: 'Refractive glass, gold-leaf metallics and the deep amber of the fragrance — a study in PBR layering.',
  },
  keyboard: {
    file: 'assets/models/keyboard.glb', title: 'HP Omen Encoder', word: 'OMEN', kind: 'Hard-Surface',
    bg: '#080707', bg2: '#3b0508', ink: '#ff2a35', glow: '#ff1020', dark: true,
    rot: [0.62, -0.42, 0.08], fit: 2.5, y: 0.05, explode: true,
    blurb: 'Mechanical gaming keyboard rebuilt switch by switch — industrial design meets gaming aesthetics.',
  },
  dupas: {
    file: 'assets/models/dupas.glb', title: 'Dupas Lumin', word: 'LUMIN', kind: 'Commercial Banner',
    bg: '#041b1c', bg2: '#0b4a4c', ink: '#7ff6f2', glow: '#38e8ff', dark: true,
    rot: [0, -0.5, 0], fit: 1.8, y: 0, hide: ['Text', 'Text001'],
    blurb: 'CeRetinol serum bottles lit for a night-themed web banner for Dupas Lumin.',
  },
  watch: {
    file: 'assets/models/watch.glb', title: 'Chrono Study', word: 'TIME', kind: 'Product Visual',
    bg: '#dfe4e8', bg2: '#ffffff', ink: '#0b2e57', glow: '#5aa0ff', dark: false,
    rot: [Math.PI / 2 - 0.25, 0.3, 0], fit: 1.7, y: 0,
    glass: ['Material.001'],
    blurb: 'Anisotropic brushed steel, a sunburst dial and a sapphire crystal — explored in blue and green.',
  },
  chair: {
    file: 'assets/models/chair.glb', title: 'Crown Chair', word: 'CROWN', kind: 'Furniture · Sub-D',
    bg: '#0d3a31', bg2: '#16584a', ink: '#f2c35b', glow: '#ffd27a', dark: true,
    rot: [0.05, -0.55, 0], fit: 1.75, y: 0, fabric: ['Soft Suede Fabric'],
    swatches: [['Emerald', '#1f6b5a'], ['Mustard', '#d39a2c'], ['Blush', '#c9787f'], ['Ink', '#1d2433']],
    blurb: 'Sub-D modelled lounge chair — 3.5k tris low poly, 45.4k tris high poly, clean quad flow.',
  },
  sofa: {
    file: 'assets/models/sofa.glb', title: 'Curved Sofa', word: 'CURVE', kind: 'Furniture · Sub-D',
    bg: '#e8dccb', bg2: '#f6efe4', ink: '#3d3326', glow: '#c9a77a', dark: false,
    rot: [0.12, -Math.PI / 2 + 0.5, 0], fit: 2.6, y: 0, fabric: ['Fluffy Velvet'],
    swatches: [['Oat', '#c9b79a'], ['Sage', '#8f9b7c'], ['Terracotta', '#b76a4b'], ['Charcoal', '#3a3a3c']],
    blurb: 'Organic boucle sofa — 15k tris low poly, 42k tris high poly, built for real-time and offline.',
  },
  speaker: {
    file: 'assets/models/speaker.glb', title: 'Kisonli Q22', word: 'Q22', kind: 'Product Animation',
    bg: '#d6d6d2', bg2: '#f2f2ee', ink: '#111111', glow: '#2f7bff', dark: false,
    rot: [0.12, -0.6, 0], fit: 1.75, y: 0,
    blurb: 'Portable speaker hero shots with fluid-sim water splash and LED detailing.',
  },
  blade: {
    file: 'assets/models/blade.glb', title: 'Flower Blade', word: 'BLADE', kind: 'Game Asset · PBR',
    bg: '#ebe5d8', bg2: '#fbf8f1', ink: '#1b1b18', glow: '#9fb38a', dark: false,
    rot: [0, 0.4, -0.18], fit: 2.1, y: 0,
    tex: { map: 'assets/tex/blade_albedo.jpg', orm: 'assets/tex/blade_orm.jpg', normal: 'assets/tex/blade_normal.png' },
    blurb: 'Low-poly sword baked from a high-poly sculpt, textured in a Marmoset / Substance PBR pipeline.',
  },
  spray: {
    file: 'assets/models/spray.glb', title: 'Bold Orbit', word: 'BOLD', kind: 'Product Visual',
    bg: '#1a1a1a', bg2: '#3a3a3a', ink: '#f5f5f5', glow: '#ffffff', dark: true,
    rot: [0, -0.3, 0], fit: 1.6, y: 0, recolor: { 'metal body': '#1b1b1d', 'grey plastic': '#e8e8e8' },
    blurb: 'Body-spray can with brushed steel, graphic print and studio lighting.',
  },
  heydar: {
    file: 'assets/models/heydar.glb', title: 'Heydar Aliyev Center', word: 'ZAHA', kind: 'ArchViz',
    bg: '#d9d6cf', bg2: '#f4f2ed', ink: '#151515', glow: '#ffffff', dark: false,
    rot: [0.0, 0.6, 0], fit: 3.5, y: 0, clay: true,
    blurb: 'A study of Zaha Hadid’s fluid landmark — continuous surfaces, baked PBR for real-time.',
  },
};

// Order of the hero showroom carousel
export const SHOWROOM = ['oud', 'keyboard', 'chair', 'watch', 'dupas', 'blade', 'sofa', 'speaker'];

// Featured case studies (colour-matched full-bleed panels)
export const FEATURED = [
  {
    id: 'oud', no: '01', cat: 'Product Visuals', title: 'J. Janan Oud', model: 'oud',
    bg: '#140c07', ink: '#f3c48a', accent: '#e8892f',
    text: '3D recreation of Janan Oud by J. I chose it to challenge myself with the interaction between refractive glass, gold-leaf metallic textures and the deep amber tones of the fragrance — a deep dive into complex PBR layering and studio lighting for a premium, shelf-ready look.',
    tools: ['Blender', 'Cycles', 'Photoshop'],
    specs: [['Tris', '110k'], ['Glass', 'Refractive'], ['Engine', 'Cycles']],
    images: ['oud_front', 'oud_close', 'oud_45', 'oud_rasp'],
  },
  {
    id: 'omen', no: '02', cat: 'Product Visuals', title: 'HP Omen Encoder', model: 'keyboard',
    bg: '#070606', ink: '#ffffff', accent: '#ff2433',
    text: 'A 3D recreation of the HP OMEN Encoder mechanical gaming keyboard. The project focused on the intersection of industrial design and gaming aesthetics — specifically the tactile nature of mechanical hardware, down to every switch stem and LED.',
    tools: ['Blender', 'Cycles', 'Photoshop', 'After Effects'],
    specs: [['Tris', '627k'], ['Shots', '5'], ['Views', 'Exploded']],
    images: ['omen_3', 'omen_exploded', 'omen_switch', 'omen_1'],
  },
  {
    id: 'dupas', no: '03', cat: 'Commercial', title: 'Dupas Lumin', model: 'dupas',
    bg: '#031819', ink: '#d7fffd', accent: '#3fe6ee',
    text: 'Created a banner for Dupas Lumin for their website — CeRetinol serum bottles staged in a nocturnal set with chrome pearls and a glowing halo ring.',
    tools: ['Blender', 'Photoshop'],
    specs: [['Client', 'Dupas'], ['Use', 'Web banner'], ['Ratio', '21:9']],
    images: ['dupas'],
  },
  {
    id: 'speaker', no: '04', cat: 'Product Animation', title: 'Kisonli Q22', model: 'speaker',
    bg: '#1a1b1b', ink: '#f0f0f0', accent: '#7aa7ff',
    text: 'A portable speaker reveal — macro detailing of the grille and controls, a fluid-simulated water splash and a short animated product film.',
    tools: ['Blender', 'Mantaflow', 'After Effects'],
    specs: [['Tris', '457k'], ['Sim', 'Liquid'], ['Film', '1080p']],
    images: ['speaker_1', 'speaker_splash', 'speaker_black'],
    video: 'speaker_anim',
  },
  {
    id: 'watch', no: '05', cat: 'Product Visuals', title: 'Chrono Study', model: 'watch',
    bg: '#c9cfd4', ink: '#0d1e33', accent: '#22578f',
    text: 'A minimal wristwatch built to explore anisotropic brushed metal, a sunburst dial and glass reflections — rendered in two colourways.',
    tools: ['Blender', 'Cycles'],
    specs: [['Tris', '226k'], ['Colourways', '2'], ['Engine', 'Cycles']],
    images: ['watch_blue', 'watch_green'],
  },
];

export const FURNITURE = {
  chair: {
    title: 'Crown Chair', model: 'chair', poly: [['Low poly', '3.5k tris · 1.8k faces'], ['High poly', '45.4k tris · 22.7k faces'], ['Method', 'Sub-D modelling']],
    stages: [['Final', 'chair_tex'], ['In context', 'chair_room'], ['Clay', 'chair_clay'], ['High poly', 'chair_hp'], ['Low poly', 'chair_lp']],
  },
  sofa: {
    title: 'Curved Sofa', model: 'sofa', poly: [['Low poly', '15k tris · 7.6k faces'], ['High poly', '42k tris · 21.5k faces'], ['Method', 'Sub-D modelling']],
    stages: [['Final', 'sofa_front'], ['Top 45°', 'sofa_45'], ['Wireframe', 'sofa_wire'], ['UV flow', 'sofa_uv'], ['Material ID', 'sofa_matid'], ['Object ID', 'sofa_objid']],
  },
};

export const ENVIRONMENTS = [
  { id: 'sakura', title: 'Rakotzbrücke', sub: 'Sakura edition', note: 'Devil’s Bridge reimagined in full bloom', compare: 'rakotz_clay' },
  { id: 'temple_angelic', title: 'Angelic Temple', sub: 'Environment', note: 'Self-modelled assets, Botaniq & Substance Painter' },
  { id: 'konoha_1', title: 'Hidden Leaf', sub: 'Fan environment', note: 'Village-scale set dressing & volumetrics' },
  { id: 'temple_abandoned', title: 'Abandoned Temple', sub: 'Environment', note: 'Moss, ruin and god-rays' },
  { id: 'mist', title: 'Enchanted Mist', sub: 'Mood piece', note: 'Colour-graded forest fog' },
  { id: 'milky', title: 'Ethereal Journey', sub: 'Night scene', note: 'Milky-way path through the pines' },
  { id: 'glacier', title: 'Glacier', sub: 'Landscape', note: 'Procedural ice shelves' },
  { id: 'cabin', title: 'Cabin in the Woods', sub: 'Landscape', note: 'Scatter-heavy forest' },
  { id: 'flower_room', title: 'Flower Room', sub: 'Interior', note: 'Lantern light & foliage' },
  { id: 'space', title: 'Distant World', sub: 'Sci-fi', note: 'Planet-rise over still water' },
  { id: 'konoha_7', title: 'Leaf Gate', sub: 'Fan environment', note: 'Entrance shot' },
  { id: 'neon_arches', title: 'Neon Arches', sub: 'Abstract', note: 'Emissive geometry & reflections' },
  { id: 'canyon', title: 'Lost Canyon', sub: 'Abstract', note: 'Monolith architecture' },
  { id: 'cat', title: 'Cat & Butterfly', sub: 'Story frame', note: 'Shallow depth of field' },
];

export const ARCHVIZ = [
  { id: 'skyscraper', title: 'Abstract Skyscraper', note: 'An abstract archviz high-rise of curved passageways' },
  { id: 'glassroom', title: 'Abstract Glass Room', note: 'Glass, steel and a planted atrium' },
  { id: 'uniwall', title: 'Panel Installation', note: 'Mock-up for a university wall' },
  { id: 'dojo', title: 'Dojo', note: 'Interior lighting study' },
  { id: 'bed', title: 'Marshmallow Bed', note: 'Product-in-room visual' },
  { id: 'myroom', title: 'Bedroom', note: 'Warm interior' },
  { id: 'iso_room', title: 'Isometric Bar', note: 'Cut-away room' },
  { id: 'chair_room', title: 'Crown Chair Set', note: 'Furniture styling' },
];

export const MORE = [
  { id: 'r1', title: 'Yamaha R1', cat: 'Automotive' },
  { id: 'porsche', title: 'Porsche 911', cat: 'Automotive' },
  { id: 'huracan', title: 'Huracán', cat: 'Automotive' },
  { id: 'iphone_colors', title: 'iPhone 11 Pro', cat: 'Product' },
  { id: 'spray', title: 'Bold Orbit', cat: 'Product' },
  { id: 'diamond', title: 'Sci-fi Core', cat: 'Abstract' },
  { id: 'house', title: 'Overgrown House', cat: 'Environment' },
  { id: 'snowman', title: 'Snowman', cat: 'Stylised' },
  { id: 'tropical', title: 'Tropical Hut', cat: 'Environment' },
  { id: 'oud_rasp', title: 'Janan × Raspberry', cat: 'Product' },
];

export const REEL = [
  { id: 'interior', title: 'Interior Deco Installation' },
  { id: 'konoha', title: 'Hidden Leaf — Shot 01' },
  { id: 'speaker_anim', title: 'Kisonli Q22 Film' },
  { id: 'chair_turn', title: 'Crown Chair Turntable' },
  { id: 'sofa_turn', title: 'Curved Sofa Turntable' },
  { id: 'porsche', title: 'Porsche Wet Road' },
  { id: 'cloth', title: 'Cloth Simulation' },
];

export const TOOLKIT = [
  ['Modeling & Design', ['Blender', 'ZBrush', 'Clo3D']],
  ['Texturing & Post', ['Substance Painter', 'Photoshop', 'Lightroom']],
  ['Engine & Motion', ['Unreal Engine', 'After Effects', 'Marmoset']],
];
