// Keep unit test output clean and deterministic.
// Snap-ins run in managed environments where log verbosity is configurable;
// during tests we default to the minimal level unless a test explicitly opts in.
process.env['GMAIL_EMAIL_LOG_LEVEL'] = process.env['GMAIL_EMAIL_LOG_LEVEL'] || 'error';

