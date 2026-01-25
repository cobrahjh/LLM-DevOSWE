/**
 * TroubleshootEngine - Shared module for Hive services
 * Provides common server startup and diagnostics
 */
class TroubleshootEngine {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
  }

  startServer(httpServer, port, host, callback) {
    httpServer.listen(port, host, () => {
      console.log(`[${this.name}] Server started on ${host}:${port}`);
      if (callback) callback();
    });
  }

  getUptime() {
    return Date.now() - this.startTime;
  }

  log(message) {
    console.log(`[${this.name}] ${message}`);
  }

  error(message) {
    console.error(`[${this.name}] ERROR: ${message}`);
  }
}

module.exports = TroubleshootEngine;
