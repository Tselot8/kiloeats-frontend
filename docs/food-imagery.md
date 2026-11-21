# Food photograph sources and reuse

The current application uses real online photographs downloaded on 16 November
2026. No image generation or generative editing was used for this revision.
Earlier generated files are preserved as prior uncommitted work but are not
imported by the application or included in the production build.

| Local asset | Source / creator | License | Local dimensions / bytes |
| --- | --- | --- | --- |
| `src/images/ethiopian/beyainatu-photo.jpg` | [Beyaynetu.JPG](https://commons.wikimedia.org/wiki/File:Beyaynetu.JPG), Dawityirga | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 900 × 675; 166,391 bytes |
| `src/images/ethiopian/shiro-photo.jpg` | [Taita and shiro.jpg](https://commons.wikimedia.org/wiki/File:Taita_and_shiro.jpg), Temesgen Woldezion; edited by Merhawie Woldezion | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/) | 900 × 549; 101,195 bytes |
| `src/images/ethiopian/firfir-photo.jpg` | [Taita fit-fit.jpg](https://commons.wikimedia.org/wiki/File:Taita_fit-fit.jpg), Temesgen Woldezion; edited by Merhawie Woldezion | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/) | 900 × 899; 165,369 bytes |
| `src/images/ethiopian/ethiopian-platter-photo.jpg` | [Ethiopian Traditional Food.jpg](https://commons.wikimedia.org/wiki/File:Ethiopian_Traditional_Food.jpg), Tensu.12 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 900 × 601; 217,835 bytes |

The fit-fit photograph depicts the regional injera-based dish, used for the
existing firfir item. The first downloaded Firfir.JPG photograph was not used
because the injera covered the prepared dish. Shiro preparation-stage images
were also rejected. These choices were visually inspected before use.

The published Commons file pages were checked for authorship and explicit
reuse licenses. Standard Commons thumbnails were downloaded after the original
host rate-limited requests. No arbitrary stock photographs, watermarks, or
reference-screen assets were used.

The chosen photographs were resized proportionally to 900px wide,
re-encoded as JPEG at quality 84 and stripped of metadata using native
System.Drawing. CSS adds circular/elliptical clipping and changes the display
crop. These adapted image files are distributed under the corresponding
source licenses or public-domain terms above. Source/author/license links and modification notices
are also shipped in `public/food-photo-credits.html`, linked from the footer and
demo notices. No photographer or pictured restaurant endorses KiloEats.

The public-domain platter photograph is used only in the browsing page's
left-hand food feature. It was downloaded from the standard Commons thumbnail,
resized and JPEG-compressed using the same process above. Its decorative circular
crop does not represent a new catalog item or any restaurant's actual offering.
The other candidate photographs inspected during selection were not shipped.

`src/components/demoFoodPhotos.js` maps only explicit demo restaurant/item IDs
onto these photos. Catalog records, names, prices, availability and cart storage
are unchanged. Supplied non-demo images keep priority. Unmatched dishes retain
their supplied illustration or intentional missing-photo fallback. No tibs or
doro wat menu entries were invented to use additional imagery.
