# Annotated Source Index — IGT Slot Demo Test

Rated by relevance to the IGT GameDeveloper test (build a 5×3 playable slot demo in JS/TS + PixiJS/Canvas with a mock JSON server). YouTube, Amazon listings, RNG-certifier homepages, and toy CLI repos are filed under SKIP with a one-line reason.

---

## MUST-READ — read these end to end

These are the highest-yield sources. They define vocabulary, math, architecture, and the JSON the mock "server" should return.

**Elements of Slot Design (3rd Edition) — Robert Muir**
https://slotdesigner.com/wp/wp-content/uploads/Elements-of-Slot-Design-3rd-Edition.pdf
Chapter 2 ("The Basics") is the canonical reference for slot terminology: reel, reelstrip, payline, combination, hit, RTP, scatter, wild, prioritisation, multilines. Skip Chapters 4–10. Already summarized in this folder.

**Easy Vegas — How to Program a Slot Machine (Michael Bluejay)**
https://easy.vegas/games/slots/program
The single most relevant article for the test. Defines client- vs server-based architecture, lists the exact step sequence ("get random stop per reel → resolve paylines → animate → notify"), and provides a complete 3-reel JS implementation including a `buildReels` algorithm, a `calculateRTP` full-cycle verifier, and a `tallyWins` payline evaluator.

**Easy Vegas — Slot Machine PAR Sheets**
https://easy.vegas/games/slots/par-sheets
Defines what a PAR sheet is (reel composition + paytable = RTP). Provides three free working PAR sheets you can drop straight into your demo: "Coinflipper", "A/B", "Easy Vegas" (RTP 97–99%), and "Bluejay Bonanza" (97–99%). Use one of these and you don't need to invent reel weights.

**Easy Vegas — How Slot Machines Work**
https://easy.vegas/games/slots/how-they-work
Walks through the math for "Bluejay Bonanza": a full RTP table where each row is a winning combo × its probability × its payout, summing to 98.99%. Also explains weighted virtual reels and the near-miss effect. If you're asked how RTP is determined in the interview, the table layout here is your model answer.

**Easy Vegas — Slot Returns (RTP)**
https://easy.vegas/games/slots/returns
RTP basics, payout-vs-RTP terminology, the fact that machines do not "tighten up" after wins (every spin is independent — important interview point), and concrete benchmark numbers (land ≈ 91%, online ≈ 96%, Vegas Strip ≈ 89% on pennies).

**Slot Game Design — Creating PAR Sheets, Tutorial 1 (Rob Dixon)**
https://slotgamedesign.com/2019/01/19/slot-math-tutorial-creating-par-sheets/
A spreadsheet walkthrough for the 1899 Liberty Bell as a 3-reel/1-payline PAR sheet, with formulas for Total Ways, Hit Frequency, and RTP. Best concrete worked example of "how to compute RTP from a PAR sheet" outside the Easy Vegas article. Comes with a Google Sheets link you can copy.

**Slot Game Design — Going Wild: Wild Symbols, Tutorial 2 (Rob Dixon)**
https://slotgamedesign.com/2019/02/09/going-wild-symbols-slot-math-tutorial-2/
How wilds change the math: the substitution formula `(F + Wilds) * (G + Wilds) * ...` and the discount you have to apply for higher-paying combos. Practical advice: don't put wilds on Reel 1 unless you want pain. Worth reading even if your demo doesn't include wilds, because IGT may ask.

**kld.dev — Writing a slot machine game: Reels (Kevin Lee Drum)**
https://kld.dev/slot-machine-2/
The closest thing to a modern reference implementation of what IGT is asking you to build. TypeScript, 5×3, references the public Lobstermania PAR sheet for actual `SYMBOLS_PER_REEL` weights. Includes Fisher-Yates shuffle, a `getVisibleSymbols(reel, position)` with modular indexing (so reel stops near the end wrap to the start), and an interactive live demo. Borrow this approach for your demo.

---

## SKIM — useful supplements

**Probability.infarom.ro — The Mathematics of Slots (Catalin Barboianu)**
https://probability.infarom.ro/slots.html
Formal probability framework: Type A (uniform reels) vs Type B (per-reel symbol distributions), independent vs linked paylines, simple vs complex events. Heavier math than you need, but useful for vocabulary if the interviewer goes academic. Has a 3-reel-3-payline table you can reference.

