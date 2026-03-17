# Generate Pollinator Extras Sprites

This project includes a ready pipeline for generating a second sprite pack.

## Files
- `pollinator-extras-pack-spec.md` - art direction + required assets
- `pollinator-extras-jobs.jsonl` - one image generation prompt per sprite
- `pollinator-extras-layout.json` - target sheet grid map
- `scripts/generate-pollinator-extras.sh` - runs image generation batch
- `scripts/build-pollinator-extras-sheet.py` - packs generated PNGs into one sprite sheet

## 1) Set API key
Set `OPENAI_API_KEY` in your shell (do not paste it in chat).

## 2) Dry run (recommended)
```bash
cd "/Users/jamesmcnicholas/Documents/Steam Lab Games/pollinator patrol"
./scripts/generate-pollinator-extras.sh --dry-run
```

## 3) Generate sprites
```bash
cd "/Users/jamesmcnicholas/Documents/Steam Lab Games/pollinator patrol"
./scripts/generate-pollinator-extras.sh
```

Generated files go to:
- `output/imagegen/pollinator-extras/*.png`

## 4) Pack into one sheet
```bash
cd "/Users/jamesmcnicholas/Documents/Steam Lab Games/pollinator patrol"
python3 ./scripts/build-pollinator-extras-sheet.py
```

Output:
- `pollinator-extras-spritesheet-v2.png`

## 5) Wire into game
Once generated, set the extras sheet path in the game and map cell names in code.
