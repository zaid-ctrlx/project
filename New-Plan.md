Overview
Integrate an optional map view into the Discover section of the application. The map will display discoverable events and communities based on their stored locations.

The map must not be displayed by default. Users should continue seeing the existing Discover experience unless they explicitly choose to open the map through a clearly visible control such as a “View Map” button or map icon near the search bar in discover section.

The map is intended only to show public events and communities. Personal users, application users, and individual user locations must never be displayed.

Initial Geographic Scope
The map should be restricted to India.
During the initial implementation, only events and communities located in Karnataka should be displayed.
Locations outside Karnataka should either:
Not appear on the map, or
Be rejected during event or community creation, depending on the agreed product behavior.
The geographic restriction should be implemented in a way that allows additional Indian states to be enabled later without major architectural changes.
The initial map viewport should focus on Karnataka rather than displaying the entire world map.
Map Entities
The map should display only:

Events
Communities
It should not display:

Individual users
User profiles
User live locations
Private or restricted locations
Any location that is not associated with an event or community
Visibility should follow the existing access rules for events and communities. Private or restricted entities should not be exposed through the map unless the current product rules explicitly allow the user to view them.

Visual Differentiation
Events and communities must be visually distinguishable at a glance.

Suggested initial implementation:

Use one marker color for events.
Use a different marker color for communities.
Use different marker icons or shapes where supported.
Include a small legend explaining the marker types.
Selecting a marker should display a compact preview containing:
Name
Type: event or community
Short description
Date and time for events, where applicable
Approximate location or address
Relevant action such as “View Event” or “View Community”
The UI should avoid exposing unnecessary personal information.

Location Data and Accuracy
The map location must be generated from the location entered when creating an event or community.

The creation flow should:

Collect a sufficiently precise location.
Convert the provided location into latitude and longitude using geocoding.
Store the resolved coordinates with the event or community.
Preserve the user-entered address or location name for display.
Validate that the location is within the allowed geographic region.
Handle invalid, ambiguous, or incomplete locations with a clear validation message.
Allow the user to confirm the resolved location before publishing.
The map should use stored coordinates rather than attempting to geocode every time the Discover map is opened. This will improve performance and ensure consistent marker placement.

Where possible, the creation flow should provide location suggestions and allow users to select the correct result. A location should not be published if the geocoder returns a low-confidence or clearly incorrect result.

Interaction and Performance Requirements
The map should be smooth and reliable on both mobile and supported web experiences.

Requirements include:

The map opens only after the user explicitly selects the map option.
The existing Discover view remains the default view.
Markers should load without blocking the rest of the Discover experience.
Loading, empty, and error states must be handled clearly.
Markers should not visibly jump after they are loaded.
The map should remain responsive while panning and zooming.
Marker clustering should be considered when many events or communities are displayed in the same area.
Repeated map opening should not unnecessarily reload unchanged data.
The implementation should avoid visible flickering, layout shifts, or animation glitches.
Transitions for opening the map, loading markers, and selecting an entity should be subtle and smooth.
Map behavior should work correctly on smaller mobile screens.

Suggested API and Data Requirements
The backend should expose map-ready data for discoverable events and communities. Each map item should include, at minimum:
id
type: event | community
name
latitude
longitude
location_name or address
visibility/access information
short description

Events may additionally include:
start_date
end_date
category
attendee_count, if available

Communities may additionally include:
member_count, if available

The API should filter by:

Geographic boundary
Entity visibility
Current user permissions
Entity type, if the client requests only events or communities
The client should not receive user-location data for this feature.

Future Enhancements
The following items are outside the initial implementation but should be considered in the design:

Expanding map coverage from Karnataka to other Indian states.
Allowing users to filter between events and communities.
Filtering by event category, community type, date, or distance.
Dynamic marker sizes based on:
Community member count
Number of event attendees or RSVPs
Marker clustering and density visualization.
Navigation or route generation to an event or community location.
Distance from the current user’s selected or approximate location.
Search by place, city, or district.
Map-based pagination or viewport-based loading.
More advanced map animations and marker transitions.

Dynamic marker sizing should be designed carefully so that high-attendance events or large communities remain visually useful without obscuring nearby markers or revealing sensitive information.

Out of Scope for Initial Version

The first version should not include:

Displaying personal users on the map
Displaying live user locations
Navigation or turn-by-turn directions
Location tracking
Coverage outside India
Event or community creation directly from the map
Dynamic marker sizing based on member or attendee counts
Complex route planning
Heatmaps or geographic analytics

Acceptance Criteria

