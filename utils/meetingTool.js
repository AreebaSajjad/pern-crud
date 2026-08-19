const { pool } = require('../config/pgDb');
const { validateMeetingInput, checkConflict } = require('../controllers/meetingController');

// ---------------- Tool Schemas ----------------
const createMeetingTool = {
  type: 'function',
  function: {
    name: 'create_meeting',
    description:
      'Schedules a new meeting between exactly two participants. Use ONLY when the admin gives both participant names/emails, a title, date, time, duration, and mode (online/physical) with location or link.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        participant1_id: { type: 'integer', description: 'User id of the first participant' },
        participant2_id: { type: 'integer', description: 'User id of the second participant' },
        title: { type: 'string', description: 'Meeting title' },
        date: { type: 'string', description: 'Meeting date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Meeting time in HH:MM 24-hour format' },
        duration: { type: 'integer', description: 'Duration in minutes' },
        mode: { type: 'string', enum: ['online', 'physical'], description: 'Meeting mode' },
        location: { type: 'string', description: 'Physical location — required if mode is physical, empty string otherwise' },
        link: { type: 'string', description: 'Meeting link — required if mode is online, empty string otherwise' },
      },
      required: ['participant1_id', 'participant2_id', 'title', 'date', 'time', 'duration', 'mode', 'location', 'link'],
      additionalProperties: false,
    },
  },
};

const updateMeetingTool = {
  type: 'function',
  function: {
    name: 'update_meeting',
    description:
      'Updates an existing meeting by its id. Still needs both participants and mode-appropriate location/link since the update replaces the full meeting record.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        meeting_id: { type: 'integer', description: 'The id of the meeting to update' },
        participant1_id: { type: 'integer', description: 'User id of the first participant' },
        participant2_id: { type: 'integer', description: 'User id of the second participant' },
        title: { type: 'string', description: 'Meeting title' },
        date: { type: 'string', description: 'Meeting date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Meeting time in HH:MM 24-hour format' },
        duration: { type: 'integer', description: 'Duration in minutes' },
        mode: { type: 'string', enum: ['online', 'physical'], description: 'Meeting mode' },
        location: { type: 'string', description: 'Physical location — required if mode is physical, empty string otherwise' },
        link: { type: 'string', description: 'Meeting link — required if mode is online, empty string otherwise' },
      },
      required: ['meeting_id', 'participant1_id', 'participant2_id', 'title', 'date', 'time', 'duration', 'mode', 'location', 'link'],
      additionalProperties: false,
    },
  },
};

const deleteMeetingTool = {
  type: 'function',
  function: {
    name: 'delete_meeting',
    description: 'Soft-deletes an existing meeting by its id.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        meeting_id: { type: 'integer', description: 'The id of the meeting to delete' },
      },
      required: ['meeting_id'],
      additionalProperties: false,
    },
  },
};

const tools = [createMeetingTool, updateMeetingTool, deleteMeetingTool];

// ---------------- Execution helpers ----------------
const buildMeetingBody = (args) => ({
  participants: [args.participant1_id, args.participant2_id],
  title: args.title,
  date: args.date,
  time: args.time,
  duration: args.duration,
  mode: args.mode,
  location: args.location || null,
  link: args.link || null,
});

async function executeCreateMeeting(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can schedule meetings via chat.' };
  }

  const body = buildMeetingBody(args);
  const validationError = validateMeetingInput(body);
  if (validationError) return { success: false, error: validationError };

 const usersResult = await pool.query('SELECT id FROM users WHERE id = ANY($1::int[]) AND deleted_at IS NULL', [body.participants]);
  if (usersResult.rows.length !== 2) {
    return { success: false, error: 'One or both participant ids were not found.' };
  }

  const conflict = await checkConflict({ date: body.date, time: body.time, duration: Number(body.duration), participants: [body.participants ]});
  if (conflict) {
    return { success: false, error: 'This time slot conflicts with an existing meeting for one of the participants.' };
  }

  const result = await pool.query(
    `INSERT INTO meetings (created_by, title, date, time, duration, mode, location, link)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, title, date, time`,
    [currentUser.id, body.title, body.date, body.time, body.duration, body.mode, body.location, body.link]
  );
  const meeting = result.rows[0];

  await pool.query(
    `INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1,$2), ($1,$3)`,
    [meeting.id, body.participants[0], body.participants[1]]
  );

  return { success: true, meeting };
}

async function executeUpdateMeeting(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can update meetings via chat.' };
  }

  const existing = await pool.query('SELECT id FROM meetings WHERE id = $1 AND deleted_at IS NULL', [args.meeting_id]);
  if (existing.rowCount === 0) {
    return { success: false, error: `No active meeting found with id ${args.meeting_id}` };
  }

  const body = buildMeetingBody(args);
  const validationError = validateMeetingInput(body);
  if (validationError) return { success: false, error: validationError };

  const usersResult = await pool.query('SELECT id FROM users WHERE id = ANY($1::int[]) AND deleted_at IS NULL', [body.participants]);
  if (usersResult.rows.length !== 2) {
    return { success: false, error: 'One or both participant ids were not found.' };
  }

  const conflict = await checkConflict({
    date: body.date, time: body.time, duration: Number(body.duration),
    participants: [body.participants], excludeId: args.meeting_id,
  });
  if (conflict) {
    return { success: false, error: 'This time slot conflicts with an existing meeting for one of the participants.' };
  }

  const result = await pool.query(
    `UPDATE meetings SET title=$1, date=$2, time=$3, duration=$4, mode=$5, location=$6, link=$7, updated_at=NOW()
     WHERE id=$8 RETURNING id, title, date, time`,
    [body.title, body.date, body.time, body.duration, body.mode, body.location, body.link, args.meeting_id]
  );

  await pool.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [args.meeting_id]);
  await pool.query(
    `INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1,$2), ($1,$3)`,
    [args.meeting_id, body.participants[0], body.participants[1]]
  );

  return { success: true, meeting: result.rows[0] };
}

async function executeDeleteMeeting(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can delete meetings via chat.' };
  }

  if (!Number.isInteger(args.meeting_id)) {
    return { success: false, error: 'meeting_id must be a whole number' };
  }

  const result = await pool.query(
    'UPDATE meetings SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, title',
    [args.meeting_id]
  );
  if (result.rowCount === 0) {
    return { success: false, error: `No active meeting found with id ${args.meeting_id}` };
  }

  return { success: true, deleted: result.rows[0] };
}

// ---------------- Tool Selection (dispatch) + Parameter Extraction ----------------
const toolExecutors = {
  create_meeting: executeCreateMeeting,
  update_meeting: executeUpdateMeeting,
  delete_meeting: executeDeleteMeeting,
};

async function runTool(toolCall, currentUser) {
  const executor = toolExecutors[toolCall.function.name];
  if (!executor) return { success: false, error: `Unknown tool: ${toolCall.function.name}` };

  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return { success: false, error: 'Could not parse tool arguments as JSON' };
  }

  console.log(`[function-calling] tool selected: ${toolCall.function.name} | args:`, args);
  return executor(args, currentUser);
}

module.exports = { tools, runTool };