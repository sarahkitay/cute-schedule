# Nutrition Label OCR (port package)

Everything you need to reuse ProYou’s AI / Vision OCR nutrition-label scanner in another repo lives here:

**[docs/nutrition-label-ocr/](./nutrition-label-ocr/)**

| File | Purpose |
|------|---------|
| [nutrition-label-ocr/README.md](./nutrition-label-ocr/README.md) | Architecture, Capacitor wiring, deps, how to integrate |
| [nutrition-label-ocr/ALL_CODE.md](./nutrition-label-ocr/ALL_CODE.md) | Full concatenated source (~2.4k lines) |
| `nutrition-label-ocr/js/` | Scanner bridge, parser, React UI, tests |
| `nutrition-label-ocr/api/` | OpenAI enhance endpoint + rate limit |
| `nutrition-label-ocr/ios/` | Capacitor plugin + Vision OCR + live camera UI |
| `nutrition-label-ocr/css/` | Scanner modal styles |

Start with the README, then copy the folders you need (or grab `ALL_CODE.md` for a single archive).
