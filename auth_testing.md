# Auth testing playbook (Fishing Realm)
1. mongosh test_database: db.users.findOne({role:"owner"}) -> password_hash starts with $2b$. Indexes: users.email (unique, partial), users.username_lower (unique), login_attempts.identifier.
2. curl -X POST $API/api/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@fishingrealm.com","password":"RealmOwner#2026"}' -> {access_token, refresh_token, player}
3. curl $API/api/auth/me -H "Authorization: Bearer <access_token>" -> {player}
4. 5 wrong passwords from same IP+email -> 429 lockout for 15 min.
5. Guest: POST /api/auth/guest -> player.is_guest true; POST /api/auth/claim {email,password} with Bearer -> is_guest false; then login with that email works.
