import { useState, useEffect } from 'react';

const CountdownTimer = ({ date, time }) => {
  const [display, setDisplay] = useState('');
  const [status, setStatus] = useState('upcoming');

  useEffect(() => {
    const targetTime = new Date(`${date}T${time}`).getTime();

    const tick = () => {
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        setStatus('started');
        setDisplay('Meeting time has arrived');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setDisplay(`${days}d ${hours}h ${minutes}m`);
        setStatus('upcoming');
      } else if (hours > 0) {
        setDisplay(`${hours}h ${minutes}m ${seconds}s`);
        setStatus(hours < 1 ? 'soon' : 'upcoming');
      } else if (minutes > 0) {
        setDisplay(`${minutes}m ${seconds}s`);
        setStatus('soon');
      } else {
        setDisplay(`${seconds}s`);
        setStatus('soon');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [date, time]);

  return (
    <span className={`countdown-badge countdown-${status}`}>
      {status === 'started' ? '🔴 ' : '⏳ '}{display}
    </span>
  );
};

export default CountdownTimer;