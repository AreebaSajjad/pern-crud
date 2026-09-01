const { pool } = require('../config/pgDb');
const { getEmbeddingsBatch, getChatCompletion } = require('../utils/openaiClient');
const { chunkText } = require('./chunking');
const { extractTextFromFile } = require('./pdfExtractor');

// Documents products se kaafi bare hote hain (200 pages tak), isliye chunk size bhi
// bara rakha hai — chote 60-word chunks (products wale) yahan hazaron chunks bana dete,
// jo na to zaroori hai na fast. 220 words/chunk + 40 overlap ek theek balance hai:
// context poora bhi rehta hai aur similarity search bhi meaningful chunks pe hoti hai.
const KB_CHUNK_SIZE = 220;
const KB_CHUNK_OVERLAP = 40;

// Kitne chunks ek embedding API call mein bhejne hain — bohot bara batch bhejne se
// request bari ho jati hai, isliye chote-chote groups mein todte hain.
const EMBED_BATCH_SIZE = 50;

// "Iss document mein kya hai" jaise BROAD sawal ke liye similarity-search kaafi nahi —
// wo sirf top-K (chunk_count ka chota fraction) laata hai, poora document nahi. Isliye
// upload ke waqt ek chhoti overview bhi bana lete hain (document ke evenly-spread hisso
// se sample le kar), taake bot broad sawalon ka bhi acha jawab de sake.
const MAX_SUMMARY_SAMPLES = 15;

const sampleForSummary = (chunks, maxSamples = MAX_SUMMARY_SAMPLES) => {
  if (chunks.length <= maxSamples) return chunks;
  const step = chunks.length / maxSamples;
  const picks = [];
  for (let i = 0; i < maxSamples; i++) picks.push(chunks[Math.floor(i * step)]);
  return picks;
};

const generateDocumentSummary = async (title, rawChunks) => {
  try {
    const sampleText = sampleForSummary(rawChunks).join('\n\n---\n\n');
    const summaryPrompt = `You are given several excerpts sampled evenly across a longer document titled "${title}". Write a concise 120-180 word overview describing what this document covers overall — its main topics, sections, or subject areas. Plain text only, no markdown symbols. Do not say "this document" repeatedly.`;
    return await getChatCompletion(summaryPrompt, sampleText, []);
  } catch (err) {
    // Summary fail ho jaye to bhi upload fail nahi hona chahiye — sirf chunks/embeddings
    // hi asal RAG ke liye zaroori hain, summary sirf ek extra help hai.
    console.error('KB summary generation failed:', err.message);
    return null;
  }
};

const batchArray = (arr, size) => {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) batches.push(arr.slice(i, i + size));
  return batches;
};

// Ek document upload hone ke baad ye function poora pipeline chalata hai:
// extract text -> chunk -> embed (batches mein) -> embeddings table mein save ->
// kb_documents ka status/page_count/chunk_count update.
// Ye function apni khud ki errors handle karta hai (document ko 'failed' mark kar deta
// hai) taake upload request crash na ho — isko background mein bhi await kiye bagair
// call kiya ja sakta hai agar future mein async processing chahiye ho.
const processKbDocument = async (kbDocument, filePath, mimetype) => {
  try {
    const { text, pageCount } = await extractTextFromFile(filePath, mimetype);

    if (!text || !text.trim()) {
      await pool.query(
        `UPDATE kb_documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        ['No readable text found in this file (it may be a scanned/image-only PDF).', kbDocument.id]
      );
      return;
    }

    const rawChunks = chunkText(text, { chunkSize: KB_CHUNK_SIZE, overlap: KB_CHUNK_OVERLAP });

    // Har chunk ke andar hi document ka title bata dete hain — isse jab ye chunk
    // baad mein RAG context mein LLM ko dikhaya jayega, model ko khud pata hoga ke
    // ye text kaunse document se aaya hai (koi separate lookup nahi karna paDta).
    const chunks = rawChunks.map(
      (c, i) => `[Document: "${kbDocument.title}" — part ${i + 1} of ${rawChunks.length}]\n${c}`
    );

    const batches = batchArray(chunks, EMBED_BATCH_SIZE);
    const vectors = [];
    for (const batch of batches) {
      const batchVectors = await getEmbeddingsBatch(batch);
      vectors.push(...batchVectors);
    }

    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        `INSERT INTO embeddings (source_type, source_id, chunk_index, text, vector) VALUES ('kb_document', $1, $2, $3, $4)`,
        [kbDocument.id, i, chunks[i], vectors[i]]
      );
    }

    const summary = await generateDocumentSummary(kbDocument.title, rawChunks);

    await pool.query(
      `UPDATE kb_documents SET status = 'ready', page_count = $1, chunk_count = $2, summary = $3, updated_at = NOW() WHERE id = $4`,
      [pageCount, chunks.length, summary, kbDocument.id]
    );
  } catch (err) {
    console.error('KB document processing failed for', kbDocument.id, err.message);
    await pool.query(
      `UPDATE kb_documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message.slice(0, 500), kbDocument.id]
    );
  }
};

// Document delete hone par uske saare chunks bhi hata do
const removeKbDocumentEmbeddings = async (documentId) => {
  await pool.query(`DELETE FROM embeddings WHERE source_type = 'kb_document' AND source_id = $1`, [documentId]);
};

module.exports = { processKbDocument, removeKbDocumentEmbeddings };
