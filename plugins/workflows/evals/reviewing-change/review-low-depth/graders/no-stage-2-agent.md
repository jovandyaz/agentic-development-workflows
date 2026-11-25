---
# Low depth dispatches only the three reviewer lenses; any other subagent,
# such as a stage-2 reviewer started without loading its skill, fails.
type: tool_used
tool: Agent
input_match: '^(?![\s\S]*"subagent_type"\s*:\s*"workflows:(?:quality|spec|standards)-reviewer")'
min: 0
max: 0
---
