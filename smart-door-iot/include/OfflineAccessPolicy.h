#ifndef OFFLINE_ACCESS_POLICY_H
#define OFFLINE_ACCESS_POLICY_H

// Keep local door access independent from network recovery.
constexpr bool canProcessLocalAccess(bool otaInProgress) {
    return !otaInProgress;
}

constexpr bool shouldAttemptWiFiReconnect(
    bool wifiIsConnected,
    unsigned long now,
    unsigned long lastAttempt,
    unsigned long interval
) {
    return !wifiIsConnected && (now - lastAttempt >= interval);
}

constexpr bool shouldStartHttpOtaServer(bool wifiIsConnected, bool serverStarted) {
    return wifiIsConnected && !serverStarted;
}

#endif // OFFLINE_ACCESS_POLICY_H
