# AI Worklog

## Overview

While building the inventory MCP server, I used AI as a support tool for thinking, exploring ideas, and getting initial direction. I did not rely on it to generate the full solution. Instead, I used it to understand the problem better, generate starting code where helpful, and then refined everything myself.

---

## Understanding the Problem

At the beginning, I was treating oversell as just a stock issue. To clarify this, I asked questions like:

* “Why does overselling happen even when reservations exist?”
* “What exactly is the role of reservations in preventing oversell?”

These questions helped me realize that the issue is not just about stock, but about the relationship between stock, orders, and reservations. This shifted my approach to thinking of it as a consistency problem.

---

## Understanding the Data Model

Before writing logic, I focused on understanding the schema in depth. I asked:

* “How do orders and reservations interact in real systems?”
* “What happens to reservations when an order is cancelled or expired?”

This helped me understand how stale reservations occur and why they are a major cause of inconsistencies. It also helped me interpret the meaning of different order states and how they affect inventory.

---

## Designing MCP Tools

When structuring the system, I did not build everything at once. I broke it down into smaller steps and asked:

* “What tools would an AI agent need to reason about inventory?”
* “How should I break this problem into smaller capabilities?”

This led me to design tools in layers:

* First, tools to fetch stock and reservation data
* Then, tools to detect issues
* Finally, tools to resolve them safely

---

## Oversell Detection Logic

To build detection logic, I focused on root causes instead of just outcomes. I explored questions like:

* “What are common failure cases in reservation systems?”
* “Can reservations exist without being released properly?”

From this, I derived a key rule that active reservations should not exceed total stock. This became the core logic for detecting oversell conditions.

---

## Resolution Strategy

When moving to fixing issues, I wanted to avoid unsafe actions. I asked:

* “What actions are safe to automate in an inventory system?”
* “Should stock ever be modified directly?”

These discussions helped me decide that only stale or invalid reservations should be released automatically, while other cases should be escalated. This kept the system realistic and safe.

---

## Generating Starting Code

AI was also used to generate initial templates and starting code for parts of the system. For example:

* Basic structure for the MCP HTTP server
* Session handling logic
* Initial file organization for tools

I did not use this code as is. I modified and adapted it to fit the exact requirements of my system.

---

## Debugging and Deployment

During implementation, I used AI to resolve practical issues. I asked things like:

* “Why am I getting missing session ID errors in MCP?”
* “Why is my Git branch not pushing correctly?”
* “What is the correct build and start setup for deployment?”

This helped me fix issues faster and continue development smoothly.

---

## Testing the System

While testing, I generated realistic scenarios and used AI to think through them:

* “What does an oversell scenario look like in real data?”
* “How can I simulate stale reservations?”

This helped me create better seed data and test the system more thoroughly.

---

## Key Learning

One important thing I noticed is that AI often gives general or ideal solutions. For example, it might suggest directly updating stock, which is not safe in real systems. Because of this, I always reviewed and adjusted suggestions based on actual constraints.

---

## Summary

AI helped me understand the problem better, structure the system, and get started faster with some parts of the code. It was especially useful for asking the right questions and exploring different approaches. However, all important decisions, logic, and final implementation were done by me to ensure the system works correctly and follows real world constraints.
