# 🚀 Bailout – Production Scheduling Assistant

**Tagline:**
*Turn historical production data into real-time decisions*

---

## 🧩 Problem statement

Small-scale manufacturing companies often rely heavily on a single key coordinator — the person who holds the entire machine scheduling logic in their head. When that person is absent, the whole production line gets disrupted because no one knows which job should run next after a machine finishes.

The real problem is not a lack of people — it’s that experience is trapped in one individual’s mind instead of being encoded into reusable data. Historical production data already contains enough patterns to support — and in many cases outperform — human judgment, but it has not yet been properly leveraged.

---

## 💡 Core Insight

> **Experience is not magic — it is pattern recognition built from historical data.**

What expert planners do intuitively:

* Recognize patterns in job transitions
* Reuse successful decisions from similar past situations
* Balance trade-offs based on context

👉 These patterns already exist in historical production data — they are just not being systematically extracted or reused.

---

## 🛠️ Solution

**Bailout** is a lightweight **Production Scheduling Assistant** that:

* Takes minimal input:

  * Number of machines about to become idle
  * List of pending jobs
* Reconstructs decision patterns from historical production data
* Suggests the **next best job** for each machine
* Provides **clear, data-driven explanations** for every recommendation

---

## ⚙️ How It Works

### Layer A – Recommendation Engine (Business Logic)

Reconstructs machine-mold-job decision patterns from historical production data. 

It builds a **weighted capacity matrix** per (machine, mold) pair — blending spec-based defaults with actual run history, where older records contribute less.

From this, it derives a **priority ranking** of machines per mold, then matches pending orders to the best-fit machine based on mold compatibility, delivery deadline, throughput, and backlog size.

👉 More details in [recommendation_engine](docs/recommendation_engine.md)

---

### Layer B – Orchestrator

Handles real-time interaction:

1. Receives user input
2. Generates ranked job recommendations
3. Uses an LLM to produce **human-readable explanations**

---

## 🧠 Example Output


---

## ✨ Key Features


---

## 🎯 Why It Matters


---

## 🏗️ Tech Approach


---

## 🚧 Future Improvements


---

## 🏁 Conclusion


