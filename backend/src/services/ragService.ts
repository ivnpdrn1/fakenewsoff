import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fetchFullText } from './fetchService';

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  publishDate?: string;
}

interface DocumentChunk {
  text: string;
  embedding: number[];
  sourceUrl: string;
  chunkIndex: number;
}

interface RetrievalResult {
  chunks: DocumentChunk[];
  similarityScores: number[];
}

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const EMBEDDING_MODEL = 'amazon.nova-embed-v1:0';
const MAX_CHUNK_TOKENS = 512;
const OVERLAP_TOKENS = 50;
const RETRIEVAL_TIMEOUT_MS = 8000;

/**
 * Approximate token count using simple word splitting
 */
function countTokens(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Split text into chunks with overlap
 */
function splitIntoChunks(text: string, maxTokens: number, overlapTokens: number): string[] {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const chunks: string[] = [];
  
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + maxTokens).join(' ');
    chunks.push(chunk);
    
    // Move forward by (maxTokens - overlapTokens) to create overlap
    i += maxTokens - overlapTokens;
    
    // Prevent infinite loop if overlapTokens >= maxTokens
    if (i <= chunks.length * overlapTokens && maxTokens <= overlapTokens) {
      break;
    }
  }
  
  return chunks;
}

/**
 * Generate embedding using AWS Bedrock Nova Embeddings
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const payload = {
    inputText: text
  };

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

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

/**
 * Chunk documents and generate embeddings
 */
export async function chunkDocuments(sources: SearchResult[]): Promise<DocumentChunk[]> {
  const startTime = Date.now();
  const allChunks: DocumentChunk[] = [];

  for (const source of sources) {
    try {
      // Fetch full text
      const fetchResult = await fetchFullText(source.url);
      
      if (!fetchResult.cleanedText || fetchResult.cleanedText.length === 0) {
        console.log(JSON.stringify({
          stage: 'rag_chunking',
          warning: 'Empty text',
          url: source.url
        }));
        continue;
      }

      // Split into chunks
      const textChunks = splitIntoChunks(
        fetchResult.cleanedText,
        MAX_CHUNK_TOKENS,
        OVERLAP_TOKENS
      );

      // Generate embeddings for each chunk
      for (let i = 0; i < textChunks.length; i++) {
        const embedding = await generateEmbedding(textChunks[i]);
        
        allChunks.push({
          text: textChunks[i],
          embedding,
          sourceUrl: source.url,
          chunkIndex: i
        });
      }
    } catch (error: any) {
      console.log(JSON.stringify({
        stage: 'rag_chunking',
        error: error.message,
        url: source.url
      }));
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(JSON.stringify({
    stage: 'rag_chunking',
    source_count: sources.length,
    total_chunks: allChunks.length,
    duration_ms: durationMs
  }));

  return allChunks;
}

/**
 * Retrieve relevant chunks based on query similarity
 */
export async function retrieveRelevantChunks(
  query: string,
  chunks: DocumentChunk[]
): Promise<RetrievalResult> {
  const startTime = Date.now();

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Retrieval timeout')), RETRIEVAL_TIMEOUT_MS);
  });

  try {
    // Race between actual retrieval and timeout
    const result = await Promise.race([
      performRetrieval(query, chunks),
      timeoutPromise
    ]);

    const durationMs = Date.now() - startTime;
    console.log(JSON.stringify({
      stage: 'rag_retrieval',
      query_length: query.length,
      chunks_retrieved: result.chunks.length,
      duration_ms: durationMs
    }));

    return result;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.log(JSON.stringify({
      stage: 'rag_retrieval',
      error: error.message,
      duration_ms: durationMs
    }));
    throw error;
  }
}

/**
 * Internal function to perform the actual retrieval
 */
async function performRetrieval(
  query: string,
  chunks: DocumentChunk[]
): Promise<RetrievalResult> {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Calculate similarity scores
  const similarities = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));

  // Sort by similarity (descending)
  similarities.sort((a, b) => b.score - a.score);

  // Take top 1-5 chunks
  const topResults = similarities.slice(0, 5);

  return {
    chunks: topResults.map(r => r.chunk),
    similarityScores: topResults.map(r => r.score)
  };
}
