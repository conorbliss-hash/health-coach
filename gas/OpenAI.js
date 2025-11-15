/**
 * Calls OpenAI Chat Completions and returns text.
 * @param {string} prompt The prompt to send to the API.
 * @returns {string} The text response from the AI.
 */
const OPENAI_MAX_RETRIES = 3;
const OPENAI_BASE_DELAY_MS = 1000;
const OPENAI_TIMEOUT_MS = 15000;

function callOpenAIChat_(prompt, options) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in Script properties.');

  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: (options && options.model) || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a concise helpful assistant.' },
      { role: 'user',   content: prompt }
    ],
    max_tokens: options?.maxTokens ?? 600,
    temperature: options?.temperature ?? 0.3
  };

  const requestOptions = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${apiKey}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const fetchFn = () => {
    const start = Date.now();
    let response;
    try {
      response = UrlFetchApp.fetch(url, requestOptions);
    } catch (err) {
      err.isNetworkError = true;
      throw err;
    }

    const status = response.getResponseCode();
    const elapsed = Date.now() - start;
    if (elapsed > OPENAI_TIMEOUT_MS) {
      const timeoutError = new Error(`OpenAI timeout after ${elapsed}ms`);
      timeoutError.name = 'OpenAITimeoutError';
      timeoutError.status = status;
      timeoutError.elapsed = elapsed;
      throw timeoutError;
    }

    if (status < 200 || status >= 300) {
      const error = new Error(`OpenAI error ${status}: ${response.getContentText()}`);
      error.name = 'OpenAIHttpError';
      error.status = status;
      error.body = response.getContentText();
      throw error;
    }

    return response;
  };

  const response = callWithRetry_(fetchFn, { retries: OPENAI_MAX_RETRIES, baseDelayMs: OPENAI_BASE_DELAY_MS });
  const data = JSON.parse(response.getContentText());
  const text = data.choices?.[0]?.message?.content || '';
  return text.trim();
}

function callWithRetry_(fn, options) {
  const retries = options?.retries ?? 0;
  const baseDelay = options?.baseDelayMs ?? 1000;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return fn();
    } catch (error) {
      const willRetry = attempt < retries && shouldRetryOpenAiError_(error);
      logOpenAiError_(attempt, error, willRetry);
      if (!willRetry) throw error;
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, 30000);
      Utilities.sleep(delay);
      attempt += 1;
    }
  }
  throw new Error('Retry attempts exhausted.');
}

function shouldRetryOpenAiError_(error) {
  if (!error) return false;
  if (error.isNetworkError) return true;
  if (error.name === 'OpenAITimeoutError') return true;
  const status = error.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

function logOpenAiError_(attempt, error, willRetry) {
  const status = typeof error?.status === 'number' ? error.status : 'n/a';
  const message = error?.message || 'Unknown OpenAI error';
  const classification = willRetry ? 'retry' : 'fail';
  const detail = error?.body && error.body.length <= 500 ? error.body : '';
  const line = `[OpenAI][${classification}] attempt=${attempt} status=${status} message=${message}${detail ? ` body=${detail}` : ''}`;
  if (typeof console !== 'undefined' && console.error) {
    console.error(line);
  } else {
    Logger.log(line);
  }
}