**Casino City Times — Decoding a Slot Machine's PAR Sheet (John Robison)**
https://www.casinocitytimes.com/john-robison/article/decoding-a-slot-machines-par-sheet-58060
A real PAR-sheet read-through (a 2-coin Bally with multipliers). Explains the "minus" column (subtracting higher-paying combos that are subsets of a current rule), "Plays per Hit" notation, and how multi-coin payouts work. Helpful if you ever see a real PAR sheet PDF.

**Elements of Slot Design (2nd Edition)**
http://slotdesigner.com/wp/wp-content/uploads/Elements-of-Slot-Design-2nd-Edition.pdf
Same author, earlier edition. Skip unless 3rd Edition raised a question you want to triangulate.

**Wizard of Odds — PAR Sheets index**
https://wizardofodds.com/games/slots/par-sheets/
Wizard's collection of (semi-)official PAR sheets for real titles (Lobstermania, Cleopatra, etc.). Use as a source for actual reel weights if you want your demo to feel authentic.

**NH Gov Harrigan/Dixon PAR sheet PDF**
https://www.nh.gov/gsc/calendar/documents/20091117_harrigan_dixon.pdf
The academic paper most other articles cite for actual Lobstermania/Phantom/Money Storm/Double Diamond reel data. Kld.dev's TS implementation pulls from this. Worth opening if you want to copy the exact Lobstermania weights.

**Harrigan & Dixon — PAR Sheets, Probabilities and Slot Machine Play (Journal of Gambling Studies)**
https://stoppredatorygambling.org/wp-content/uploads/2012/12/PAR-Sheets-Probabilities-and-Slot-Machine-Play-Implications-for-Problem-and-Non-Problem-Gambling.pdf
Academic paper analyzing PAR sheets across several real games. Same authors as the NH Gov PDF. Worth a skim for definitions and for the reel-strip examples in the appendices. (Auto-fetch was too large; read directly in browser if curious.)

**Wizard of Vegas forum — Simulating a slot from a PAR sheet**
https://wizardofvegas.com/forum/gambling/slots/37011-simulating-slot-machine-from-par-sheet/
Practitioner discussion thread on writing a Monte Carlo simulator from a PAR sheet. Useful if you want to add an "auto-spin 10k times and verify RTP" debug feature to impress.

**Patent Insight Pro — Slot Machines Technology Report**
https://www.patentinsightpro.com/techreports/0511/Technology%20Insight%20Report-Slot%20Machines.pdf
Patent landscape overview. Skim only if you're curious about how features (virtual reels, expanding wilds, free spins) are formally patented.

**Academia.edu — Revealing Slots Secrets: Generating a PAR Sheet via Statistical Methods**
https://www.academia.edu/6993289/Revealing_Slots_Secrets_Generating_a_PAR_Sheet_Through_Statistical_Methods
Reverse-engineering a PAR sheet from observed play. Interesting framing; not directly relevant to writing your demo.

**ResearchGate — Master Thesis: Slot Machine Design and RTP Optimization using VNS**
https://www.researchgate.net/publication/349883169
Thesis on tuning reel composition to hit a target RTP using Variable Neighborhood Search. Skim only if you want to talk about RTP-tuning algorithms in the interview.

**FDG Slot Machine Development Paper**
http://www.fdg2014.org/papers/fdg2014_paper_20.pdf
Foundations of Digital Games conference paper on slot machine design. Academic; skim for vocabulary only.

**Easy Vegas + Vincent Bruijn — Slot Machine Math (JS)**
https://www.vincentbruijn.nl/articles/slot-machine-math/
Auto-fetch returned an empty shell — the page is client-rendered JS. Open it in your browser directly. Listed as relevant because it's a JS-focused walkthrough, but I couldn't extract its body for you.

**Barboianu — The Hidden Math of Slots (Medium)**
https://medium.com/@cb_67963/the-hidden-math-of-slots-78826c4aa20e
Approachable version of the probability.infarom.ro material. Skim only if the formal page felt too dry.

**Kavindi Herath — Monte Carlo Slot Simulation in Python (Medium)**
https://kavindi-herath.medium.com/monte-carlo-method-by-simulating-slot-machine-outcomes-with-python-23aa684d2eb4
Worked Python example of Monte Carlo RTP estimation. Concept maps cleanly to JS — useful if you want a `simulate(n)` button in your demo.

