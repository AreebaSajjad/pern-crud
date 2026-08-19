import { useState, useRef, useEffect } from 'react';

const generateSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
};

const formatTimeLabel = (time24) => {
  const [h, m] = time24.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
};

const TimeSlotPicker = ({ value, onChange, bookedTimes = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const slots = generateSlots();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (time) => {
    onChange(time);
    setIsOpen(false);
  };

  return (
    <div className="time-picker-wrapper" ref={wrapperRef}>
      <div className="time-picker-input" onClick={() => setIsOpen(!isOpen)}>
        <span>{value ? formatTimeLabel(value) : 'Click to select a time slot'}</span>
        <span className="time-picker-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <>
          <div className="time-picker-overlay" onClick={() => setIsOpen(false)}></div>
          <div className="time-picker-panel">
            <div className="time-picker-panel-header">
              <h3>Select a Time Slot</h3>
              <div className="time-picker-legend">
                <span><span className="legend-dot legend-free"></span> Free</span>
                <span><span className="legend-dot legend-booked"></span> Booked</span>
              </div>
            </div>
            <div className="time-picker-grid">
              {slots.map((time) => {
                const isBooked = bookedTimes.includes(time);
                return (
                  <button
                    key={time}
                    type="button"
                    className={`time-slot ${isBooked ? 'slot-booked' : 'slot-free'} ${value === time ? 'slot-selected' : ''}`}
                    disabled={isBooked}
                    onClick={() => handleSelect(time)}
                  >
                    {formatTimeLabel(time)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TimeSlotPicker;