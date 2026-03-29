'use client';

import { useEffect, useState } from 'react';

// Maintenance ends: March 31, 2026 at 12:01 AM IST (which is March 30, 2026 at 18:31 UTC)
const MAINTENANCE_END_UTC = new Date('2026-03-30T18:31:00Z').getTime();

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [isMaintenanceOver, setIsMaintenanceOver] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    function checkTime() {
      const now = Date.now();
      if (now >= MAINTENANCE_END_UTC) {
        setIsMaintenanceOver(true);
      } else {
        setIsMaintenanceOver(false);
        const diff = MAINTENANCE_END_UTC - now;
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    }

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // While determining state, show nothing (avoids flash)
  if (isMaintenanceOver === null) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#050b14',
      }} />
    );
  }

  // Maintenance is over — render app normally
  if (isMaintenanceOver) {
    return <>{children}</>;
  }

  // Maintenance page
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050b14 0%, #0a1628 40%, #0d1f3c 100%)',
      color: '#e2e8f0',
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '50%',
        height: '50%',
        background: 'radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '40%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '720px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Animated gear icon */}
        <div style={{
          fontSize: '72px',
          marginBottom: '16px',
          animation: 'spin 4s linear infinite',
        }}>
          ⚙️
        </div>

        <h1 style={{
          fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #fbbf24, #f97316, #ef4444)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px',
          lineHeight: 1.2,
        }}>
          🚧 Under Maintenance
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
          color: '#94a3b8',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          MAAP is currently undergoing scheduled maintenance due to exceeding monthly server resource limits.
          We&apos;ll be back shortly!
        </p>

        {/* Countdown Timer */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Hours', value: timeLeft.hours },
            { label: 'Minutes', value: timeLeft.minutes },
            { label: 'Seconds', value: timeLeft.seconds },
          ].map((item) => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '16px 24px',
              minWidth: '90px',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
                fontWeight: 800,
                color: '#fbbf24',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {String(item.value).padStart(2, '0')}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
                marginTop: '4px',
              }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Expected downtime info */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          <p style={{
            color: '#cbd5e1',
            fontSize: '0.95rem',
            margin: 0,
          }}>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>Expected Restoration:</span>{' '}
            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
              31st March 2026, 12:01 AM IST
            </span>
          </p>
        </div>

        {/* Student notice - Big prominent card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%)',
          border: '2px solid rgba(34,197,94,0.3)',
          borderRadius: '20px',
          padding: '28px',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Corner accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: 'linear-gradient(180deg, #22c55e, #10b981)',
            borderRadius: '20px 0 0 20px',
          }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '28px' }}>📢</span>
            <h2 style={{
              fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
              fontWeight: 800,
              color: '#22c55e',
              margin: 0,
            }}>
              Important Notice for Students
            </h2>
          </div>

          <div style={{
            fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
            color: '#d1d5db',
            lineHeight: 1.8,
            paddingLeft: '12px',
          }}>
            <p style={{ margin: '0 0 14px 0' }}>
              If you have <span style={{ color: '#fbbf24', fontWeight: 700 }}>pending assignments</span> to submit during this maintenance window, <span style={{ color: '#22c55e', fontWeight: 700 }}>please do not worry!</span>
            </p>
            <p style={{ margin: '0 0 14px 0', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', fontWeight: 600, color: '#e2e8f0' }}>
              ✅ All submission deadlines will be extended to account for this downtime.
            </p>
            <p style={{ margin: '0 0 14px 0' }}>
              ❌ There is <span style={{ color: '#ef4444', fontWeight: 700 }}>NO need</span> to email your respective faculty members regarding this issue.
            </p>
            <p style={{
              margin: 0,
              padding: '12px 16px',
              background: 'rgba(34,197,94,0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#a7f3d0',
              fontWeight: 600,
              fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
            }}>
              💡 All faculty members have already been pre-informed about the ongoing situation. Your submissions and deadlines are safe. Sit tight and we&apos;ll be back before you know it!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          color: '#475569',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}>
          © 2025 Dept. of Mathematics, HIT • MAAP Portal
        </div>
      </div>

      {/* CSS animation for gear */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
