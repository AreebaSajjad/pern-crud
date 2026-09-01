const { pool } = require('../config/pgDb');
const { getEmbedding, getChatCompletion, getChatCompletionWithTools } = require('../utils/openaiClient');
const { cosineSimilarity } = require('../utils/similarity');
const { tools: productTools, runTool: runProductTool } = require('../utils/productTool');
const { tools: meetingTools, runTool: runMeetingTool } = require('../utils/meetingTool');
const { tools: userTools, runTool: runUserTool } = require('../utils/userTool');
const { tools: orderTools, runTool: runOrderTool } = require('../utils/orderTool');

// Chaaron tool-file ke executors ko ek jagah milaya, taake execution loop ko
// har tool ke liye alag se pata na karna pade — bas naam se dhoond kar chala deta hai.
const TOOL_RUNNERS = {}; // { tool_name: runner_function }
[...productTools, ...meetingTools, ...userTools, ...orderTools].forEach((t) => {
  const name = t.function.name;
  if (productTools.some((pt) => pt.function.name === name)) TOOL_RUNNERS[name] = runProductTool;
  else if (meetingTools.some((mt) => mt.function.name === name)) TOOL_RUNNERS[name] = runMeetingTool;
  else if (userTools.some((ut) => ut.function.name === name)) TOOL_RUNNERS[name] = runUserTool;
  else TOOL_RUNNERS[name] = runOrderTool;
});
const runAnyTool = (toolCall, currentUser, uploadedImages) => TOOL_RUNNERS[toolCall.function.name](toolCall, currentUser, uploadedImages);
const GREETING_PATTERNS = /^(hi|hello|hey|salam|assalam|good morning|good evening|good afternoon|hola)[\s!.?]*$/i;

// Retrieval tuning (RAG):
// TOP_K -> similarity search se kitne sabse relevant chunks context mein dalne hain.
//   Ab chunking ki wajah se ek hi product ke 1+ chunks ho sakte hain, isliye 4 se 6 kiya
//   taake agar koi product multi-chunk ho to uska poora context aa sake.
// SIMILARITY_THRESHOLD -> cosine similarity ka minimum score (0 to 1) jo ek chunk ko
//   "relevant" maanne ke liye chahiye. Isse bachta hai ke bilkul unrelated query
//   (jaise "what's the weather") pe bhi zabardasti top-K products context mein na chale jayein.
//   NOTE: OpenAI embeddings ka baseline similarity kaafi high hota hai (unrelated text bhi
//   kabhi 0.5+ score kar deta hai), isliye ye value deliberately conservative rakhi hai taake
//   koi legit match filter na ho jaye. Console.log(scored) laga kar apni real product queries
//   pe actual scores dekh lena, phir is number ko tune karna — 0.3 sirf ek safe starting point hai.
const TOP_K = 6;
const SIMILARITY_THRESHOLD = 0.3;
// Knowledge Base PDFs ke liye alag, bara TOP_K — documents products se kaafi lambe
// hote hain (200 pages tak), isliye zyada chunks context mein dena zaroori hai.
const KB_TOP_K = 8;

const isGreeting = (message) => GREETING_PATTERNS.test(message.trim());

const formatOrderLine = (o, includeUserName = false) => {
  const who = includeUserName ? ` — Ordered by: ${o.user_name}` : '';
  return `- Order #${o.id}: ${o.quantity} x "${o.product_name}" — $${o.total} total — status: ${o.status}${who}`;
};

