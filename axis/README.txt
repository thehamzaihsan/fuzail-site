A.X.I.S. - Anatomical eXploration & Interactive System (web build)

This folder is a complete static website. Upload the whole folder as it is (keep the sub-folders) to any web host,
for example as /portfolio/software-engineer/axis/ . Open index.html through the web address; it needs no server code.

  index.html             the app
  assets/                3D models (.glb) and flow data (.json)
  js/, css/, lib/, icons/ code, styles, Three.js, app icons
  sw.js, manifest        offline support / install as an app on phones
  tools/flow_editor.html the flow path editor (on a website it can only "Download JSON")

The host must serve .glb files (most do; on Netlify/Vercel/GitHub Pages/cPanel they work as is).
