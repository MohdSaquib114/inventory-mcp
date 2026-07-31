# AI Worklog

## Overview

While building the inventory MCP server, I used multiple AI tools including ChatGPT, Cursor, Claude, and Codex. Each tool played a different role across planning, implementation, debugging, and testing. I did not rely on AI to generate the full solution. Instead, I used it to guide my understanding, generate starting points where useful, and then refined and validated everything myself.

---

## AI Tools and Model Usage

I primarily used ChatGPT for planning, reasoning, and understanding system design concepts. It was useful for exploring how inventory systems behave and for thinking through edge cases.

Cursor was my main development environment where I used built in AI assistance for writing and testing code. It helped with quick iterations and small code suggestions while implementing MCP tools.

I also used Claude occasionally for comparing explanations and getting alternative perspectives on system design questions. Codex was used in a limited way for code related suggestions when needed.

I chose ChatGPT mainly for deeper reasoning and structured explanations, while Cursor was more helpful during implementation. Claude was useful when I wanted a second perspective to validate ideas.

---

## Planning and Breaking Down the Work

I used AI to break the problem into smaller steps instead of trying to build everything at once. I asked questions like:

* “What tools would an AI agent need to reason about inventory issues?”
* “How should I structure detection and resolution workflows?”

This helped me divide the system into clear layers. I started with basic data access tools, then added detection logic, and finally built resolution tools. This step by step breakdown made the system easier to design and test.

---

## Understanding the Problem and Data Model

Initially, I thought oversell was just a stock issue. I asked:

* “Why does overselling happen even when reservations exist?”
* “What is the role of reservations in preventing oversell?”

These questions helped me understand that the real issue is consistency between stock and reservations.

To understand the schema, I asked:

* “How do orders and reservations interact in real systems?”
* “What happens to reservations when an order is cancelled or expired?”

This helped me identify stale reservations as a key failure case and guided how I designed detection and resolution logic.

---

## Dividing Responsibilities Between AI and Myself

I used AI mainly for:

* Understanding concepts and system behavior
* Generating initial templates or starting code
* Suggesting possible approaches
* Helping debug issues and errors

I handled:

* Final system design decisions
* Writing and refining MCP tools
* Implementing business logic
* Validating correctness and handling edge cases

For example, I used AI to generate a starting structure for the MCP HTTP server and session handling, but I modified it to properly manage sessions and fit the MCP workflow.

---

## Important Prompts and Context

Some of the key prompts that influenced my design were:

* “Why does overselling happen even with reservations in distributed systems?”
* “What are common failure cases in reservation based inventory systems?”
* “How to design a system that detects and safely resolves inconsistencies?”
* “How should MCP tools be structured for detection and resolution?”

These prompts helped shape both the architecture and the reasoning behind the tools I built.

---

## AI Suggestions I Corrected or Rejected

One important case was when AI suggested directly modifying stock values to fix oversell. I rejected this approach because it is not safe in real systems and does not address the root cause.

Instead, I designed the system to only release stale or invalid reservations, which is a safer and more realistic approach. I also avoided solutions that ignored edge cases like cancelled orders still holding reservations.

---

## Verifying AI Generated Work

I verified all AI generated suggestions by:

* Testing them against seeded data with known edge cases
* Checking whether they follow real system constraints
* Comparing outputs with expected behavior for oversell scenarios
* Manually reviewing logic before integrating it

I created test cases such as oversold SKUs and stale reservations to ensure the system behaves correctly.

---

## Debugging and Testing

During development, I used AI to troubleshoot issues. For example:

* Fixing MCP session handling errors like missing session IDs
* Understanding server setup and request handling
* Resolving Git and deployment related issues

I also used AI to think through test scenarios like:

* “What does an oversell case look like in real data?”
* “How can I simulate stale reservations?”

This helped improve my test coverage.

---

## Remaining Risks and Unfinished Work

There are still some limitations in the current system:

* Sessions are stored in memory and are not persistent across restarts
* The system does not handle distributed or concurrent updates fully
* Escalation handling is basic and not integrated with external systems
* Some edge cases may still exist in more complex real world scenarios

These are areas that could be improved in a production level system.

---

## Summary

AI played an important supporting role in helping me think through the problem, explore design options, and speed up parts of development. However, all key decisions, validations, and final implementations were done by me to ensure the system is correct, safe, and aligned with real world behavior.
