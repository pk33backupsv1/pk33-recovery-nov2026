# tmux-adversarial-review.md — the pattern that worked on 2026-11-02

Three seats, three models, three stances, one question. Run from the seat that
owns the work, before any irreversible action.

---

## Why three seats and not two

One seat proposes, one attacks. But a single pair tends to converge on the
same blind spot — and if both run the same model, they converge *hard*.

Three stances force genuinely different readings of the same evidence:

| Seat | Stance | Question it answers | Model used |
|---|---|---|---|
| **A — Skeptic** | assume the plan is wrong | *what is refuted?* | `deepseek` (fast, sharp at contradiction) |
| **B — Steward** | nothing is lost, it is paused | *what is worth keeping and how do we bring it back?* | `deepseek-pro` (thorough, architectural) |
| **C — Architect** | some of it must be rebuilt | *what should be built differently?* | `MiniMax-M3` (design register) |

**Different models on purpose.** The whole value is the divergence.

---

## The launch

```bash
cd /home/pk33/pk33backupsv1/_agent-out

tmux new-session -d -s advA -c "$PWD" \
  "codex exec --model deepseek --sandbox danger-full-access \
   --skip-git-repo-check 'Read ADVERSARY_A.md and execute it completely. \
   Write the findings file exactly as instructed. Work autonomously until \
   the file is written.'"

tmux new-session -d -s advB -c "$PWD" \
  "codex exec --model deepseek-pro --sandbox danger-full-access \
   --skip-git-repo-check 'Read ADVERSARY_B.md and execute it completely. \
   Write the findings file exactly as instructed. Work autonomously until \
   the file is written.'"

tmux new-session -d -s advC -c "$PWD" \
  "codex exec --model MiniMax-M3 --sandbox danger-full-access \
   --skip-git-repo-check 'Read ADVERSARY_C.md and execute it completely. \
   Write the findings file exactly as instructed. Work autonomously until \
   the file is written.'"
```

### The three things that will bite you

1. **`--skip-git-repo-check` is required** outside a trusted git repo. Without
   it codex exits instantly with *"Not inside a trusted directory and
   `--skip-git-repo-check` was not specified."* This is the single most common
   reason an agent seat dies at launch — and the tmux session dies with it, so
   `tmux ls` shows **no server running** and you get no error.

2. **The command must be absolute or `cd X &&`-prefixed** for
   `pcl_selfcron.sh install` (it rejects relative paths — *"relative paths
   silently fail under crontab"*).

3. **Briefs live in files; the tmux prompt stays short.** Long prompts get
   mangled by shell quoting. Each seat gets a brief file and the command says
   *"execute it completely"*.

---

## The briefs

Each brief states, explicitly:

- the seat's stance and what to attack
- the specific questions to answer
- **READ-ONLY. Do not delete, move, edit, commit, or restart anything.**
- the exact output path and the required section structure
- *"If a claim survives your attack, say so plainly. Do not manufacture
  objections."*

That last line matters. A seat told only to attack will manufacture objections;
a seat told to report honestly produces **"CONFIRMED"** sections, which are
what make the synthesis trustworthy.

---

## Monitoring

```bash
tmux ls                                    # are the seats alive?
tmux capture-pane -p -t advA | tail -20    # what is it doing now?
```

Seats produce no output until they write their findings file. **Absence of a
findings file is normal for 20+ minutes** — these are deep investigations.

Check they are *moving*, not stuck: the pane content should change between
samples. A seat showing the same last line for several minutes is stuck.

---

## What the seats found that one agent had not

The 2026-11-02 run: **three audit findings were wrong, and three serious
problems were missed.** See `../docs/SYNTHESIS.md` for the full list. The
short version:

- The audits claimed 24 worktrees carried unmerged branch tips. **They do
  not** — the tips are already in the SSOT. The real risk was 26 files in two
  dirty worktrees.
- The audits quoted "125 s to rebuild the index". That is the **hash-only**
  path; the cold cost is **72 minutes**.
- The audits called `pk` a dead hostname. **It is a live machine.**
- Missed: the pause state was **uncommitted** (one `git checkout` from
  re-arming it); a growth guard was documented as installed but **had no
  scheduler**; a **second live index** sat inside the paused layer; and an
  **offline ONNX embedder** was already on the box, unused.

**Every one of these was verified and fixed the same day.**

---

## The synthesis is not a summary

The output of the three seats is **input**. The synthesis must state:

- where they **agreed**
- where they **conflicted**
- which side the **evidence** supports — with a command
- what was **changed** as a result
- what remains a **decision for pk**

---

*Pattern established 2026-11-02 IST.*
