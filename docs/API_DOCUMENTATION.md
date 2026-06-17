# IISc Shuttlers API Documentation

**API Version**: 1.0  
**Last Updated**: June 2026  
**Backend**: Supabase (PostgreSQL) + Firebase (Real-time Database & Cloud Messaging)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users & Profiles](#users--profiles)
3. [Matches](#matches)
4. [ELO Ratings](#elo-ratings)
5. [Tournaments](#tournaments)
6. [Leaderboard](#leaderboard)
7. [Notifications](#notifications)
8. [Admin Operations](#admin-operations)
9. [Error Handling](#error-handling)

---

## Authentication

### Sign Up
**Endpoint**: `POST /auth/signup` (via Supabase Auth)

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "nickname": "PlayerName"
}
```

**Response (Success)**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-06-17T10:00:00Z"
  },
  "session": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc..."
  }
}
```

**Response (Error)**:
```json
{
  "error": {
    "code": "user_already_exists",
    "message": "User with this email already exists"
  }
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid input
- `409`: User already exists

---

### Sign In
**Endpoint**: `POST /auth/signin`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (Success)**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "app_metadata": {
      "provider": "email"
    }
  },
  "session": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 3600
  }
}
```

**Status Codes**:
- `200`: Success
- `401`: Invalid credentials
- `400`: Missing required fields

---

### Sign Out
**Endpoint**: `POST /auth/signout`

**Headers**: `Authorization: Bearer {access_token}`

**Response (Success)**:
```json
{
  "success": true
}
```

---

## Users & Profiles

### Get Current User
**Endpoint**: `GET /api/users/me`

**Headers**: `Authorization: Bearer {access_token}`

**Response**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "nickname": "PlayerName",
  "gender": "M",
  "level": "Intermediate",
  "hand": "R",
  "avatar_url": "https://...",
  "profile_setup_complete": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-06-17T10:00:00Z"
}
```

---

### Update Profile
**Endpoint**: `PATCH /api/users/me`

**Headers**: `Authorization: Bearer {access_token}`

**Request**:
```json
{
  "nickname": "NewName",
  "gender": "F",
  "level": "Advanced",
  "hand": "L",
  "avatar_url": "https://..."
}
```

**Response**:
```json
{
  "id": "uuid",
  "nickname": "NewName",
  "gender": "F",
  "level": "Advanced",
  "hand": "L",
  "avatar_url": "https://...",
  "updated_at": "2026-06-17T10:30:00Z"
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid input
- `401`: Unauthorized
- `404`: User not found

---

### Get User Profile
**Endpoint**: `GET /api/users/{userId}`

**Response**:
```json
{
  "id": "uuid",
  "nickname": "PlayerName",
  "gender": "M",
  "level": "Intermediate",
  "avatar_url": "https://...",
  "ms_elo": 1500,
  "ws_elo": null,
  "md_elo": 1450,
  "wd_elo": null,
  "xd_elo": 1350,
  "blended_elo": 1433,
  "wins": 45,
  "losses": 25,
  "win_rate": 0.643,
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

### List All Players
**Endpoint**: `GET /api/players`

**Query Parameters**:
- `limit`: Number of results (default: 50, max: 500)
- `offset`: Number to skip (default: 0)
- `search`: Filter by nickname
- `gender`: Filter by gender (M, F, Other)
- `level`: Filter by level
- `min_elo`: Minimum ELO rating
- `max_elo`: Maximum ELO rating

**Example**: `GET /api/players?limit=20&gender=M&min_elo=1200`

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "nickname": "Player1",
      "gender": "M",
      "level": "Intermediate",
      "blended_elo": 1500,
      "wins": 45,
      "losses": 25,
      "avatar_url": "https://..."
    }
  ],
  "count": 156,
  "limit": 20,
  "offset": 0
}
```

---

## Matches

### Create Match
**Endpoint**: `POST /api/matches`

**Headers**: `Authorization: Bearer {access_token}`

**Request**:
```json
{
  "format": "MS",
  "player1_id": "uuid",
  "player2_id": "uuid",
  "score": [21, 15],
  "is_friendly": false,
  "tournament_id": "uuid (optional)"
}
```

**Response**:
```json
{
  "id": "uuid",
  "format": "MS",
  "player1_id": "uuid",
  "player2_id": "uuid",
  "winner_id": "uuid",
  "score": [21, 15],
  "is_friendly": false,
  "tournament_id": null,
  "elo_change_p1": 32,
  "elo_change_p2": -32,
  "created_at": "2026-06-17T10:45:00Z",
  "created_by": "uuid"
}
```

**Status Codes**:
- `201`: Created
- `400`: Invalid format or score
- `401`: Unauthorized
- `404`: Player not found

---

### Get Match
**Endpoint**: `GET /api/matches/{matchId}`

**Response**:
```json
{
  "id": "uuid",
  "format": "MS",
  "player1": {
    "id": "uuid",
    "nickname": "Player1",
    "avatar_url": "https://..."
  },
  "player2": {
    "id": "uuid",
    "nickname": "Player2",
    "avatar_url": "https://..."
  },
  "winner": {
    "id": "uuid",
    "nickname": "Player1"
  },
  "score": [21, 15],
  "is_friendly": false,
  "duration_minutes": 45,
  "tournament_id": null,
  "elo_change_p1": 32,
  "elo_change_p2": -32,
  "created_at": "2026-06-17T10:45:00Z",
  "video_url": null
}
```

---

### List User Matches
**Endpoint**: `GET /api/users/{userId}/matches`

**Query Parameters**:
- `limit`: Default 50
- `offset`: Default 0
- `format`: Filter by format (MS, WS, MD, WD, XD)
- `tournament_only`: Boolean

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "format": "MS",
      "opponent": {
        "id": "uuid",
        "nickname": "Opponent",
        "avatar_url": "https://..."
      },
      "score": [21, 15],
      "won": true,
      "elo_change": 32,
      "created_at": "2026-06-17T10:45:00Z"
    }
  ],
  "count": 142,
  "limit": 50,
  "offset": 0
}
```

---

### Update Match
**Endpoint**: `PATCH /api/matches/{matchId}`

**Headers**: `Authorization: Bearer {access_token}`

**Request**:
```json
{
  "score": [21, 18],
  "video_url": "https://youtube.com/watch?v=xxx"
}
```

**Status Codes**:
- `200`: Success
- `403`: Only creator or admin can edit
- `404`: Match not found

---

### Delete Match
**Endpoint**: `DELETE /api/matches/{matchId}`

**Headers**: `Authorization: Bearer {access_token}`

**Status Codes**:
- `204`: Deleted
- `403`: Only creator or admin can delete
- `404`: Match not found

---

## ELO Ratings

### Get ELO History
**Endpoint**: `GET /api/users/{userId}/elo-history`

**Query Parameters**:
- `format`: Filter by format (MS, WS, MD, WD, XD, blended)
- `limit`: Default 100
- `offset`: Default 0

**Response**:
```json
{
  "data": [
    {
      "date": "2026-06-17",
      "format": "MS",
      "elo_before": 1468,
      "elo_after": 1500,
      "change": 32,
      "match_id": "uuid",
      "opponent": "Player2"
    }
  ],
  "count": 342,
  "limit": 100
}
```

---

### Get ELO Tier
**Endpoint**: `GET /api/elo-tiers`

**Response**:
```json
{
  "tiers": [
    {
      "name": "Bronze",
      "min_elo": 0,
      "max_elo": 999,
      "color": "#B87333"
    },
    {
      "name": "Silver",
      "min_elo": 1000,
      "max_elo": 1299,
      "color": "#C0C0C0"
    },
    {
      "name": "Gold",
      "min_elo": 1300,
      "max_elo": 1599,
      "color": "#FFD700"
    },
    {
      "name": "Platinum",
      "min_elo": 1600,
      "max_elo": 1899,
      "color": "#E5E4E2"
    },
    {
      "name": "Diamond",
      "min_elo": 1900,
      "max_elo": 2199,
      "color": "#B9F2FF"
    },
    {
      "name": "Grandmaster",
      "min_elo": 2200,
      "max_elo": 9999,
      "color": "#FF6B6B"
    }
  ]
}
```

---

## Tournaments

### Create Tournament
**Endpoint**: `POST /api/tournaments`

**Headers**: `Authorization: Bearer {access_token}` (Admin only)

**Request**:
```json
{
  "name": "INVICTA 2026",
  "format": "Single Elimination",
  "start_date": "2026-06-25T08:00:00Z",
  "end_date": "2026-06-27T18:00:00Z",
  "max_participants": 64,
  "description": "Annual invitational tournament"
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "INVICTA 2026",
  "format": "Single Elimination",
  "status": "draft",
  "start_date": "2026-06-25T08:00:00Z",
  "end_date": "2026-06-27T18:00:00Z",
  "max_participants": 64,
  "participant_count": 0,
  "created_by": "uuid",
  "created_at": "2026-06-17T10:00:00Z"
}
```

---

### Get Tournament
**Endpoint**: `GET /api/tournaments/{tournamentId}`

**Response**:
```json
{
  "id": "uuid",
  "name": "INVICTA 2026",
  "format": "Single Elimination",
  "status": "ongoing",
  "start_date": "2026-06-25T08:00:00Z",
  "end_date": "2026-06-27T18:00:00Z",
  "participants": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "nickname": "Player1",
      "seed": 1,
      "status": "active"
    }
  ],
  "bracket": {
    "matches": [
      {
        "id": "uuid",
        "round": 1,
        "position": 1,
        "player1_id": "uuid",
        "player2_id": "uuid",
        "winner_id": null,
        "status": "pending"
      }
    ]
  }
}
```

---

### Register for Tournament
**Endpoint**: `POST /api/tournaments/{tournamentId}/register`

**Headers**: `Authorization: Bearer {access_token}`

**Response**:
```json
{
  "success": true,
  "message": "Successfully registered for tournament"
}
```

---

### List Tournaments
**Endpoint**: `GET /api/tournaments`

**Query Parameters**:
- `status`: draft, ongoing, completed
- `limit`: Default 50
- `offset`: Default 0

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "INVICTA 2026",
      "format": "Single Elimination",
      "status": "ongoing",
      "start_date": "2026-06-25T08:00:00Z",
      "participant_count": 32
    }
  ],
  "count": 5,
  "limit": 50
}
```

---

## Leaderboard

### Get Leaderboard
**Endpoint**: `GET /api/leaderboard`

**Query Parameters**:
- `format`: MS, WS, MD, WD, XD, blended (default: blended)
- `gender`: M, F, Mixed (default: all)
- `limit`: 1-500 (default: 50)
- `offset`: Default 0
- `period`: all-time, season, month, week

**Response**:
```json
{
  "data": [
    {
      "rank": 1,
      "user_id": "uuid",
      "nickname": "TopPlayer",
      "elo": 2150,
      "wins": 120,
      "losses": 20,
      "win_rate": 0.857,
      "matches_played": 140
    }
  ],
  "format": "blended",
  "period": "all-time",
  "total_players": 256,
  "limit": 50,
  "offset": 0
}
```

---

### Get User Rank
**Endpoint**: `GET /api/users/{userId}/rank`

**Query Parameters**:
- `format`: blended (default)
- `period`: all-time (default)

**Response**:
```json
{
  "rank": 15,
  "elo": 1850,
  "wins": 85,
  "losses": 30,
  "win_rate": 0.739,
  "total_players": 256,
  "percentile": 94.1
}
```

---

## Notifications

### Get Notifications
**Endpoint**: `GET /api/notifications`

**Headers**: `Authorization: Bearer {access_token}`

**Query Parameters**:
- `unread_only`: Boolean (default: false)
- `limit`: Default 50
- `offset`: Default 0

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Match Start",
      "body": "Your match with John starts in 10 minutes",
      "type": "match",
      "related_id": "match-uuid",
      "read": false,
      "created_at": "2026-06-17T14:50:00Z"
    }
  ],
  "unread_count": 5,
  "limit": 50
}
```

---

### Mark as Read
**Endpoint**: `PATCH /api/notifications/{notificationId}`

**Headers**: `Authorization: Bearer {access_token}`

**Request**:
```json
{
  "read": true
}
```

---

### Mark All as Read
**Endpoint**: `PATCH /api/notifications/read-all`

**Headers**: `Authorization: Bearer {access_token}`

**Response**:
```json
{
  "success": true,
  "count": 12
}
```

---

## Admin Operations

### Get Analytics
**Endpoint**: `GET /api/admin/analytics`

**Headers**: `Authorization: Bearer {access_token}` (Admin only)

**Query Parameters**:
- `period`: day, week, month, year (default: month)

**Response**:
```json
{
  "total_users": 256,
  "active_users_period": 182,
  "new_users_period": 34,
  "total_matches": 2841,
  "matches_period": 341,
  "active_tournaments": 3,
  "completed_tournaments": 18
}
```

---

### Get Activity Log
**Endpoint**: `GET /api/admin/activity-log`

**Headers**: `Authorization: Bearer {access_token}` (Admin only)

**Query Parameters**:
- `action`: create_match, update_profile, delete_match, etc.
- `user_id`: Filter by user
- `limit`: Default 100
- `offset`: Default 0

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action": "create_match",
      "entity": "match",
      "entity_id": "uuid",
      "details": { "format": "MS", "score": [21, 15] },
      "created_at": "2026-06-17T14:45:00Z"
    }
  ],
  "count": 342,
  "limit": 100
}
```

