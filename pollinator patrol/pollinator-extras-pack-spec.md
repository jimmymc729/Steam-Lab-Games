# Pollinator Patrol Extras Sprite Pack (v1)

Goal: add a small second sprite sheet to make gameplay more engaging for kids without changing the core art style.

## Sheet format
- File: `pollinator-extras-spritesheet.png`
- Grid: `4 x 4`
- Cell size: `256 x 256`
- Total size: `1024 x 1024`
- Background: transparent
- No text labels baked into sprites
- Center each sprite in its cell with breathing room

## Style guardrails
- Same visual family as current sprites (cute, glossy, soft outlines, classroom-friendly)
- Saturated but gentle colors (avoid harsh neon)
- Keep silhouette readable at small sizes
- No heavy shadows extending far outside sprite body

## Cell map (row, col)
- Row 1, Col 1: `butterfly_blue_1`
- Row 1, Col 2: `butterfly_blue_2`
- Row 1, Col 3: `butterfly_pink_1`
- Row 1, Col 4: `butterfly_pink_2`
- Row 2, Col 1: `ladybug_idle`
- Row 2, Col 2: `dragonfly_idle`
- Row 2, Col 3: `star_badge`
- Row 2, Col 4: `honey_drop`
- Row 3, Col 1: `seedling_stage_1`
- Row 3, Col 2: `seedling_stage_2`
- Row 3, Col 3: `seedling_stage_3`
- Row 3, Col 4: `clover_patch`
- Row 4, Col 1: `wind_swirl`
- Row 4, Col 2: `mission_scroll`
- Row 4, Col 3: `combo_burst`
- Row 4, Col 4: `empty`

## How each asset will be used
- `butterfly_*`: ambient moving life + optional avoid/collect interactions
- `ladybug_idle`: collectible bonus critter
- `dragonfly_idle`: faster ambient critter
- `star_badge`: combo and milestone rewards
- `honey_drop`: optional bonus pickup
- `seedling_stage_*`: garden growth progression visuals
- `clover_patch`: decorative growth tiles around pollinated flowers
- `wind_swirl`: gentle challenge zone indicator
- `mission_scroll`: mini-goal UI icon
- `combo_burst`: quick celebratory popup VFX

## Production checklist
- All sprites exported as transparent PNG
- All sprites centered and not clipped
- Consistent outline weight and lighting direction
- No checkerboard artifacts
- No text in art
- Test legibility at 48x48 and 64x64
