import React, { useEffect, useState } from "react";

function Clock({ start }: { start: Date }) {
  const [time, setTime] = useState(new Date());
  const dif = time.getTime() - start.getTime();
  const minute = Math.max(0, Math.floor(dif / 1000 / 60));
  const second = Math.max(0, Math.floor((dif / 1000) % 60));
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="text-2xl font-medium">
      <span>{minute.toString().padStart(2, "0")}</span>:
      <span>{second.toString().padStart(2, "0")}</span>
    </div>
  );
}

export default React.memo(Clock);
