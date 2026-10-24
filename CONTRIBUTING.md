# Contributing to LotusPad

Thanks for helping. Small, focused changes are easiest to review.

## Getting set up

```sh
npm install
npm test
npm run typecheck
```

Both must pass before you open a pull request. CI runs them on macOS.

## Guidelines

- **Add a test with every change.** Shape-tidy fixes need a fixture stroke; parser fixes need an input line; format changes need an example file.
- **Keep core code pure.** Nothing under `src/` may touch the DOM, the file system or the network. Data in, data out.
- **File format changes are special.** Adding an optional field is fine. Anything else needs a new version number, a migration and an update to `docs/file-format.md`.
- **Keep names plain** and comments about why, not what.
- **One topic per pull request**, with a short description of what changed and why.

## Reporting bugs

Open an issue with what you did, what you expected and what happened. For a drawing that tidies badly, attach the stroke's `raw` points from the `.lotuspad` file.

## Conduct

Everyone taking part must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
