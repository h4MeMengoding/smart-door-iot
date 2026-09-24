"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import {
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowRight,
  Wifi,
  WifiOff,
  CreditCard,
  Clock,
  ShieldCheck,
  Fingerprint,
  CheckCircle2,
  Database,
  HardDrive,
  LockOpen,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import styles from "./login.module.css";

interface SystemStats {
  doorStatus: "LOCKED" | "UNLOCKED" | null;
  uptime: string | null;
  cardCount: number | null;
  rssi: number | null;
  freeHeap: number | null;
  espOnline: boolean | null;
  statusUnavailable: boolean;
  dbConnected: boolean | null;
  dbLatency: number | null;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loading} role="status">
          <Loader2 className="animate-spin" />
          <span className="sr-only">Loading login</span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function SystemStatus({ stats }: { stats: SystemStats }) {
  const seconds = Number(stats.uptime);
  const uptime =
    stats.uptime === null
      ? "—"
      : Number.isNaN(seconds)
        ? stats.uptime
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}m`
          : `${(seconds / 3600).toFixed(1)}h`;
  const items = [
    {
      icon: stats.espOnline ? Wifi : WifiOff,
      label: "Wi-Fi signal",
      value: stats.rssi === null ? "—" : `${stats.rssi} dBm`,
    },
    {
      icon: stats.doorStatus === "UNLOCKED" ? LockOpen : Lock,
      label: "Door lock",
      value:
        stats.doorStatus === null
          ? "—"
          : stats.doorStatus === "LOCKED"
            ? "Locked"
            : "Unlocked",
    },
    {
      icon: CreditCard,
      label: "RFID cards",
      value: stats.cardCount === null ? "—" : `${stats.cardCount} registered`,
    },
    {
      icon: Database,
      label: "Database",
      value:
        stats.dbConnected === null
          ? "Unavailable"
          : stats.dbConnected
            ? `${stats.dbLatency ?? 0} ms`
            : "Offline",
    },
    {
      icon: HardDrive,
      label: "Free memory",
      value:
        stats.freeHeap === null
          ? "—"
          : `${Math.round(stats.freeHeap / 1024)} KB`,
    },
    { icon: Clock, label: "Device uptime", value: uptime },
  ];

  return (
    <section className={styles.statusPanel} aria-label="System status">
      <div className={styles.statusHeading}>
        <div>
          <span className={styles.eyebrow}>CONNECTED TO YOUR SPACE</span>
          <h2>System at a glance</h2>
        </div>
        <span className={styles.deviceStatus} data-online={stats.espOnline}>
          <i />
          {stats.statusUnavailable
            ? "Status unavailable"
            : stats.espOnline === null
              ? "Connecting…"
              : `Device ${stats.espOnline ? "online" : "offline"}`}
        </span>
      </div>
      <dl className={styles.statsGrid}>
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className={styles.stat}>
            <Icon size={17} aria-hidden="true" />
            <div>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className={styles.statusFoot}>
        <span>Auto-refreshes every 15 seconds</span>
        <span>
          {stats.statusUnavailable
            ? "Unable to fetch device status"
            : stats.espOnline === null
              ? "Awaiting device status"
              : "Read-only device telemetry"}
        </span>
      </div>
    </section>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null,
  );

  const [stats, setStats] = useState<SystemStats>({
    doorStatus: null,
    uptime: null,
    cardCount: null,
    rssi: null,
    freeHeap: null,
    espOnline: null,
    statusUnavailable: false,
    dbConnected: null,
    dbLatency: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch system stats ──
  useEffect(() => {
    let aborted = false;
    const fetchStats = async () => {
      const [espRes, dbRes] = await Promise.allSettled([
        fetch("/api/health/device", { cache: "no-store" }).then((response) =>
          response.ok ? response.json() : null,
        ),
        fetch("/api/health/db", { cache: "no-store" }).then((response) =>
          response.ok || response.status === 503 ? response.json() : null,
        ),
      ]);
      if (aborted) return;
      const espData = espRes.status === "fulfilled" ? espRes.value : null;
      const dbData = dbRes.status === "fulfilled" ? dbRes.value : null;

      setStats({
        doorStatus: espData?.doorStatus ?? null,
        uptime: espData?.uptime ?? null,
        cardCount: espData?.cardCount ?? null,
        rssi: espData?.rssi ?? null,
        freeHeap: espData?.freeHeap ?? null,
        espOnline: espData?.deviceOnline ?? null,
        statusUnavailable: espData === null,
        dbConnected: dbData?.connected ?? null,
        dbLatency: dbData?.latency ?? null,
      });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => {
      aborted = true;
      clearInterval(interval);
    };
  }, []);

  // ── Lockout countdown ──
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) {
          setLocked(false);
          setError("");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // ── Focus first input ──
  useEffect(() => {
    // Avoid opening the software keyboard before a mobile user interacts.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleSubmit = useCallback(
    async (fullPin: string) => {
      if (loading || locked || success || fullPin.length !== 6) return;
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: fullPin }),
        });
        const data = await res.json();

        if (data.success) {
          setSuccess(true);
          // Hard navigation to ensure fresh server render (no stale Router Cache)
          setTimeout(() => {
            window.location.href = redirect;
          }, 900);
          return;
        }

        if (data.locked) {
          setLocked(true);
          setLockoutSeconds(data.lockoutSeconds || 300);
          setError(data.message);
        } else {
          setError(data.message || "Incorrect PIN");
          setRemainingAttempts(data.remainingAttempts ?? null);
        }
        triggerShake();
        setTimeout(() => {
          setPin("");
          inputRef.current?.focus();
        }, 450);
      } catch {
        setError("Connection failed");
        triggerShake();
        setTimeout(() => {
          setPin("");
          inputRef.current?.focus();
        }, 450);
      } finally {
        setLoading(false);
      }
    },
    [loading, locked, success, redirect, triggerShake],
  );

  const formatLockout = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className={styles.page}>
      <div className={styles.accessGrid}>
        <section className={styles.hero} aria-label="Smart Door access control">
          <div className={styles.heroTop}>
            <span className={styles.eyebrow}>
              <i />
              SMART ACCESS, SIMPLIFIED
            </span>
            <ArrowUpRight size={22} />
          </div>
          <h1>
            A smarter way
            <br />
            to feel <span>at home.</span>
          </h1>
          <p className={styles.heroDescription}>
            One door. Complete control.
            <br />
            Your connected space starts here.
          </p>
          <div className={styles.doorScene} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.orbitInner} />
            <div className={styles.floor} />
            <div className={styles.doorFrame}>
              <div className={styles.door}>
                <div className={styles.doorInset} />
                <div className={styles.reader}>
                  <span />
                  <Fingerprint size={25} />
                  <div />
                </div>
                <div className={styles.handle} />
              </div>
            </div>
            <div className={styles.sceneLabel}>
              <span>
                <ShieldCheck size={17} />
              </span>
              <div>
                Designed for peace of mind<small>Access on your terms</small>
              </div>
            </div>
            <span className={styles.sceneCoordinate}>01 / ACCESS POINT</span>
          </div>
          <div className={styles.heroFoot}>
            <span>
              <Fingerprint size={16} />
              Personal access
            </span>
            <span>
              <Wifi size={16} />
              Connected control
            </span>
          </div>
        </section>

        <section className={styles.formPanel} aria-labelledby="login-heading">
          <div className={styles.formTop}>
            <span className={styles.eyebrow}>YOUR CONTROL CENTER</span>
            <span className={styles.step}>01 / SIGN IN</span>
          </div>
          <div className={styles.formContent}>
            <div className={styles.formIcon}>
              {success ? (
                <CheckCircle2 size={26} />
              ) : (
                <Lock size={26} strokeWidth={1.6} />
              )}
            </div>
            <h2 id="login-heading">
              {success ? "You’re home." : "Welcome back."}
            </h2>
            <p className={styles.formDescription}>
              {success
                ? "Access granted. Opening your dashboard…"
                : "A little PIN. A lot of peace of mind."}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(pin);
              }}
            >
              <div className={styles.pinLabel}>
                <label htmlFor="access-pin">Your access PIN</label>
                <span>6 digits</span>
              </div>
              <div
                className={`${styles.pinField} ${shake ? styles.shake : ""}`}
                data-error={!!error}
                data-success={success}
              >
                <input
                  ref={inputRef}
                  id="access-pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={pin}
                  onChange={(event) => {
                    const next = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);
                    setPin(next);
                    setError("");
                    if (next.length === 6) void handleSubmit(next);
                  }}
                  disabled={locked || loading || success}
                  autoComplete="off"
                  aria-describedby="pin-help login-feedback"
                  aria-invalid={!!error}
                  className={styles.pinInput}
                />
                <div className={styles.pinSlots} aria-hidden="true">
                  {Array.from({ length: 6 }, (_, index) => (
                    <span
                      key={index}
                      data-filled={!!pin[index]}
                      data-active={pin.length === index}
                    >
                      {pin[index] ? showPin ? pin[index] : "•" : <i />}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.pinOptions}>
                <span id="pin-help">Enter PIN to unlock your dashboard</span>
                <button
                  type="button"
                  onClick={() => setShowPin((value) => !value)}
                  aria-pressed={showPin}
                  disabled={success}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showPin ? "Hide" : "Show"}
                </button>
              </div>
              <div
                id="login-feedback"
                className={styles.feedback}
                role="status"
                aria-live="polite"
              >
                {error || locked ? (
                  <div className={styles.error}>
                    <AlertCircle size={16} />
                    <span>
                      {error || "Please wait before trying again."}
                      {locked && (
                        <>
                          {" "}
                          Try again in{" "}
                          <strong>{formatLockout(lockoutSeconds)}</strong>.
                        </>
                      )}
                      {!locked && remainingAttempts !== null && (
                        <> {remainingAttempts} attempts remaining.</>
                      )}
                    </span>
                  </div>
                ) : success ? (
                  <span className={styles.success}>
                    PIN verified. Welcome in.
                  </span>
                ) : null}
              </div>
              <button
                className={styles.submit}
                type="submit"
                disabled={pin.length !== 6 || loading || locked || success}
              >
                <span>
                  {success
                    ? "Access granted"
                    : locked
                      ? `Try again in ${formatLockout(lockoutSeconds)}`
                      : loading
                        ? "Verifying your PIN…"
                        : "Enter dashboard"}
                </span>
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : success ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            </form>
            <p className={styles.help}>
              Forgot your PIN? <span>Contact your administrator.</span>
            </p>
          </div>
          <div className={styles.formFoot}>
            <ShieldCheck size={15} />
            <span>Private access. Only for authorized users.</span>
          </div>
        </section>
      </div>
      <SystemStatus stats={stats} />
    </div>
  );
}
