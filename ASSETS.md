# Artwork and sound

The five WebP images, the PNG README image and four PNG icon sizes in the 1.2.0 package were rendered for this release. The image generator is included at `tools/render-art.cjs`.

| Files | Source |
| --- | --- |
| `SideQuest/art/velocity.webp`, `flux.webp`, `signal.webp`, `drift.webp` | Frames rendered from Night Run, Split Orbit, Night Switch and Koi Current, using their bundled game logic and a fixed random seed. |
| `SideQuest/art/hero.webp`, `SideQuest/art/readme.png` | A montage of three of those rendered playfields. The PNG is converted from the WebP for README compatibility. |
| `SideQuest/icons/*.png` | The renderer draws a lightning polygon and rounded frame at 16, 32, 48 and 128 pixels. |
| Sound effects and music | Synthesized locally by the arcade engine. |

The project license covers these bundled assets. The extension loads its visual and audio resources locally.
