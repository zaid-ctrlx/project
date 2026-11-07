# How the recommender works (and how to defend it)

Study notes for explaining the recommendation engine to a faculty panel. Every
number below comes from code in this repo and can be reproduced with the
commands shown.

## 1. What it does in one paragraph

For a signed-in user, rank the upcoming events and the communities they have
not already joined, best first, and say *why* each is suggested. It is a
**hybrid** of two classic techniques: **content-based filtering** (match what
the user says they like against what an event is) and **collaborative
filtering** (learn from what similar people did). New users get content-based
results only; the collaborative part is blended in as they build a history.

## 2. Data it uses

| Signal | Where it comes from |
|---|---|
| User interests | Tags picked in onboarding/profile (`user_tags`) |
| User location | Profile location (only for the distance term) |
| Event features | `activity_type` (20 values), location, start time |
| Behaviour (implicit feedback) | `interactions` table: **view**, **bookmark**, **RSVP**, **join** |

Strength of each action (`app/recsys/config.py`): view 1, bookmark 3, RSVP 4,
join 4. Repeats on the same event add up but are capped at 6, so one user
hammering an event cannot dominate. Bookmarks/RSVPs/memberships that existed
before logging started are back-filled when the model is fitted.

## 3. The pipeline

**Step 1 - candidates.** All upcoming events plus all communities, minus the
user's own posts and anything they already bookmarked, RSVP'd to or joined.

**Step 2 - content score** (`content.py`), a weighted sum, each part in [0,1]:

| Part | Weight | Meaning |
|---|---|---|
| Interest match | 0.55 | cosine similarity between the user's tag vector and the event's activity vector |
| Distance | 0.20 | `exp(-km / 25)` - 1.0 at the event's door, 0.37 at 25 km, ~0 at 100 km |
| Time | 0.15 | `exp(-days_until / 30)` - sooner is better; past events 0; communities neutral |
| Popularity | 0.10 | how many people interacted, min-max scaled |

*Shared vocabulary* (`taxonomy.py`): users pick interest **tags**, events carry
one **activity type**. Each activity maps onto a primary tag (weight 1.0) plus
related ones (e.g. badminton -> badminton 1.0, sports 0.5). That puts both in
the same 20-dimensional space so cosine similarity is meaningful. A unit test
fails if a new activity type is added without a mapping.

**Step 3 - collaborative score** (`cf.py`). Build the user x event matrix of
interaction strengths, then **truncated SVD** with 5 latent factors:
`R ~= U S V^T`. The reconstructed matrix gives a predicted affinity for events
the user has not touched. Intuition: each factor is a hidden "taste" (e.g.
outdoorsy, techy); users and events get coordinates on those tastes, and
affinity is how well they line up.

**Step 4 - hybrid** (`hybrid.py`): `final = (1 - w) * content + w * cf`, both
min-max scaled, where `w` depends on how much history the user has:

- fewer than **5** interactions -> `w = 0` (pure content-based: the **cold-start rule**)
- then rises linearly to `w = 0.9` at **10** interactions
- never 1.0, so interests/distance always keep a voice and the result stays explainable

