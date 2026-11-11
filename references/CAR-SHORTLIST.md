# Cars shortlisted before GLB downloads

All 432 cars-vehicles rows read from the live 6,015-row Objaverse-clean metadata on 11 Nov 2026. Each shortlisted source API record was also read: title, description, tags, author and linked CC-BY-4.0 licence. Those API reads were metadata checks only; no Sketchfab download or login was used. GLBs come only from the no-login HF engine mirror.

CarConcept was downloaded and packed first: 213,347 source triangles, Eric Chadwick / Darmstadt Graphics Group GmbH, CC-BY-4.0. Its License material identified the shared Khronos/3D Commerce texture; seven base-colour/emissive links were detached and the now unused texture removed. Named wheel/door nodes retained. Target 40k: requesting 32k with error 0.03 produced 38,571 triangles, 1,736 KB binary.

| Mirror id | Source tris | Author | Licence | Reason to render |
|---|---:|---|---|---|
| fictional-supercar-v12-goblin-0a20e49a | 86,623 | ollitei | CC-BY-4.0 | Author calls it a unique fictional exterior; no interior |
| gourami-luxury-saloon-bf29aca0 | 107,768 | Fishboe | CC-BY-4.0 | Author's own fictional luxury design; simplify to hero budget |
| buggy-2-983dc960 | 36,214 | Rzyas | CC-BY-4.0 | PBR offroad body; inspect stickers |
| coupeox-futuristic-vehicle-f4eeef5a | 46,672 | koleos3d | CC-BY-4.0 | Explicit original concept; separated objects |
| racing-car-96909aba | 22,307 | Willy Decarpentrie | CC-BY-4.0 | Explicit non-existent generic game-ready design |
| fancy-car-780c75b7 | 7,004 | rajibkc | CC-BY-4.0 | Cheap generic traffic fallback; realism uncertain |
| car-e2a25f0d | 46,444 | Bryan | CC-BY-4.0 | No marque in record; visual identity requires inspection |
| car-6695d36a | 23,202 | OlegYurkov | CC-BY-4.0 | Car photogrammetry; condition/brand requires inspection |

## Excluded before downloading

| Candidate | Reason |
|---|---|
| retrowave-lowpoly-car-remake-81c1d168 | Live source tags include testarossa; real model |
| racecar-rc-13-09b4b84a | Description says derived from GrandPrix4's Ferrari model; game-derived/real marque |
| demolition-derby-car-low-poly-model-4d9d28e9 | Original source now returns 404; source identity could not be checked |
| zombie-pickup-truck-23708528 | Author explicitly says based on Toyota Hilux |
| 3d-car-ce7f30f1 | Source tags include hot_wheels |
| 70s-italian-concept-car-669ba289 | Existing wedge-concept-car covers this model; avoid duplicate body |
| Named Jaguar, Mercury, Studebaker, Lotus, Kenworth, Buick, Plymouth, VW, Infiniti, Koenigsegg and film/franchise rows | Real marques, identifiable real designs or film/game props; excluded by brief |

## Rendering environment

The existing sheet command builds the real runtime HTML, but its Playwright launch fails: enforced browser-floor sandbox has no usable sandbox inside this runtime. TMPDIR=/tmp fixes the earlier read-only temp directory but cannot fix that kernel boundary. Native browser new_page was rejected by automatic approval policy. No guard/settings changes or shim bypasses attempted. A portable official Blender CPU renderer is being checked as an alternate local renderer; browser correctness remains a distinct check for the conductor.
