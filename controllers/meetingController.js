const { pool } = require('../config/pgDb');

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const isOverlapping = (start1, duration1, start2, duration2) => {
  const end1 = start1 + duration1;
  const end2 = start2 + duration2;
  return start1 < end2 && start2 < end1;
};

// Ek meeting row ko participants ke sath poori shape me build karna (jaisa Mongoose .populate() deta tha)
const attachParticipants = async (meetingRows) => {
  if (meetingRows.length === 0) return [];

  const meetingIds = meetingRows.map((m) => m.id);
  const participantsResult = await pool.query(
    `SELECT mp.meeting_id, u.id AS "_id", u.name, u.email
     FROM meeting_participants mp
     JOIN users u ON u.id = mp.user_id
     WHERE mp.meeting_id = ANY($1::int[])`,
    [meetingIds]
  );

  const createdByResult = await pool.query(
    `SELECT id AS "_id", name, email FROM users WHERE id = ANY($1::int[])`,
    [meetingRows.map((m) => m.created_by)]
  );
  const createdByMap = {};
  createdByResult.rows.forEach((u) => { createdByMap[u._id] = u; });

  return meetingRows.map((m) => ({
    _id: m.id,
    title: m.title,
    date: m.date,
    time: m.time,
    duration: m.duration,
    mode: m.mode,
    location: m.location,
    link: m.link,
    createdBy: createdByMap[m.created_by] || null,
    participants: participantsResult.rows.filter((p) => p.meeting_id === m.id).map((p) => ({
      _id: p._id, name: p.name, email: p.email,
    })),
  }));
};

// Kisi participant ke sath waqt clash check karna
const checkConflict = async ({ date, time, duration, participants, excludeId }) => {
  let query = `
    SELECT m.id, m.time, m.duration
    FROM meetings m
    JOIN meeting_participants mp ON mp.meeting_id = m.id
    WHERE m.date = $1 AND mp.user_id = ANY($2::int[])
  `;
  const values = [date, participants];

  if (excludeId) {
    query += ` AND m.id != $3`;
    values.push(excludeId);
  }

  const result = await pool.query(query, values);
  const newStart = toMinutes(time);

  for (const m of result.rows) {
    const existingStart = toMinutes(m.time);
    if (isOverlapping(newStart, duration, existingStart, m.duration)) {
      return m;
    }
  }
  return null;
};

const validateMeetingInput = (body) => {
  const { participants, title, date, time, duration, mode, location, link } = body;

  if (!participants || !Array.isArray(participants) || participants.length !== 2) {
    return 'Please select exactly 2 participants';
  }
  if (String(participants[0]) === String(participants[1])) {
    return 'Participants must be two different users';
  }
  if (!title || !title.trim()) return 'Title is required';
  if (!date) return 'Date is required';
  if (!time) return 'Time is required';
  if (!duration || duration <= 0) return 'Please select a valid duration';
  if (!mode || !['online', 'physical'].includes(mode)) return 'Please select a meeting mode';
  if (mode === 'physical' && (!location || !location.trim())) return 'Location is required for physical meetings';
  if (mode === 'online' && (!link || !link.trim())) return 'Meeting link is required for online meetings';

  const meetingDateTime = new Date(`${date}T${time}`);
  if (isNaN(meetingDateTime.getTime())) return 'Invalid date or time';
  if (meetingDateTime < new Date()) return 'Meeting date/time must be in the future';

  return null;
};

const createMeeting = async (req, res) => {
  try {
    const { participants, title, date, time, duration, mode, location, link } = req.body;

    const validationError = validateMeetingInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const usersResult = await pool.query('SELECT id FROM users WHERE id = ANY($1::int[])', [participants]);
    if (usersResult.rows.length !== 2) {
      return res.status(404).json({ message: 'One or more selected users not found' });
    }

    const conflict = await checkConflict({ date, time, duration: Number(duration), participants });
    if (conflict) {
      return res.status(409).json({ message: 'This time slot conflicts with an existing meeting for one of the selected participants' });
    }

    const meetingResult = await pool.query(
      `INSERT INTO meetings (created_by, title, date, time, duration, mode, location, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id, title, date, time, duration, mode,
        mode === 'physical' ? location : null,
        mode === 'online' ? link : null,
      ]
    );
    const meeting = meetingResult.rows[0];

    await pool.query(
      `INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [meeting.id, participants[0], participants[1]]
    );

    const [populated] = await attachParticipants([meeting]);

    res.status(201).json({ message: 'Meeting scheduled successfully', meeting: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAllMeetings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let countQuery, dataQuery, params;

    if (req.user.role === 'admin') {
      countQuery = 'SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL';
      dataQuery = `SELECT * FROM meetings WHERE deleted_at IS NULL ORDER BY date ASC, time ASC LIMIT $1 OFFSET $2`;
      params = [limit, offset];
    } else {
      countQuery = `SELECT COUNT(*) FROM meetings m JOIN meeting_participants mp ON mp.meeting_id = m.id WHERE mp.user_id = $1 AND m.deleted_at IS NULL`;
      dataQuery = `SELECT m.* FROM meetings m
         JOIN meeting_participants mp ON mp.meeting_id = m.id
         WHERE mp.user_id = $1 AND m.deleted_at IS NULL
         ORDER BY m.date ASC, m.time ASC
         LIMIT $2 OFFSET $3`;
      params = [req.user.id, limit, offset];
    }

    const countResult = await pool.query(
      countQuery,
      req.user.role === 'admin' ? [] : [req.user.id]
    );
    const totalMeetings = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalMeetings / limit);

    const result = await pool.query(dataQuery, params);
    const meetings = await attachParticipants(result.rows);

    res.status(200).json({
      totalMeetings,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      meetings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateMeeting = async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM meetings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const validationError = validateMeetingInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { participants, title, date, time, duration, mode, location, link } = req.body;

    const usersResult = await pool.query('SELECT id FROM users WHERE id = ANY($1::int[]) AND deleted_at IS NULL', [participants]);
    if (usersResult.rows.length !== 2) {
      return res.status(404).json({ message: 'One or more selected users not found' });
    }

    const conflict = await checkConflict({
      date, time, duration: Number(duration), participants, excludeId: req.params.id,
    });
    if (conflict) {
      return res.status(409).json({ message: 'This time slot conflicts with an existing meeting for one of the selected participants' });
    }

    const updateResult = await pool.query(
      `UPDATE meetings SET title = $1, date = $2, time = $3, duration = $4, mode = $5, location = $6, link = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        title, date, time, duration, mode,
        mode === 'physical' ? location : null,
        mode === 'online' ? link : null,
        req.params.id,
      ]
    );

    await pool.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [req.params.id]);
    await pool.query(
      `INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [req.params.id, participants[0], participants[1]]
    );

    const [populated] = await attachParticipants([updateResult.rows[0]]);

    res.status(200).json({ message: 'Meeting updated successfully', meeting: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteMeeting = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE meetings SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(200).json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createMeeting, getAllMeetings, updateMeeting, deleteMeeting,
  validateMeetingInput, checkConflict, attachParticipants,
};
