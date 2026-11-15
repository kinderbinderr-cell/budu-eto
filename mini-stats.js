// Only signed Telegram launches can contribute. Never upload menu contents.
const miniStats = (() => {
  const launch = window.Telegram?.WebApp?.initData;
  let desired = 0, sent = 0, sending = false, timer = 0, failures = 0;
  let storageKey;
  try {
    const user = JSON.parse(new URLSearchParams(launch).get("user"));
    if (Number.isSafeInteger(user?.id)) storageKey = "budu-pending-week-" + user.id;
  } catch {}
  function pending(value) {
    if (!storageKey) return false;
    try {
      if (value === true) localStorage.setItem(storageKey, "1");
      if (value === false) localStorage.removeItem(storageKey);
      return localStorage.getItem(storageKey) === "1";
    } catch { return false; }
  }
  async function flush() {
    if (!launch || sending || sent >= desired) return;
    clearTimeout(timer);
    const target = desired;
    sending = true;
    try {
      const response = await fetch("https://www.kbrcore.ru:8444/budu-eto/mini-event", {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
        body: JSON.stringify({event: target === 2 ? "week_built" : "opened", initData: launch})
      });
      if (!response.ok) {
        if (response.status === 403) return; // A fresh launch supplies a fresh signature.
        throw Error("unavailable");
      }
      sent = target;
      failures = 0;
      if (target === 2) pending(false);
    } catch {
      timer = setTimeout(flush, Math.min(60000, 1000 * 2 ** Math.min(++failures, 6)));
      return;
    } finally { sending = false; }
    if (desired > sent) void flush();
  }
  if (launch) window.addEventListener("online", flush);
  return {
    opened() {
      if (!launch) return;
      desired = Math.max(desired, pending() ? 2 : 1);
      void flush();
    },
    built() {
      if (!launch || desired === 2) return;
      const week = plan();
      if (week?.days.length !== 7 || !week.days.every(day =>
        day.meals.length === 3 && day.meals.every(meal => meal.r?.id))) return;
      pending(true);
      desired = 2;
      void flush();
    }
  };
})();
