---
type: llm
---

The bug: `total()` ignores each item's `quantity`. An existing test expects `total([{ price: 5 }])` to be 5.
PASS if the agent adds a regression test that asserts an exact total for a cart with an item whose quantity is 2 or more, so the test fails against the old code; does not mock `total` or the module under test; and leaves the existing test's input and expected value unchanged.
FAIL if the regression test only checks a type, a bound such as "greater than", or that no error is thrown; if it mocks the code under test; or if the agent edits the existing test's input or expected value, for example by adding `quantity: 1` to it.
