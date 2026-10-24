# LotusPad

An open-source macOS notepad where you write and sketch on book pages or a whiteboard, tidy drawings automatically, and turn numbers in your notes into charts.

**Status:** early. This repository currently holds the tested core library. The app shell comes next (see the milestone plan).

## What is here

| Path | What it does |
|---|---|
| `src/format` | `.lotuspad` file format: schema, validation, versioning, migrations |
| `src/tidy` | Turns a hand-drawn stroke into a clean line, rectangle, ellipse, triangle or smooth curve |
| `src/data` | Reads numbers from text, computes stats, lays out bar, line and pie charts |
| `docs/file-format.md` | The file format spec |
| `examples/` | Sample `.lotuspad` files |

The library has no dependency on the DOM or any window system, so the same code runs in the app, in tests and in tools.

## Develop

```sh
npm install
npm test          # run the tests
npm run typecheck
```

Needs Node 20 or newer.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE).
