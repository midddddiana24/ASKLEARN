# Cobalt artwork generation

Generated with the installed Image Generation skill using the built-in image generator; no API credentials were used or modified. Original v1 images are retained.

## Logo

Saved asset: `frontend/public/brand/asklearn-mark-cobalt-v2.png`

Prompt:

Create a premium original education app logo icon for ASKLearn. A folded open book combined subtly with a speech bubble, bold simple silhouette, cobalt blue #3155D9 with porcelain white #F5F7FC page detail and a tiny warm amber bookmark. Softly rounded geometric design, polished matte 3D depth but legible at 32 pixels. Centered single icon filling 80 percent of a square. No text, no letters, no frame, no watermark. True transparent background. Project asset named asklearn-mark-cobalt-v2.png.

## Student and study illustration

Saved asset: `frontend/public/brand/asklearn-study-cobalt-v2.png`

Prompt:

Premium original ASKLearn education application illustration, isolated on true transparent background. A friendly stylized 3D young adult student with dark navy sculpted hair, round thin navy glasses, warm medium tan skin, expressive eyes, cobalt blue #3155D9 zip jacket with porcelain white small trim, navy trousers and simple porcelain sneakers. Full body entirely visible, student on LEFT standing confidently waving one hand, other hand beside a floating open cobalt book. On RIGHT a beautifully rounded open book, porcelain curved pages, two small floating blank study cards, an amber bookmark and small cobalt document folder. Cohesive quiet matte clay render, soft studio key lighting, gentle contact shadows, sophisticated accessible education product, clear appealing anatomy and proportions. Landscape 3:2 composition, generous spacing, NO letters, NO text, no logos, no scenery, no frame, no watermark. Intended for login and empty states and as reference for an original real-time 3D student model.

Both PNGs include alpha transparency. The study illustration is a static generated illustration and visual reference; the animated student is separately constructed as original articulated Three.js geometry. Existing SVG artwork remains the lightweight reduced-motion and WebGL-failure fallback. Wordmark text remains accessible HTML. No external models, characters, textures or image requests are needed during use.


## Later 2D student update

The 3D student PNG is retained as a historical generated asset. Active login, library and empty-state scenes now use the original local SVG student and StudyArtwork composition. StudentArt defines eight code-native poses; no new image generation was needed for that vector update. Only book/folder/task objects continue to use Three.js.