**Step 5 - explanation.** The reason is only ever something true for that item:
"Matches your interest in X" (tag overlap), "Popular with people who like
similar things" (strong collaborative score), else "Happening this week" /
"Upcoming event" / "Active community". **Distance is a separate number** (km,
straight line from the user's saved location) shown only when both locations
are known; otherwise nothing is shown. It is not road distance.

The fitted SVD is cached for 10 minutes (scheduled-batch style retraining, as
the proposal says - *not* online learning; do not claim otherwise).

## 4. How it was evaluated

No real user base exists yet, so the proposal's bootstrap strategy is used:
a **synthetic data generator** (`synthetic.py`) with interest clusters, a
skewed popularity distribution, and noise.

- **Temporal split**: the earliest 80% of interactions train, the latest 20%
  test (not a random split - recommendation is time-ordered).
- **Relevant** = events the user bookmarked/RSVP'd/joined in the test period
  that they had not touched in training.
- **Metrics**: Precision@10, Recall@10, NDCG@10 (ranking quality); RMSE/MAE of
  the SVD's predicted strength (reported for completeness).
- **Baselines**: popularity-only, content-only, collaborative-only, hybrid.
- **Repetition**: 10 random datasets per scenario, reported as mean +/- std and
  as paired win counts, not a single run.
- **No tuning on the test set**: settings (SVD factors, max CF weight, blend
  ramp) were chosen by `scripts/tune_recommender.py` on *validation* seeds
  100-104; results are reported on different seeds 0-9.
- **Scenarios**: 0% / 30% / 60% of users have declared tags that do not match
  their real behaviour (people choose interests carelessly).

Reproduce: `python -m scripts.evaluate_recommender --tag-noise 0.3`
(from `backend/`).

### Results (NDCG@10, mean over 10 datasets)

| Declared tags unreliable | Popularity | Content-only | Collaborative-only | **Hybrid** |
|---|---|---|---|---|
| 0% | 0.116 | 0.129 | 0.146 | **0.149** |
| 30% | 0.115 | 0.097 | 0.148 | 0.138 |
| 60% | 0.114 | 0.074 | 0.154 | 0.129 |

How to read it honestly:

- With reliable tags the hybrid is the best of the four.
- The hybrid beats content-only in every unreliable-tag scenario (10/10
  datasets at 30% and 60%) - blending behaviour in rescues bad profiles.
- Collaborative-only is a little ahead of the hybrid when tags are unreliable,
  because the hybrid deliberately keeps content in the mix and gates CF behind
  the cold-start rule. The price of that safety is a small loss where history is
  plentiful; the benefit is that brand-new users still get sensible results.
- Cold users (<5 interactions): the hybrid equals content-based by design.
- Absolute values look small (NDCG ~0.15) because each user has only ~3
  relevant test items among ~150 events; compare systems *relative to each
  other*, not to 1.0.

## 5. Limitations to state before they ask

1. **Synthetic data.** Behaviour is generated from interest clusters, which
   inherently favours methods that can find clusters. Results show the method
   works as designed, not that it will hit these numbers on real users.
   Re-run the evaluation once real interactions exist.
2. **Small catalogue and user base.** The live database has only dozens of
   users; collaborative filtering needs far more.
3. **Synthetic "cold" users still have 1-4 interactions.** A truly brand-new
   user has zero, where only content/popularity can work.
4. **Communities have no activity type**, so they cannot match on interests;
   they are ranked by distance, popularity and collaborative signal only.
5. **Distance is straight-line**, not travel time.
6. **No online learning**; the model refits at most every 10 minutes.
7. **Popularity bias**: popular items get recommended more, which can bury
   new niche events (the cold-start problem for items). Not mitigated yet.
8. SVD `RMSE/MAE` are high because held-out pairs are mostly unseen cells
   predicted near zero; ranking metrics are the meaningful ones.

## 6. Privacy and consent (proposal section 6)

- Used by the recommender: chosen interest tags, saved location (distance only),
  and the user's own views, bookmarks, RSVPs and community joins.
- Not used: messages, profile text, contacts, or anyone's personal details.
- Other users' data is used only in aggregate (counts, similarity) - one
  user's behaviour is never shown to another.
- A user's location is rounded to ~1 km (2 decimal places) when saved, and only
  the *distance to events* is returned to that same user; location is not
  exposed to others by this feature.
- Account deletion cascades and removes that user's interactions.
- Still to do: show the user an explicit "your activity improves
  recommendations" notice with an opt-out.

## 7. Likely viva questions

**Why a hybrid and not just one method?** Each fails alone: content-based
needs accurate profiles and never discovers surprises; collaborative needs
history and fails for new users. The hybrid covers both, and the experiments
show it beating content-only when profiles are unreliable.

**Why SVD?** Standard, explainable matrix factorisation for implicit feedback;
cheap to train for this scale; `surprise` was avoided because it targets
explicit ratings and needs a C compiler on Windows - scipy's `svds` is the same
factorisation.

**How do you handle cold start?** New users: 0 collaborative weight until 5
interactions, then a linear ramp. New events: matched on activity type,
location and time, so they can be recommended before anyone interacts.

**Why those weights?** Hand-set for the content score (interest 0.55 > distance
> time > popularity, reflecting that relevance matters most); the SVD factors,
max CF weight and ramp were *tuned on validation data*. The content weights
are a judgement call and are listed as future tuning.

**How do you know it is not overfitted?** Settings chosen on seeds 100-104,
results reported on seeds 0-9, averaged over 10 datasets with standard deviations.

**Why is NDCG only ~0.15?** Few relevant items per user in a 150-event
catalogue; the meaningful figure is the gap between systems.

**What would you do with real data?** Collect interactions for a few weeks,
re-run `evaluate_recommender` on a temporal split of the real log, re-tune,
and add an A/B comparison of click-through and RSVP rate.

**Is it fair / safe?** The recommender ranks *events and communities*, never
people, and never exposes one user's behaviour to another. Recommendations can
still lead to real-world meetups, so safety rests on the app's existing controls
(blocking, community join approval) plus the privacy notes above. Posts by
anyone the user blocked, or who blocked them, are never recommended. Users can
report a profile or a post (private, stored for review). Honest gap: there is no
admin dashboard and reported content is not auto-hidden - state that as future work.
