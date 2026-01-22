# Check Relay Messages

Poll the relay service for pending messages from Kitt/phone.

```bash
curl -s http://localhost:8600/api/messages/pending
```

If there are pending messages:
1. Show message content and sender
2. Ask if I should respond or claim the message
3. To claim: `curl -X POST http://localhost:8600/api/messages/MESSAGE_ID/claim`
4. To respond: `curl -X POST http://localhost:8600/api/messages/MESSAGE_ID/respond -H "Content-Type: application/json" -d '{"response":"Your response"}'`