The existing Discover experience remains unchanged by default.
A user can explicitly open the map from the Discover section.
Only events and communities are displayed.
Individual users and user locations are never displayed.
The map is restricted to India, with Karnataka as the only enabled state initially.
Events and communities use clearly different marker colors and/or icons.
Selecting a marker opens the correct event or community details.
Event and community coordinates come from their creation-time location input.
Location input is geocoded and validated before publication.
Marker positions are accurate and remain stable after loading.
Invalid or ambiguous locations are handled with a clear error or confirmation flow.
Loading, empty, and failure states are implemented.
The map performs smoothly during opening, panning, zooming, and marker selection.
The implementation allows additional states to be enabled later without redesigning the entire feature.
No personal user data or user locations are exposed through the map.







-------------------------------------------
I’ll trace the existing user/profile flow, API conventions, and database migration pattern first, then turn that into a staged implementation plan with the key state rules and validation points. I’ll keep this read-only since you asked for a plan rather than code changes.

Search complete: Trace profile architecture

Read 

Read 

Searched codebase for "user profile implementation backend mobile user model schema routes", 13 results

Searched codebase for "profile API client screens components navigation", 15 results

Searched codebase for "followers following system one-way relationship", 29 results

Searched for files matching `**/user*.json`, no matches

Searched for files matching `**/profile*.json`, no matches

Searched for files matching `**/user*.ts`, no matches

Searched for files matching `**/profile*.ts`, 1 match

Searched for files matching `**/user*.js`, no matches

Searched for files matching `**/profile*.js`, no matches

Searched for files matching `**/*profile*.{ts,js,tsx,xts}`, 5 matches

Read 

Read 

Read 

Read 

Read , lines 1 to 260

Read , lines 1 to 260

Read 

Read 

The local shape is clear: profiles are represented by `UserPublicOut` and `PublicProfile`, profile actions live under `/users/{user_id}`, and the mobile profile screens already centralize relationship-like actions such as block/mute. I’m checking the migration and navigation/list patterns now so the plan can specify exact endpoints, screens, and rollout order rather than staying conceptual.

Read 

Read 

Read 

The backend already has the right precedent for this feature: a directional join table with a composite uniqueness constraint and cascading foreign keys, while block behavior deliberately differs by policy. I also found the main navigation entry point; one filename assumption was wrong, so I’m locating the actual user-search/profile-card surfaces before finalizing the “profiles shown elsewhere” part of the plan.

Searching for regex `searchUsers|UserSearchResult|navigate("UserProfile"|getUserProfile` (`**/mobile/src/**`)

Searched for files matching `**/mobile/src/screens/**/*Search*.tsx`, 1 match

Searched for regex `read_user_profile|UserPublicOut|response_model=list\[` (`**/backend/**`), 18 results

Searched for files matching `**/backend/tests/**/*`, no matches

Searched for regex `searchUsers|UserSearchResult|getUserProfile|UserProfile` (`**/mobile/src/**`), 37 results

Read , lines 220 to 262

Searched for regex `UserSearch|search users|Search users|users/search` (`**/mobile/src/**`), 18 results

Searched for regex `TestClient|pytest|alembic upgrade|users` (`**/backend/**`), 501 results

**Followers / Following Implementation Plan**

### 1. Data model and migration

Add a new directional relationship table:

`backend/app/models/follow.py`

```text
user_follows
- id
- follower_id -> users.id
- following_id -> users.id
- created_at
```

Constraints:

- Unique `(follower_id, following_id)`
- Foreign keys use `ON DELETE CASCADE`
- Index both `follower_id` and `following_id`
- Reject self-following

This follows the existing pattern used by `UserBlock` and its migration.

Create an Alembic migration:

`backend/alembic/versions/<revision>_add_user_follows_table.py`

Register the model in `__init__.py` if required by the project’s metadata setup.

### 2. Backend response schemas

Extend `user.py`:

Add relationship fields to public profile responses:

```text
followers_count: int
following_count: int
is_following: bool
follows_me: bool
```

Meaning:

- `is_following`: current user follows the viewed user
- `follows_me`: viewed user follows the current user

These two independent booleans support all required states:

| `is_following` | `follows_me` | Meaning |
|---|---|---|
| false | false | Neither follows the other |
| true | false | I follow them |
| false | true | They follow me |
| true | true | Mutual following |

Create a reusable lightweight user-list schema containing:

```text
id
username
full_name
avatar_url
is_following
follows_me
```

Use it for followers and following lists so relationship state is visible everywhere users are listed.

### 3. Backend API endpoints

Extend `users.py`.

#### Follow actions

```text
POST   /users/{user_id}/follow
DELETE /users/{user_id}/follow
```

Rules:

- Require authentication
- Reject self-following with `400`
- Return `404` for missing users
- `POST` is idempotent
- `DELETE` is idempotent
- Following is one-way only
- Do not create a reciprocal row automatically

#### Profile relationship data

Update:

```text
GET /users/{user_id}
```

Return:

- Follower count
- Following count
- `is_following`
- `follows_me`
- Existing block/mute fields

Use SQL `COUNT` and `EXISTS` queries rather than loading every relationship into Python.