---

### Send Push Notification (Admin)
**Endpoint**: `POST /api/admin/notifications/broadcast`

**Headers**: `Authorization: Bearer {access_token}` (Admin only)

**Request**:
```json
{
  "title": "New Feature Released",
  "body": "Check out the new video analysis tool",
  "target": "all",
  "user_ids": [] // if target is "specific"
}
```

**Response**:
```json
{
  "success": true,
  "sent_count": 245,
  "failed_count": 0
}
```

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "status": 400
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `invalid_input` | 400 | Request body validation failed |
| `not_found` | 404 | Resource not found |
| `unauthorized` | 401 | Missing or invalid authentication |
| `forbidden` | 403 | Insufficient permissions |
| `conflict` | 409 | Resource already exists |
| `rate_limit` | 429 | Too many requests |
| `server_error` | 500 | Internal server error |

---

### Rate Limiting

- **Limit**: 100 requests per minute per user
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Error**: Returns 429 with retry-after header

---

## Authentication Headers

All endpoints (except auth endpoints) require:

```
Authorization: Bearer {access_token}
```

Access tokens expire in 1 hour. Use refresh_token to get a new access_token:

```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "..."
}
```

---

## Pagination

Endpoints with collections use:
- `limit`: Number of results (1-500, default varies)
- `offset`: Number to skip (default: 0)
- `count`: Total number of items available

Example:
```
GET /api/players?limit=20&offset=40
```

---

## Timestamps

All timestamps are in ISO 8601 format (UTC):
```
2026-06-17T14:45:30.123Z
```

---

## Webhooks

Firebase Cloud Functions trigger webhooks for:
- Match creation/completion
- Tournament status changes
- User achievements
- Breaches of terms

---

## SDK Support

Official SDKs available for:
- JavaScript/TypeScript (npm: `iiscshuttlers-sdk`)
- Python (pip: `iiscshuttlers-sdk`)

## Further Support

For API support, email: `api-support@iiscshuttlers.github.io`