const buildIdentityContext = async (currentUser) => {
  if (currentUser.role === 'admin') {
    const usersResult = await pool.query('SELECT id, name, email, role FROM users WHERE deleted_at IS NULL ORDER BY created_at');
    const userLines = usersResult.rows.map((u) => `- id:${u.id} | ${u.name} | ${u.email} | role: ${u.role}`).join('\n');

    const meetingsBaseQuery = `
      SELECT m.id, m.title, m.date, m.time, m.duration, m.mode, cb.name AS created_by_name,
        (SELECT string_agg(u.name || ' (' || u.email || ')', ' & ')
         FROM meeting_participants mp JOIN users u ON u.id = mp.user_id WHERE mp.meeting_id = m.id) AS participant_names
      FROM meetings m
      JOIN users cb ON cb.id = m.created_by
      WHERE m.deleted_at IS NULL AND `;
    const formatMeetingLine = (m) => `- id:${m.id} "${m.title}" on ${m.date} at ${m.time} (${m.duration} min, ${m.mode}) — Participants: ${m.participant_names} — Created by: ${m.created_by_name}`;

    const upcomingResult = await pool.query(`${meetingsBaseQuery} m.date::date >= CURRENT_DATE ORDER BY m.date::date, m.time`);
    const pastResult = await pool.query(`${meetingsBaseQuery} m.date::date < CURRENT_DATE ORDER BY m.date::date DESC, m.time DESC LIMIT 5`);
    const upcomingLines = upcomingResult.rows.map(formatMeetingLine).join('\n');
    const pastLines = pastResult.rows.map(formatMeetingLine).join('\n');

    const ordersResult = await pool.query(`
      SELECT o.id, o.quantity, o.total, o.status, p.name AS product_name, u.name AS user_name
      FROM orders o
      JOIN products p ON p.id = o.product_id
      JOIN users u ON u.id = o.user_id
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `);
    const orderLines = ordersResult.rows.map((o) => formatOrderLine(o, true)).join('\n');

    return `You are speaking with an ADMIN. You have full access to all users', all meetings', and all orders' information — share it freely when asked, including specific people's details, specific meetings, or specific orders.
Today's date is ${new Date().toISOString().slice(0, 10)}. When asked generally about "the meeting" or "which meeting is scheduled", always refer to Upcoming meetings — never a past one — unless the user explicitly asks about history/past meetings. User ids and meeting ids below are for your own use when calling tools; don't need to read them out loud unless asked.

All registered users:
${userLines || 'No users found.'}

Upcoming meetings:
${upcomingLines || 'No upcoming meetings.'}

Past meetings (already happened, only mention if explicitly asked):
${pastLines || 'No past meetings.'}

All orders:
${orderLines || 'No orders found.'}`;
  }

  const meetingsBaseQueryUser = `
    SELECT m.id, m.title, m.date, m.time, m.duration, m.mode,
      (SELECT string_agg(u.name || ' (' || u.email || ')', ' & ')
       FROM meeting_participants mp2 JOIN users u ON u.id = mp2.user_id WHERE mp2.meeting_id = m.id) AS participant_names
    FROM meetings m
    JOIN meeting_participants mp ON mp.meeting_id = m.id
    WHERE mp.user_id = $1 AND m.deleted_at IS NULL AND `;
  const formatUserMeetingLine = (m) => `- "${m.title}" on ${m.date} at ${m.time} (${m.duration} min, ${m.mode}) — Participants: ${m.participant_names}`;

  const upcomingResult = await pool.query(`${meetingsBaseQueryUser} m.date::date >= CURRENT_DATE ORDER BY m.date::date, m.time`, [currentUser.id]);
  const pastResult = await pool.query(`${meetingsBaseQueryUser} m.date::date < CURRENT_DATE ORDER BY m.date::date DESC, m.time DESC LIMIT 5`, [currentUser.id]);
  const upcomingLines = upcomingResult.rows.map(formatUserMeetingLine).join('\n');
  const pastLines = pastResult.rows.map(formatUserMeetingLine).join('\n');

  const ordersResult = await pool.query(`
    SELECT o.id, o.quantity, o.total, o.status, p.name AS product_name
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.user_id = $1 AND o.deleted_at IS NULL
    ORDER BY o.created_at DESC
  `, [currentUser.id]);
  const orderLines = ordersResult.rows.map((o) => formatOrderLine(o, false)).join('\n');

  return `You are speaking with a regular USER (not an admin). You must ONLY share this user's own information below. Never mention any other user's name, email, meetings, or orders — even if asked directly. If asked about someone else, say you don't have access to that information.
Today's date is ${new Date().toISOString().slice(0, 10)}. When asked generally about "the meeting" or "which meeting is scheduled", always refer to Upcoming meetings — never a past one — unless the user explicitly asks about history/past meetings.

This user's profile:
- Name: ${currentUser.name}
- Email: ${currentUser.email}
- Role: ${currentUser.role}

This user's upcoming meetings:
${upcomingLines || 'No upcoming meetings.'}

This user's past meetings (only mention if explicitly asked):
${pastLines || 'No past meetings.'}

This user's own orders:
${orderLines || 'No orders placed yet.'}`;
};