#### Complete list endpoints

```text
GET /users/{user_id}/followers
GET /users/{user_id}/following
```

Return complete lists using the public user-list schema.

Recommended behavior:

- Order alphabetically by username initially
- Exclude users hidden by the existing block rules
- Do not expose email, gender, or location
- Add pagination parameters later if list size becomes significant

For the current user, the same endpoints should work with their own user ID.

### 4. Block and privacy rules

Keep follow relationships logically independent from blocking, but apply the existing visibility policy consistently:

- A blocked user should not appear in search, followers, or following lists
- Following a blocked user should return a clear `400` or `403`
- Blocking an existing connection should remove the follow rows in both directions, or alternatively hide them consistently; removing them is preferable because it prevents stale relationships
- Unblocking should not restore deleted follows automatically

This should be explicitly documented and covered by tests.

### 5. Backend profile and search integration

Update public profile and user-search responses so follower information is available wherever profiles appear:

- `user.py`
- `users.py`

For search results, include at least:

```text
is_following
follows_me
```

Counts are optional in search rows and should only be added if the UI needs them. The full profile endpoint remains the authoritative source for counts.

Avoid per-user database queries in search results. Use grouped counts and `EXISTS` expressions or a single relationship query.

### 6. Mobile API layer

Update `profile.ts`.

Add types:

```text
ProfileRelationship
PublicUserSummary
```

Add API methods:

```text
followUser(userId)
unfollowUser(userId)
getUserFollowers(userId)
getUserFollowing(userId)
```

Extend `PublicProfile` with:

```text
followers_count
following_count
is_following
follows_me
```

Extend `UserSearchResult` with the relationship booleans so search results clearly show the current state.

### 7. Other-user profile UI

Update `UserProfileScreen.tsx`.

Add:

- Followers count button/row
- Following count button/row
- Follow button when `is_following === false`
- Following or Unfollow action when `is_following === true`
- Loading/disabled state while the request is in progress
- Optimistic count and state updates with rollback on failure
- Existing message, block, menu, bio, and interests behavior unchanged

The button label should be based only on whether the current user follows the profile owner:

```text
false -> Follow
true  -> Following or Unfollow
```

`follows_me` should be shown separately, for example with a small “Follows you” label. It must not change the follow button behavior.

### 8. Own profile UI

Update `ProfileScreen.tsx`.

Add follower/following count rows beneath the identity section:

```text
Followers  <count>
Following  <count>
```

Tapping either row should open the corresponding complete list for the current user.

Because `UserOut` currently powers the authenticated user, add follower/following counts there or fetch the current profile relationship summary separately.

### 9. Complete followers/following list screen

Create a reusable screen, for example:

`mobile/src/screens/UserListScreen.tsx`

Navigation params:

```text
{
  userId: string;
  mode: "followers" | "following";
  title: string;
}
```

The screen should provide:

- Header title
- Complete list of users
- Avatar, username, and full name
- Tap-through to `UserProfile`
- Follow-state indicator
- “Follows you” indicator where applicable
- Loading state
- Empty state
- Error state
- Refresh support if consistent with existing screens

Add the route to `AppStack.tsx`.

### 10. Profile surfaces elsewhere

Update profile summaries wherever users are shown:

- `DiscoverScreen.tsx`
- `EventAttendeesScreen.tsx`
- `UserMultiPicker.tsx`
- Group member/contact surfaces
- Any future profile cards using `UserSearchResult`

Use a shared compact user-row component if the same avatar/name/follow-state layout appears in multiple places. Keep existing navigation and interaction intact.

### 11. Testing plan

Backend tests should cover:

- Following another user creates exactly one directional row
- Repeated follow requests are idempotent
- Unfollow removes only the current user’s relationship
- Self-follow is rejected
- One-way state remains independent
- Both users following each other works correctly
- Profile counts are accurate
- `is_following` and `follows_me` are independently correct
- Followers and following lists contain the correct users
- Deleted users cascade their relationships
- Blocked users cannot be followed or exposed in lists

Mobile validation should cover:

- Follow state for all four relationship combinations
- Follow/unfollow loading and rollback behavior
- Counts update after actions
- Complete lists open from both own and other profiles
- User rows navigate to profiles
- Search/discover/profile surfaces show relationship state
- Existing block, mute, message, and profile editing behavior still works

### Recommended implementation order

1. Add follow model and Alembic migration.
2. Add backend schemas and relationship query helpers.
3. Implement follow/unfollow endpoints.
4. Extend profile, search, and list endpoints.
5. Add backend tests for directional state.
6. Add mobile API types and methods.
7. Add follow controls to `UserProfileScreen`.
8. Add counts to `ProfileScreen`.
9. Add reusable followers/following list screen and navigation.
10. Update other user-profile surfaces.
11. Run backend tests, TypeScript checks, and manual Expo validation across all four relationship states.