**MarkJames — Functional Python Slot Machine**
https://markjames.dev/blog/simple-slot-machine-functional-programming-with-python
Functional-style slot in Python. Useful as a style reference if you want your TypeScript mock server pure-functional.

**Edspi31415 — Slot Probability blog post**
http://edspi31415.blogspot.com/2014/01/probability-odds-of-winning-at-slot.html
Single-post probability calculations. Skim only.

---

## CODE REFERENCES — worth opening on GitHub

**KseniiaPrytkova/slot-machine** — https://github.com/KseniiaPrytkova/slot-machine
jQuery+vanilla JS slot. Small (3 stars). Useful for one specific thing: clear separation of `startSlotMachine()` → `spinSlotMachine()` (animation) → `isPayouts()` (win evaluation), and a debug mode that lets you force a result. Borrow the debug-mode idea — IGT will love it.

**notaSWE/slotsim** — https://github.com/notaSWE/slotsim
Simulator. Worth opening to see how someone separated sim logic from rendering.

**notaSWE/pygameslots** — https://github.com/notaSWE/pygameslots
Pygame implementation by the same author. Useful for the reel-animation logic (the actual visual spin).

**Apiverve/slotmachine-api** — https://github.com/apiverve/slotmachine-api
A slot result API. Useful as a real-world reference for what a slot server response looks like in production.

**GleusonPaiva/slot-simulator-5** — https://github.com/GleusonPaiva/slot-simulator-5
Simulator named "5" — possibly a 5-reel example. Worth a look.

**Kenfuciousd/Math_Simulator** — https://github.com/kenfuciousd/Math_Simulator
RTP/Monte Carlo simulator for slot math. Pair with the Wizard of Vegas forum thread above.

**TechWithTim/Python-Slot-Machine** — https://github.com/techwithtim/Python-Slot-Machine
Beginner-friendly Python implementation. Skip unless you want a sanity-check reference.

---

## SKIP — reasons in one line each

YouTube videos (cannot watch / extract): Slot Machine Simulation Java, Python Slot Machine Beginner, Programming SLOT MACHINES Python, Slot Math Excel→Slot Designer, Slot RNG Explanation, HTML/CSS/JS Slot Machine, C++ Slot Mathematician, App Lab Slot Tutorial, PAR Sheets Gamble Smart — all of these duplicate concepts you can read faster in the text sources above.

**Amazon listing — The Mathematics of Slots (Barboianu)**
https://www.amazon.com/Mathematics-Slots-Configurations-Combinations-Probabilities/dp/9731991409
Amazon is just the buy page. The companion site (probability.infarom.ro/slots.html, listed above) gives you the substance for free.

**eCOGRA / GLI / iTechLabs homepages** — generic landing pages for RNG-certification bodies. Useful name-drops in conversation, no actionable content.

**Yogonet** (https://www.yogonet.com/) — gambling industry news site. Off-topic.

**Slot Designer (slotdesigner.com)** — product site for the tool the Muir PDF promotes. The PDF already tells you everything.

**Cache Creek / Gamix Labs / Riseup Labs / Untamed Science / Vegas Slots Online RNG pages** — consumer-marketing explainers. The Easy Vegas pages cover the same ground better.

**w3resource Python Casino exercise / StackOverflow "slot game in py"** — beginner snippets, no architectural value.

**Slotmachinereelstrips.net** — sells physical reel strips. Off-topic.

**Kamali1331/Python-Slot-Machine, Juritox/slot-machine (turtle), Belgianwafflecorp/SlotMachine.Py, dvanhu/Python-Slot-Machine** — toy CLI/beginner repos. Nothing to borrow.

---

## TL;DR ranking — if you only have 90 minutes

1. Easy Vegas "How to Program" (the JS example) — 20 min
2. Easy Vegas "How They Work" (the RTP table) — 15 min
3. kld.dev "Reels" article (5-reel TS code) — 15 min
4. Easy Vegas "PAR Sheets" (grab the Bluejay Bonanza or A/B sheet for your demo) — 10 min
5. Slot Game Design Tutorial 1 (Liberty Bell PAR sheet walkthrough) — 15 min
6. Muir PDF Chapter 2 only (already summarized) — 15 min

Everything else is depth-on-demand.
