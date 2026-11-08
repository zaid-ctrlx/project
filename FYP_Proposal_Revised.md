# AI-Powered Recommendation System for Niche Community Events
### Final Year Project Proposal (Revised, Scoped Version)

---

## 1. Problem Statement

People engaged in niche activities — cycling, gym, trekking, photography, study groups, music — struggle to discover relevant local communities, events, and like-minded participants. Mainstream platforms are optimized for broad, popular content rather than fine-grained niche-interest matching, leaving these communities underserved.

---

## 2. Scope

The original idea covered four recommendation targets (users, communities, events, activities) and six ML techniques at once. That breadth is difficult to implement *and* evaluate rigorously within a final year timeline, so this revision narrows the core deliverable:

**Primary deliverable:** A hybrid recommender that ranks **events/activities** for a given user, combining content signals from their profile and activity history with collaborative signals from similar users' interaction patterns.

**Explicitly out of primary scope** (documented as future work, not built for the defense):
- Full user-to-user matchmaking pipeline
- Real-time participation prediction and engagement/churn prediction models
- Web app — mobile-first (React Native/Expo) is the primary build target

Narrowing scope this way lets you implement one pipeline deeply and evaluate it properly, rather than covering many pipelines shallowly.

---

## 3. System Architecture

*(See accompanying diagram.)*

- **Content-Based Filtering** — profile and activity feature vectors (interest tags, activity type, location, past attendance) compared via cosine similarity.
- **Collaborative Filtering** — matrix factorization (SVD) over the user–event interaction matrix, built from implicit feedback (RSVPs, clicks, saves).
- **Hybrid Combiner** — a switching/weighted hybrid. New users with little history get content-based recommendations; users with more interaction history get a blend that increasingly favors collaborative filtering as their interaction count grows.

---

## 4. Cold-Start & Data Strategy

This was the biggest gap in the original proposal — collaborative filtering needs interaction history a brand-new platform doesn't have yet.

- **Bootstrap data:** validate models offline before real users exist, using a public dataset (e.g. Meetup.com public datasets) or a synthetic data generator simulating users, events, and interactions across configurable interest clusters.
- **Cold-start rule:** new users default to content-based recommendations until they cross a minimum interaction threshold (e.g. 5–10 actions), after which collaborative filtering is blended in.
- This staged approach mirrors patterns used in production recommender systems, and gives you a concrete, defensible design decision to discuss in your defense.

---

## 5. Evaluation Plan

- **Split:** temporal train/test split of interaction data (train on earlier interactions, test on later ones — not a random split, since recommendation is inherently time-ordered).
- **Metrics:** Precision@K, Recall@K, NDCG@K for ranking quality; RMSE/MAE for the SVD's predicted interaction strength.
- **Baselines for comparison:**
  1. Popularity-based recommender (most-attended events)
  2. Content-based only
  3. Collaborative filtering only
  4. Your hybrid model

Presenting these four side-by-side in a results table/chart is what actually delivers the "research potential through comparison" the original proposal claimed but didn't operationalize.

---

## 6. Safety & Privacy Considerations

Recommendations here lead to real-world meetups between strangers, so this needs explicit treatment:

- User reporting/blocking functionality
- Optional profile verification
- Configurable location precision shown to other users (e.g. neighborhood-level, not exact address)
- Clear documentation of what profile data feeds the recommender, with explicit user consent

Most FYP rubrics score ethics/privacy handling separately — a short, deliberate section here is worth including even at MVP scale.

---

## 7. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React Native (Expo) | Mobile-first; web (React) is future work |
| Backend | FastAPI | |
| Database | PostgreSQL | |
| ML | Python, Scikit-learn, Pandas | Consider the `surprise` library specifically for SVD |
| Retraining | Scheduled batch (nightly/weekly) | Not true online learning — state this explicitly in the report to avoid overclaiming |
| Optional stretch | Docker, FAISS | Docker for deployment; FAISS only if similarity search needs to scale beyond a small dataset |

---

## 8. Future Work / Stretch Goals

- User-to-user matchmaking (extending the same content-based profile vectors to people, not just events)
- Activity participation prediction (classification model for RSVP likelihood, once real interaction data exists)
- User engagement/churn prediction
- Web app via React (companion to the mobile-first React Native app)

Framing these as future work (rather than promising them in the core deliverable) still shows the examiners the platform's growth potential without overcommitting your timeline.

---

## 9. Proposed Timeline (≈14–16 weeks)

| Weeks | Milestone |
|---|---|
| 1–2 | Literature review; finalize dataset/bootstrap strategy |
| 3–4 | Data collection or synthetic generation; DB schema design |
| 5–7 | Content-based filtering module + backend API |
| 8–10 | Collaborative filtering (SVD) + hybrid combiner |
| 11–12 | Mobile (React Native/Expo) frontend integration |
| 13–14 | Evaluation: baselines, metrics, results analysis |
| 15–16 | Report writing, safety/privacy write-up, presentation prep |

---

## 10. Why This Is a Strong Final Year Project

- Combines a genuine hybrid ML **architecture** — not a flat list of techniques — with full-stack implementation.
- Has a clear, defensible research contribution: a quantitative comparison of recommendation strategies in a niche-interest domain, which is less studied than mainstream recommender benchmarks (movies, music, e-commerce).
- Addresses cold start explicitly — a well-known hard problem — showing engineering maturity beyond a typical class project.
- The architecture is extensible to user-matching and engagement prediction after graduation without redesign, which supports the "could become a startup" narrative without requiring you to build all of it now.
