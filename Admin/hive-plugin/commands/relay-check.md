# /relay-check - Check and Respond to Relay Messages

Check for pending messages in the Relay queue and optionally respond to them.

## Instructions

1. Fetch pending messages from `http://localhost:8600/api/messages/pending`

2. If no messages, report "No pending messages"

3. If messages exist, display each message with:
   - Message ID
   - Timestamp
   - Source (phone, KittBox, etc.)
   - Content preview (first 200 chars)

4. Ask user which message to respond to (or "all" or "skip")

5. For each message to respond:
   a. Claim the message: `POST http://localhost:8600/api/messages/{id}/claim`
   b. Generate appropriate response based on message content
   c. Send response: `POST http://localhost:8600/api/messages/{id}/respond` with `{"response": "..."}`

6. Confirm each response was sent successfully

## Output Format

```
=== PENDING RELAY MESSAGES ===

[1] ID: msg_abc123
    Time: 2026-01-22 10:30:15
    From: phone
    Content: "Can you check if the build passed?"

[2] ID: msg_def456
    Time: 2026-01-22 10:45:22
    From: kittbox
    Content: "What's the status of the PR?"

Which message to respond to? (1, 2, all, skip)
```
