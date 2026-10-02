# Generations, seeds and network expansion

"Generation" is the most important coordinate in NEBULA. It decides the left-to-right order in Path Finder, the bands in Reaction Network and the colours everywhere.

---

## The idea in one paragraph

Imagine you start with a pantry of simple compounds (the **seed compounds**). You may run any reaction whose ingredients you already have. Each time that produces a compound you did not have, you have moved on a step. Repeat until nothing new appears. The step at which a compound first becomes available is its **generation**.

---

## How NEBULA computes it

NEBULA uses the *network expansion* method of Goldford and colleagues [[9]](references#ref-9)[[10]](references#ref-10) (an approach with a long history [[11]](references#ref-11)[[24]](references#ref-24)):

1. **Seeds.** Expansion begins from a fixed seed set: compounds assumed available from the environment before any reaction. These are **generation 0**. Elemental metal centres are part of this set.
2. **A reaction fires only when all its substrates are present**, including cofactors, at the current or an earlier generation. All enzymes are assumed available.
3. **A generation advances** when the available compounds allow a reaction to produce a compound *not previously present*.
4. **Lateral moves.** Reactions among available compounds that produce nothing new are *lateral*: they stay in the same generation.
5. **Every reaction is reversible in the expansion.** Each reaction is tried in the direction that advances the generation, so the network gains a direction from seeds toward new products. (NEBULA computes what is *mechanistically reachable*, not what is energetically favourable.)

> **Note:** For most cofactors, a synthesis route is part of the network. Once a cofactor has been made, a single renaming "reaction" assigns it to its conserved cofactor role.

In the current dataset, 67 compounds are generation 0 and generations extend to about 100. L-Glutamate (`C00025`) is generation 9.

---

## Where you see generations

| Place | How |
|---|---|
| Metabolome Records | The **transition** column, `3 -> 4`: reactants available at generation 3, product first appears at generation 4. |
| Path Finder | One column per generation, headed **GEN 1**, **GEN 2** … (plus **SEED** when seeds are drawn as nodes). A range such as **GEN 4–5** means two generations share a column so every line can point right. |
| Reaction Network | One band per generation headed **Seed**, **Gen 1** … plus the generation timeline and the rainbow colouring. |
| Metabolic Map | Compound colour: the rainbow runs from red (early) to violet (late). |

![A Path drawn by generation](images/pf-isolated.png "A Path to L-Glutamate in Path Finder: each column is a generation, and the target sits in generation 9.")

---

## Seeds, sources and cofactors

| Term | Meaning |
|---|---|
| **Seed compound** | In the generation-0 set. Assumed available from the start. |
| **Source compound** | A compound *you* choose in the **Source** field. Searches need not begin within the global seed set. When you give a source, every Path must use it. |
| **Cofactor** | NEBULA's cofactor-role compounds are the `Z` IDs. Metal centres and iron-sulfur clusters are seeds (generation 0) and are treated as always available, so Path Finder leaves them out of its nodes. Coenzymes such as NAD/NADP or CoA have their own generation: a route that needs them must first reach them. All `Z` compounds can be hidden in every viewer with the eye icon. |

See [Cofactor filtering](feature-cofactors).

---

## Reading generation numbers correctly

- A **higher generation** means *further from the seeds* in the expansion. It does not mean "later in evolution" or "more complex" by itself, although the expansion has been used to argue about early metabolism [[9]](references#ref-9)[[16]](references#ref-16)[[17]](references#ref-17).
- Generation is **not the number of steps in a Path.** A Path's *steps* (number of reactions) and *depth* (longest chain of reactions that must run in order) are measured separately. See [AND-OR logic and Paths](concept-and-or-paths).
- Because the expansion is forward-only, it shows what *becomes reachable*, not *how*. Path Finder adds the reverse operation: it traces back from a target through every minimal route [[9]](references#ref-9).

**Limits:** the expansion assumes reactions are reversible and all enzymes available, so it says nothing about thermodynamics or kinetics. See [FAQ and limitations](reference-limitations-faq).
