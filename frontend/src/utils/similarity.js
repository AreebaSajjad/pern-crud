// Do vectors kitne "similar" hain, ye nikaalta hai (-1 to 1 ke beech, 1 = identical).
// Yehi wo formula hai jo Vector Databases ke andar retrieval ke liye use hota hai.
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { cosineSimilarity };