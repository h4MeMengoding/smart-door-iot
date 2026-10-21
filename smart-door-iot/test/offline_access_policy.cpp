#include "OfflineAccessPolicy.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

void test_local_access_is_independent_from_wifi_recovery() {
    TEST_ASSERT_TRUE(canProcessLocalAccess(false));
    TEST_ASSERT_FALSE(canProcessLocalAccess(true));
    TEST_ASSERT_TRUE(shouldAttemptWiFiReconnect(false, 10000, 0, 10000));
    TEST_ASSERT_FALSE(shouldAttemptWiFiReconnect(false, 9999, 0, 10000));
    TEST_ASSERT_FALSE(shouldAttemptWiFiReconnect(true, 20000, 0, 10000));
    TEST_ASSERT_FALSE(shouldStartHttpOtaServer(false, false));
    TEST_ASSERT_TRUE(shouldStartHttpOtaServer(true, false));
    TEST_ASSERT_FALSE(shouldStartHttpOtaServer(true, true));
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_local_access_is_independent_from_wifi_recovery);
    UNITY_END();
}

void loop() {}

#else

#include <assert.h>

int main() {
    // Local access must remain active whenever firmware is not being written.
    assert(canProcessLocalAccess(false));
    assert(!canProcessLocalAccess(true));

    // Wi-Fi recovery is scheduled separately and must not control local access.
    assert(shouldAttemptWiFiReconnect(false, 10000, 0, 10000));
    assert(!shouldAttemptWiFiReconnect(false, 9999, 0, 10000));
    assert(!shouldAttemptWiFiReconnect(true, 20000, 0, 10000));
    assert(!shouldStartHttpOtaServer(false, false));
    assert(shouldStartHttpOtaServer(true, false));
    assert(!shouldStartHttpOtaServer(true, true));
}

#endif