// ---------------- 4. Execution Loop ----------------
const runChatWithFunctionCalling = async (systemPrompt, userMessage, history, currentUser, uploadedImages = []) => {
  // Tool Selection: role-specific tools sirf admin ko; order tools (create/cancel) sabko milte hain
// kyunke normal user bhi order place/cancel kar sakta hai.
const roleTools = currentUser.role === 'admin' ? [...productTools, ...meetingTools, ...userTools, ...orderTools] : [...orderTools];
const availableTools = roleTools;
  let messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    ...(uploadedImages.length
      ? [{ role: 'system', content: `The admin attached ${uploadedImages.length} image(s) with this message. If they are creating a product now, treat images as already provided — do not ask them to attach images.` }]
      : []),
    { role: 'user', content: userMessage },
  ];

  const maxSteps = 4;
  for (let step = 0; step < maxSteps; step++) {
    const assistantMessage = availableTools.length
      ? await getChatCompletionWithTools(messages, availableTools)
      : { content: await getChatCompletion(systemPrompt, userMessage, history), tool_calls: null };

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content;
    }

    // Model ne tool(s) maangi — execute karo aur result wapis conversation mein daalo
    messages.push({
      role: 'assistant',
      content: assistantMessage.content || null,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const result = await runAnyTool(toolCall, currentUser, uploadedImages); // Parameter Extraction + Execution
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
    // loop dobara chalega taake model tool result dekh kar final jawab bana sake
  }

  return "Sorry, I couldn't complete that request right now.";
};
// Message bhejna — agar conversationId di hai to usi mein save hoga, warna nayi conversation ban jayegi
const chatWithBot = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const currentUser = userResult.rows[0];
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Existing conversation load karo, ya nayi bana do
    let conversation;
    if (conversationId) {
      const convResult = await pool.query(
        'SELECT * FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [conversationId, currentUser.id]
      );
      if (convResult.rows.length === 0) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      conversation = convResult.rows[0];
    } else {
      const newConv = await pool.query(
        `INSERT INTO conversations (user_id, title) VALUES ($1, 'New Chat') RETURNING *`,
        [currentUser.id]
      );
      conversation = newConv.rows[0];
    }

    const saveMessage = async (role, text) => {
      await pool.query('INSERT INTO messages (conversation_id, role, text) VALUES ($1, $2, $3)', [conversation.id, role, text]);
    };

    const updateTitleIfNeeded = async (newTitle) => {
      if (conversation.title === 'New Chat') {
        await pool.query('UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2', [newTitle, conversation.id]);
        conversation.title = newTitle;
      } else {
        await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversation.id]);
      }
    };

    if (isGreeting(message)) {
      const greeting =
        currentUser.role === 'admin'
          ? 'Hello! 👋 Ask me anything about our products, users, meetings, orders, or the uploaded knowledge base documents.'
          : 'Hello! 👋 Ask me anything about our products, your own meetings, your orders, or the uploaded knowledge base documents.';

      await saveMessage('user', message);
      await saveMessage('bot', greeting);
      await updateTitleIfNeeded(message);

      return res.status(200).json({ answer: greeting, conversationId: conversation.id, title: conversation.title });
    }

    const queryVector = await getEmbedding(message);
    const embeddingsResult = await pool.query(`SELECT e.source_id, e.text, e.vector FROM embeddings e JOIN products p ON p.id = e.source_id WHERE e.source_type = 'product' AND p.deleted_at IS NULL`);
    // Poori catalog ka halka summary — taake "kitne products hain?" jaisi aggregate questions
    // ka sahi jawab mile, chahe wo top-4 similarity match mein na aayein
    const allProductsResult = await pool.query('SELECT id, name, price, quantity FROM products WHERE deleted_at IS NULL ORDER BY id');
    const catalogSummary = allProductsResult.rows
  .map((p) => `- id:${p.id} ${p.name} — $${p.price} (${p.quantity} in stock)`)
  .join('\n');
    const totalProductCount = allProductsResult.rows.length;

    // Vector Search / Similarity Search + Threshold:
    // Har chunk ka score nikalo, sirf wo chunks rakho jo SIMILARITY_THRESHOLD se upar hain
    // (irrelevant matches ko yahin filter kar dete hain), phir un mein se top-K sabse achay le lo.
    let productContext = 'No matching products found for this query.';
    if (embeddingsResult.rows.length > 0) {
      const scored = embeddingsResult.rows.map((e) => ({
        text: e.text,
        score: cosineSimilarity(queryVector, e.vector),
      }));
      scored.sort((a, b) => b.score - a.score);

      const relevant = scored.filter((m) => m.score >= SIMILARITY_THRESHOLD).slice(0, TOP_K);

      // Context Injection: sirf relevant chunks ka text prompt mein jata hai (score khud nahi jata,
      // wo sirf humare filtering/debugging ke liye hai — model ko raw number dena faayda nahi deta)
      if (relevant.length > 0) {
        productContext = relevant.map((m) => m.text).join('\n\n---\n\n');
      }
    }

    // ---------------- Knowledge Base documents (uploaded PDFs) ----------------
    // Isi query ka embedding (queryVector) upar products ke liye already ban chuka hai,
    // isliye yahan dobara OpenAI call nahi karni padi — bas ek alag similarity search
    // kb_document chunks ke against. Ye Knowledge Base module se upload hue PDFs hain.
    const kbDocsResult = await pool.query(
      `SELECT id, title, page_count, summary FROM kb_documents WHERE status = 'ready' AND deleted_at IS NULL ORDER BY created_at`
    );
    const kbDocumentList = kbDocsResult.rows
      .map((d) => `- "${d.title}"${d.page_count ? ` (${d.page_count} pages)` : ''}${d.summary ? `\n  Overview: ${d.summary}` : ''}`)
      .join('\n');

    let kbContext = 'No matching knowledge base content found for this query.';
    if (kbDocsResult.rows.length > 0) {
      const kbEmbeddingsResult = await pool.query(
        `SELECT e.text, e.vector
         FROM embeddings e
         JOIN kb_documents d ON d.id = e.source_id
         WHERE e.source_type = 'kb_document' AND d.status = 'ready' AND d.deleted_at IS NULL`
      );
      if (kbEmbeddingsResult.rows.length > 0) {
        const kbScored = kbEmbeddingsResult.rows.map((e) => ({
          text: e.text,
          score: cosineSimilarity(queryVector, e.vector),
        }));
        kbScored.sort((a, b) => b.score - a.score);

        // Documents bare hote hain (200 pages tak), isliye products se zyada chunks
        // (KB_TOP_K) lete hain taake ek sawal ka jawab document ke kai hisso mein
        // bikhra ho to bhi sab context mein aa sake.
        //
        // NOTE: products ke unlike, yahan SIMILARITY_THRESHOLD apply NAHI karte —
        // real (non-boilerplate) documents mein genuinely relevant chunks ka score bhi
        // kabhi kabhi 0.3 se neeche aa jata hai (embedding model ka normal behavior,
        // kisi bug ki wajah se nahi), aur threshold se filter hone par kbContext bilkul
        // khali reh jata tha — jiski wajah se bot sach mein maujood detail ko bhi "nahi
        // mila" keh raha tha. Ab hum hamesha top KB_TOP_K chunks (jo bhi unka score ho)
        // context mein bhejte hain — system prompt already model ko batata hai ke agar
        // excerpt mein sawal ka jawab na ho to guess na kare, isliye ye safe hai.
        const kbRelevant = kbScored.slice(0, KB_TOP_K);

        // Hybrid retrieval — sirf embedding similarity kaafi nahi hoti jab document mein
        // bohot saare chunks ek jaise "shape" ke hon aur sirf ek number/ID se alag hon
        // (e.g. "page 187" vs "page 143" ka structure/wording bilkul same hota hai —
        // embedding model in dono ko almost identical samajhta hai, isliye sahi chunk
        // top-K mein rank hi nahi hota). Isliye query mein agar koi number ya ID-jaisa
        // token ho (e.g. "187", "RAG200-PAGE-187"), to us exact term ko seedha chunk text
        // mein literally dhoondte hain aur use hamesha context mein shamil karte hain,
        // similarity score ki parwah kiye baghair — isse exact page/ID lookups reliably
        // kaam karte hain.
        const literalTerms = Array.from(
          new Set((message.match(/[A-Za-z]*\d[A-Za-z0-9-]*/g) || []).filter((t) => t.replace(/\D/g, '').length >= 2))
        ).slice(0, 5);

        // Har term alag se match karte hain (ek saath "match ANY term" nahi) — aur agar
        // koi term document ke bohot saare chunks mein mil raha hai (e.g. query mein PDF
        // ka filename bhi ho, jisme koi number ho jo har page ke marker mein repeat hota
        // hai — jaise "200" in "RAG200-PAGE-187"), to wo term "generic" hai, koi useful
        // identifier nahi — usay discard kar dete hain. Warna wo generic term saari 6
        // slots bhar deta tha aur asal specific term (e.g. "187", jo sirf 1-2 chunks mein
        // hota hai) kabhi context mein pohanchta hi nahi tha.
        const MAX_GENERIC_MATCH_RATIO = 0.15; // ek term chunks ke 15% se zyada mein mile to generic maana
        const genericCeiling = Math.max(3, Math.ceil(kbEmbeddingsResult.rows.length * MAX_GENERIC_MATCH_RATIO));

        const literalMatches = [];
        for (const term of literalTerms) {
          const lowerTerm = term.toLowerCase();
          const termMatches = kbEmbeddingsResult.rows.filter((row) => row.text.toLowerCase().includes(lowerTerm));
          if (termMatches.length === 0 || termMatches.length > genericCeiling) continue; // generic ya no-match, skip
          termMatches.forEach((row) => literalMatches.push(row.text));
        }

        const combinedTexts = Array.from(new Set([...literalMatches, ...kbRelevant.map((m) => m.text)])).slice(
          0,
          KB_TOP_K + literalMatches.length
        );
        if (combinedTexts.length > 0) {
          kbContext = combinedTexts.join('\n\n---\n\n');
        }
      }
    }

    const identityContext = await buildIdentityContext(currentUser);

    const historyResult = await pool.query(
      'SELECT role, text FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6',
      [conversation.id]
    );
    const recentHistory = historyResult.rows.reverse().map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    // Agar user explicitly "poora/complete/exact content do" jaisa keh raha hai, to sirf
    // system prompt ke beech mein ek instruction likhna kaafi reliable nahi tha (GPT
    // kabhi kabhi phir bhi summarize kar deta tha — bohot saari instructions ke beech
    // ek line dab jati hai). Isliye ab ye check karke, agar aisa request hai, ek chhota
    // aur bohot explicit reminder VERY END mein (sabse last, jahan model sabse zyada
    // dhyan deta hai) add karte hain — taake verbatim excerpt reliably milay.
    const VERBATIM_REQUEST_PATTERN =
      /\b(complete|full|entire|exact|whole|raw)\b[\s\S]{0,25}\b(content|text|excerpt|page)\b|verbatim|word[- ]for[- ]word/i;
    const isVerbatimRequest = VERBATIM_REQUEST_PATTERN.test(message);

    const systemPrompt = 
     `Today's date is ${new Date().toISOString().slice(0,10)}.
     You are the MyStore assistant.
Answer the user's question ONLY using the information provided below. Do not make anything up.

Formatting rules:
- Do NOT use markdown symbols like ** or __ for bold, or # for headings. Use plain text only.
- If listing multiple items, use a simple dash (-) per line.
- Keep answers concise and friendly, EXCEPT when the user explicitly asks for the "full", "complete", "exact", or "entire" content/text of something (e.g. a page, chunk, or excerpt) — in that case quote the relevant excerpt in full instead of summarizing it; the concise rule doesn't apply to an explicit verbatim request.
-Keep this in your mind that your admin/owner who made you is Areeba Sajjad.
- Use the conversation history to understand follow-up questions.
- There are exactly ${totalProductCount} products in the store in total. If asked "how many products" or "list all products", use the Full product catalog list below (it has all of them) — not just the detailed section.
- You also have access to a Knowledge Base of uploaded PDF documents (see "Knowledge base documents" and "Knowledge base excerpts" below). Each document in the list has an "Overview" line — ALWAYS use that Overview for broad questions about a document as a whole (e.g. "what is this document about", "summarize this pdf", "give me an overview", "what topics does it cover") — never say you don't have that information when an Overview is present. For specific/detailed questions (a particular fact, number, definition, or topic), use the "Knowledge base excerpts" section instead (each excerpt starts with "[Document: "<title>" — part X of Y]" so you know which document it came from — mention that title in your answer, e.g. "According to <title>..."). IMPORTANT: base your answer strictly on the excerpt/overview text itself — do NOT fill in gaps using your own general/pretrained knowledge of the topic, even if you recognize the subject and know more about it than the document says. If the excerpt only names a topic without explaining it, say that the document mentions the topic but doesn't go into detail — do not supply the missing explanation yourself. If a specific detail truly isn't in the excerpts, the overview, or the document list, say clearly that the knowledge base doesn't have that information — do not guess.
- Order tools (create_order, cancel_order — available to everyone; update_order_status is admin-only): to order/buy something, get the product id (look it up by name in the catalog above) and quantity, then call create_order. To cancel, get the order id from the orders context above. NEVER use create_product or any other tool to represent placing an order — only create_order does that. If a requested action has no matching tool available to you, say so plainly instead of using an unrelated tool.
${currentUser.role === 'admin' ? `- Product tools: create_product, update_product, delete_product. For create, get all 5 fields (name, category, description, quantity, price) before calling — ask if missing. You may mention the admin can attach product image(s) using the 📎 attach button below the chat box (up to 5), but do NOT block on it — if they don't attach any, a matching image will be auto-picked based on the product name, so proceed with create_product either way. If a system note says images were attached with this message, use them and don't ask again. For update/delete, you need the product id — look it up by name in the product catalog context above; if not found, ask the admin to confirm which product (by id).
- Meeting tools: create_meeting, update_meeting, delete_meeting. You need both participants' user ids (look them up by name/email in "All registered users" above), title, date, time, duration, mode, and location/link matching the mode. For update/delete: find the meeting_id yourself by matching the title/date in the Upcoming/Past meetings context above — do NOT ask the admin for the id unless multiple meetings match ambiguously or none match. For update_meeting, silently reuse the meeting's current values (from context) for any field the admin didn't mention — do NOT list out all fields and ask the admin to confirm each one as "(unchanged?)"; only ask a question if something genuinely new is missing (e.g. they want to change participants but didn't say to whom). Once you have enough info, call the tool directly instead of re-describing the plan back to the admin.
- User tools: add_user (name, email, role — never ask for or set a password directly), update_user (name/role only), delete_user (admin cannot delete their own id). To change ANY user's password, use send_password_reset (just needs an email) — never accept a new password typed in chat. This tool emails a 6-digit reset code (NOT a link) that the user enters on the reset-password page — always describe it as "a reset code" in your reply, never as a link.
- Always double check required details are present before calling a tool; if something is missing or ambiguous, ask the admin instead of guessing.` : '- To order/buy a product, use create_order (product id + quantity). To cancel an order, use cancel_order (order id). Always double check required details before calling a tool; if something is missing or ambiguous, ask instead of guessing.'}
${identityContext}

Full product catalog list (${totalProductCount} products total):
${catalogSummary || 'No products found.'}

Detailed info on the products most relevant to this specific question:
${productContext}

Knowledge base documents (${kbDocsResult.rows.length} total):
${kbDocumentList || 'No documents uploaded yet.'}

Knowledge base excerpts most relevant to this specific question:
${kbContext}${isVerbatimRequest ? `

