const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const toTimeString = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const generateAllSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
};

export const getBookedSlotsForParticipants = (meetings, date, participantIds, excludeId) => {
  const relevantMeetings = meetings.filter((m) => {
    if (m.date !== date) return false;
    if (excludeId && m._id === excludeId) return false;
    const mParticipantIds = m.participants?.map((p) => p._id) || [];
    return participantIds.some((id) => mParticipantIds.includes(id));
  });

  const bookedSet = new Set();
  const allSlots = generateAllSlots();

  relevantMeetings.forEach((m) => {
    const start = toMinutes(m.time);
    const end = start + m.duration;
    allSlots.forEach((slot) => {
      const slotMin = toMinutes(slot);
      if (slotMin >= start && slotMin < end) {
        bookedSet.add(slot);
      }
    });
  });

  return Array.from(bookedSet);
};