---
# Multiplying by an absent quantity breaks this test; the fix must keep its
# input and expected value instead of editing the test to pass.
type: regex
target:
  source: file
  path: test/cart.test.js
pattern: 'assert\.equal\(\s*total\(\[\s*\{\s*price:\s*5\s*\}\s*\]\),\s*5\s*\)'
---