CRITICAL INSTRUCTION FOR THIS RESPONSE ONLY: The user explicitly asked for the full/complete/exact/entire content or text of something. You MUST copy the matching "Knowledge base excerpt" above WORD-FOR-WORD in your reply — do not summarize, shorten, paraphrase, or describe it instead. Paste the excerpt's actual text (you may drop the "[Document: ...]" prefix line itself), optionally with one short sentence before it. If genuinely no excerpt matches what they asked for, say so plainly instead of inventing content.` : ''}`;

    const uploadedImagePaths = req.files && req.files.length ? req.files.map((f) => `/uploads/${f.filename}`) : [];
    const answer = await runChatWithFunctionCalling(systemPrompt, message, recentHistory, currentUser, uploadedImagePaths);
    await saveMessage('user', message);
    await saveMessage('bot', answer);
    const titleFromMessage = message.length > 40 ? message.slice(0, 40) + '...' : message;
    await updateTitleIfNeeded(titleFromMessage);

    res.status(200).json({ answer, conversationId: conversation.id, title: conversation.title });
  } catch (error) {
    console.error('RAG chat error:', error.message);
    res.status(500).json({ message: 'Chat failed', error: error.message });
  }
};

// Sidebar ke liye — sirf list (title + date), poori messages nahi
const getConversations = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id AS "_id", title, updated_at AS "updatedAt" FROM conversations WHERE user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.status(200).json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Ek specific conversation ke poore messages
const getConversationById = async (req, res) => {
  try {
    const convResult = await pool.query(
      'SELECT id AS "_id", title FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (convResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messagesResult = await pool.query(
      'SELECT role, text FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.status(200).json({
      conversation: { ...convResult.rows[0], messages: messagesResult.rows },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Conversation delete karna
const deleteConversation = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE conversations SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.status(200).json({ message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { chatWithBot, getConversations, getConversationById, deleteConversation };