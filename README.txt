SITE IS NOT MINE I AM JUST DEPLOYING IT ~ Hamza Ihsan


FUZAIL AHMED — 3D PORTFOLIO
===========================

Run it
  Double-click "Start Portfolio.bat"  ->  opens http://localhost:8080
  (or in a terminal:  python serve.py 8080)

Edit content
  js/data.js      all text, colours, project lists, which renders/models appear
  assets/img      full-size renders (jpg, 2400px)   assets/thumb  small versions
  assets/models   GLB models exported from Blender (Draco-compressed)
  assets/video    web-encoded clips + poster frames

Add a new 3D model
  1. In Blender: File > Export > glTF 2.0 (.glb), tick "Selected Objects", "Apply Modifiers", Draco compression.
  2. Drop it in assets/models and add an entry to MODELS in js/data.js (file, title, word, colours).
  3. Add its key to SHOWROOM to show it in the hero carousel.

Tools used to build the assets live in ../tools (export_glb.py, media.py).
