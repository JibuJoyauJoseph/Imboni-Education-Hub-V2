const pool = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/ai-tutor/chat
// body: { conversation_id?, course_id?, message }
// Creates a conversation on first message, stores both sides, returns the reply.
exports.chat = async (req, res) => {
  try {
    const { conversation_id, course_id, message } = req.body;
    if (!message) return res.status(400).json({ message: 'A message is required.' });

    let conversationId = conversation_id;
    if (!conversationId) {
      const [result] = await pool.query(
        'INSERT INTO ai_tutor_conversations (student_id, course_id, title) VALUES (?,?,?)',
        [req.user.id, course_id || null, message.slice(0, 60)]
      );
      conversationId = result.insertId;
    }

    await pool.query(
      'INSERT INTO ai_tutor_messages (conversation_id, sender, message) VALUES (?,"student",?)',
      [conversationId, message]
    );

    // Pull recent history for context (last 20 messages)
    const [history] = await pool.query(
      'SELECT sender, message FROM ai_tutor_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 20',
      [conversationId]
    );

    const anthropicMessages = history.map(h => ({
      role: h.sender === 'student' ? 'user' : 'assistant',
      content: h.message
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'You are the IMBONI AI Tutor, a patient study assistant for TVET and university students in Rwanda. Explain concepts clearly, use simple examples, and encourage the student. Keep answers focused and not overly long.',
      messages: anthropicMessages
    });

    const reply = response.content.find(b => b.type === 'text')?.text || "Sorry, I couldn't generate a response.";

    await pool.query(
      'INSERT INTO ai_tutor_messages (conversation_id, sender, message) VALUES (?,"ai",?)',
      [conversationId, reply]
    );

    res.json({ conversation_id: conversationId, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI tutor is unavailable right now.', error: err.message });
  }
};

// GET /api/ai-tutor/conversations
exports.listConversations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, course_id, created_at FROM ai_tutor_conversations WHERE student_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load conversations.', error: err.message });
  }
};

// GET /api/ai-tutor/conversations/:id/messages
exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const [[conv]] = await pool.query('SELECT * FROM ai_tutor_conversations WHERE id = ? AND student_id = ?', [id, req.user.id]);
    if (!conv) return res.status(404).json({ message: 'Conversation not found.' });

    const [rows] = await pool.query('SELECT sender, message, created_at FROM ai_tutor_messages WHERE conversation_id = ? ORDER BY id ASC', [id]);
    res.json({ messages: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load messages.', error: err.message });
  }
};
